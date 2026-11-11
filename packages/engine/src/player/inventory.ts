import { applyConsumableEffects, type Vitals } from "../combat/consumables";
import { AUTOCAST_CATEGORIES, combatStyles } from "../combat/weapon-categories";
import type { Rng } from "../core/rng";
import type { CombatStats } from "../defs/common";
import { SKILLS, type EquipmentSlot, type ItemDef, type Skill } from "../defs/item";
import type { ContentRegistry } from "../defs/registry";
import type { ItemStack, PlayerState } from "../entities/types";
import { totalBonuses } from "./equipment";
import { weaponFromItem } from "./weapon";

export const INVENTORY_SIZE = 28;

export type Result<T = object> = ({ ok: true } & T) | { ok: false; reason: string };

const fail = (reason: string): { ok: false; reason: string } => ({ ok: false, reason });

function item(content: ContentRegistry, id: string): ItemDef {
  const def = content.items.get(id);
  if (!def) throw new Error(`Unknown item "${id}"`);
  return def;
}

/** Default quantity for a new stack: doses for potions, otherwise 1. */
export function defaultQuantity(def: ItemDef): number {
  return def.consumable?.doses ?? 1;
}

/** Requirements the player's base levels do not meet, e.g. ["60 Attack"]. */
export function missingRequirements(stats: CombatStats, def: ItemDef): string[] {
  return Object.entries(def.requirements).flatMap(([skill, level]) =>
    (stats[skill as keyof CombatStats] ?? 0) < (level as number) ? [`${level} ${skill[0]!.toUpperCase()}${skill.slice(1)}`] : [],
  );
}

/**
 * Recomputes everything derived from equipment: bonuses and weapon. Keeps
 * the combat style if the new weapon offers it, clears autocast on weapons
 * that cannot autocast, and disarms the special attack on a weapon change.
 */
export function refreshEquipment(p: PlayerState, content: ContentRegistry): void {
  const worn = Object.values(p.equipment).flatMap((s) => (s ? [item(content, s.itemId)] : []));
  p.bonuses = totalBonuses(worn);
  const before = p.weapon.itemId;
  p.weapon = weaponFromItem(p.equipment.weapon ? item(content, p.equipment.weapon.itemId) : undefined);
  if (p.weapon.itemId !== before) {
    p.specialArmed = false;
    if (!AUTOCAST_CATEGORIES.has(p.weapon.category)) p.autocastSpellId = null;
    if (p.combatStyleIndex >= combatStyles(p.weapon.category).length) p.combatStyleIndex = 0;
    const style = combatStyles(p.weapon.category)[p.combatStyleIndex]!;
    if (style.cls === "magic" && AUTOCAST_CATEGORIES.has(p.weapon.category) && !p.autocastSpellId) p.combatStyleIndex = 0;
  }
}

const freeSlots = (inv: Array<ItemStack | null>) => inv.reduce((n, s) => n + (s ? 0 : 1), 0);

/** Equip the item in an inventory slot. The replaced item takes its place. */
export function equipFromInventory(p: PlayerState, content: ContentRegistry, index: number): Result<{ slot: EquipmentSlot; itemId: string }> {
  const stack = p.inventory[index];
  if (!stack) return fail("that slot is empty");
  const def = item(content, stack.itemId);
  if (!def.slot) return fail(`${def.name} cannot be worn`);
  const missing = missingRequirements(p.stats, def);
  if (missing.length) return fail(`${def.name} requires ${missing.join(", ")}`);

  const slot = def.slot;
  const current = p.equipment[slot];
  // Stack identical ammunition.
  if (current && current.itemId === stack.itemId && def.stackable) {
    current.quantity += stack.quantity;
    p.inventory[index] = null;
    refreshEquipment(p, content);
    return { ok: true, slot, itemId: stack.itemId };
  }

  const displaced: ItemStack[] = [];
  if (current) displaced.push(current);
  const weapon = p.equipment.weapon ? item(content, p.equipment.weapon.itemId) : null;
  const unequipShield = slot === "weapon" && def.weapon?.twoHanded && p.equipment.shield;
  const unequipWeapon = slot === "shield" && weapon?.weapon?.twoHanded;
  if (unequipShield) displaced.push(p.equipment.shield!);
  if (unequipWeapon) displaced.push(p.equipment.weapon!);

  // The first displaced item goes where the equipped item was; the rest need free slots.
  if (displaced.length - 1 > freeSlots(p.inventory)) return fail("not enough inventory space");

  p.inventory[index] = displaced[0] ?? null;
  for (const extra of displaced.slice(1)) p.inventory[p.inventory.indexOf(null)] = extra;
  if (unequipShield) delete p.equipment.shield;
  if (unequipWeapon) delete p.equipment.weapon;
  p.equipment[slot] = stack;
  refreshEquipment(p, content);
  return { ok: true, slot, itemId: stack.itemId };
}

