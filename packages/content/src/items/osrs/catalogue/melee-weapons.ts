import type { CatalogueEntry } from "./types";

/** Melee weapons. Requirements quote each item's OSRS Wiki page. */
export const MELEE_WEAPONS: CatalogueEntry[] = [
  { name: "Abyssal whip", requirements: { attack: 70 }, animationCue: "attack.slash", // "requires an Attack level of 70"
    special: { name: "Energy Drain", energy: 50, accuracy: [5, 4], defenceStyle: "slash" } },
  { name: "Rune scimitar", requirements: { attack: 40 }, animationCue: "attack.slash" },
  { name: "Dragon scimitar", requirements: { attack: 60 }, animationCue: "attack.slash",
    special: { name: "Sever", energy: 55, accuracy: [5, 4], defenceStyle: "slash" } },
  { name: "Dragon dagger", requirements: { attack: 60 }, animationCue: "attack.stab",
    special: { name: "Puncture", energy: 25, accuracy: [23, 20], damage: [[23, 20]], hits: 2, defenceStyle: "slash" } },
  { name: "Dragon longsword", requirements: { attack: 60 }, animationCue: "attack.slash",
    special: { name: "Cleave", energy: 25, damage: [[5, 4]], defenceStyle: "slash" } },
  { name: "Dragon mace", requirements: { attack: 60 }, animationCue: "attack.crush",
    special: { name: "Shatter", energy: 25, accuracy: [5, 4], damage: [[3, 2]], defenceStyle: "crush" } },
  { name: "Dragon warhammer", requirements: { strength: 60 }, animationCue: "attack.crush",
    special: { name: "Smash", energy: 50, damage: [[3, 2]], defenceStyle: "crush", effects: [{ type: "drain-defence-percent", percent: 30 }], animationCue: "attack.slam" } },
  { name: "Armadyl godsword", requirements: { attack: 75 }, animationCue: "attack.slash",
    special: { name: "The Judgement", energy: 50, accuracy: [2, 1], damage: [[11, 10], [5, 4]], defenceStyle: "slash", animationCue: "attack.slam" } },
  { name: "Bandos godsword", requirements: { attack: 75 }, animationCue: "attack.slash",
    special: { name: "Warstrike", energy: 50, accuracy: [2, 1], damage: [[11, 10], [11, 10]], defenceStyle: "slash", animationCue: "attack.slam",
      // Wiki order is Defence, Strength, Prayer, Attack, Magic, Ranged; NPCs here have no Prayer level.
      effects: [{ type: "drain-levels-by-damage", order: ["defence", "strength", "attack", "magic", "ranged"] }] } },
  { name: "Abyssal dagger", requirements: { attack: 70 }, animationCue: "attack.stab",
    special: { name: "Abyssal Puncture", energy: 25, accuracy: [5, 4], damage: [[17, 20]], hits: 2, linkedAccuracy: true, defenceStyle: "slash" } },
  { name: "Elder maul", requirements: { attack: 75, strength: 75 }, animationCue: "attack.crush",
    special: { name: "Pulverize", energy: 50, accuracy: [5, 4], defenceStyle: "crush", effects: [{ type: "drain-defence-percent", percent: 35 }], animationCue: "attack.slam" } },
  { name: "Ghrazi rapier", requirements: { attack: 80 }, animationCue: "attack.stab" },
  { name: "Rune 2h sword", requirements: { attack: 40 }, animationCue: "attack.slash" },

  // ---- Added with the content expansion (requirements quoted from each item's wiki page, 2026-11) ----
  { name: "Dragon spear", requirements: { attack: 60 }, animationCue: "attack.stab", notes: ["Special attack (Shove) not modelled."] },
  { name: "Zamorakian hasta", requirements: { attack: 70 }, animationCue: "attack.stab", notes: ["Special attack not modelled."] },
  { name: "Dragon halberd", requirements: { attack: 60, strength: 30 }, animationCue: "attack.slash", notes: ["Special attack (Sweep) not modelled.", "Also requires Regicide."] },
  { name: "Dragon battleaxe", requirements: { attack: 60 }, animationCue: "attack.slash", notes: ["Special attack (Rampage) not modelled.", "Also requires Heroes' Quest."] },
  { name: "Leaf-bladed battleaxe", requirements: { attack: 65 }, animationCue: "attack.slash", notes: ["Also requires 55 Slayer.", "Bonus against kurasks and turoths not modelled."] },
  { name: "Dragon claws", requirements: { attack: 60 }, animationCue: "attack.slash", notes: ["Special attack (Slice and Dice) not modelled."] },
  { name: "Abyssal bludgeon", requirements: { attack: 70, strength: 70 }, animationCue: "attack.crush", notes: ["Special attack (Penance) not modelled."] },
  { name: "Saradomin sword", requirements: { attack: 70 }, animationCue: "attack.slash", notes: ["Special attack (Saradomin's Lightning) not modelled."] },
  { name: "Rune longsword", requirements: { attack: 40 }, animationCue: "attack.slash" },
  { name: "Abyssal tentacle", requirements: { attack: 75 }, animationCue: "attack.slash", notes: ["Special attack (Binding Tentacle) not modelled.", "Degrades with use (charges not modelled)."] },
  { name: "Inquisitor's mace", requirements: { attack: 80 }, animationCue: "attack.crush", tags: ["set:inquisitor"], notes: ["Inquisitor's set crush bonus not modelled."] },
];
