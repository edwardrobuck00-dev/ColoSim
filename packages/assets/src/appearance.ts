/**
 * How items look: a shape and two colours. Used for the gear a character
 * wears in the 3D view and for inventory and equipment icons. Every shape is
 * an original design drawn from primitives; the colours follow each item's
 * general colour scheme so gear is recognisable at a glance (rune is
 * cyan-blue, dragon is red, Armadyl is white and gold, and so on).
 */

export type WeaponShape =
  | "whip" | "scimitar" | "dagger" | "longsword" | "greatsword" | "mace" | "warhammer" | "maul" | "rapier"
  | "shortbow" | "crossbow" | "staff" | "wand" | "trident" | "axe" | "spear" | "halberd" | "claws";

export type ItemShape =
  | WeaponShape
  | "helm" | "hood" | "hat" | "body" | "robe-top" | "legs" | "skirt" | "defender" | "kiteshield" | "book"
  | "gloves" | "bracelet" | "boots" | "cape" | "quiver-cape" | "amulet" | "ring" | "arrows" | "bolts"
  | "fish" | "ray" | "lobster" | "karambwan" | "potion" | "unknown";

export interface ItemAppearance {
  shape: ItemShape;
  /** Main colour (blade, plate, cloth, potion liquid). */
  color: string;
  /** Trim, hilt or detail colour. */
  accent: string;
}

const RUNE = "#3f8fb0";
const DRAGON = "#b3271e";
const GOLD = "#c9a227";
const STEEL = "#c3c8cf";
const WOOD = "#6b4a2a";
const BLACK = "#2b2a2a";
const ARMADYL = "#e4e0d2";
const BANDOS = "#6e6a50";
const ANCESTRAL = "#3d2a5a";
const MYSTIC = "#2f4f8f";

const a = (shape: ItemShape, color: string, accent = color): ItemAppearance => ({ shape, color, accent });

