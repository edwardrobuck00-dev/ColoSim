import { attackRoll, hitChance, npcAttackRoll, npcDefenceRoll, playerDefenceRoll, scaleRoll } from "../combat/accuracy";
import { rollHit } from "../combat/damage";
import { effectiveLevel, prayedLevelWithMinimum } from "../combat/effective-level";
import { applyDamageFactors, magicMaxHit, PLAYER_DAMAGE_CAP, strengthMaxHit } from "../combat/max-hit";
import { bestFactor, combinedDefenceFactor, NPC_PROTECTION_DAMAGE, totalMagicDamageTenths, type PrayerEffects } from "../combat/prayer";
import { deactivatePrayers, hasUtility } from "../player/prayers";
import { footprintDistance } from "../combat/range";
import { drainByPercent, drainInOrder } from "../combat/special-attack";
import { stanceBonus, type CombatClass } from "../combat/stances";
import { combatStyleAt } from "../combat/weapon-categories";
import { hitDelayTicks, isMelee } from "../combat/timing";
import { applyFactor } from "../combat/factors";
import type { World } from "../core/world";
import { engineContext, runHook } from "../mechanics/runtime";
import type { AttackDef } from "../defs/attack";
import type { CombatStats, CombatStyle } from "../defs/common";
import type { SpecialEffect } from "../defs/special-attack";
import { isAlive, type EntityState, type NpcState, type PlayerState } from "../entities/types";
import { PIPELINES, type PipelineInfo } from "../mechanics/pipelines";
import { attackProfile } from "../player/attack-profile";
import { poweredStaffMaxHit } from "../player/weapon";
import { killEntity } from "./lifecycle";
import { npcDefenceBonuses } from "../npc/behaviour-def";
import type { HitDetail, HitStyle } from "../api/events";

/**
 * Combat event processing. Every attack follows the same stages:
 *
 *  1. startAttack (on the attack tick)
 *     - attack roll, defence roll and max hit come from the OSRS formulas in
 *       combat/ (prayers, stances, equipment, special attacks), then pass
 *       through pipelines so mechanics can adjust them
 *     - accuracy and damage are rolled now, with the "combat" RNG stream
 *     - AttackStarted (+ ProjectileLaunched); onAttackStart hooks
 *     - each hit is scheduled for landTick = tick + hit delay
 *  2. applyHit, via runDueEvents (on the land tick)
 *     - dropped if the target is no longer alive
 *     - protection prayers (checked as the hit lands; see uncertainty U4)
 *     - "damage.incoming" pipeline, capped at remaining hitpoints
 *     - special attack effects (level drains); HitLanded; onHitLanded hooks
 *     - 0 hitpoints starts the death sequence (lifecycle.ts)
 */

export const HIT_EVENT = "hit";

export interface HitPayload {
  sourceId: string;
  targetId: string;
  attackId: string;
  damage: number;
  maxHit: number;
  style: CombatStyle;
  /** Combat class a protection prayer must cover to block this hit. */
  protectableAs: CombatClass;
  /** Fraction of damage that pierces a matching protection prayer. */
  prayerPenetration: number;
  /** Special attack effects applied when this hit lands. */
  effects: SpecialEffect[];
  projectile: { id: string; visualId: string; launchTick: number } | null;
  /** The roll behind this hit, for HitLanded's detail. */
  roll: { startedTick: number; special: boolean; reason: string; attackRoll: number; defenceRoll: number; hitChance: number; accurate: boolean; rolled: number };
}

export interface AttackSpec {
  attackId: string;
  style: CombatStyle;
  cls: CombatClass;
  attackRoll: number;
  defenceRoll: number;
  maxHit: number;
  minHit: number;
  hits: number;
  linkedAccuracy: boolean;
  speedTicks: number;
  projectileVisualId: string | null;
  animationCue: string;
  special: boolean;
  effects: SpecialEffect[];
  prayerPenetration: number;
  /** Player hits are capped at 200. */
  damageCap: number | null;
  /** Why this attack happened, for the event log (e.g. "Lash with Abyssal whip", "Rotation 2/3"). */
  reason: string;
}

