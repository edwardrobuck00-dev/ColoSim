import { AMMUNITION } from "./ammunition";
import { ARMOUR } from "./armour";
import { CAPES_JEWELLERY } from "./capes-jewellery";
import { FOOD_ITEMS } from "./food";
import { MAGIC_WEAPONS } from "./magic-weapons";
import { MELEE_WEAPONS } from "./melee-weapons";
import { POTIONS } from "./potions";
import { RANGED_WEAPONS } from "./ranged-weapons";
import type { CatalogueEntry } from "./types";

export type { CatalogueEntry } from "./types";

/**
 * The curated item catalogue, one file per category. To add an item: add its
 * exact wiki name to tools/items/item-names.ts, run `pnpm items:fetch`, then
 * add an entry to the matching file here (requirements, special, ammo,
 * consumable effects, tags, notes).
 */
export const CATALOGUE: CatalogueEntry[] = [
  ...MELEE_WEAPONS, ...RANGED_WEAPONS, ...MAGIC_WEAPONS, ...ARMOUR, ...CAPES_JEWELLERY, ...AMMUNITION, ...FOOD_ITEMS, ...POTIONS,
];
