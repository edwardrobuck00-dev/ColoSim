import { describe, expect, it } from "vitest";
import { canonicalJson, hashState } from "../src";
import { Scheduler } from "../src/core/scheduler";

describe("state hashing", () => {
  it("ignores object key order", () => {
    expect(canonicalJson({ b: 1, a: [1, { d: 2, c: 3 }] })).toBe(canonicalJson({ a: [1, { c: 3, d: 2 }], b: 1 }));
    expect(hashState({ x: 1, y: 2 })).toBe(hashState({ y: 2, x: 1 }));
  });
});

describe("Scheduler", () => {
  it("returns due events in tick order, then insertion order", () => {
    const s = new Scheduler();
    s.schedule(5, "b", 1);
    s.schedule(3, "a", 1);
    s.schedule(5, "c", 1);
    expect(s.takeDue(4).map((e) => e.kind)).toEqual(["a"]);
    expect(s.takeDue(5).map((e) => e.kind)).toEqual(["b", "c"]);
    expect(s.size).toBe(0);
  });
});
