import { describe, expect, it } from "vitest";
import { ease, lerp, tileToWorld, worldToTile } from "../src";

describe("tile/world coordinates", () => {
  it("round-trips the centre of every tile", () => {
    for (let x = 0; x < 20; x++) {
      for (let y = 0; y < 20; y++) {
        const w = tileToWorld({ x, y });
        expect(worldToTile(w.x, w.z)).toEqual({ x, y });
      }
    }
  });

  it("centres multi-tile entities on their footprint", () => {
    expect(tileToWorld({ x: 2, y: 2 }, 3)).toEqual({ x: 3.5, z: -3.5 });
  });
});

describe("interpolation", () => {
  it("lerp and ease hit their endpoints", () => {
    expect(lerp(2, 4, 0.5)).toBe(3);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(2)).toBe(1);
  });
});
