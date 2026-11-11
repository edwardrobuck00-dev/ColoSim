import { describe, expect, it } from "vitest";
import { bestFactor, drainPrayerTick, prayerDrainResistance, totalMagicDamageTenths } from "../../src";

describe("prayer drain", () => {
  it("resistance is 60 + 2 x prayer bonus (wiki: +15 -> 90; +30 halves the drain rate)", () => {
    expect(prayerDrainResistance(0)).toBe(60);
    expect(prayerDrainResistance(15)).toBe(90);
    expect(prayerDrainResistance(30)).toBe(2 * prayerDrainResistance(0));
  });

  it("loses a point only when the counter exceeds the resistance", () => {
    let counter = 0;
    const lost: number[] = [];
    for (let t = 0; t < 6; t++) {
      const r = drainPrayerTick(counter, 24, 0);
      counter = r.counter;
      lost.push(r.pointsLost);
    }
    // 24, 48, 72 (>60: lose, 12), 36, 60 (not > 60), 84 (lose, 24)
    expect(lost).toEqual([0, 0, 1, 0, 0, 1]);
  });

  it("averages resistance / drain effect ticks per point (wiki: seconds = 0.6 x resistance / effect)", () => {
    // Drain effect 24 (Piety-tier), bonus 0: 2.5 ticks per point = 1.5 seconds.
    let counter = 0;
    let lost = 0;
    for (let t = 0; t < 1000; t++) {
      const r = drainPrayerTick(counter, 24, 0);
      counter = r.counter;
      lost += r.pointsLost;
    }
    expect(Math.abs(lost - 400)).toBeLessThanOrEqual(1);
  });

  it("can lose more than one point in a tick", () => {
    expect(drainPrayerTick(0, 200, 0).pointsLost).toBe(3);
  });
});

describe("prayer effects", () => {
  it("uses the strongest multiplier of each kind and sums magic damage", () => {
    const effects = [{ meleeStrength: [105, 100] as const }, { meleeStrength: [123, 100] as const, magicDamageTenths: 10 }, { magicDamageTenths: 40 }];
    expect(bestFactor(effects, "meleeStrength")).toEqual([123, 100]);
    expect(bestFactor(effects, "rangedAccuracy")).toBeNull();
    expect(totalMagicDamageTenths(effects)).toBe(50);
  });
});