export const ITEM_APPEARANCE: Readonly<Record<string, ItemAppearance>> = {
  // Weapons
  "abyssal-whip": a("whip", "#45403f", "#7a1f1f"),
  "rune-scimitar": a("scimitar", RUNE, WOOD),
  "dragon-scimitar": a("scimitar", DRAGON, GOLD),
  "dragon-dagger": a("dagger", DRAGON, GOLD),
  "dragon-longsword": a("longsword", DRAGON, GOLD),
  "dragon-mace": a("mace", DRAGON, GOLD),
  "dragon-warhammer": a("warhammer", DRAGON, "#7d7f86"),
  "armadyl-godsword": a("greatsword", STEEL, GOLD),
  "bandos-godsword": a("greatsword", STEEL, "#7b7d45"),
  "abyssal-dagger": a("dagger", "#3e4a3e", "#7a1f1f"),
  "elder-maul": a("maul", "#e6dfcb", "#6a5a40"),
  "ghrazi-rapier": a("rapier", "#b7c3cf", "#6d2a7a"),
  "rune-2h-sword": a("greatsword", RUNE, WOOD),
  "magic-shortbow": a("shortbow", "#5b4a2a", "#d9d2b0"),
  "rune-crossbow": a("crossbow", RUNE, WOOD),
  "armadyl-crossbow": a("crossbow", ARMADYL, GOLD),
  "trident-of-the-seas": a("trident", "#2fa0a8", GOLD),
  "staff-of-the-dead": a("staff", "#2e6b3a", BLACK),
  "ancient-staff": a("staff", "#4a3a5a", "#8a6ab0"),
  "kodai-wand": a("wand", "#2c5a8a", GOLD),
  "dragon-spear": a("spear", DRAGON, WOOD),
  "zamorakian-hasta": a("spear", "#5a2a2a", GOLD),
  "dragon-halberd": a("halberd", DRAGON, WOOD),
  "dragon-battleaxe": a("axe", DRAGON, WOOD),
  "leaf-bladed-battleaxe": a("axe", "#7f8c7a", "#4a5a3a"),
  "dragon-claws": a("claws", DRAGON, "#5a5a5a"),
  "abyssal-bludgeon": a("maul", "#3e4a3e", "#7a1f1f"),
  "saradomin-sword": a("greatsword", "#e8e8e8", "#2f4f9f"),
  "rune-longsword": a("longsword", RUNE, WOOD),
  "abyssal-tentacle": a("whip", "#3a4a3a", "#8a3a8a"),
  "inquisitors-mace": a("mace", "#b9b3a2", GOLD),
  "dragon-crossbow": a("crossbow", DRAGON, WOOD),
  "magic-longbow": a("shortbow", "#5b4a2a", "#d9d2b0"),
  "yew-shortbow": a("shortbow", "#8a5a2a", "#d9d2b0"),
  "dragon-hunter-crossbow": a("crossbow", "#3e6b3e", "#c9b48a"),
  "master-wand": a("wand", "#6a5a8a", "#c9a0ff"),
  "nightmare-staff": a("staff", "#4a3a5a", "#b08ad0"),
  "mystic-fire-staff": a("staff", "#5a3a2a", "#ff6a1f"),
  // Head
  "helm-of-neitiznot": a("helm", "#8d8f96", "#e2dccb"),
  "rune-full-helm": a("helm", RUNE),
  "archer-helm": a("helm", "#8d8f96", "#3e6b3e"),
  "farseer-helm": a("helm", "#8d8f96", "#3e4f8f"),
  "armadyl-helmet": a("hood", ARMADYL, GOLD),
  "ancestral-hat": a("hat", ANCESTRAL, GOLD),
  "neitiznot-faceguard": a("helm", "#8d8f96", "#3a3a3a"),
  "torva-full-helm": a("helm", "#5a5550", "#8a1f1f"),
  "masori-mask": a("hood", "#c9a45a", "#5a4a2a"),
  "virtus-mask": a("hat", "#2a2a3a", "#7a3aa0"),
  "dragon-full-helm": a("helm", DRAGON, GOLD),
  "berserker-helm": a("helm", "#8d8f96", "#b3271e"),
  "justiciar-faceguard": a("helm", "#d8d2c0", GOLD),
  "crystal-helm": a("helm", "#a8d8e0", "#e8f4f8"),
  // Body
  "fighter-torso": a("body", "#8a2c22", "#c9b48a"),
  "bandos-chestplate": a("body", BANDOS, "#b08a3a"),
  "rune-platebody": a("body", RUNE),
  "black-dhide-body": a("body", BLACK, "#5a3a2a"),
  "armadyl-chestplate": a("body", ARMADYL, GOLD),
  "mystic-robe-top": a("robe-top", MYSTIC, "#c9b48a"),
  "ahrims-robetop": a("robe-top", "#3c3c3c", "#6a6a6a"),
  "ancestral-robe-top": a("robe-top", ANCESTRAL, GOLD),
  "torva-platebody": a("body", "#5a5550", "#8a1f1f"),
  "masori-body": a("body", "#c9a45a", "#5a4a2a"),
  "virtus-robe-top": a("robe-top", "#2a2a3a", "#7a3aa0"),
  "dragon-platebody": a("body", DRAGON, GOLD),
  "justiciar-chestguard": a("body", "#d8d2c0", GOLD),
  "karils-leathertop": a("body", "#4a3a2a", "#6a6a6a"),
  "crystal-body": a("body", "#a8d8e0", "#e8f4f8"),
  "inquisitors-hauberk": a("body", "#b9b3a2", GOLD),
  // Legs
  "bandos-tassets": a("skirt", BANDOS, "#b08a3a"),
  "rune-platelegs": a("legs", RUNE),
  "dragon-platelegs": a("legs", DRAGON),
  "black-dhide-chaps": a("legs", BLACK, "#5a3a2a"),
  "armadyl-chainskirt": a("skirt", ARMADYL, GOLD),
  "mystic-robe-bottom": a("skirt", MYSTIC),
  "ahrims-robeskirt": a("skirt", "#3c3c3c"),
  "ancestral-robe-bottom": a("skirt", ANCESTRAL, GOLD),
  "torva-platelegs": a("legs", "#5a5550", "#8a1f1f"),
  "masori-chaps": a("legs", "#c9a45a", "#5a4a2a"),
  "virtus-robe-bottom": a("skirt", "#2a2a3a", "#7a3aa0"),
  "justiciar-legguards": a("legs", "#d8d2c0", GOLD),
  "karils-leatherskirt": a("skirt", "#4a3a2a", "#6a6a6a"),
  "crystal-legs": a("legs", "#a8d8e0", "#e8f4f8"),
  "inquisitors-plateskirt": a("skirt", "#b9b3a2", GOLD),
  // Shield
  "dragon-defender": a("defender", DRAGON, GOLD),
  "rune-kiteshield": a("kiteshield", RUNE),
  "spirit-shield": a("kiteshield", "#4a6ab0", "#d8d8e8"),
  "mages-book": a("book", "#6b3a2a", GOLD),
  "avernic-defender": a("defender", "#7a1f1f", "#3a3a3a"),
  "dragonfire-shield": a("kiteshield", "#4a4a4a", "#e8711c"),
  "crystal-shield": a("kiteshield", "#a8d8e0", "#e8f4f8"),
  "arcane-spirit-shield": a("kiteshield", "#4a6ab0", GOLD),
  "elysian-spirit-shield": a("kiteshield", "#4a6ab0", "#f0f0f0"),
  "twisted-buckler": a("kiteshield", "#4a5a3a", "#c9b48a"),
  // Hands
  "barrows-gloves": a("gloves", "#6a5a3a", "#3a3a3a"),
  "regen-bracelet": a("bracelet", "#a07a3a", "#3fbf6a"),
  "mithril-gloves": a("gloves", "#3a3d6a"),
  "ferocious-gloves": a("gloves", "#4a3a3a", "#7a1f1f"),
  "zaryte-vambraces": a("gloves", "#6a3a8a", "#3a3a3a"),
  "tormented-bracelet": a("bracelet", "#5a3a6a", "#a07a3a"),
  "combat-bracelet": a("bracelet", GOLD, "#d8263a"),
  // Feet
  "dragon-boots": a("boots", DRAGON),
  "climbing-boots": a("boots", WOOD),
  "pegasian-boots": a("boots", "#6d6f73", "#e2dccb"),
  "primordial-boots": a("boots", "#7a1f1f", "#3a3a3a"),
  "infinity-boots": a("boots", MYSTIC, "#c9b48a"),
  "guardian-boots": a("boots", "#6d6f73", "#8a5a2a"),
  "eternal-boots": a("boots", MYSTIC, "#3fbfbf"),
  "bandos-boots": a("boots", BANDOS, "#b08a3a"),
  // Cape
  "fire-cape": a("cape", "#e8711c", "#ffc23a"),
  "infernal-cape": a("cape", "#8a1f1a", "#ff6a1f"),
  "avas-accumulator": a("quiver-cape", "#5a4a3a", "#8a8f99"),
  "avas-assembler": a("quiver-cape", "#5a4a3a", "#b3271e"),
  "imbued-saradomin-cape": a("cape", "#2f4f9f", "#f0f0f0"),
  "obsidian-cape": a("cape", "#2e2b2b", "#c94a1a"),
  "mythical-cape": a("cape", "#4a3a6a", "#c9a227"),
  "saradomin-cape": a("cape", "#2f4f9f", "#f0f0f0"),
  // Neck
  "amulet-of-glory": a("amulet", GOLD, "#d8263a"),
  "amulet-of-fury": a("amulet", GOLD, DRAGON),
  "amulet-of-torture": a("amulet", DRAGON, GOLD),
  "necklace-of-anguish": a("amulet", "#3a7a3a", GOLD),
  "occult-necklace": a("amulet", BLACK, "#7a3aa0"),
  "amulet-of-strength": a("amulet", GOLD, "#d8263a"),
  "amulet-of-power": a("amulet", GOLD, "#e8e8e8"),
  "amulet-of-blood-fury": a("amulet", GOLD, "#7a1f1f"),
  "amulet-of-rancour": a("amulet", "#3a3a3a", "#b3271e"),
  // Ring
  "berserker-ring": a("ring", "#8a8f99", "#7a1f1f"),
  "archers-ring": a("ring", "#8a8f99", "#3e6b3e"),
  "seers-ring": a("ring", "#8a8f99", "#3e4f8f"),
  "warrior-ring": a("ring", "#8a8f99", "#b3271e"),
  "ultor-ring": a("ring", GOLD, "#b3271e"),
  "venator-ring": a("ring", GOLD, "#3e6b3e"),
  "magus-ring": a("ring", GOLD, "#3e4f8f"),
  "bellator-ring": a("ring", GOLD, "#8a8f99"),
  // Ammunition
  "adamant-arrow": a("arrows", "#4f7a4f", WOOD),
  "rune-arrow": a("arrows", RUNE, WOOD),
  "amethyst-arrow": a("arrows", "#9a5ac9", WOOD),
  "dragon-arrow": a("arrows", DRAGON, WOOD),
  "runite-bolts": a("bolts", RUNE),
  "dragon-bolts": a("bolts", DRAGON),
  "adamant-bolts": a("bolts", "#4f7a4f"),
  // Food
  lobster: a("lobster", "#c8402a", "#f0c080"),
  monkfish: a("fish", "#b8946e", "#7a5a3a"),
  shark: a("fish", "#8a8f99", "#c9a07a"),
  "manta-ray": a("ray", "#6a6aa0", "#c9a07a"),
  anglerfish: a("fish", "#a0607a", "#e0b080"),
  "cooked-karambwan": a("karambwan", "#5a4a2a", "#8a6a3a"),
  "dark-crab": a("lobster", "#4a3a5a", "#c9a07a"),
  "sea-turtle": a("fish", "#4a6a3a", "#c9a07a"),
  "tuna-potato": a("karambwan", "#c9a06a", "#f0e0b0"),
  // Potions (liquid colour)
  "saradomin-brew": a("potion", "#e8d44a"),
  "super-combat-potion": a("potion", "#2f6b2f"),
  "ranging-potion": a("potion", "#3a8fbf"),
  "magic-potion": a("potion", "#c99a6a"),
  "prayer-potion": a("potion", "#3abfa0"),
  "super-restore": a("potion", "#c94a6a"),
  "super-attack": a("potion", "#3a4fbf"),
  "super-strength": a("potion", "#e8e8e8"),
  "super-defence": a("potion", "#d8c84a"),
  "bastion-potion": a("potion", "#8a5a2a"),
  "battlemage-potion": a("potion", "#6a3a6a"),
};

const SLOT_FALLBACK: Record<string, ItemShape> = {
  head: "helm", body: "body", legs: "legs", shield: "kiteshield", hands: "gloves", feet: "boots",
  cape: "cape", neck: "amulet", ring: "ring", ammo: "arrows", weapon: "scimitar",
};

/** Appearance of an item; unknown items get a neutral grey shape for their slot. */
export function itemAppearance(itemId: string | null | undefined, slot?: string | null): ItemAppearance {
  const known = itemId ? ITEM_APPEARANCE[itemId] : undefined;
  if (known) return known;
  return a((slot && SLOT_FALLBACK[slot]) || "unknown", "#8a8a8a", "#5a5a5a");
}

export function isWeaponShape(shape: ItemShape): shape is WeaponShape {
  return ["whip", "scimitar", "dagger", "longsword", "greatsword", "mace", "warhammer", "maul", "rapier", "shortbow", "crossbow", "staff", "wand", "trident", "axe", "spear", "halberd", "claws"].includes(shape);
}
