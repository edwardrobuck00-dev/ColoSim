import { applyFactor } from "../combat/factors";
import type { World } from "../core/world";
import type { AttackDef } from "../defs/attack";
import type { BossSpecialDef, PhaseDef } from "../defs/behaviour";
import type { NpcDef } from "../defs/npc";
import type { NpcState, PlayerState } from "../entities/types";
import type { AttackSpec } from "../systems/combat-events";
import type { SpecialContext, SpecialKindRegistry } from "./specials";
import { behaviourOf, currentPhase } from "./behaviour-def";

export { behaviourOf, currentPhase, npcDefenceBonuses } from "./behaviour-def";

/**
 * Runs data-driven NPC behaviour (defs/behaviour.ts): phase transitions,
 * enrage, attack patterns and special attacks. Nothing here knows about any
 * particular boss.
 */

const hpPercent = (npc: NpcState) => (npc.hitpoints * 100) / Math.max(1, npc.maxHitpoints);

/**
 * Moves to the deepest phase whose hitpoint threshold has been reached.
 * Phases only advance (healing never moves a boss back a phase).
 */
export function updatePhase(world: World, npc: NpcState, def: NpcDef): void {
  const phases = behaviourOf(def).phases;
  let target = npc.boss.phaseIndex;
  for (let i = npc.boss.phaseIndex + 1; i < phases.length; i++) {
    const at = phases[i]!.atHpPercent;
    if (at !== undefined && hpPercent(npc) <= at) target = i;
  }
  if (target !== npc.boss.phaseIndex) enterPhase(world, npc, def, target);
}

export function enterPhase(world: World, npc: NpcState, def: NpcDef, index: number): void {
  const phase = behaviourOf(def).phases[index]!;
  const b = npc.boss;
  b.phaseIndex = index;
  b.phaseStartTick = world.tick;
  b.attackCount = 0;
  b.specialCount = 0;
  b.switchAttackId = null;
  b.switchCount = 0;
  npc.rotationIndex = 0;
  world.events.push({
    type: "BossPhaseChanged", npcId: npc.id, phaseIndex: index, phaseId: phase.id, name: phase.name ?? null,
    hitpoints: npc.hitpoints, maxHitpoints: npc.maxHitpoints, threshold: phase.atHpPercent ?? null,
  });

  const e = phase.onEnter;
  if (e.say) say(world, npc, e.say);
  if (e.message) world.events.push({ type: "MechanicMessage", mechanicId: `${def.id}.phase`, text: e.message });
  if (e.invulnerableTicks > 0) b.invulnerableUntil = Math.max(b.invulnerableUntil, world.tick + e.invulnerableTicks);
  if (e.pauseTicks > 0) {
    b.busyUntil = Math.max(b.busyUntil, world.tick + e.pauseTicks);
    npc.nextAttackTick = Math.max(npc.nextAttackTick, b.busyUntil);
  }
  if (e.healPercent > 0) npc.hitpoints = Math.min(npc.maxHitpoints, npc.hitpoints + Math.floor((npc.maxHitpoints * e.healPercent) / 100));
  if (e.moveTo) {
    const to = world.arena.spawns[e.moveTo];
    if (to) {
      const from = npc.pos;
      npc.pos = { ...to };
      world.events.push({ type: "EntityMoved", entityId: npc.id, from: { ...from }, to: { ...to }, running: false, teleport: true });
    }
  }
  b.pendingSpecial = e.special ?? null;
}

/** Enrages once: below the hitpoint threshold or after the time limit. */
export function updateEnrage(world: World, npc: NpcState, def: NpcDef): void {
  const enrage = behaviourOf(def).enrage;
  if (!enrage || npc.boss.enraged) return;
  const byHp = enrage.atHpPercent !== undefined && hpPercent(npc) <= enrage.atHpPercent;
  const byTime = enrage.afterTicks !== undefined && world.tick >= enrage.afterTicks;
  if (!byHp && !byTime) return;
  npc.boss.enraged = true;
  world.events.push({
    type: "BossEnraged", npcId: npc.id, cause: byHp ? "hitpoints" : "time", hitpoints: npc.hitpoints, maxHitpoints: npc.maxHitpoints,
    threshold: enrage.atHpPercent ?? null, afterTicks: enrage.afterTicks ?? null,
  });
  if (enrage.say) say(world, npc, enrage.say);
  if (enrage.message) world.events.push({ type: "MechanicMessage", mechanicId: `${def.id}.enrage`, text: enrage.message });
}