const footprint = (e: EntityState) => ({ pos: e.pos, size: e.kind === "player" ? 1 : e.size });

export const classOf = (style: CombatStyle): CombatClass => (isMelee(style) ? "melee" : style === "ranged" ? "ranged" : "magic");

function prayerEffects(world: World, p: PlayerState): PrayerEffects[] {
  return p.activePrayers.flatMap((id) => {
    const def = world.content.prayers.get(id);
    return def ? [def.effects] : [];
  });
}

/** NPC defence roll against a style, using the NPC's current (possibly drained) levels. */
function npcDefence(world: World, npc: NpcState, style: CombatStyle): number {
  const def = world.content.npcs.get(npc.defId)!;
  const level = style === "magic" ? npc.levels.magic : npc.levels.defence;
  return npcDefenceRoll(level, npcDefenceBonuses(def, npc)[style]);
}

/**
 * The player's attack against an NPC. `useSpecial` applies the weapon's
 * special attack (the caller has already checked and spent the energy).
 */
export function playerAttackSpec(world: World, p: PlayerState, npc: NpcState, useSpecial = false): AttackSpec {
  const prof = attackProfile(p, world.content);
  const effects = prayerEffects(world, p);
  // Formulas use current levels: potions boost them, brews and drains lower them.
  const s = p.levels;
  let atk: number;
  let maxHit: number;

  if (prof.cls === "melee") {
    const effAtt = effectiveLevel({ level: s.attack, prayer: bestFactor(effects, "meleeAccuracy"), stanceBonus: prof.bonus.accuracy });
    const strPrayer = bestFactor(effects, "meleeStrength");
    const minGain = Math.max(0, ...effects.map((e) => (e.meleeStrength ? (e.minimumStrengthGain ?? 0) : 0)));
    const prayedStr = prayedLevelWithMinimum(s.strength, strPrayer, minGain);
    const effStr = effectiveLevel({ level: prayedStr, stanceBonus: prof.bonus.strength });
    atk = attackRoll(effAtt, p.bonuses.attack[prof.attackType]);
    maxHit = strengthMaxHit(effStr, p.bonuses.meleeStrength);
  } else if (prof.cls === "ranged") {
    const effAtt = effectiveLevel({ level: s.ranged, prayer: bestFactor(effects, "rangedAccuracy"), stanceBonus: prof.bonus.accuracy });
    const effStr = effectiveLevel({ level: s.ranged, prayer: bestFactor(effects, "rangedStrength"), stanceBonus: prof.bonus.strength });
    atk = attackRoll(effAtt, p.bonuses.attack.ranged);
    maxHit = strengthMaxHit(effStr, p.bonuses.rangedStrength);
  } else {
    const effMagic = effectiveLevel({ level: s.magic, prayer: bestFactor(effects, "magicAccuracy"), stanceBonus: prof.bonus.accuracy, base: 9 });
    atk = attackRoll(effMagic, p.bonuses.attack.magic);
    const base = prof.spell ? prof.spell.baseMaxHit : poweredStaffMaxHit(p.weapon, s.magic);
    const dmgTenths = Math.round(p.bonuses.magicDamagePercent * 10) + totalMagicDamageTenths(effects);
    maxHit = magicMaxHit(base, dmgTenths);
  }

  const spec = useSpecial ? p.weapon.special : null;
  let defenceStyle: CombatStyle = prof.attackType;
  if (spec) {
    atk = scaleRoll(atk, spec.accuracy);
    maxHit = applyDamageFactors(maxHit, spec.damage);
    defenceStyle = spec.defenceStyle ?? defenceStyle;
  }

  return {
    attackId: prof.spell?.id ?? p.weapon.itemId ?? "unarmed",
    style: defenceStyle,
    cls: prof.cls,
    attackRoll: atk,
    defenceRoll: npcDefence(world, npc, defenceStyle),
    maxHit,
    minHit: 0,
    hits: spec?.hits ?? 1,
    linkedAccuracy: spec?.linkedAccuracy ?? false,
    speedTicks: prof.speedTicks,
    projectileVisualId: prof.projectileVisualId,
    animationCue: spec ? (spec.animationCue ?? "attack.special") : prof.animationCue,
    special: !!spec,
    effects: spec?.effects ?? [],
    prayerPenetration: 0,
    damageCap: PLAYER_DAMAGE_CAP,
    reason: spec
      ? `Special attack: ${spec.name} (${p.weapon.name})`
      : prof.spell
        ? `Casting ${prof.spell.name} (${prof.style.name})`
        : `${prof.style.name} (${prof.stance}) with ${p.weapon.name}`,
  };
}

