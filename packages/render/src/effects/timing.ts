/** Pure timing and layout maths for effects, kept separate so it can be unit tested. */

/** About two game ticks, like classic hitsplats. */
export const SPLAT_SECONDS = 1.2;

/**
 * Scale, opacity and vertical rise of a splat `age` seconds after it
 * appeared. Classic splats appear at full size, stay still and vanish after a
 * short fade; there is no pop or float, so the number is readable at once.
 */
export function splatAnimation(age: number): { scale: number; opacity: number; rise: number; done: boolean } {
  const fadeStart = SPLAT_SECONDS - 0.12;
  const opacity = age < fadeStart ? 1 : Math.max(0, 1 - (age - fadeStart) / 0.12);
  return { scale: 1, opacity, rise: 0, done: age >= SPLAT_SECONDS };
}

/**
 * Where the n-th simultaneous splat on one entity goes (offsets in splat
 * widths): centre, above, left, right, then stacked upward. Slots never overlap.
 */
export function splatSlot(index: number): { x: number; y: number } {
  const slots = [{ x: 0, y: 0 }, { x: 0, y: 0.95 }, { x: -0.95, y: 0.45 }, { x: 0.95, y: 0.45 }];
  return slots[index] ?? { x: 0, y: 0.95 * (index - 2) };
}

/**
 * Flight progress (0..1) of a projectile at fractional tick `tickFloat`.
 * Launch events arrive with tick L and play while the view interpolates from
 * L-1 to L; the hit appears when tick D arrives. So the flight spans
 * [L-1, D-1], and progress is exactly 1 when the hit splat appears.
 */
export function flightProgress(tickFloat: number, launchTick: number, landTick: number): number {
  const span = Math.max(1, landTick - launchTick);
  return Math.min(1, Math.max(0, (tickFloat - (launchTick - 1)) / span));
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Point along a parabolic arc from `a` to `b`, peaking `arc` above the straight line at t = 0.5. */
export function arcPoint(a: Vec3, b: Vec3, arc: number, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t + arc * 4 * t * (1 - t),
    z: a.z + (b.z - a.z) * t,
  };
}
