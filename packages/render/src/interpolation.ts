export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Smoothstep easing so movement starts and stops gently between ticks. */
export const ease = (t: number): number => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};
