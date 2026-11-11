import type { CatalogueEntry } from "./types";

/** Capes, necks and rings. Requirements quote each item's OSRS Wiki page. */
export const CAPES_JEWELLERY: CatalogueEntry[] = [
  { name: "Fire cape" },
  { name: "Infernal cape" },
  { name: "Ava's accumulator", ammoSavePercent: 72 }, // 72% recovered, 8% dropped, 20% broken
  { name: "Ava's assembler", requirements: { ranged: 70 }, ammoSavePercent: 80 }, // 80% recovered
  { name: "Imbued saradomin cape" },
  { name: "Obsidian cape" },
  { name: "Amulet of glory(4)", id: "amulet-of-glory", displayName: "Amulet of glory" },
  { name: "Amulet of fury" },
  { name: "Amulet of torture", requirements: { hitpoints: 75 } },
  { name: "Necklace of anguish", requirements: { hitpoints: 75 } },
  { name: "Occult necklace", requirements: { magic: 70 } },
  { name: "Amulet of strength" },
  { name: "Amulet of power" },
  { name: "Berserker ring" },
  { name: "Archers ring" },
  { name: "Seers ring" },
  { name: "Warrior ring" },

  // ---- Added with the content expansion ----
  { name: "Mythical cape", notes: ["Also requires Dragon Slayer II."] },
  { name: "Saradomin cape", notes: ["Charge (God spell) bonus not modelled."] },
  { name: "Amulet of blood fury", notes: ["Passive healing (20% chance to heal 30% of melee damage) not modelled."] },
  { name: "Amulet of rancour", requirements: { hitpoints: 90 } },
  { name: "Ultor ring" },
  { name: "Venator ring" },
  { name: "Magus ring" },
  { name: "Bellator ring" },
];
