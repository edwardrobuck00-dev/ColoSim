import { ITEMS } from "../items";
import { STARTER_LOADOUTS } from "../loadouts/starter";
import { PRAYERS } from "../prayers";
import { SPELLS } from "../spells";
import type { ContentPack } from "./types";

/** Verified OSRS items, prayers, spells and the built-in loadouts. Bosses build on this pack. */
export const osrsBasePack: ContentPack = {
  id: "osrs-base",
  name: "OSRS items, prayers and spells",
  version: "1.0.0",
  description: "Item stats from the OSRS Wiki (see docs/item-database.md), the standard prayer book and combat spells.",
  items: ITEMS,
  prayers: PRAYERS,
  spells: SPELLS,
  loadouts: STARTER_LOADOUTS,
};
