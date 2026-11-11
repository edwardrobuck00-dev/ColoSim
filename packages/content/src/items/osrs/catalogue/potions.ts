import { type CatalogueEntry, pct, POTION } from "./types";

/** Potions. Requirements quote each item's OSRS Wiki page. */
export const POTIONS: CatalogueEntry[] = [
  { name: "Saradomin brew(4)", id: "saradomin-brew", displayName: "Saradomin brew", consumable: { ...POTION, effects: [
    { type: "drain", skills: ["attack", "strength", "ranged", "magic"], amount: { terms: [pct(10)], flat: 2 } },
    { type: "heal", overheal: true, amount: { terms: [pct(15)], flat: 2 } },
    { type: "boost", skills: ["defence"], amount: { terms: [pct(20)], flat: 2 } },
  ] } },
  { name: "Super combat potion(4)", id: "super-combat-potion", displayName: "Super combat potion",
    consumable: { ...POTION, effects: [{ type: "boost", skills: ["attack", "strength", "defence"], amount: { terms: [pct(15)], flat: 5 } }] } },
  { name: "Ranging potion(4)", id: "ranging-potion", displayName: "Ranging potion",
    consumable: { ...POTION, effects: [{ type: "boost", skills: ["ranged"], amount: { terms: [pct(10)], flat: 4 } }] } },
  { name: "Magic potion(4)", id: "magic-potion", displayName: "Magic potion",
    consumable: { ...POTION, effects: [{ type: "boost", skills: ["magic"], amount: { terms: [], flat: 4 } }] } },
  { name: "Prayer potion(4)", id: "prayer-potion", displayName: "Prayer potion",
    consumable: { ...POTION, effects: [{ type: "restore", skills: ["prayer"], amount: { terms: [{ num: 1, den: 4, mult: 1 }], flat: 7 } }] } },
  { name: "Super restore(4)", id: "super-restore", displayName: "Super restore",
    consumable: { ...POTION, effects: [{ type: "restore", skills: ["attack", "strength", "defence", "ranged", "magic", "prayer"], amount: { terms: [{ num: 1, den: 4, mult: 1 }], flat: 8 } }] } },

  // Boost formulas from each potion's wiki page.
  { name: "Super attack(4)", id: "super-attack", displayName: "Super attack",
    consumable: { ...POTION, effects: [{ type: "boost", skills: ["attack"], amount: { terms: [pct(15)], flat: 5 } }] } },
  { name: "Super strength(4)", id: "super-strength", displayName: "Super strength",
    consumable: { ...POTION, effects: [{ type: "boost", skills: ["strength"], amount: { terms: [pct(15)], flat: 5 } }] } },
  { name: "Super defence(4)", id: "super-defence", displayName: "Super defence",
    consumable: { ...POTION, effects: [{ type: "boost", skills: ["defence"], amount: { terms: [pct(15)], flat: 5 } }] } },
  { name: "Bastion potion(4)", id: "bastion-potion", displayName: "Bastion potion",
    consumable: { ...POTION, effects: [
      { type: "boost", skills: ["ranged"], amount: { terms: [pct(10)], flat: 4 } },
      { type: "boost", skills: ["defence"], amount: { terms: [pct(15)], flat: 5 } },
    ] } },
  { name: "Battlemage potion(4)", id: "battlemage-potion", displayName: "Battlemage potion",
    consumable: { ...POTION, effects: [
      { type: "boost", skills: ["magic"], amount: { terms: [], flat: 4 } },
      { type: "boost", skills: ["defence"], amount: { terms: [pct(15)], flat: 5 } },
    ] } },
];