export function say(world: World, npc: NpcState, text: string): void {
  world.events.push({ type: "NpcSaid", entityId: npc.id, text });
}

/** Attack IDs the phase can use as normal attacks (for range checks and movement). */
export function phaseAttackIds(phase: PhaseDef): string[] {
  const p = phase.pattern;
  const ids = p.type === "random" ? p.attacks.map((a) => a.attack) : [...p.attacks];
  if (phase.closeRange) ids.push(phase.closeRange.attack);
  return ids;
}

/**
 * The next normal attack: the close-range attack when it applies, else the
 * phase's pattern among attacks in range. Null if nothing is in range.
 */
export interface AttackChoice {
  attack: AttackDef;
  /** Why the pattern picked it, for the event log. */
  reason: string;
}

export function nextAttack(world: World, npc: NpcState, phase: PhaseDef, inRange: (a: AttackDef) => boolean): AttackChoice | null {
  const get = (id: string) => world.content.attacks.get(id)!;
  const rng = world.rng.get("ai");
  const label = phase.name ?? phase.id;
  const choose = (attack: AttackDef, why: string): AttackChoice => ({ attack, reason: `${label}: ${why}` });
  if (phase.closeRange) {
    const close = get(phase.closeRange.attack);
    if (inRange(close) && (phase.closeRange.chance >= 1 || rng.int(10_000) < phase.closeRange.chance * 10_000)) {
      const pct = Math.round(phase.closeRange.chance * 100);
      return choose(close, `you were in range of ${close.name ?? close.id}${pct < 100 ? ` (used ${pct}% of the time)` : ""}`);
    }
  }
  const p = phase.pattern;
  switch (p.type) {
    case "rotation": {
      for (let i = 0; i < p.attacks.length; i++) {
        const idx = (npc.rotationIndex + i) % p.attacks.length;
        const a = get(p.attacks[idx]!);
        if (inRange(a)) {
          npc.rotationIndex = idx + 1;
          return choose(a, `rotation step ${idx + 1} of ${p.attacks.length}${i > 0 ? " (earlier steps out of range)" : ""}`);
        }
      }
      return null;
    }
    case "random": {
      const options = p.attacks.filter((o) => inRange(get(o.attack)));
      const total = options.reduce((s, o) => s + o.weight, 0);
      if (options.length === 0 || total <= 0) return null;
      let r = (rng.int(1_000_000) / 1_000_000) * total;
      for (const o of options) {
        r -= o.weight;
        if (r < 0) return choose(get(o.attack), `random pick (weight ${o.weight} of ${total})`);
      }
      const last = options[options.length - 1]!;
      return choose(get(last.attack), `random pick (weight ${last.weight} of ${total})`);
    }
    case "switch": {
      const b = npc.boss;
      const usable = p.attacks.filter((id) => inRange(get(id)));
      if (usable.length === 0) return null;
      const current = b.switchAttackId;
      if (!current || !usable.includes(current) || b.switchCount >= p.every) {
        let next: string;
        if (p.order === "random") {
          const others = usable.filter((id) => id !== current);
          const pool = others.length > 0 ? others : usable;
          next = pool[rng.int(pool.length)]!;
        } else {
          const start = current ? p.attacks.indexOf(current) + 1 : 0;
          next = usable[0]!;
          for (let i = 0; i < p.attacks.length; i++) {
            const id = p.attacks[(start + i) % p.attacks.length]!;
            if (usable.includes(id)) {
              next = id;
              break;
            }
          }
        }
        b.switchAttackId = next;
        b.switchCount = 0;
      }
      b.switchCount++;
      const a = get(b.switchAttackId!);
      return choose(a, `${a.name ?? a.id} ${b.switchCount} of ${p.every} before switching`);
    }
  }
}

