/**
 * Seeded, deterministic PRNG (sfc32), with independent named streams so that
 * adding a roll in one system does not shift the rolls of another.
 * The engine must use this and never Math.random.
 */
export const RNG_STREAMS = ["combat", "ai", "hazards", "misc"] as const;
export type RngStreamName = (typeof RNG_STREAMS)[number];

export type RngState = [number, number, number, number];

function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
}

export class Rng {
  private s: RngState;

  constructor(state: RngState) {
    this.s = [...state];
  }

  static fromSeed(seed: number): Rng {
    const next = splitmix32(seed);
    const rng = new Rng([next(), next(), next(), next()]);
    // Warm up so near-identical seeds diverge quickly.
    for (let i = 0; i < 12; i++) rng.nextUint32();
    return rng;
  }

  nextUint32(): number {
    let [a, b, c, d] = this.s;
    const t = (((a + b) >>> 0) + d) >>> 0;
    d = (d + 1) >>> 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) >>> 0;
    c = ((c << 21) | (c >>> 11)) >>> 0;
    c = (c + t) >>> 0;
    this.s = [a >>> 0, b, c, d];
    return t;
  }

  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number {
    if (maxExclusive <= 0) return 0;
    return Math.floor((this.nextUint32() / 0x1_0000_0000) * maxExclusive);
  }

  /** Uniform integer in [min, max] inclusive. */
  range(min: number, max: number): number {
    return min + this.int(max - min + 1);
  }

  /** True with probability numerator/denominator. */
  chance(numerator: number, denominator: number): boolean {
    return this.int(denominator) < numerator;
  }

  getState(): RngState {
    return [...this.s];
  }
}

export class RngStreams {
  private readonly streams: Map<RngStreamName, Rng>;

  constructor(seed: number) {
    this.streams = new Map(
      RNG_STREAMS.map((name, i) => [name, Rng.fromSeed((seed ^ Math.imul(i + 1, 0x27d4eb2d)) >>> 0)]),
    );
  }

  get(name: RngStreamName): Rng {
    const rng = this.streams.get(name);
    if (!rng) throw new Error(`Unknown RNG stream: ${name}`);
    return rng;
  }

  getState(): Record<RngStreamName, RngState> {
    return Object.fromEntries(RNG_STREAMS.map((n) => [n, this.get(n).getState()])) as Record<
      RngStreamName,
      RngState
    >;
  }
}
