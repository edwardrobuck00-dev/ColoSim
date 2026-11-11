import type { Rng } from "../core/rng";
import { rollAccuracy } from "./accuracy";

export interface HitRoll {
  accurate: boolean;
  damage: number;
}

/**
 * One attack: an accuracy roll, then (if accurate) a uniform damage roll in
 * [minHit, maxHit]. An inaccurate attack deals 0. See uncertainty U1 for the
 * "accurate 0" question.
 */
export function rollHit(rng: Rng, atkRoll: number, defRoll: number, maxHit: number, minHit = 0): HitRoll {
  const accurate = rollAccuracy(rng, atkRoll, defRoll);
  if (!accurate) return { accurate, damage: 0 };
  const lo = Math.min(minHit, maxHit);
  return { accurate, damage: rng.range(lo, maxHit) };
}

/** Expected damage of one attack: hitChance * (min + max) / 2. */
export function expectedDamage(hitChanceValue: number, maxHit: number, minHit = 0): number {
  return (hitChanceValue * (Math.min(minHit, maxHit) + maxHit)) / 2;
}
