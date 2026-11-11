/**
 * Every OSRS item the database includes, by exact wiki item name.
 * `fetch-osrs-items.ts` pulls verified data for each from the OSRS Wiki.
 * To add an item: add its name here, run `pnpm items:fetch`, then add a
 * catalogue entry in packages/content/src/items/osrs/catalogue.ts.
 */
export const ITEM_NAMES = [
  // Melee weapons
  "Abyssal whip", "Rune scimitar", "Dragon scimitar", "Dragon dagger", "Dragon longsword", "Dragon mace",
  "Dragon warhammer", "Armadyl godsword", "Bandos godsword", "Abyssal dagger", "Elder maul", "Ghrazi rapier", "Rune 2h sword",
  "Dragon spear", "Zamorakian hasta", "Dragon halberd", "Dragon battleaxe", "Leaf-bladed battleaxe", "Dragon claws",
  "Abyssal bludgeon", "Saradomin sword", "Rune longsword", "Abyssal tentacle", "Inquisitor's mace",
  // Ranged weapons
  "Magic shortbow", "Rune crossbow", "Armadyl crossbow",
  "Dragon crossbow", "Magic longbow", "Yew shortbow", "Dragon hunter crossbow",
  // Magic weapons
  "Trident of the Seas", "Staff of the dead", "Ancient staff", "Kodai wand",
  "Master wand", "Nightmare staff", "Mystic fire staff",
  // Head
  "Helm of neitiznot", "Rune full helm", "Archer helm", "Farseer helm", "Armadyl helmet", "Ancestral hat",
  "Neitiznot faceguard", "Torva full helm", "Masori mask", "Virtus mask", "Dragon full helm", "Berserker helm", "Justiciar faceguard", "Crystal helm",
  // Body
  "Fighter torso", "Bandos chestplate", "Rune platebody", "Black d'hide body", "Armadyl chestplate",
  "Mystic robe top", "Ahrim's robetop", "Ancestral robe top",
  "Torva platebody", "Masori body", "Virtus robe top", "Dragon platebody", "Justiciar chestguard", "Karil's leathertop", "Crystal body", "Inquisitor's hauberk",
  // Legs
  "Bandos tassets", "Rune platelegs", "Dragon platelegs", "Black d'hide chaps", "Armadyl chainskirt",
  "Mystic robe bottom", "Ahrim's robeskirt", "Ancestral robe bottom",
  "Torva platelegs", "Masori chaps", "Virtus robe bottom", "Justiciar legguards", "Karil's leatherskirt", "Crystal legs", "Inquisitor's plateskirt",
  // Shield
  "Dragon defender", "Rune kiteshield", "Spirit shield", "Mage's book",
  "Avernic defender", "Dragonfire shield", "Crystal shield", "Arcane spirit shield", "Twisted buckler", "Elysian spirit shield",
  // Hands
  "Barrows gloves", "Regen bracelet", "Mithril gloves",
  "Ferocious gloves", "Zaryte vambraces", "Tormented bracelet", "Combat bracelet",
  // Feet
  "Dragon boots", "Climbing boots", "Pegasian boots", "Primordial boots", "Infinity boots",
  "Guardian boots", "Eternal boots", "Bandos boots",
  // Cape
  "Fire cape", "Infernal cape", "Ava's accumulator", "Ava's assembler", "Imbued saradomin cape", "Obsidian cape",
  "Mythical cape", "Saradomin cape",
  // Neck
  "Amulet of glory(4)", "Amulet of fury", "Amulet of torture", "Necklace of anguish", "Occult necklace", "Amulet of strength", "Amulet of power",
  "Amulet of blood fury", "Amulet of rancour",
  // Ring
  "Berserker ring", "Archers ring", "Seers ring", "Warrior ring",
  "Ultor ring", "Venator ring", "Magus ring", "Bellator ring",
  // Ammunition
  "Adamant arrow", "Rune arrow", "Amethyst arrow", "Dragon arrow", "Runite bolts", "Dragon bolts",
  "Adamant bolts",
  // Food
  "Lobster", "Monkfish", "Shark", "Manta ray", "Anglerfish", "Cooked karambwan",
  "Dark crab", "Sea turtle", "Tuna potato",
  // Potions (4-dose versions)
  "Saradomin brew(4)", "Super combat potion(4)", "Ranging potion(4)", "Magic potion(4)", "Prayer potion(4)", "Super restore(4)",
  "Super attack(4)", "Super strength(4)", "Super defence(4)", "Bastion potion(4)", "Battlemage potion(4)",
] as const;

/** Combat spells, by wiki page name. */
export const SPELL_NAMES = ["Fire Bolt", "Fire Blast", "Fire Wave", "Fire Surge"] as const;