/** Move a worn item to the inventory (stacking ammo onto an existing stack). */
export function unequip(p: PlayerState, content: ContentRegistry, slot: EquipmentSlot): Result<{ itemId: string }> {
  const stack = p.equipment[slot];
  if (!stack) return fail("nothing is worn there");
  const def = item(content, stack.itemId);
  const same = def.stackable ? p.inventory.findIndex((s) => s?.itemId === stack.itemId) : -1;
  if (same >= 0) {
    p.inventory[same]!.quantity += stack.quantity;
  } else {
    const free = p.inventory.indexOf(null);
    if (free < 0) return fail("not enough inventory space");
    p.inventory[free] = stack;
  }
  delete p.equipment[slot];
  refreshEquipment(p, content);
  return { ok: true, itemId: stack.itemId };
}

/** Swap two inventory slots. */
export function moveItem(p: PlayerState, from: number, to: number): Result {
  if (from < 0 || to < 0 || from >= INVENTORY_SIZE || to >= INVENTORY_SIZE) return fail("no such slot");
  [p.inventory[from], p.inventory[to]] = [p.inventory[to] ?? null, p.inventory[from] ?? null];
  return { ok: true };
}

export interface ConsumeOutcome {
  itemId: string;
  hitpointsBefore: number;
  hitpointsAfter: number;
  dosesLeft: number;
  /** Every level or resource the item changed, before and after. */
  changes: Array<{ skill: string; from: number; to: number }>;
  /** Ticks added to the attack timer (normal food 3, combo food 2). */
  attackDelayTicks: number;
}

/** Eat or drink the item in an inventory slot. */
export function consumeItem(p: PlayerState, content: ContentRegistry, index: number, tick: number): Result<ConsumeOutcome> {
  const stack = p.inventory[index];
  if (!stack) return fail("that slot is empty");
  const def = item(content, stack.itemId);
  const c = def.consumable;
  if (!c) return fail(`${def.name} cannot be eaten or drunk`);

  if (c.kind === "food" && tick < p.foodReadyTick) return fail("you can't eat yet");
  if (c.kind === "combo-food" && tick < p.comboReadyTick) return fail("you can't eat yet");
  if (c.kind === "potion" && tick < p.potionReadyTick) return fail("you can't drink yet");

  const base: Record<Skill, number> = { ...p.stats };
  const current: Record<Skill, number> = { ...p.levels, prayer: p.prayerPoints, hitpoints: p.hitpoints };
  const before = p.hitpoints;
  const after = applyConsumableEffects({ base, current } satisfies Vitals, c.effects).current;
  const changes = SKILLS.filter((s) => after[s] !== current[s]).map((s) => ({ skill: s, from: current[s], to: after[s] }));
  for (const s of SKILLS) {
    if (s === "hitpoints") p.hitpoints = after.hitpoints;
    else if (s === "prayer") p.prayerPoints = after.prayer;
    else p.levels[s] = after[s];
  }

  if (c.kind === "food") p.foodReadyTick = tick + c.consumeDelayTicks;
  if (c.kind === "combo-food") {
    p.comboReadyTick = tick + c.consumeDelayTicks;
    p.foodReadyTick = Math.max(p.foodReadyTick, tick + c.consumeDelayTicks);
  }
  if (c.kind === "potion") p.potionReadyTick = tick + c.consumeDelayTicks;
  if (c.attackDelayTicks > 0) p.nextAttackTick = Math.max(p.nextAttackTick, tick) + c.attackDelayTicks;

  stack.quantity -= 1;
  if (stack.quantity <= 0) p.inventory[index] = null;
  return { ok: true, itemId: def.id, hitpointsBefore: before, hitpointsAfter: p.hitpoints, dosesLeft: Math.max(0, stack.quantity), changes, attackDelayTicks: c.attackDelayTicks };
}

/** Whether the equipped ranged weapon has suitable ammunition. Weapons that need no ammo always pass. */
export function ammoReady(p: PlayerState, content: ContentRegistry): Result {
  const needs = p.weapon.itemId ? item(content, p.weapon.itemId).weapon?.ammo : undefined;
  if (!needs) return { ok: true };
  const stack = p.equipment.ammo;
  if (!stack || stack.quantity <= 0) return fail("you have no ammunition left");
  const ammo = item(content, stack.itemId).ammo;
  if (!ammo || ammo.kind !== needs.kind) return fail(`you can't use that ammunition with your ${p.weapon.name}`);
  if (ammo.tier > needs.maxTier) return fail(`your ${p.weapon.name} can't fire that ammunition`);
  return { ok: true };
}

/**
 * Uses one piece of ammunition, unless the cape recovers it (Ava's devices:
 * 72% / 80%, OSRS Wiki). Rolls on the given RNG so results stay deterministic.
 * Returns true if the ammo was used up.
 */
export function spendAmmo(p: PlayerState, content: ContentRegistry, rng: Rng): boolean {
  const stack = p.equipment.ammo;
  if (!stack) return false;
  const save = p.equipment.cape ? (item(content, p.equipment.cape.itemId).ammoSavePercent ?? 0) : 0;
  if (save > 0 && rng.int(100) < save) return false;
  stack.quantity -= 1;
  if (stack.quantity <= 0) {
    delete p.equipment.ammo;
    refreshEquipment(p, content);
  }
  return true;
}