/** True if this attack (counting from 1 in the phase) should be a special. */
export function specialDue(phase: PhaseDef, npc: NpcState): boolean {
  return !!phase.specials && (npc.boss.attackCount + 1) % phase.specials.every === 0;
}

export function pickSpecial(world: World, npc: NpcState, def: NpcDef, phase: PhaseDef): BossSpecialDef | null {
  const s = phase.specials;
  if (!s) return null;
  const id = s.order === "random" ? s.ids[world.rng.get("ai").int(s.ids.length)]! : s.ids[npc.boss.specialCount % s.ids.length]!;
  return def.specials.find((x) => x.id === id) ?? null;
}

/** Attack speed after the phase override and enrage. */
export function attackSpeed(def: NpcDef, npc: NpcState, base: number): number {
  const phase = currentPhase(def, npc);
  const enrage = behaviourOf(def).enrage;
  const speed = phase.attackSpeedTicks ?? base;
  return Math.max(1, speed + (npc.boss.enraged && enrage ? enrage.attackSpeedDelta : 0));
}

/** Applies phase speed and enrage multipliers to an NPC attack. */
export function applyBehaviourToSpec(def: NpcDef, npc: NpcState, spec: AttackSpec): AttackSpec {
  const enrage = behaviourOf(def).enrage;
  const out = { ...spec, speedTicks: attackSpeed(def, npc, spec.speedTicks) };
  if (npc.boss.enraged && enrage) {
    out.maxHit = applyFactor(out.maxHit, enrage.maxHitMultiplier);
    out.attackRoll = applyFactor(out.attackRoll, enrage.accuracyMultiplier);
    out.reason = `${out.reason} (enraged)`;
  }
  return out;
}

/** Builds the restricted context a special attack kind acts through. */
export function specialContext(
  world: World,
  npc: NpcState,
  target: PlayerState,
  startAttack: (attackId: string, delayTicks: number) => void,
  specialName = "special attack",
): SpecialContext {
  return {
    tick: world.tick,
    npc,
    target,
    arena: { width: world.arena.width, height: world.arena.height },
    isWalkable: (t) => world.grid.isWalkable(t),
    rng: world.rng.get("ai"),
    attack: (attackId, delayTicks = 0) => startAttack(attackId, delayTicks),
    hazard: (h) => {
      const id = `hz-${world.nextId++}`;
      const detonateTick = world.tick + Math.max(1, h.delayTicks);
      const lingerUntil = h.lingerTicks > 0 ? detonateTick + h.lingerTicks : detonateTick;
      world.hazards.push({
        id, sourceId: npc.id, name: h.name === "area" ? specialName : h.name, tiles: h.tiles.map((t) => ({ ...t })), detonateTick,
        damageMin: h.damage[0], damageMax: h.damage[1], lingerUntil, lingerDamage: h.lingerDamage,
      });
      world.events.push({ type: "HazardPlaced", hazardId: id, sourceId: npc.id, name: h.name === "area" ? specialName : h.name, tiles: h.tiles.map((t) => ({ ...t })), detonateTick, lingerUntil });
    },
    say: (text) => say(world, npc, text),
  };
}

/** Every attack ID an NPC can use: legacy list, phase patterns, close-range attacks and special attacks. */
export function npcAttackRefs(def: NpcDef, specialKinds?: SpecialKindRegistry): string[] {
  const ids = new Set<string>(def.attacks);
  for (const phase of def.behaviour?.phases ?? []) for (const id of phaseAttackIds(phase)) ids.add(id);
  for (const sp of def.specials) {
    const kind = specialKinds?.get(sp.kind);
    const parsed = kind?.params.safeParse(sp.params);
    if (kind?.attackRefs && parsed?.success) for (const id of kind.attackRefs(parsed.data)) ids.add(id);
  }
  return [...ids];
}
