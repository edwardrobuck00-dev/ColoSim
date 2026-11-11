/** Small helpers for authoring procedural animation curves. */

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * Piecewise curve through [time, value] keys (times 0..1, ascending),
 * smoothstep-eased between keys. Holds the end values outside the range.
 */
export function keys(points: ReadonlyArray<readonly [number, number]>): (t: number) => number {
  return (t) => {
    const first = points[0]!;
    if (t <= first[0]) return first[1];
    for (let i = 1; i < points.length; i++) {
      const [t1, v1] = points[i]!;
      const [t0, v0] = points[i - 1]!;
      if (t <= t1) return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0 || 1));
    }
    return points[points.length - 1]![1];
  };
}

export const wave = (t: number, cycles = 1, phase = 0) => Math.sin((t * cycles + phase) * Math.PI * 2);
