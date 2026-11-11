import type { World } from "../core/world";
import type { CombatStats } from "../defs/common";
import { isOverhead, type PrayerDef } from "../defs/prayer";
import type { PlayerState } from "../entities/types";
import type { PrayerCause } from "../api/events";

const label = (skill: string) => `${skill[0]!.toUpperCase()}${skill.slice(1)}`;

/** Unmet requirements for a prayer, e.g. ["70 Prayer", "70 Defence"]. */
export function missingPrayerRequirements(stats: CombatStats, def: PrayerDef): string[] {
  const out: string[] = [];
  if (stats.prayer < def.level) out.push(`${def.level} Prayer`);
  for (const [skill, level] of Object.entries(def.requirements)) {
    if ((stats[skill as keyof CombatStats] ?? 0) < (level as number)) out.push(`${level} ${label(skill)}`);
  }
  return out;
}

/** Timer side effects when a utility prayer is switched on or off. */
function onToggled(world: World, p: PlayerState, def: PrayerDef, active: boolean): void {
  if (def.utility === "rapid-heal") p.hpRegenTimer = 0; // toggling resets the regen countdown (OSRS Wiki "Rapid Heal")
  if (def.utility === "rapid-restore") p.rapidRestoreTimer = 0; // its own timer starts on activation
  if (def.utility === "preserve") p.preserveSince = active ? world.tick : null;
}

function setInactive(world: World, p: PlayerState, id: string, cause: PrayerCause, replacedBy?: string): void {
  if (!p.activePrayers.includes(id)) return;
  p.activePrayers = p.activePrayers.filter((x) => x !== id);
  const def = world.content.prayers.get(id);
  if (def) onToggled(world, p, def, false);
  world.events.push({ type: "PrayerToggled", prayerId: id, active: false, cause, ...(replacedBy ? { replacedBy } : {}) });
}

/**
 * Turns a prayer on or off. Turning one on switches off active prayers that
 * share a group. Returns a rejection reason, or null on success.
 */
export function togglePrayer(world: World, prayerId: string): string | null {
  const p = world.player;
  const def = world.content.prayers.get(prayerId);
  if (!def) return "no such prayer";
  if (p.activePrayers.includes(prayerId)) {
    setInactive(world, p, prayerId, "player");
    return null;
  }
  const missing = missingPrayerRequirements(p.stats, def);
  if (missing.length) return `needs ${missing.join(", ")}`;
  if (p.prayerPoints <= 0) return "no prayer points left";
  if (isOverhead(def) && world.tick < p.overheadsLockedUntil) {
    return `overhead prayers are disabled for ${p.overheadsLockedUntil - world.tick} more ticks`;
  }
  for (const id of [...p.activePrayers]) {
    const other = world.content.prayers.get(id);
    if (other && other.groups.some((g) => def.groups.includes(g))) setInactive(world, p, id, "conflict", prayerId);
  }
  p.activePrayers.push(prayerId);
  onToggled(world, p, def, true);
  world.events.push({ type: "PrayerToggled", prayerId, active: true, cause: "player" });
  return null;
}

/** Switches off prayers: all of them, or only overheads. */
export function deactivatePrayers(world: World, which: "all" | "overheads", cause: PrayerCause = "mechanic"): void {
  const p = world.player;
  for (const id of [...p.activePrayers]) {
    const def = world.content.prayers.get(id);
    if (which === "all" || (def && isOverhead(def))) setInactive(world, p, id, cause);
  }
}

/** Removes prayer points; at 0 every prayer switches off. */
export function drainPrayerPoints(world: World, points: number, cause: "prayers" | "mechanic" = "prayers"): void {
  const p = world.player;
  if (points <= 0 || p.prayerPoints <= 0) return;
  const amount = Math.min(points, p.prayerPoints);
  p.prayerPoints -= amount;
  world.events.push({ type: "PrayerDrained", amount, cause, pointsLeft: p.prayerPoints, activePrayers: [...p.activePrayers] });
  if (p.prayerPoints === 0) {
    deactivatePrayers(world, "all", "no-points");
    p.prayerDrainCounter = 0;
  }
}

/** The player's protection or utility overhead, for display. */
export function activeOverhead(world: World, p: PlayerState): string | null {
  for (const id of p.activePrayers) {
    const def = world.content.prayers.get(id);
    if (def && isOverhead(def)) return def.protects ?? def.utility ?? def.id;
  }
  return null;
}

export function hasUtility(world: World, p: PlayerState, utility: PrayerDef["utility"]): boolean {
  return p.activePrayers.some((id) => world.content.prayers.get(id)?.utility === utility);
}

/** Drops prayers whose requirements are no longer met (after a level change). */
export function dropUnusablePrayers(world: World): void {
  const p = world.player;
  for (const id of [...p.activePrayers]) {
    const def = world.content.prayers.get(id);
    if (def && missingPrayerRequirements(p.stats, def).length) setInactive(world, p, id, "requirements");
  }
}