/**
 * The player's defence roll against an attack style: current Defence (and
 * Magic vs magic), defence prayers added together, the stance bonus and
 * equipment defence. Before encounter pipelines.
 */
export function playerDefenceRollVs(world: World, p: PlayerState, style: CombatStyle): number {
  const effects = prayerEffects(world, p);
  const playerStyle = combatStyleAt(p.weapon.category, p.combatStyleIndex);
  return playerDefenceRoll({
    defence: p.levels.defence,
    magic: p.levels.magic,
    defencePrayer: combinedDefenceFactor(effects, "defence"),
    magicDefencePrayer: bestFactor(effects, "magicDefence"),
    stanceBonus: stanceBonus(playerStyle.stance, playerStyle.cls).defence,
    equipmentBonus: p.bonuses.defence[style],
    vsMagic: style === "magic",
  });
}

/** An NPC attack against the player, rolled against the player's real defence roll. */
export function npcAttackSpec(world: World, npc: NpcState, attack: AttackDef, p: PlayerState): AttackSpec {
  const style = attack.style;
  const cls = classOf(style);
  const level = cls === "melee" ? npc.levels.attack : cls === "ranged" ? npc.levels.ranged : npc.levels.magic;
  const defRoll = playerDefenceRollVs(world, p, style);
  return {
    attackId: attack.id,
    style,
    cls,
    attackRoll: npcAttackRoll(level, attack.accuracyBonus),
    defenceRoll: defRoll,
    maxHit: attack.maxHit,
    minHit: 0,
    hits: 1,
    linkedAccuracy: false,
    speedTicks: attack.speedTicks,
    projectileVisualId: attack.projectile?.visualId ?? null,
    animationCue: attack.animationCue,
    special: false,
    effects: [],
    prayerPenetration: attack.prayerPenetration,
    damageCap: null,
    reason: attack.name ?? attack.id,
  };
}

/**
 * Starts an attack on this tick and sets the attacker's cooldown.
 * Returns the tick on which the hit(s) will land.
 */
export function startAttack(world: World, attacker: EntityState, target: EntityState, spec: AttackSpec): number {
  const ctx = engineContext(world);
  const info: PipelineInfo = { attackerId: attacker.id, targetId: target.id, style: spec.style, attackId: spec.attackId };
  const atk = world.pipelines.run(PIPELINES.attackRoll, spec.attackRoll, ctx, info);
  const def = world.pipelines.run(PIPELINES.defenceRoll, spec.defenceRoll, ctx, info);
  const maxHit = Math.max(0, world.pipelines.run(PIPELINES.maxHit, spec.maxHit, ctx, info));
  const speed = Math.max(1, world.pipelines.run(PIPELINES.attackSpeed, spec.speedTicks, ctx, info));
  const rng = world.rng.get("combat");

  const landTick = world.tick + hitDelayTicks(spec.style, footprintDistance(footprint(attacker), footprint(target)));
  attacker.nextAttackTick = world.tick + speed;

  world.events.push({
    type: "AttackStarted",
    attackerId: attacker.id,
    targetId: target.id,
    attackId: spec.attackId,
    style: spec.style,
    animationCue: spec.animationCue,
    special: spec.special,
    reason: spec.reason,
  });

  let projectile: HitPayload["projectile"] = null;
  if (spec.projectileVisualId && landTick > world.tick) {
    projectile = { id: `proj-${world.nextId++}`, visualId: spec.projectileVisualId, launchTick: world.tick };
    world.events.push({
      type: "ProjectileLaunched",
      projectileId: projectile.id,
      sourceId: attacker.id,
      targetId: target.id,
      visualId: projectile.visualId,
      style: spec.style,
      launchTick: world.tick,
      landTick,
    });
  }

  let firstAccurate = true;
  for (let i = 0; i < spec.hits; i++) {
    let roll = rollHit(rng, atk, def, maxHit, spec.minHit);
    if (spec.linkedAccuracy && i > 0) {
      roll = firstAccurate ? { accurate: true, damage: rng.range(Math.min(spec.minHit, maxHit), maxHit) } : { accurate: false, damage: 0 };
    }
    if (i === 0) firstAccurate = roll.accurate;
    const damage = spec.damageCap === null ? roll.damage : Math.min(spec.damageCap, roll.damage);
    const payload: HitPayload = {
      sourceId: attacker.id,
      targetId: target.id,
      attackId: spec.attackId,
      damage,
      maxHit,
      style: spec.style,
      protectableAs: spec.cls,
      prayerPenetration: spec.prayerPenetration,
      effects: i === 0 ? spec.effects : [],
      projectile: i === 0 ? projectile : null,
      roll: {
        startedTick: world.tick, special: spec.special, reason: spec.reason, attackRoll: atk, defenceRoll: def,
        hitChance: hitChance(atk, def), accurate: roll.accurate, rolled: roll.damage,
      },
    };
    world.scheduler.schedule(landTick, HIT_EVENT, payload);
  }
  runHook(world, "onAttackStart", { attackerId: attacker.id, targetId: target.id, attackId: spec.attackId, style: spec.style, landTick });
  return landTick;
}

