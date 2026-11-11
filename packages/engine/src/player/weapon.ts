import type { WeaponCategory } from "../combat/weapon-categories";
import type { ItemDef } from "../defs/item";
import type { SpecialAttackDef } from "../defs/special-attack";

/** What the player attacks with, resolved from the equipped weapon (or fists). */
export interface PlayerWeapon {
  itemId: string | null;
  name: string;
  category: WeaponCategory;
  speedTicks: number;
  rangeTiles: number;
  /** Built-in spell of a powered staff. */
  poweredStaff: { fixedMaxHit?: number; magicDivisor?: number; offset: number } | null;
  projectileVisualId: string | null;
  animationCue: string;
  special: SpecialAttackDef | null;
}

/** Unarmed: 4 ticks, punch/kick/block (OSRS Wiki "Attack speed", "Weapons/Categories"). */
export const UNARMED: PlayerWeapon = {
  itemId: null,
  name: "Unarmed",
  category: "unarmed",
  speedTicks: 4,
  rangeTiles: 1,
  poweredStaff: null,
  projectileVisualId: null,
  animationCue: "attack.punch",
  special: null,
};

export function weaponFromItem(item: ItemDef | undefined): PlayerWeapon {
  if (!item?.weapon) return UNARMED;
  const w = item.weapon;
  return {
    itemId: item.id,
    name: item.name,
    category: w.category,
    speedTicks: w.attackSpeedTicks,
    rangeTiles: w.rangeTiles,
    poweredStaff: w.poweredStaff ?? null,
    projectileVisualId: w.projectile?.visualId ?? null,
    animationCue: w.animationCue,
    special: w.special ?? null,
  };
}

/** Max hit of a powered staff's built-in spell: fixed, or max(1, floor(magic / divisor) + offset). */
export function poweredStaffMaxHit(w: PlayerWeapon, currentMagic: number): number {
  const ps = w.poweredStaff;
  if (!ps) return 0;
  if (ps.magicDivisor) return Math.max(1, Math.floor(currentMagic / ps.magicDivisor) + ps.offset);
  return ps.fixedMaxHit ?? 0;
}
