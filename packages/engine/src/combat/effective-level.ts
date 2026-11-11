import { applyFactor, type Factor } from "./factors";

export interface EffectiveLevelInput {
  /** Visible base level. */
  level: number;
  /** Temporary boost (potions); may be negative for drains. */
  boost?: number;
  /** Prayer multiplier, e.g. [123, 100]. */
  prayer?: Factor | null;
  /** Invisible stance bonus (+3 / +1 / +2 ...). */
  stanceBonus?: number;
  /** Constant added after the stance bonus: 8 for melee/ranged, 9 for magic accuracy. */
  base?: number;
  /** Set-effect multiplier applied last (void: [11, 10] or [29, 20] for magic). */
  setBonus?: Factor | null;
}

/**
 * floor( ( floor((level + boost) * prayer) + stance + base ) * setBonus )
 * Source: OSRS Wiki "Maximum melee hit" step one, "Damage per second/Ranged"
 * step four, "Damage per second/Magic" step two.
 */
export function effectiveLevel({ level, boost = 0, prayer = null, stanceBonus = 0, base = 8, setBonus = null }: EffectiveLevelInput): number {
  const prayed = applyFactor(level + boost, prayer);
  return applyFactor(prayed + stanceBonus + base, setBonus);
}

/**
 * The 5% Strength prayer always raises Strength by at least 1 (OSRS Wiki,
 * "Maximum melee hit", note on Burst of Strength). Implemented as in the wiki
 * DPS calculator: at levels <= 20 it adds 1 instead of multiplying.
 */
export function prayedLevelWithMinimum(level: number, prayer: Factor | null, minimumGain: number): number {
  if (!prayer) return level;
  const multiplied = applyFactor(level, prayer);
  return Math.max(multiplied, level + minimumGain);
}

/**
 * Potion-style boosts: floor(level * percent / 100) + flat.
 * Source: OSRS Wiki "Maximum melee hit" table (e.g. Strength potion: 10% + 3,
 * Super strength potion: 15% + 5).
 */
export function percentBoost(level: number, percent: number, flat: number): number {
  return Math.trunc((level * percent) / 100) + flat;
}
