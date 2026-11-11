import type { PlayerSetupInput } from "@sim/engine";

export interface LoadoutPreset {
  id: string;
  name: string;
  setup: PlayerSetupInput;
}

const stats = (n: number, over: Partial<Record<string, number>> = {}) => ({
  hitpoints: n, attack: n, strength: n, defence: n, ranged: n, magic: n, prayer: n, ...over,
});
const many = (item: string, n: number) => Array.from({ length: n }, () => item);

/**
 * Presets built only from verified OSRS items; every item's requirements are
 * met by the preset's levels (checked by the content tests).
 * combatStyle indexes follow each weapon category's style list.
 */
export const STARTER_LOADOUTS: LoadoutPreset[] = [
  {
    id: "melee-70",
    name: "Melee (level 70, dragon scimitar)",
    setup: {
      stats: stats(70),
      equipment: {
        weapon: "dragon-scimitar", head: "helm-of-neitiznot", body: "fighter-torso", legs: "dragon-platelegs", shield: "dragon-defender",
        hands: "barrows-gloves", feet: "dragon-boots", cape: "fire-cape", neck: "amulet-of-glory", ring: "berserker-ring",
      },
      inventory: ["dragon-dagger", "super-combat-potion", "prayer-potion", "prayer-potion", ...many("shark", 10), ...many("cooked-karambwan", 4)],
      combatStyle: 1,
    },
  },
  {
    id: "ranged-70",
    name: "Ranged (level 70, magic shortbow)",
    setup: {
      stats: stats(70),
      equipment: {
        weapon: "magic-shortbow", ammo: { itemId: "rune-arrow", quantity: 500 }, head: "archer-helm", body: "black-dhide-body",
        legs: "black-dhide-chaps", hands: "barrows-gloves", feet: "climbing-boots", cape: "avas-accumulator", neck: "amulet-of-glory", ring: "archers-ring",
      },
      inventory: ["ranging-potion", "prayer-potion", "prayer-potion", ...many("shark", 10), ...many("cooked-karambwan", 4)],
      combatStyle: 1,
    },
  },
  {
    id: "magic-75",
    name: "Magic (level 75, trident)",
    setup: {
      stats: stats(75),
      equipment: {
        weapon: "trident-of-the-seas", shield: "mages-book", head: "farseer-helm", body: "mystic-robe-top", legs: "mystic-robe-bottom",
        hands: "barrows-gloves", feet: "infinity-boots", cape: "imbued-saradomin-cape", neck: "occult-necklace", ring: "seers-ring",
      },
      inventory: ["magic-potion", "prayer-potion", "prayer-potion", ...many("shark", 10), ...many("cooked-karambwan", 4)],
      combatStyle: 0,
    },
  },
  {
    id: "spells-75",
    name: "Magic (level 75, Fire Wave)",
    setup: {
      stats: stats(75),
      equipment: {
        weapon: "ancient-staff", shield: "mages-book", head: "farseer-helm", body: "mystic-robe-top", legs: "mystic-robe-bottom",
        hands: "barrows-gloves", feet: "infinity-boots", cape: "imbued-saradomin-cape", neck: "occult-necklace", ring: "seers-ring",
      },
      inventory: ["prayer-potion", "prayer-potion", ...many("shark", 10)],
      combatStyle: 4,
      autocastSpellId: "fire-wave",
    },
  },
  {
    id: "melee-99",
    name: "Melee (level 99, whip + warhammer)",
    setup: {
      stats: stats(99),
      equipment: {
        weapon: "abyssal-whip", head: "helm-of-neitiznot", body: "bandos-chestplate", legs: "bandos-tassets", shield: "dragon-defender",
        hands: "barrows-gloves", feet: "primordial-boots", cape: "infernal-cape", neck: "amulet-of-torture", ring: "berserker-ring",
      },
      inventory: ["dragon-warhammer", "super-combat-potion", "saradomin-brew", "saradomin-brew", "super-restore", "super-restore", ...many("anglerfish", 8), ...many("cooked-karambwan", 4)],
      combatStyle: 1,
    },
  },
  {
    id: "ranged-99",
    name: "Ranged (level 99, Armadyl crossbow)",
    setup: {
      stats: stats(99),
      equipment: {
        weapon: "armadyl-crossbow", ammo: { itemId: "dragon-bolts", quantity: 500 }, shield: "spirit-shield", head: "armadyl-helmet",
        body: "armadyl-chestplate", legs: "armadyl-chainskirt", hands: "barrows-gloves", feet: "pegasian-boots", cape: "avas-assembler",
        neck: "necklace-of-anguish", ring: "archers-ring",
      },
      inventory: ["ranging-potion", "saradomin-brew", "super-restore", ...many("anglerfish", 8), ...many("cooked-karambwan", 4)],
      combatStyle: 1,
    },
  },
  {
    id: "melee-99-ags",
    name: "Melee (level 99, Armadyl godsword)",
    setup: {
      stats: stats(99),
      equipment: {
        weapon: "armadyl-godsword", head: "helm-of-neitiznot", body: "bandos-chestplate", legs: "bandos-tassets",
        hands: "barrows-gloves", feet: "primordial-boots", cape: "infernal-cape", neck: "amulet-of-torture", ring: "berserker-ring",
      },
      inventory: ["super-combat-potion", ...many("anglerfish", 8)],
      combatStyle: 1,
    },
  },
];