export function entityById(world: World, id: string): EntityState | undefined {
  return id === world.player.id ? world.player : world.npcs.find((n) => n.id === id);
}

/** True if the player has a protection prayer up against `cls`. */
function isProtected(world: World, p: PlayerState, cls: CombatClass): boolean {
  return p.activePrayers.some((id) => world.content.prayers.get(id)?.protects === cls);
}

const SKILL_KEY: Record<string, keyof CombatStats> = {
  defence: "defence", strength: "strength", attack: "attack", magic: "magic", ranged: "ranged",
};

function applyEffects(world: World, target: EntityState, effects: SpecialEffect[], damage: number): void {
  if (target.kind !== "npc" || effects.length === 0) return;
  for (const effect of effects) {
    if (damage <= 0) continue; // drains need a damaging hit
    if (effect.type === "drain-defence-percent") {
      const from = target.levels.defence;
      target.levels.defence = drainByPercent(from, effect.percent);
      world.events.push({ type: "LevelDrained", entityId: target.id, skill: "defence", from, to: target.levels.defence });
    } else {
      const keys = effect.order.map((k) => SKILL_KEY[k]!);
      const before = { ...target.levels };
      const drained = drainInOrder(before as Record<keyof CombatStats, number>, keys, damage);
      for (const k of keys) {
        if (drained[k] !== before[k]) {
          world.events.push({ type: "LevelDrained", entityId: target.id, skill: k, from: before[k], to: drained[k] });
        }
      }
      target.levels = drained;
    }
  }
}

/** Scheduler kind for an NPC attack that starts on a later tick (boss volleys). */
export const NPC_ATTACK_EVENT = "npc-attack";

export interface DelayedAttackPayload {
  npcId: string;
  attackId: string;
  reason?: string;
}

/**
 * Runs every scheduled event due on this tick, in the order they were
 * scheduled: hits land, and delayed NPC attacks start.
 */
export function runDueEvents(world: World, startDelayedAttack: (payload: DelayedAttackPayload) => void): void {
  for (const ev of world.scheduler.takeDue(world.tick)) {
    if (ev.kind === HIT_EVENT) applyHit(world, ev.payload as HitPayload);
    else if (ev.kind === NPC_ATTACK_EVENT) startDelayedAttack(ev.payload as DelayedAttackPayload);
  }
}

