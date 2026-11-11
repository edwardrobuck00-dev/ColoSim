import { applyFactor } from "./factors";

/** Special attack energy: 0 to 100 (%). Regenerates 10% every 50 ticks (30 s). OSRS Wiki "Special attacks". */
export const MAX_SPECIAL_ENERGY = 100;
export const SPECIAL_REGEN_AMOUNT = 10;
export const SPECIAL_REGEN_INTERVAL_TICKS = 50;

/** Advances the regeneration timer by one tick. */
export function regenSpecialEnergy(energy: number, timer: number): { energy: number; timer: number } {
  const t = timer + 1;
  if (t < SPECIAL_REGEN_INTERVAL_TICKS) return { energy, timer: t };
  return { energy: Math.min(MAX_SPECIAL_ENERGY, energy + SPECIAL_REGEN_AMOUNT), timer: 0 };
}

/** Defence drain by a percentage of the current level: def - trunc(def * p / 100). */
export function drainByPercent(level: number, percent: number): number {
  return level - applyFactor(level, [percent, 100]);
}

/**
 * Drains levels in order by an amount (the damage dealt); whatever cannot be
 * drained from one level carries over to the next, and the carry-over stops
 * as soon as a level does not reach 0.
 */
export function drainInOrder<K extends string>(levels: Record<K, number>, order: readonly K[], amount: number): Record<K, number> {
  const out = { ...levels };
  let left = amount;
  for (const k of order) {
    if (left <= 0) break;
    const start = out[k];
    out[k] = Math.max(0, start - left);
    left = out[k] > 0 ? 0 : left - start;
  }
  return out;
}
