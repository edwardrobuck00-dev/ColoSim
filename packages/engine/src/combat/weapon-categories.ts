import type { CombatStyle } from "../defs/common";
import type { CombatClass, Stance } from "./stances";

/**
 * Weapon categories decide which combat styles a weapon offers.
 * Source: OSRS Wiki "Weapons/Categories" (Module:CombatStyles).
 */
export interface CombatStyleOption {
  name: string;
  /** Attack type rolled against the matching defence bonus. */
  attackType: CombatStyle;
  stance: Stance;
  cls: CombatClass;
}

const m = (name: string, attackType: CombatStyle, stance: Stance): CombatStyleOption => ({ name, attackType, stance, cls: "melee" });
const r = (name: string, stance: Stance): CombatStyleOption => ({ name, attackType: "ranged", stance, cls: "ranged" });
const g = (name: string, stance: Stance): CombatStyleOption => ({ name, attackType: "magic", stance, cls: "magic" });

export const WEAPON_CATEGORIES = {
  unarmed: [m("Punch", "crush", "accurate"), m("Kick", "crush", "aggressive"), m("Block", "crush", "defensive")],
  whip: [m("Flick", "slash", "accurate"), m("Lash", "slash", "controlled"), m("Deflect", "slash", "defensive")],
  spiked: [m("Pound", "crush", "accurate"), m("Pummel", "crush", "aggressive"), m("Spike", "stab", "controlled"), m("Block", "crush", "defensive")],
  "slash-sword": [m("Chop", "slash", "accurate"), m("Slash", "slash", "aggressive"), m("Lunge", "stab", "controlled"), m("Block", "slash", "defensive")],
  "stab-sword": [m("Stab", "stab", "accurate"), m("Lunge", "stab", "aggressive"), m("Slash", "slash", "aggressive"), m("Block", "stab", "defensive")],
  "two-handed-sword": [m("Chop", "slash", "accurate"), m("Slash", "slash", "aggressive"), m("Smash", "crush", "aggressive"), m("Block", "slash", "defensive")],
  blunt: [m("Pound", "crush", "accurate"), m("Pummel", "crush", "aggressive"), m("Block", "crush", "defensive")],
  // The next five: OSRS Wiki Template:CombatStyles (Axe, Spear, Claw, Polearm, Bludgeon), read 2026-11.
  axe: [m("Chop", "slash", "accurate"), m("Hack", "slash", "aggressive"), m("Smash", "crush", "aggressive"), m("Block", "slash", "defensive")],
  spear: [m("Lunge", "stab", "controlled"), m("Swipe", "slash", "controlled"), m("Pound", "crush", "controlled"), m("Block", "stab", "defensive")],
  claw: [m("Chop", "slash", "accurate"), m("Slash", "slash", "aggressive"), m("Lunge", "stab", "controlled"), m("Block", "slash", "defensive")],
  polearm: [m("Jab", "stab", "controlled"), m("Swipe", "slash", "aggressive"), m("Fend", "stab", "defensive")],
  bludgeon: [m("Pound", "crush", "aggressive"), m("Pummel", "crush", "aggressive"), m("Smash", "crush", "aggressive")],
  bow: [r("Accurate", "accurate"), r("Rapid", "rapid"), r("Longrange", "longrange")],
  crossbow: [r("Accurate", "accurate"), r("Rapid", "rapid"), r("Longrange", "longrange")],
  /** Staves bash in melee, or autocast a selected spell. */
  staff: [m("Bash", "crush", "accurate"), m("Pound", "crush", "aggressive"), m("Focus", "crush", "defensive"), g("Spell (defensive)", "defensive-autocast"), g("Spell", "autocast")],
  /** Bladed staves stab/slash/crush in melee, or autocast a selected spell. */
  "bladed-staff": [m("Jab", "stab", "accurate"), m("Swipe", "slash", "aggressive"), m("Fend", "crush", "defensive"), g("Spell (defensive)", "defensive-autocast"), g("Spell", "autocast")],
  /** Powered staves cast their own built-in spell. */
  "powered-staff": [g("Accurate", "accurate"), g("Accurate", "accurate"), g("Longrange", "longrange")],
} as const satisfies Record<string, readonly CombatStyleOption[]>;

export type WeaponCategory = keyof typeof WEAPON_CATEGORIES;
export const WEAPON_CATEGORY_IDS = Object.keys(WEAPON_CATEGORIES) as [WeaponCategory, ...WeaponCategory[]];

export function combatStyles(category: WeaponCategory): readonly CombatStyleOption[] {
  return WEAPON_CATEGORIES[category];
}

/** The style at `index`, falling back to the first if the index is out of range. */
export function combatStyleAt(category: WeaponCategory, index: number): CombatStyleOption {
  const styles = WEAPON_CATEGORIES[category];
  return styles[index] ?? styles[0]!;
}

/** Categories that can autocast spells from a spellbook. */
export const AUTOCAST_CATEGORIES: ReadonlySet<WeaponCategory> = new Set<WeaponCategory>(["staff", "bladed-staff"]);
