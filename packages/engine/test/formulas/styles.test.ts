import { describe, expect, it } from "vitest";
import { WEAPON_CATEGORIES, effectiveRange, stanceBonus } from "../../src";

describe("stance bonuses (OSRS Wiki, Combat Options)", () => {
  it("melee: accurate +3 Attack, aggressive +3 Strength, defensive +3 Defence, controlled +1 each", () => {
    expect(stanceBonus("accurate", "melee")).toMatchObject({ accuracy: 3, strength: 0, defence: 0 });
    expect(stanceBonus("aggressive", "melee")).toMatchObject({ accuracy: 0, strength: 3, defence: 0 });
    expect(stanceBonus("defensive", "melee")).toMatchObject({ accuracy: 0, strength: 0, defence: 3 });
    expect(stanceBonus("controlled", "melee")).toMatchObject({ accuracy: 1, strength: 1, defence: 1 });
  });

  it("ranged: accurate +3 to accuracy and damage, rapid -1 tick, longrange +3 Defence and +2 range", () => {
    expect(stanceBonus("accurate", "ranged")).toMatchObject({ accuracy: 3, strength: 3 });
    expect(stanceBonus("rapid", "ranged").speedDelta).toBe(-1);
    expect(stanceBonus("longrange", "ranged")).toMatchObject({ defence: 3, rangeDelta: 2 });
  });

  it("longrange range is capped at 10 tiles", () => {
    const lr = stanceBonus("longrange", "ranged");
    expect(effectiveRange(7, lr)).toBe(9);
    expect(effectiveRange(9, lr)).toBe(10);
  });

  it("autocasting gives no invisible bonus", () => {
    expect(stanceBonus("autocast", "magic")).toMatchObject({ accuracy: 0, strength: 0, defence: 0 });
  });
});

describe("weapon categories (OSRS Wiki, Module:CombatStyles)", () => {
  const summary = (c: keyof typeof WEAPON_CATEGORIES) => WEAPON_CATEGORIES[c].map((s) => `${s.name}:${s.attackType}:${s.stance}`);

  it("slash sword: Chop, Slash, Lunge (stab, controlled), Block", () => {
    expect(summary("slash-sword")).toEqual(["Chop:slash:accurate", "Slash:slash:aggressive", "Lunge:stab:controlled", "Block:slash:defensive"]);
  });

  it("stab sword: Stab, Lunge, Slash (aggressive), Block", () => {
    expect(summary("stab-sword")).toEqual(["Stab:stab:accurate", "Lunge:stab:aggressive", "Slash:slash:aggressive", "Block:stab:defensive"]);
  });

  it("2h sword: Chop, Slash, Smash (crush), Block", () => {
    expect(summary("two-handed-sword")).toEqual(["Chop:slash:accurate", "Slash:slash:aggressive", "Smash:crush:aggressive", "Block:slash:defensive"]);
  });

  it("unarmed and blunt are all crush", () => {
    expect(summary("unarmed")).toEqual(["Punch:crush:accurate", "Kick:crush:aggressive", "Block:crush:defensive"]);
    expect(summary("blunt")).toEqual(["Pound:crush:accurate", "Pummel:crush:aggressive", "Block:crush:defensive"]);
  });
});
