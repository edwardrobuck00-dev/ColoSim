import type { CatalogueEntry } from "./types";

/** Ammunition. Requirements quote each item's OSRS Wiki page. */
export const AMMUNITION: CatalogueEntry[] = [
  { name: "Adamant arrow", requirements: { ranged: 30 }, ammo: { kind: "arrow", tier: 30 } },
  { name: "Rune arrow", requirements: { ranged: 40 }, ammo: { kind: "arrow", tier: 40 } },
  { name: "Amethyst arrow", requirements: { ranged: 50 }, ammo: { kind: "arrow", tier: 50 } },
  { name: "Dragon arrow", requirements: { ranged: 60 }, ammo: { kind: "arrow", tier: 60 } },
  { name: "Runite bolts", requirements: { ranged: 61 }, ammo: { kind: "bolt", tier: 61 } },
  { name: "Dragon bolts", requirements: { ranged: 64 }, ammo: { kind: "bolt", tier: 64 } },

  // Adamant bolts: "fired from an adamant crossbow or higher, effectively requiring 46 Ranged".
  { name: "Adamant bolts", requirements: { ranged: 46 }, ammo: { kind: "bolt", tier: 46 } },
];
