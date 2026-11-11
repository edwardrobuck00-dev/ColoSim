/**
 * OSRS applies multipliers as integer fractions and truncates after each
 * step (for example Piety's strength boost is x123/100, not x1.23 in floating
 * point). Keeping factors as [numerator, denominator] reproduces the game's
 * rounding exactly.
 */
export type Factor = readonly [numerator: number, denominator: number];

export const IDENTITY: Factor = [1, 1];

/** trunc(value * num / den). For the non-negative values used in combat this equals floor. */
export function applyFactor(value: number, factor: Factor | null | undefined): number {
  if (!factor) return Math.trunc(value);
  return Math.trunc((value * factor[0]) / factor[1]);
}

/** Applies factors one after another, truncating after each. Order matters. */
export function applyFactors(value: number, factors: readonly Factor[]): number {
  return factors.reduce((v, f) => applyFactor(v, f), Math.trunc(value));
}

/** value + trunc(value * num / den): an additive percentage bonus such as magic damage. */
export function addFactor(value: number, factor: Factor): number {
  return value + applyFactor(value, factor);
}
