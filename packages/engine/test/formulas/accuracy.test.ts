import { describe, expect, it } from "vitest";
import { Rng, attackRoll, hitChance, npcAttackRoll, npcDefenceRoll, playerDefenceRoll, rollAccuracy } from "../../src";

describe("rolls", () => {
  it("attack roll = effective level x (bonus + 64), then gear factors", () => {
    expect(attackRoll(152, 82)).toBe(152 * 146);
    expect(attackRoll(100, 36, [[7, 6]])).toBe(Math.trunc((100 * 100 * 7) / 6));
  });

  it("NPC defence and attack rolls use level + 9", () => {
    expect(npcDefenceRoll(1, 0)).toBe(640);
    expect(npcDefenceRoll(99, 100)).toBe(108 * 164);
    expect(npcAttackRoll(250, 20)).toBe(259 * 84);
  });

  it("player defence roll: (8 + level + stance) x (bonus + 64)", () => {
    expect(playerDefenceRoll({ defence: 99, magic: 1, stanceBonus: 3, equipmentBonus: 100, vsMagic: false })).toBe(110 * 164);
  });

  it("against magic, blends 70% Magic and 30% Defence (each truncated)", () => {
    // floor(99 * 0.7) = 69, floor(99 * 0.3) = 29 -> 98; (8 + 98) * 64
    expect(playerDefenceRoll({ defence: 99, magic: 99, stanceBonus: 0, equipmentBonus: 0, vsMagic: true })).toBe(106 * 64);
    // With x125/100 to both: 123 and 123 -> 86 + 36 = 122
    expect(
      playerDefenceRoll({ defence: 99, magic: 99, defencePrayer: [125, 100], magicDefencePrayer: [125, 100], stanceBonus: 0, equipmentBonus: 0, vsMagic: true }),
    ).toBe(130 * 64);
  });
});

describe("hit chance", () => {
  it("uses the two-branch formula", () => {
    expect(hitChance(20000, 10000)).toBeCloseTo(1 - 10002 / 40002, 12);
    expect(hitChance(10000, 20000)).toBeCloseTo(10000 / 40002, 12);
    expect(hitChance(0, 500)).toBe(0);
  });

  it("equals the exact probability of attacker roll > defender roll over all roll pairs", () => {
    // Brute force: both sides roll uniformly in [0, A] and [0, D] (OSRS Wiki derivation).
    for (let A = 0; A <= 30; A += 3) {
      for (let D = 0; D <= 30; D += 4) {
        let wins = 0;
        for (let a = 0; a <= A; a++) for (let d = 0; d <= D; d++) if (a > d) wins++;
        expect(hitChance(A, D)).toBeCloseTo(wins / ((A + 1) * (D + 1)), 12);
      }
    }
  });

  it("handles negative rolls like the wiki DPS calculator", () => {
    expect(hitChance(-5, 100)).toBe(0);
    expect(hitChance(100, -5)).toBeCloseTo(1 - 1 / 4 / 101, 12);
  });

  it("rollAccuracy compares two uniform rolls (scripted RNG walks every pair)", () => {
    const A = 6;
    const D = 4;
    const pairs: number[] = [];
    for (let a = 0; a <= A; a++) for (let d = 0; d <= D; d++) pairs.push(a, d);
    let i = 0;
    const scripted = { int: () => pairs[i++]! } as unknown as Rng;
    let wins = 0;
    for (let k = 0; k < (A + 1) * (D + 1); k++) if (rollAccuracy(scripted, A, D)) wins++;
    expect(wins / ((A + 1) * (D + 1))).toBeCloseTo(hitChance(A, D), 12);
  });

  it("over many seeded rolls, the hit rate converges to the formula", () => {
    const rng = Rng.fromSeed(1);
    const n = 200_000;
    let hits = 0;
    for (let k = 0; k < n; k++) if (rollAccuracy(rng, 15000, 9000)) hits++;
    expect(hits / n).toBeCloseTo(hitChance(15000, 9000), 2);
  });
});
