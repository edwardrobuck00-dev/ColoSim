import type { CatalogueEntry } from "./types";

/** Magic weapons. Requirements quote each item's OSRS Wiki page. */
export const MAGIC_WEAPONS: CatalogueEntry[] = [
  // Trident max hit: floor(Magic / 3) - 5 (wiki "Trident of the Seas", Maximum hit).
  { name: "Trident of the Seas", requirements: { magic: 75 }, poweredStaff: { magicDivisor: 3, offset: -5 }, projectile: "projectile.arcane-bolt", animationCue: "attack.cast" },
  { name: "Staff of the dead", requirements: { magic: 75, attack: 75 }, animationCue: "attack.slash" },
  { name: "Ancient staff", requirements: { attack: 50, magic: 50 }, animationCue: "attack.crush" },
  { name: "Kodai wand", requirements: { magic: 80 }, animationCue: "attack.crush" },

  // ---- Added with the content expansion ----
  { name: "Master wand", requirements: { magic: 60 }, animationCue: "attack.crush" },
  { name: "Nightmare staff", requirements: { magic: 72, hitpoints: 50 }, animationCue: "attack.crush" },
  { name: "Mystic fire staff", requirements: { attack: 40, magic: 40 }, animationCue: "attack.crush", notes: ["Unlimited fire runes are not relevant here."] },
];
