import type { Rng } from "../core/rng";
import { applyFactor, applyFactors, type Factor } from "./factors";

/**
 * Attack roll: floor(effectiveLevel * (equipmentBonus + 64) * gearFactors...).
 * Source: OSRS Wiki "Damage per second/Melee" step four (same shape for
 * ranged and magic).
 */
export function attackRoll(effLevel: number, equipmentBonus: number, gearFactors: readonly Factor[] = []): number {
  return applyFactors(effLevel * (equipmentBonus + 64), gearFactors);
}

/** NPC defence roll: (defenceLevel + 9) * (styleDefenceBonus + 64). Against magic, most NPCs use their Magic level. */
export function npcDefenceRoll(level: number, styleDefenceBonus: number): number {
  return (level + 9) * (styleDefenceBonus + 64);
}

/** NPC attack roll: (attackingLevel + 9) * (attackBonus + 64). */
export function npcAttackRoll(level: number, attackBonus: number): number {
  return (level + 9) * (attackBonus + 64);
}

export interface PlayerDefenceInput {
  defence: number;
  defenceBoost?: number;
  magic: number;
  magicBoost?: number;
  /** Defence prayer multiplier (e.g. [125, 100]). */
  defencePrayer?: Factor | null;
  /** Magic-defence multiplier from magic prayers (e.g. [115, 100]). */
  magicDefencePrayer?: Factor | null;
  stanceBonus: number;
  /** The player's defence bonus against the incoming attack type. */
  equipmentBonus: number;
  vsMagic: boolean;
}

/**
 * Player defence roll: (8 + effectiveDefence) * (bonus + 64).
 * Against magic the effective level blends 70% Magic and 30% Defence, each
 * truncated: floor(magic * 7/10) + floor(defence * 3/10).
 * Source: OSRS Wiki "Damage per second/Melee" step five/six; wiki DPS calculator
 * (NPCVsPlayerCalc.getPlayerDefenceRoll) for the magic blend and stance order.
 */
export function playerDefenceRoll(i: PlayerDefenceInput): number {
  let level = applyFactor(i.defence + (i.defenceBoost ?? 0), i.defencePrayer);
  if (i.vsMagic) {
    const magic = applyFactor(i.magic + (i.magicBoost ?? 0), i.magicDefencePrayer);
    level = applyFactor(magic, [7, 10]) + applyFactor(level, [3, 10]);
  }
  return (8 + level + i.stanceBonus) * (i.equipmentBonus + 64);
}

/**
 * Probability that an attack hits. Both sides roll uniformly in [0, roll];
 * the attack hits if attacker's roll > defender's roll:
 *   A > D: 1 - (D + 2) / (2(A + 1))
 *   else:  A / (2(D + 1))
 * Negative rolls (from negative bonuses) follow the wiki DPS calculator
 * (BaseCalc.getNormalAccuracyRoll); see uncertainty U6.
 */
export function hitChance(atk: number, def: number): number {
  const std = (a: number, d: number) => (a > d ? 1 - (d + 2) / (2 * (a + 1)) : a / (2 * (d + 1)));
  let a = atk;
  let d = def;
  if (a < 0) a = Math.min(0, a + 2);
  if (d < 0) d = Math.min(0, d + 2);
  if (a >= 0 && d >= 0) return std(a, d);
  if (a >= 0 && d < 0) return 1 - 1 / (-d + 1) / (a + 1);
  if (a < 0 && d >= 0) return 0;
  return std(-d, -a);
}

/**
 * Rolls accuracy the way the game does: attacker and defender each roll
 * uniformly in [0, roll], and the attack hits if the attacker rolls higher.
 * For negative rolls, falls back to the hit chance formula.
 */
export function rollAccuracy(rng: Rng, atk: number, def: number): boolean {
  if (atk >= 0 && def >= 0) return rng.int(atk + 1) > rng.int(def + 1);
  return rng.int(1_000_000) < Math.floor(hitChance(atk, def) * 1_000_000);
}

/** Multiplies an attack roll by an accuracy factor (special attacks). */
export function scaleRoll(roll: number, factor: Factor | null | undefined): number {
  return applyFactor(roll, factor);
}
