import type { ItemDefInput, WeaponCategory } from "@sim/engine";
import { CATALOGUE, type CatalogueEntry } from "./catalogue";
import { WIKI_ITEMS, type WikiItem } from "./wiki-data.generated";

/** OSRS Wiki combat_style -> engine weapon category. */
const CATEGORY: Record<string, WeaponCategory> = {
  Whip: "whip",
  "Slash Sword": "slash-sword",
  "Stab Sword": "stab-sword",
  "2h Sword": "two-handed-sword",
  Blunt: "blunt",
  Axe: "axe",
  Spear: "spear",
  Claw: "claw",
  Polearm: "polearm",
  Bludgeon: "bludgeon",
  Spiked: "spiked",
  Bow: "bow",
  Crossbow: "crossbow",
  Staff: "staff",
  "Bladed Staff": "bladed-staff",
  "Powered Staff": "powered-staff",
};

export const slugify = (name: string) =>
  name.toLowerCase().replace(/'/g, "").replace(/\(\d\)$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export class ItemBuildError extends Error {
  override name = "ItemBuildError";
}

/** Merges a curated catalogue entry with verified wiki data into an item definition. */
export function buildItem(entry: CatalogueEntry, wiki: WikiItem): ItemDefInput {
  const b = wiki.bonuses;
  const rawSlot = b?.equipment_slot;
  const twoHanded = rawSlot === "2h";
  const slot = twoHanded ? "weapon" : (rawSlot as ItemDefInput["slot"]);
  const n = (v: number | undefined) => v ?? 0;

  let weapon: ItemDefInput["weapon"];
  if (slot === "weapon") {
    const category = b?.combat_style ? CATEGORY[b.combat_style] : undefined;
    if (!category) throw new ItemBuildError(`${entry.name}: unsupported combat style "${b?.combat_style}"`);
    if (!b?.weapon_attack_speed) throw new ItemBuildError(`${entry.name}: no attack speed in wiki data`);
    const range = Number.parseInt(b.weapon_attack_range ?? "1", 10);
    weapon = {
      category,
      attackSpeedTicks: b.weapon_attack_speed,
      rangeTiles: Number.isFinite(range) && range > 0 ? range : 1,
      twoHanded,
      ...(entry.poweredStaff ? { poweredStaff: entry.poweredStaff } : {}),
      ...(entry.firesAmmo ? { ammo: entry.firesAmmo } : {}),
      ...(entry.projectile ? { projectile: { visualId: entry.projectile } } : {}),
      animationCue: entry.animationCue ?? "attack",
      ...(entry.special ? { special: entry.special } : {}),
    };
  }

  return {
    id: entry.id ?? slugify(entry.name),
    name: entry.displayName ?? entry.name,
    ...(slot ? { slot } : {}),
    weightKg: wiki.weightKg,
    stackable: !!entry.ammo,
    bonuses: b
      ? {
          attack: { stab: n(b.stab_attack_bonus), slash: n(b.slash_attack_bonus), crush: n(b.crush_attack_bonus), ranged: n(b.range_attack_bonus), magic: n(b.magic_attack_bonus) },
          defence: { stab: n(b.stab_defence_bonus), slash: n(b.slash_defence_bonus), crush: n(b.crush_defence_bonus), ranged: n(b.range_defence_bonus), magic: n(b.magic_defence_bonus) },
          meleeStrength: n(b.strength_bonus),
          rangedStrength: n(b.ranged_strength_bonus),
          magicDamagePercent: n(b.magic_damage_bonus),
          prayer: n(b.prayer_bonus),
        }
      : undefined,
    requirements: entry.requirements ?? {},
    ...(weapon ? { weapon } : {}),
    ...(entry.ammo ? { ammo: entry.ammo } : {}),
    ...(entry.ammoSavePercent !== undefined ? { ammoSavePercent: entry.ammoSavePercent } : {}),
    ...(entry.consumable ? { consumable: entry.consumable } : {}),
    source: { wikiPage: wiki.wikiPage, wikiVersion: wiki.wikiVersion, wikiRevision: wiki.wikiRevision, itemIds: wiki.itemIds },
    tags: autoTags(entry, slot, weapon?.category),
    notes: entry.notes ?? [],
  };
}

const TIERS = ["bronze", "iron", "steel", "black", "mithril", "adamant", "rune", "dragon", "crystal", "torva", "masori", "virtus", "armadyl", "bandos", "ancestral"];
const CLASS_OF: Partial<Record<WeaponCategory, string>> = { bow: "ranged", crossbow: "ranged", staff: "magic", "powered-staff": "magic", "bladed-staff": "magic" };

/** Tags for search and filters: slot, combat class, weapon category, material tier, plus curated tags. */
function autoTags(entry: CatalogueEntry, slot: string | undefined, category: WeaponCategory | undefined): string[] {
  const tags = new Set<string>(entry.tags ?? []);
  if (slot) tags.add(`slot:${slot}`);
  if (category) {
    tags.add(`category:${category}`);
    tags.add(CLASS_OF[category] ?? "melee");
  }
  if (entry.consumable) tags.add(entry.consumable.kind === "potion" ? "potion" : "food");
  if (entry.ammo) tags.add(`ammo:${entry.ammo.kind}`);
  const lower = entry.name.toLowerCase();
  const tier = TIERS.find((t) => lower.startsWith(t) || lower.includes(` ${t}`));
  if (tier) tags.add(`tier:${tier}`);
  return [...tags].sort();
}

/** All catalogue items, built from wiki data. Throws if any item lacks wiki data. */
export function buildOsrsItems(catalogue: CatalogueEntry[] = CATALOGUE, wikiItems: WikiItem[] = WIKI_ITEMS): ItemDefInput[] {
  const byName = new Map(wikiItems.map((w) => [w.name, w]));
  return catalogue.map((entry) => {
    const wiki = byName.get(entry.name);
    if (!wiki) throw new ItemBuildError(`No wiki data for "${entry.name}". Add it to tools/items/item-names.ts and run pnpm items:fetch.`);
    return buildItem(entry, wiki);
  });
}
