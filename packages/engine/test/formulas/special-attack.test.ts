import { describe, expect, it } from "vitest";
import { SPECIAL_REGEN_INTERVAL_TICKS, drainByPercent, drainInOrder, regenSpecialEnergy } from "../../src";

describe("special attack energy", () => {
  it("regenerates 10% every 50 ticks (30 seconds), capped at 100", () => {
    let s = { energy: 40, timer: 0 };
    for (let t = 0; t < SPECIAL_REGEN_INTERVAL_TICKS - 1; t++) s = regenSpecialEnergy(s.energy, s.timer);
    expect(s.energy).toBe(40);
    s = regenSpecialEnergy(s.energy, s.timer);
    expect(s.energy).toBe(50);
    expect(regenSpecialEnergy(95, SPECIAL_REGEN_INTERVAL_TICKS - 1).energy).toBe(100);
  });
});

describe("level drains", () => {
  it("percentage drain: level - trunc(level x p / 100), relative to the current level", () => {
    expect(drainByPercent(200, 30)).toBe(140);
    expect(drainByPercent(140, 30)).toBe(98);
    expect(drainByPercent(1, 30)).toBe(1); // trunc(0.3) = 0
  });

  it("drain by damage carries over to the next level only when one reaches 0", () => {
    const levels = { defence: 20, strength: 50, attack: 60, magic: 1, ranged: 1 };
    expect(drainInOrder(levels, ["defence", "strength", "attack"], 30)).toMatchObject({ defence: 0, strength: 40, attack: 60 });
    expect(drainInOrder({ ...levels, defence: 100 }, ["defence", "strength"], 30)).toMatchObject({ defence: 70, strength: 50 });
  });
});
