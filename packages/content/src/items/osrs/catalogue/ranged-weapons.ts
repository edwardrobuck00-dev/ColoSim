import type { CatalogueEntry } from "./types";

/** Ranged weapons. Requirements quote each item's OSRS Wiki page. */
export const RANGED_WEAPONS: CatalogueEntry[] = [
  // "can fire arrows up to amethyst" (amethyst arrows need 50 Ranged). Special not modelled (rolls against magic defence).
  { name: "Magic shortbow", requirements: { ranged: 50 }, firesAmmo: { kind: "arrow", maxTier: 50 }, projectile: "projectile.arrow", animationCue: "attack.shoot" },
  { name: "Rune crossbow", requirements: { ranged: 61 }, firesAmmo: { kind: "bolt", maxTier: 61 }, projectile: "projectile.bolt", animationCue: "attack.shoot" },
  { name: "Armadyl crossbow", requirements: { ranged: 70 }, firesAmmo: { kind: "bolt", maxTier: 64 }, projectile: "projectile.bolt", animationCue: "attack.shoot",
    special: { name: "Armadyl Eye", energy: 40, accuracy: [2, 1] } },

  // ---- Added with the content expansion ----
  // "can fire bolts up to dragon bolts" (64 Ranged).
  { name: "Dragon crossbow", requirements: { ranged: 64 }, firesAmmo: { kind: "bolt", maxTier: 64 }, projectile: "projectile.bolt", animationCue: "attack.shoot", notes: ["Special attack (Annihilate) not modelled."] },
  // "can fire arrows up to amethyst" (50).
  { name: "Magic longbow", requirements: { ranged: 50 }, firesAmmo: { kind: "arrow", maxTier: 50 }, projectile: "projectile.arrow", animationCue: "attack.shoot", notes: ["Special attack (Powershot) not modelled."] },
  // "can fire ammunition up to rune" (40).
  { name: "Yew shortbow", requirements: { ranged: 40 }, firesAmmo: { kind: "arrow", maxTier: 40 }, projectile: "projectile.arrow", animationCue: "attack.shoot" },
  { name: "Dragon hunter crossbow", requirements: { ranged: 70 }, firesAmmo: { kind: "bolt", maxTier: 64 }, projectile: "projectile.bolt", animationCue: "attack.shoot", notes: ["Bonus against dragons not modelled."] },
];
