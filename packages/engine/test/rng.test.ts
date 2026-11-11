import { describe, expect, it } from "vitest";
import { Rng, RngStreams } from "../src";

describe("Rng", () => {
  it("produces the same sequence for the same seed", () => {
    const a = Rng.fromSeed(1234);
    const b = Rng.fromSeed(1234);
    expect(Array.from({ length: 20 }, () => a.nextUint32())).toEqual(Array.from({ length: 20 }, () => b.nextUint32()));
  });

  it("produces different sequences for different seeds", () => {
    expect(Rng.fromSeed(1).nextUint32()).not.toBe(Rng.fromSeed(2).nextUint32());
  });

  it("keeps int() and range() within bounds", () => {
    const r = Rng.fromSeed(7);
    for (let i = 0; i < 2000; i++) {
      const v = r.int(10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
      const w = r.range(3, 5);
      expect(w).toBeGreaterThanOrEqual(3);
      expect(w).toBeLessThanOrEqual(5);
    }
  });

  it("keeps named streams independent", () => {
    const a = new RngStreams(99);
    const b = new RngStreams(99);
    for (let i = 0; i < 50; i++) b.get("hazards").nextUint32(); // extra rolls on another stream
    expect(a.get("combat").nextUint32()).toBe(b.get("combat").nextUint32());
  });
});
