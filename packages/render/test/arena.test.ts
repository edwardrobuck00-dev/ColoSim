import { describe, expect, it } from "vitest";
import { tileNoise } from "../src";

describe("tileNoise", () => {
  it("is deterministic and in [0, 1)", () => {
    for (let x = 0; x < 30; x++) {
      for (let y = 0; y < 30; y++) {
        const n = tileNoise(x, y);
        expect(n).toBe(tileNoise(x, y));
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThan(1);
      }
    }
  });
});
