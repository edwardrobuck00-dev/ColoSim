import { describe, expect, it } from "vitest";
import { applyDamageFactors, effectiveLevel, magicMaxHit, npcMaxHit, percentBoost, prayedLevelWithMinimum, strengthMaxHit } from "../../src";

/**
 * Worked examples. "Wiki example" values are stated on the OSRS Wiki; the rest
 * are computed by hand from the cited formulas, step by step in the comments.
 */
describe("melee max hit", () => {
  it("wiki example: free-to-play max hit is 31", () => {
    // OSRS Wiki "Maximum melee hit": rune 2h sword (+70), amulet of strength (+10),
    // decorative boots (gold) (+1), strength potion, Ultimate Strength, aggressive, 99 Strength.
    const boost = percentBoost(99, 10, 3); // floor(9.9) + 3 = 12
    expect(boost).toBe(12);
    const eff = effectiveLevel({ level: 99, boost, prayer: [115, 100], stanceBonus: 3 }); // floor(111 * 1.15) = 127; + 3 + 8 = 138
    expect(eff).toBe(138);
    expect(strengthMaxHit(eff, 70 + 10 + 1)).toBe(31); // floor((138 * 145 + 320) / 640) = 31
  });

  it("matches floor(0.5 + eff * (bonus + 64) / 640) everywhere", () => {
    for (let eff = 1; eff <= 200; eff += 7) {
      for (let bonus = -30; bonus <= 200; bonus += 11) {
        expect(strengthMaxHit(eff, bonus)).toBe(Math.floor(0.5 + (eff * (bonus + 64)) / 640));
      }
    }
  });

  it("99 Strength, aggressive, no gear: 11", () => {
    expect(strengthMaxHit(effectiveLevel({ level: 99, stanceBonus: 3 }), 0)).toBe(11); // (110*64+320)/640 = 11.5
  });

  it("applies the prayer before the stance bonus and truncates", () => {
    // 87 Strength with a x123/100 prayer: floor(107.01) = 107, then +3 +8 = 118.
    expect(effectiveLevel({ level: 87, prayer: [123, 100], stanceBonus: 3 })).toBe(118);
  });

  it("void-style set bonus multiplies the whole effective level, then floors", () => {
    // 99 Attack + 19 boost = 118; x120/100 = 141 (141.6); +3 +8 = 152; x11/10 = 167 (167.2).
    expect(effectiveLevel({ level: 99, boost: 19, prayer: [120, 100], stanceBonus: 3, setBonus: [11, 10] })).toBe(167);
  });

  it("the 5% strength prayer always adds at least 1 (wiki note on Burst of Strength)", () => {
    expect(prayedLevelWithMinimum(10, [105, 100], 1)).toBe(11); // 10 * 1.05 = 10.5 -> 10, minimum +1
    expect(prayedLevelWithMinimum(40, [105, 100], 1)).toBe(42); // 42 already exceeds +1
  });
});

describe("special attack damage factors", () => {
  it("applies multiple factors in order, truncating after each", () => {
    // Godsword-style: x11/10 then x5/4 (wiki DPS calculator order).
    expect(applyDamageFactors(50, [[11, 10], [5, 4]])).toBe(68); // 55 -> 68 (68.75)
    // Order and truncation matter: 49 -> 53 (53.9) -> 66 (66.25), whereas x1.375 in one step gives 67.
    expect(applyDamageFactors(49, [[11, 10], [5, 4]])).toBe(66);
    expect(Math.floor(49 * 1.375)).toBe(67);
  });
});

describe("ranged max hit", () => {
  it("uses the strength multiplier (x1.23) and the accuracy multiplier (x1.20) separately", () => {
    // Rigour-tier: accuracy x120/100, strength x123/100 (OSRS Wiki "Damage per second/Ranged", "Maximum ranged hit").
    const effStr = effectiveLevel({ level: 99, prayer: [123, 100], stanceBonus: 3 }); // 121 + 3 + 8 = 132
    const effAcc = effectiveLevel({ level: 99, prayer: [120, 100], stanceBonus: 3 }); // 118 + 3 + 8 = 129
    expect([effStr, effAcc]).toEqual([132, 129]);
    expect(strengthMaxHit(effStr, 100)).toBe(34); // floor((132*164 + 320) / 640) = 34.3
  });
});

describe("magic max hit", () => {
  it("adds percentage damage bonuses (tenths of a percent), flooring once", () => {
    expect(magicMaxHit(20, 150)).toBe(23); // 20 + floor(20 * 0.15) = 23
    expect(magicMaxHit(24, 40)).toBe(24); // +4% of 24 = 0.96 -> 0
    expect(magicMaxHit(30, 190)).toBe(35); // 30 + floor(5.7) = 35
  });
});

describe("NPC max hit from stats", () => {
  it("floor(((9 + level) * (bonus + 64) + 320) / 640)", () => {
    expect(npcMaxHit(100, 0)).toBe(11); // (109*64+320)/640 = 11.4
    expect(npcMaxHit(200, 50)).toBe(37); // (209*114+320)/640 = 37.7
  });
});
