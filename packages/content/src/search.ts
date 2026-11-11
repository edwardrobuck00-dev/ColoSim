import type { ItemDef } from "@sim/engine";

export type ItemClass = "melee" | "ranged" | "magic" | "supply" | "neutral";

/**
 * The combat class an item is for. Weapons and ammunition use their tags;
 * other gear goes by which style its offensive bonuses favour; food and
 * potions are "supply"; items with no offensive bonuses are "neutral".
 */
export function itemClass(item: ItemDef): ItemClass {
  const t = item.tags;
  if (t.includes("food") || t.includes("potion")) return "supply";
  for (const c of ["melee", "ranged", "magic"] as const) if (t.includes(c)) return c;
  if (item.ammo) return "ranged";
  const a = item.bonuses.attack;
  const melee = Math.max(a.stab, a.slash, a.crush) + item.bonuses.meleeStrength;
  const ranged = a.ranged + item.bonuses.rangedStrength;
  const magic = a.magic + item.bonuses.magicDamagePercent;
  const best = Math.max(melee, ranged, magic);
  if (best <= 0) return "neutral";
  return best === melee ? "melee" : best === ranged ? "ranged" : "magic";
}

export interface ItemQuery {
  /** Words that must all appear in the name, ID or tags (case-insensitive). */
  text?: string;
  /** Equipment slot, or "supplies" for food and potions (items without a slot). */
  slot?: string;
  class?: ItemClass;
  /** Tags the item must all have, for example ["set:torva"]. */
  tags?: string[];
}

/**
 * Filters items for pickers and lists. Results keep their input order unless
 * text is given, in which case names starting with the text come first.
 */
export function searchItems(items: Iterable<ItemDef>, q: ItemQuery): ItemDef[] {
  const words = (q.text ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const out: ItemDef[] = [];
  for (const item of items) {
    if (q.slot === "supplies" ? item.slot !== undefined : q.slot && item.slot !== q.slot) continue;
    if (q.class && itemClass(item) !== q.class) continue;
    if (q.tags && !q.tags.every((t) => item.tags.includes(t))) continue;
    if (words.length) {
      const hay = `${item.name} ${item.id} ${item.tags.join(" ")}`.toLowerCase();
      if (!words.every((w) => hay.includes(w))) continue;
    }
    out.push(item);
  }
  if (words.length) {
    const first = words.join(" ");
    const starts = (i: ItemDef) => (i.name.toLowerCase().startsWith(first) ? 0 : 1);
    out.sort((x, y) => starts(x) - starts(y));
  }
  return out;
}
