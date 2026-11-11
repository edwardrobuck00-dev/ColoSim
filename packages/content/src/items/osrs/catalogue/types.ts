import type { ConsumableInput, ItemDefInput, SpecialAttackDefInput } from "@sim/engine";

type SpecialInput = SpecialAttackDefInput;

/**
 * Curated fields for each item; everything numeric that the wiki's item
 * tables hold (bonuses, attack speed, range, combat style, weight) comes from
 * wiki-data.generated.ts instead and is never typed by hand.
 *
 * Requirements quote the item's wiki page (see docs/item-database.md).
 * Specials use OSRS Wiki "Special attacks" plus the wiki DPS calculator's
 * exact fractions. Consumables use the formulas on each item's wiki page.
 */
/**
 * One curated catalogue entry. Everything numeric that the wiki's item tables
 * hold comes from wiki-data.generated.ts instead and is never typed by hand.
 */
export interface CatalogueEntry {
  /** Exact OSRS Wiki item name. */
  name: string;
  /** Override the generated ID / display name (e.g. potions drop the dose suffix). */
  id?: string;
  displayName?: string;
  requirements?: ItemDefInput["requirements"];
  special?: SpecialInput;
  /** Ammunition this weapon fires. */
  firesAmmo?: { kind: "arrow" | "bolt"; maxTier: number };
  /** For ammunition: kind and tier (its Ranged requirement). */
  ammo?: { kind: "arrow" | "bolt"; tier: number };
  ammoSavePercent?: number;
  poweredStaff?: { fixedMaxHit?: number; magicDivisor?: number; offset?: number };
  consumable?: ConsumableInput;
  projectile?: string;
  animationCue?: string;
  /** Extra search tags (slot, class, category and tier tags are added automatically), e.g. "set:torva". */
  tags?: string[];
  /** Effects the simulator does not model, shown to players (set bonuses, passives, non-combat requirements). */
  notes?: string[];
}


/** Helpers for consumable effects (fractions of a level, flat amounts). */
export const pct = (n: number) => ({ num: n, den: 100, mult: 1 });
export const FOOD = { kind: "food" as const, attackDelayTicks: 3 };
export const heal = (n: number) => ({ type: "heal" as const, amount: { terms: [], flat: n } });
export const POTION = { kind: "potion" as const, doses: 4, attackDelayTicks: 0 };
