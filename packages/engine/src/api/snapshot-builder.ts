import { behaviourOf } from "../npc/behaviour-def";
import type { NpcState } from "../entities/types";
import type { World } from "../core/world";
import { hitChance } from "../combat/accuracy";
import { HIT_EVENT, playerAttackSpec, playerDefenceRollVs, type HitPayload } from "../systems/combat-events";
import { COMBAT_STYLES } from "../defs/common";
import { combatStyles } from "../combat/weapon-categories";
import { attackProfile } from "../player/attack-profile";
import { activeOverhead } from "../player/prayers";
import type { WorldSnapshot } from "./snapshot";

export function buildSnapshot(world: World, seed: number): WorldSnapshot {
  const p = world.player;
  const dest = p.path[p.path.length - 1];
  const readyIn = (next: number) => Math.max(0, next - world.tick);
  const profile = attackProfile(p, world.content);
  return {
    tick: world.tick,
    seed,
    encounterId: world.encounter.id,
    modifierIds: [...world.modifierIds],
    arena: arenaSnapshot(world.arena),
    player: {
      id: p.id,
      pos: { ...p.pos },
      hitpoints: p.hitpoints,
      maxHitpoints: p.maxHitpoints,
      prayerPoints: p.prayerPoints,
      maxPrayerPoints: p.maxPrayerPoints,
      runEnergy: p.runEnergy,
      running: p.running,
      destination: dest ? { ...dest } : null,
      targetId: p.targetId,
      weapon: {
        name: p.weapon.name,
        category: p.weapon.category,
        style: profile.attackType,
        speedTicks: profile.speedTicks,
        rangeTiles: profile.rangeTiles,
        hasSpecial: !!p.weapon.special,
        specialEnergy: p.weapon.special?.energy ?? null,
      },
      combatStyles: styleListSnapshot(p.weapon.category),
      combatStyleIndex: p.combatStyleIndex,
      activePrayers: [...p.activePrayers],
      overhead: activeOverhead(world, p),
      overheadsLockedFor: readyIn(p.overheadsLockedUntil),
      offence: offence(world),
      defenceRolls: Object.fromEntries(COMBAT_STYLES.map((st) => [st, playerDefenceRollVs(world, p, st)])) as Record<(typeof COMBAT_STYLES)[number], number>,
      hpRegenIn: Math.max(0, (p.activePrayers.some((id) => world.content.prayers.get(id)?.utility === "rapid-heal") ? 50 : 100) - p.hpRegenTimer),
      equipment: Object.fromEntries(Object.entries(p.equipment).flatMap(([k, v]) => (v ? [[k, { ...v }]] : []))),
      inventory: p.inventory.map((s) => (s ? { ...s } : null)),
      baseLevels: { ...p.stats },
      levels: { ...p.levels },
      bonuses: { ...p.bonuses, attack: { ...p.bonuses.attack }, defence: { ...p.bonuses.defence } },
      eatReadyIn: readyIn(p.foodReadyTick),
      comboReadyIn: readyIn(p.comboReadyTick),
      drinkReadyIn: readyIn(p.potionReadyTick),
      specialEnergy: p.specialEnergy,
      specialArmed: p.specialArmed,
      autocastSpellId: p.autocastSpellId,
      autoRetaliate: p.autoRetaliate,
      nextAttackTick: p.nextAttackTick,
      attackReadyIn: readyIn(p.nextAttackTick),
      life: p.life,
      respawnTick: p.respawnTick,
    },
    npcs: world.npcs.map((n) => ({
      id: n.id,
      defId: n.defId,
      name: n.name,
      pos: { ...n.pos },
      size: n.size,
      hitpoints: n.hitpoints,
      maxHitpoints: n.maxHitpoints,
      levels: { attack: n.levels.attack, strength: n.levels.strength, defence: n.levels.defence, ranged: n.levels.ranged, magic: n.levels.magic },
      alive: n.life === "alive",
      life: n.life,
      respawnTick: n.respawnTick,
      targetId: n.targetId,
      nextAttackTick: n.nextAttackTick,
      attackReadyIn: readyIn(n.nextAttackTick),
      phase: phaseInfo(world, n),
      enraged: n.boss.enraged,
      invulnerable: world.tick < n.boss.invulnerableUntil,
    })),
    hazards: world.hazards.map((h) => ({
      id: h.id,
      sourceId: h.sourceId,
      name: h.name,
      tiles: h.tiles.map((t) => ({ ...t })),
      state: world.tick < h.detonateTick ? ("warning" as const) : ("burning" as const),
      detonateTick: h.detonateTick,
      endTick: Math.max(h.detonateTick, h.lingerUntil),
    })),
    projectiles: world.scheduler
      .serialize()
      .filter((e) => e.kind === HIT_EVENT && (e.payload as HitPayload).projectile)
      .map((e) => {
        const h = e.payload as HitPayload;
        return {
          id: h.projectile!.id,
          sourceId: h.sourceId,
          targetId: h.targetId,
          visualId: h.projectile!.visualId,
          style: h.style,
          launchTick: h.projectile!.launchTick,
          landTick: e.dueTick,
        };
      }),
    outcome: world.outcome ? { ...world.outcome } : null,
  };
}

function offence(world: World) {
  const p = world.player;
  const npc = world.npcs.find((n) => n.id === p.targetId && n.life === "alive") ?? world.npcs.find((n) => n.life === "alive");
  if (!npc) return null;
  const spec = playerAttackSpec(world, p, npc);
  return {
    npcId: npc.id,
    style: spec.style,
    attackRoll: spec.attackRoll,
    defenceRoll: spec.defenceRoll,
    maxHit: spec.maxHit,
    hitChance: Math.round(hitChance(spec.attackRoll, spec.defenceRoll) * 10000) / 10000,
  };
}

function phaseInfo(world: World, n: NpcState) {
  const phases = behaviourOf(world.content.npcs.get(n.defId)!).phases;
  const i = Math.min(n.boss.phaseIndex, phases.length - 1);
  return { index: i, count: phases.length, id: phases[i]!.id, name: phases[i]!.name ?? null };
}

/*
 * Parts of the snapshot that never change during a fight are built once and
 * shared (frozen) between ticks, so a long fight's history does not hold
 * thousands of identical copies.
 */
const arenaSnapshots = new WeakMap<World["arena"], WorldSnapshot["arena"]>();
function arenaSnapshot(arena: World["arena"]): WorldSnapshot["arena"] {
  let snap = arenaSnapshots.get(arena);
  if (!snap) {
    snap = deepFreeze({ id: arena.id, width: arena.width, height: arena.height, blocked: arena.blocked.map((t) => ({ ...t })) });
    arenaSnapshots.set(arena, snap);
  }
  return snap;
}

const styleLists = new Map<string, WorldSnapshot["player"]["combatStyles"]>();
function styleListSnapshot(category: Parameters<typeof combatStyles>[0]): WorldSnapshot["player"]["combatStyles"] {
  let list = styleLists.get(category);
  if (!list) {
    list = deepFreeze(combatStyles(category).map((s) => ({ name: s.name, attackType: s.attackType, stance: s.stance })));
    styleLists.set(category, list);
  }
  return list;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

