import { addFactor, applyFactors, type Factor } from "./factors";

/** Every hit a player deals is capped at 200 (OSRS Wiki "Maximum melee hit", global damage cap). */
export const PLAYER_DAMAGE_CAP = 200;

/**
 * Melee and ranged base max hit:
 *   floor((effectiveStrength * (strengthBonus + 64) + 320) / 640)
 * which equals floor(0.5 + eff * (bonus + 64) / 640).
 * Source: OSRS Wiki "Maximum melee hit" step two, "Maximum ranged hit" step two.
 */
export function strengthMaxHit(effStrength: number, strengthBonus: number): number {
  return Math.trunc((effStrength * (strengthBonus + 64) + 320) / 640);
}

/**
 * Bonus damage (special attacks, slayer/salve-style gear): each factor is
 * applied in order with truncation after each. Godswords, for example, apply
 * x11/10 and then their own factor.
 */
export function applyDamageFactors(maxHit: number, factors: readonly Factor[]): number {
  return applyFactors(maxHit, factors);
}

/**
 * Magic max hit: base spell damage plus percentage magic damage bonuses.
 *   base + floor(base * damageBonusTenths / 1000)
 * Damage bonuses are summed first (equipment magic damage %, magic prayers
 * +1% to +4%), as on the wiki's "Maximum magic hit" primary damage line.
 * Bonuses are in tenths of a percent: 40 = +4%.
 */
export function magicMaxHit(baseMaxHit: number, damageBonusTenthsPercent: number): number {
  return addFactor(baseMaxHit, [damageBonusTenthsPercent, 1000]);
}

/**
 * NPC max hit from stats, when no fixed max hit is given:
 *   floor(((9 + level) * (strengthBonus + 64) + 320) / 640)
 * Many NPC attacks (most magic ones) instead have a fixed max hit.
 * Source: wiki DPS calculator (NPCVsPlayerCalc.getNPCMaxHit).
 */
export function npcMaxHit(level: number, strengthBonus: number): number {
  return Math.trunc(((9 + level) * (strengthBonus + 64) + 320) / 640);
}
