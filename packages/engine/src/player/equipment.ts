import type { ItemBonuses, ItemDef } from "../defs/item";

const zero = () => ({ stab: 0, slash: 0, crush: 0, ranged: 0, magic: 0 });

/** Sum of every equipped item's bonuses. */
export function totalBonuses(items: readonly ItemDef[]): ItemBonuses {
  const total: ItemBonuses = {
    attack: zero(), defence: zero(), meleeStrength: 0, rangedStrength: 0, magicDamagePercent: 0, prayer: 0,
  };
  for (const { bonuses: b } of items) {
    for (const k of Object.keys(total.attack) as Array<keyof ItemBonuses["attack"]>) {
      total.attack[k] += b.attack[k];
      total.defence[k] += b.defence[k];
    }
    total.meleeStrength += b.meleeStrength;
    total.rangedStrength += b.rangedStrength;
    total.magicDamagePercent += b.magicDamagePercent;
    total.prayer += b.prayer;
  }
  return total;
}
