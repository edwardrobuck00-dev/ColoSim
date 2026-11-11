import type { CombatStyle } from "../defs/common";

/**
 * Ticks between an attack and its hit landing.
 * Melee lands the same tick; ranged and magic depend on distance in tiles.
 * Source: commonly documented OSRS projectile delays (see docs/combat-formulas.md, U8).
 */
export function hitDelayTicks(style: CombatStyle, distance: number): number {
  if (style === "ranged") return 1 + Math.floor((3 + distance) / 6);
  if (style === "magic") return 1 + Math.floor((1 + distance) / 3);
  return 0;
}

export const isMelee = (style: CombatStyle): boolean => style === "stab" || style === "slash" || style === "crush";

/** Combat spells take 5 ticks (OSRS Wiki "Attack speed"). */
export const SPELL_ATTACK_SPEED = 5;
