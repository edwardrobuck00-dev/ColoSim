import type { ContentRegistry, EquipmentSlot, ItemDef, PlayerSetup, SetupItem } from "@sim/engine";
import { EQUIPMENT_SLOTS } from "@sim/engine";

export { totalBonuses } from "@sim/engine";

export const setupItemId = (entry: SetupItem): string => (typeof entry === "string" ? entry : entry.itemId);
export const setupQuantity = (entry: SetupItem, def: ItemDef | undefined): number =>
  typeof entry === "string" ? (def?.consumable?.doses ?? 1) : entry.quantity;

export function equippedItems(setup: PlayerSetup, registry: ContentRegistry): Partial<Record<EquipmentSlot, ItemDef>> {
  const out: Partial<Record<EquipmentSlot, ItemDef>> = {};
  for (const slot of EQUIPMENT_SLOTS) {
    const entry = setup.equipment[slot];
    const item = entry ? registry.items.get(setupItemId(entry)) : undefined;
    if (item) out[slot] = item;
  }
  return out;
}

/** Display name with dose count for potions, e.g. "Super restore(3)". */
export function stackLabel(def: ItemDef | undefined, quantity: number): string {
  if (!def) return "?";
  if (def.consumable && def.consumable.doses > 1) return `${def.name}(${quantity})`;
  return def.name;
}

/** "Requires 70 Attack, 40 Defence" or null. */
export function requirementText(def: ItemDef): string | null {
  const parts = Object.entries(def.requirements).map(([k, v]) => `${v} ${k[0]!.toUpperCase()}${k.slice(1)}`);
  return parts.length ? `Requires ${parts.join(", ")}` : null;
}
