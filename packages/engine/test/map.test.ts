import { describe, expect, it } from "vitest";
import { Grid, findPath, findPathToAny, tilesAdjacentToFootprint } from "../src";

describe("Grid", () => {
  it("blocks diagonal corner cutting", () => {
    const g = new Grid(4, 4, [{ x: 1, y: 0 }]);
    expect(g.canStep({ x: 0, y: 0 }, 1, 1)).toBe(false);
    expect(g.canStep({ x: 0, y: 0 }, 0, 1)).toBe(true);
  });
});

describe("findPath", () => {
  it("uses diagonal steps on open ground", () => {
    const path = findPath(new Grid(10, 10), { x: 0, y: 0 }, { x: 3, y: 3 });
    expect(path).toEqual([{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }]);
  });

  it("routes around walls", () => {
    const wall = [0, 1, 2, 3].map((y) => ({ x: 2, y }));
    const path = findPath(new Grid(6, 6, wall), { x: 0, y: 0 }, { x: 4, y: 0 });
    expect(path.at(-1)).toEqual({ x: 4, y: 0 });
    expect(path.some((t) => t.x === 2 && t.y < 4)).toBe(false);
  });

  it("walks to the closest reachable tile when the target is blocked", () => {
    const path = findPath(new Grid(6, 6, [{ x: 3, y: 3 }]), { x: 0, y: 3 }, { x: 3, y: 3 });
    expect(path.at(-1)).toEqual({ x: 2, y: 3 });
  });

  it("returns null from findPathToAny when no goal is reachable", () => {
    const g = new Grid(3, 3, [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }]);
    expect(findPathToAny(g, { x: 0, y: 0 }, [{ x: 2, y: 2 }])).toBeNull();
  });
});

describe("tilesAdjacentToFootprint", () => {
  it("lists the orthogonal neighbours of a 2x2 footprint", () => {
    expect(tilesAdjacentToFootprint({ x: 5, y: 5 }, 2)).toHaveLength(8);
  });
});