/** Hits on targets that are no longer alive are dropped. */
function applyHit(world: World, hit: HitPayload): void {
  const target = entityById(world, hit.targetId);
  if (!target || !isAlive(target)) return;
  if (target.kind === "player" && hit.sourceId !== target.id) target.lastAttackerId = hit.sourceId;

  let damage = hit.damage;
  let blockedByPrayer = false;
  let protectionPrayer: string | undefined;
  if (target.kind === "player" && hit.sourceId !== target.id && isProtected(world, target, hit.protectableAs)) {
    blockedByPrayer = true;
    protectionPrayer = target.activePrayers.find((id) => world.content.prayers.get(id)?.protects === hit.protectableAs);
    // NPC attacks are fully blocked by the matching protection prayer, unless they pierce it.
    damage = hit.prayerPenetration > 0 ? Math.floor(damage * hit.prayerPenetration) : applyFactor(damage, NPC_PROTECTION_DAMAGE);
  }
  dealDamage(world, target, {
    sourceId: hit.sourceId, attackId: hit.attackId, damage, maxHit: hit.maxHit, style: hit.style, blockedByPrayer, effects: hit.effects,
    detail: {
      attackId: hit.attackId, startedTick: hit.roll.startedTick, special: hit.roll.special, reason: hit.roll.reason,
      attackRoll: hit.roll.attackRoll, defenceRoll: hit.roll.defenceRoll, hitChance: hit.roll.hitChance,
      accurate: hit.roll.accurate, rolled: hit.roll.rolled, ...(protectionPrayer ? { protectionPrayer } : {}),
    },
  });
}

/**
 * The one path all damage takes: the incoming-damage pipeline, invulnerability,
 * hitpoints, special effects, the HitLanded event, onHitLanded hooks, death
 * and Redemption. Hazards call this too, with style "typeless".
 */
export function dealDamage(
  world: World,
  target: EntityState,
  hit: {
    sourceId: string; attackId: string; damage: number; maxHit: number; style: HitStyle; blockedByPrayer?: boolean; effects?: SpecialEffect[];
    /** The roll and causes behind the hit; completed here with the damage steps. */
    detail: Omit<HitDetail, "afterPrayer" | "afterModifiers" | "overkill" | "targetHitpointsBefore">;
  },
): number {
  const info: PipelineInfo = { attackerId: hit.sourceId, targetId: target.id, style: hit.style === "typeless" ? "crush" : hit.style, attackId: hit.attackId };
  let adjusted = Math.max(0, world.pipelines.run(PIPELINES.incomingDamage, hit.damage, engineContext(world), info));
  const immune = target.kind === "npc" && world.tick < target.boss.invulnerableUntil;
  if (immune) adjusted = 0;
  const hpBefore = target.hitpoints;
  const amount = Math.min(adjusted, target.hitpoints);
  target.hitpoints -= amount;
  const detail: HitDetail = { ...hit.detail, afterPrayer: hit.damage, afterModifiers: adjusted, overkill: adjusted - amount, targetHitpointsBefore: hpBefore };
  applyEffects(world, target, hit.effects ?? [], amount);
  world.events.push({
    type: "HitLanded",
    sourceId: hit.sourceId,
    targetId: target.id,
    amount,
    maxHit: hit.maxHit,
    style: hit.style,
    targetHitpoints: target.hitpoints,
    ...(hit.blockedByPrayer ? { blockedByPrayer: true } : {}),
    ...(immune ? { immune: true } : {}),
    detail,
  });
  runHook(world, "onHitLanded", { sourceId: hit.sourceId, targetId: target.id, amount, style: hit.style });

  if (target.hitpoints === 0) killEntity(world, target, hit.sourceId);
  else if (target.kind === "player") triggerRedemption(world, target);
  return amount;
}

/**
 * Redemption: when a hit leaves the player below 10% of max hitpoints, all
 * prayer points are drained and the player heals floor(Prayer level / 4).
 * Source: OSRS Wiki "Redemption".
 */
function triggerRedemption(world: World, p: PlayerState): void {
  if (p.hitpoints * 10 >= p.maxHitpoints || !hasUtility(world, p, "redemption")) return;
  const healed = Math.floor(p.stats.prayer / 4);
  p.prayerPoints = 0;
  p.prayerDrainCounter = 0;
  deactivatePrayers(world, "all", "redemption");
  p.hitpoints = Math.min(p.maxHitpoints, p.hitpoints + healed);
  world.events.push({ type: "RedemptionTriggered", healed });
}
