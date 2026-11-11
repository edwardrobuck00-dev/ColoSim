import { type CatalogueEntry, FOOD, heal } from "./types";

/** Food. Requirements quote each item's OSRS Wiki page. */
export const FOOD_ITEMS: CatalogueEntry[] = [
  { name: "Lobster", consumable: { ...FOOD, effects: [heal(12)] } },
  { name: "Monkfish", consumable: { ...FOOD, effects: [heal(16)] } },
  { name: "Shark", consumable: { ...FOOD, effects: [heal(20)] } },
  { name: "Manta ray", consumable: { ...FOOD, effects: [heal(22)] } },
  // floor(hp/10) + 2*floor(hp/25) + 5*floor(hp/93) + 2, can overheal (wiki "Anglerfish")
  { name: "Anglerfish", consumable: { ...FOOD, effects: [{ type: "heal", overheal: true, amount: { terms: [{ num: 1, den: 10, mult: 1 }, { num: 1, den: 25, mult: 2 }, { num: 1, den: 93, mult: 5 }], flat: 2 } }] } },
  // Heals 18; 2-tick attack delay; can be eaten in the same tick after other food.
  { name: "Cooked karambwan", consumable: { kind: "combo-food", attackDelayTicks: 2, effects: [heal(18)] } },

  // Heal amounts from each item's wiki page.
  { name: "Dark crab", consumable: { ...FOOD, effects: [heal(22)] } },
  { name: "Sea turtle", consumable: { ...FOOD, effects: [heal(21)] } },
  { name: "Tuna potato", consumable: { ...FOOD, effects: [heal(22)] } },
];
