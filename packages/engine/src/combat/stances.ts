/**
 * Combat stances and their invisible level bonuses.
 * Source: OSRS Wiki "Combat Options" and the DPS calculator (see docs/combat-formulas.md).
 */
export const STANCES = [
  "accurate", "aggressive", "defensive", "controlled", // melee
  "rapid", "longrange",                                 // ranged (+ accurate)
  "autocast", "defensive-autocast",                     // spells cast from a staff
] as const;
export type Stance = (typeof STANCES)[number];

export type CombatClass = "melee" | "ranged" | "magic";

export interface StanceBonus {
  /** Invisible bonus to the effective level used for accuracy. */
  accuracy: number;
  /** Invisible bonus to the effective level used for max hit (melee/ranged). */
  strength: number;
  /** Invisible bonus to the effective Defence level when defending. */
  defence: number;
  /** Change to the weapon's attack speed in ticks (rapid: -1). */
  speedDelta: number;
  /** Change to attack range in tiles (longrange: +2, capped at 10). */
  rangeDelta: number;
}

const NONE: StanceBonus = { accuracy: 0, strength: 0, defence: 0, speedDelta: 0, rangeDelta: 0 };

/**
 * Melee: accurate +3 Attack, aggressive +3 Strength, defensive +3 Defence,
 * controlled +1 to all three.
 * Ranged: accurate +3 Ranged (accuracy and strength), rapid -1 tick,
 * longrange +3 Defence and +2 range.
 * Magic (powered staves): accurate +2 Magic accuracy (see uncertainty U2),
 * longrange +3 Defence and +2 range. Autocasting gives no invisible bonus.
 */
export function stanceBonus(stance: Stance, cls: CombatClass): StanceBonus {
  if (cls === "melee") {
    switch (stance) {
      case "accurate": return { ...NONE, accuracy: 3 };
      case "aggressive": return { ...NONE, strength: 3 };
      case "defensive": return { ...NONE, defence: 3 };
      case "controlled": return { ...NONE, accuracy: 1, strength: 1, defence: 1 };
      default: return NONE;
    }
  }
  if (cls === "ranged") {
    switch (stance) {
      case "accurate": return { ...NONE, accuracy: 3, strength: 3 };
      case "rapid": return { ...NONE, speedDelta: -1 };
      case "longrange": return { ...NONE, defence: 3, rangeDelta: 2 };
      default: return NONE;
    }
  }
  switch (stance) {
    case "accurate": return { ...NONE, accuracy: 2 };
    case "longrange": return { ...NONE, defence: 3, rangeDelta: 2 };
    default: return NONE;
  }
}

/** Longrange extends range by 2, but no attack range exceeds 10 tiles. */
export const MAX_ATTACK_RANGE = 10;

export function effectiveRange(baseRange: number, bonus: StanceBonus): number {
  if (bonus.rangeDelta === 0) return baseRange;
  return Math.min(MAX_ATTACK_RANGE, baseRange + bonus.rangeDelta);
}
