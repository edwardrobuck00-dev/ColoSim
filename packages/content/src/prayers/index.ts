import { definePrayer, type PrayerDefInput } from "@sim/engine";

/**
 * The OSRS prayer book (combat-relevant prayers). Levels, drain effects and
 * multipliers come from the OSRS Wiki "Prayer" table and each prayer's page;
 * the exact fractions match the wiki DPS calculator. Extra requirements:
 * Chivalry 65 Defence, Piety 70 Defence, Rigour 70 Defence, Augury 70
 * Defence, Zeal 75 Attack and 75 Strength (each prayer's wiki page).
 *
 * Groups encode the wiki's "Conflicting prayers" table (see defs/prayer.ts).
 * Not included: Protect Item, Retribution and Smite (no effect in a
 * single-player fight against NPCs without prayer).
 */
const pct = (n: number) => [n, 100] as [number, number];
const RM = ["strength", "attack", "ranged-magic"] as const; // ranged and magic prayers
const COMBINED = ["defence", "strength", "attack", "ranged-magic"] as const;
const p = (def: PrayerDefInput) => definePrayer(def);

export const PRAYERS = [
  p({ id: "thick-skin", name: "Thick Skin", level: 1, drainEffect: 1, groups: ["defence"], effects: { defence: pct(105) } }),
  p({ id: "burst-of-strength", name: "Burst of Strength", level: 4, drainEffect: 1, groups: ["strength"], effects: { meleeStrength: pct(105), minimumStrengthGain: 1 } }),
  p({ id: "clarity-of-thought", name: "Clarity of Thought", level: 7, drainEffect: 1, groups: ["attack"], effects: { meleeAccuracy: pct(105) } }),
  p({ id: "sharp-eye", name: "Sharp Eye", level: 8, drainEffect: 1, groups: [...RM], effects: { rangedAccuracy: pct(105), rangedStrength: pct(105) } }),
  p({ id: "mystic-will", name: "Mystic Will", level: 9, drainEffect: 1, groups: [...RM], effects: { magicAccuracy: pct(105), magicDefence: pct(105) } }),
  p({ id: "rock-skin", name: "Rock Skin", level: 10, drainEffect: 6, groups: ["defence"], effects: { defence: pct(110) } }),
  p({ id: "superhuman-strength", name: "Superhuman Strength", level: 13, drainEffect: 6, groups: ["strength"], effects: { meleeStrength: pct(110) } }),
  p({ id: "improved-reflexes", name: "Improved Reflexes", level: 16, drainEffect: 6, groups: ["attack"], effects: { meleeAccuracy: pct(110) } }),
  p({ id: "rapid-restore", name: "Rapid Restore", level: 19, drainEffect: 1, utility: "rapid-restore" }),
  p({ id: "rapid-heal", name: "Rapid Heal", level: 22, drainEffect: 2, utility: "rapid-heal" }),
  p({ id: "hawk-eye", name: "Hawk Eye", level: 26, drainEffect: 6, groups: [...RM], effects: { rangedAccuracy: pct(110), rangedStrength: pct(110) } }),
  p({ id: "mystic-lore", name: "Mystic Lore", level: 27, drainEffect: 6, groups: [...RM], effects: { magicAccuracy: pct(110), magicDefence: pct(110), magicDamageTenths: 10 } }),
  p({ id: "steel-skin", name: "Steel Skin", level: 28, drainEffect: 12, groups: ["defence"], effects: { defence: pct(115) } }),
  p({ id: "ultimate-strength", name: "Ultimate Strength", level: 31, drainEffect: 12, groups: ["strength"], effects: { meleeStrength: pct(115) } }),
  p({ id: "incredible-reflexes", name: "Incredible Reflexes", level: 34, drainEffect: 12, groups: ["attack"], effects: { meleeAccuracy: pct(115) } }),
  p({ id: "protect-from-magic", name: "Protect from Magic", level: 37, drainEffect: 12, groups: ["overhead"], protects: "magic" }),
  p({ id: "protect-from-missiles", name: "Protect from Missiles", level: 40, drainEffect: 12, groups: ["overhead"], protects: "ranged" }),
  p({ id: "protect-from-melee", name: "Protect from Melee", level: 43, drainEffect: 12, groups: ["overhead"], protects: "melee" }),
  p({ id: "eagle-eye", name: "Eagle Eye", level: 44, drainEffect: 12, groups: [...RM], effects: { rangedAccuracy: pct(115), rangedStrength: pct(115) } }),
  p({ id: "mystic-might", name: "Mystic Might", level: 45, drainEffect: 12, groups: [...RM], effects: { magicAccuracy: pct(115), magicDefence: pct(115), magicDamageTenths: 20 } }),
  p({ id: "redemption", name: "Redemption", level: 49, drainEffect: 6, groups: ["overhead"], utility: "redemption" }),
  p({ id: "preserve", name: "Preserve", level: 55, drainEffect: 2, utility: "preserve" }),
  p({ id: "chivalry", name: "Chivalry", level: 60, requirements: { defence: 65 }, drainEffect: 12, groups: [...COMBINED], effects: { meleeAccuracy: pct(115), meleeStrength: pct(118), defence: pct(120) } }),
  p({ id: "deadeye", name: "Deadeye", level: 62, drainEffect: 12, groups: [...RM], effects: { rangedAccuracy: pct(118), rangedStrength: pct(118), defence: pct(105) } }),
  p({ id: "mystic-vigour", name: "Mystic Vigour", level: 63, drainEffect: 12, groups: [...RM], effects: { magicAccuracy: pct(118), magicDefence: pct(118), defence: pct(105), magicDamageTenths: 30 } }),
  p({ id: "piety", name: "Piety", level: 70, requirements: { defence: 70 }, drainEffect: 24, groups: [...COMBINED], effects: { meleeAccuracy: pct(120), meleeStrength: pct(123), defence: pct(125) } }),
  p({ id: "rigour", name: "Rigour", level: 74, requirements: { defence: 70 }, drainEffect: 24, groups: [...COMBINED], effects: { rangedAccuracy: pct(120), rangedStrength: pct(123), defence: pct(125) } }),
  p({ id: "augury", name: "Augury", level: 77, requirements: { defence: 70 }, drainEffect: 24, groups: [...COMBINED], effects: { magicAccuracy: pct(125), magicDefence: pct(125), defence: pct(125), magicDamageTenths: 40 } }),
  p({ id: "zeal", name: "Zeal", level: 84, requirements: { attack: 75, strength: 75 }, drainEffect: 24, groups: [...COMBINED], effects: { meleeAccuracy: pct(125), meleeStrength: pct(128), defence: pct(125) } }),
];
