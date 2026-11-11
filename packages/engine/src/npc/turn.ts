import { chaseStep, stepOutStep } from "../ai/movement";
import { footprintContains } from "../map/tiles";
import { inAttackRange } from "../combat/range";
import type { World } from "../core/world";
import type { AttackDef } from "../defs/attack";
import type { BossSpecialDef } from "../defs/behaviour";
import type { NpcDef } from "../defs/npc";
import { isAlive, type NpcState, type PlayerState } from "../entities/types";
import { NPC_ATTACK_EVENT, npcAttackSpec, startAttack, type DelayedAttackPayload } from "../systems/combat-events";
import {
  applyBehaviourToSpec, attackSpeed, behaviourOf, currentPhase, nextAttack, phaseAttackIds, pickSpecial,
  specialContext, specialDue, updateEnrage, updatePhase,
} from "./behaviour";

/**
 * One NPC's turn, driven entirely by its behaviour data:
 *  1. phase transition and enrage checks (hitpoints and time)
 *  2. target the player
 *  3. busy (phase transition pause)? do nothing
 *  4. no phase attack in range? move (chase) and stop
 *  5. attack cooldown not ready? stop
 *  6. a queued phase-entry special, or every N-th attack a special; otherwise
 *     the close-range attack or the phase's pattern picks a normal attack
 */
export function runNpcTurn(world: World, npc: NpcState): void {
  const def = world.content.npcs.get(npc.defId)!;
  const behaviour = behaviourOf(def);
  updatePhase(world, npc, def);
  updateEnrage(world, npc, def);

  const phase = currentPhase(def, npc);
  const attackIds = phaseAttackIds(phase);
  const canAct = attackIds.length > 0 || phase.movement !== "stationary" || def.specials.length > 0;
  if (!canAct && behaviour.phases.length === 1) return;

  const p = world.player;
  const wanted = isAlive(p) ? p.id : null;
  if (npc.targetId !== wanted) {
    npc.targetId = wanted;
    world.events.push({ type: "TargetChanged", entityId: npc.id, targetId: wanted });
  }
  if (!wanted || world.tick < npc.boss.busyUntil) return;

  const attacks = attackIds.map((id) => world.content.attacks.get(id)!);
  const npcFp = { pos: npc.pos, size: npc.size };
  const playerFp = { pos: p.pos, size: 1 };
  const inRange = (a: AttackDef) => inAttackRange(npcFp, playerFp, a.rangeTiles, world.grid);

  // A player standing under the NPC cannot be attacked; a moving NPC steps out first.
  if (phase.movement === "chase" && footprintContains(npc.pos, npc.size, p.pos)) {
    const next = stepOutStep(world.grid, npc.pos, npc.size, p.pos, (n) => world.rng.get("ai").int(n));
    if (next) {
      const from = npc.pos;
      npc.pos = next;
      world.events.push({ type: "EntityMoved", entityId: npc.id, from: { ...from }, to: { ...next }, running: false });
    }
    return;
  }

  const queued = npc.boss.pendingSpecial;
  if (!queued && !attacks.some(inRange)) {
    if (phase.movement === "chase") {
      const next = chaseStep(world.grid, npc.pos, npc.size, p.pos);
      if (next) {
        const from = npc.pos;
        npc.pos = next;
        world.events.push({ type: "EntityMoved", entityId: npc.id, from: { ...from }, to: { ...next }, running: false });
      }
    }
    return;
  }

  if (world.tick < npc.nextAttackTick) return;

  if (queued) {
    npc.boss.pendingSpecial = null;
    const special = def.specials.find((s) => s.id === queued);
    if (special) {
      performSpecial(world, npc, def, special, p, `opening attack of the ${phase.name ?? phase.id} phase`);
      return;
    }
  }
  if (specialDue(phase, npc)) {
    const special = pickSpecial(world, npc, def, phase);
    if (special) {
      npc.boss.specialCount++;
      npc.boss.attackCount++;
      performSpecial(world, npc, def, special, p, `every ${ordinal(phase.specials!.every)} attack in the ${phase.name ?? phase.id} phase (attack ${npc.boss.attackCount})`);
      return;
    }
  }

  const choice = nextAttack(world, npc, phase, inRange);
  if (!choice) return;
  npc.boss.attackCount++;
  const spec = npcAttackSpec(world, npc, choice.attack, p);
  startAttack(world, npc, p, applyBehaviourToSpec(def, npc, { ...spec, reason: choice.reason }));
}

/** Uses a special attack through its kind's handler, then sets the attack cooldown. */
export function performSpecial(world: World, npc: NpcState, def: NpcDef, special: BossSpecialDef, target: PlayerState, reason: string): void {
  const kind = world.content.specialKinds.get(special.kind);
  if (!kind) return;
  const params = kind.params.parse(special.params);
  world.events.push({ type: "BossSpecialUsed", npcId: npc.id, specialId: special.id, name: special.name, reason });
  world.events.push({
    type: "AttackStarted", attackerId: npc.id, targetId: target.id, attackId: special.id, style: "typeless",
    animationCue: special.animationCue, special: true, reason: `${special.name}: ${reason}`,
  });
  if (special.say) world.events.push({ type: "NpcSaid", entityId: npc.id, text: special.say });

  const ctx = specialContext(world, npc, target, (attackId, delayTicks) => {
    const why = `part of ${special.name}${delayTicks > 0 ? ` (${delayTicks} ticks after it started)` : ""}`;
    if (delayTicks <= 0) startSubAttack(world, npc, def, attackId, why);
    else world.scheduler.schedule<DelayedAttackPayload>(world.tick + delayTicks, NPC_ATTACK_EVENT, { npcId: npc.id, attackId, reason: why });
  }, special.name);
  kind.perform(ctx, params);

  const phase = currentPhase(def, npc);
  const firstAttack = phaseAttackIds(phase).map((id) => world.content.attacks.get(id)).find(Boolean);
  const base = special.cooldownTicks ?? phase.attackSpeedTicks ?? firstAttack?.speedTicks ?? 5;
  npc.nextAttackTick = world.tick + (special.cooldownTicks ?? attackSpeed(def, npc, base));
}

/** An attack started by a special (now or later): does not change the NPC's own attack cooldown. */
function startSubAttack(world: World, npc: NpcState, def: NpcDef, attackId: string, reason: string): void {
  const p = world.player;
  const attack = world.content.attacks.get(attackId);
  if (!attack || !isAlive(npc) || !isAlive(p)) return;
  const cooldown = npc.nextAttackTick;
  startAttack(world, npc, p, applyBehaviourToSpec(def, npc, { ...npcAttackSpec(world, npc, attack, p), reason }));
  npc.nextAttackTick = cooldown;
}

/** Starts an attack a special scheduled for this tick. */
export function startDelayedAttack(world: World, payload: DelayedAttackPayload): void {
  const npc = world.npcs.find((n) => n.id === payload.npcId);
  if (!npc) return;
  startSubAttack(world, npc, world.content.npcs.get(npc.defId)!, payload.attackId, payload.reason ?? "delayed attack");
}

const ordinal = (n: number) => (n === 1 ? "" : `${n}${n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`);
