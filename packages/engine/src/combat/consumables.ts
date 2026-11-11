import type { ConsumableEffect, LevelAmount, Skill } from "../defs/item";

/** sum(floor(level * num / den) * mult) + flat. */
export function levelAmount(level: number, a: LevelAmount): number {
  return a.terms.reduce((s, t) => s + Math.floor((level * t.num) / t.den) * t.mult, a.flat);
}

/** Levels that consumables act on. Hitpoints and prayer are current points; others are current levels. */
export interface Vitals {
  base: Record<Skill, number>;
  current: Record<Skill, number>;
}

/**
 * Applies consumable effects in order. Sources (OSRS Wiki):
 * - heal: food heals up to max; overheal items (anglerfish, Saradomin brew)
 *   can go above max by up to the amount healed.
 * - boost: "visible boosts do not stack": level becomes at most base + amount,
 *   and never decreases (Temporary skill boost).
 * - drain: based on the current level (Saradomin brew).
 * - restore: up to base (super restore, prayer potion).
 */
export function applyConsumableEffects(v: Vitals, effects: readonly ConsumableEffect[]): Vitals {
  const current = { ...v.current };
  for (const e of effects) {
    if (e.type === "heal") {
      const amount = levelAmount(v.base.hitpoints, e.amount);
      const hp = current.hitpoints;
      const max = v.base.hitpoints;
      current.hitpoints = e.overheal ? Math.max(hp, Math.min(hp + amount, max + amount)) : hp >= max ? hp : Math.min(max, hp + amount);
    } else if (e.type === "boost") {
      for (const s of e.skills) {
        const amount = levelAmount(v.base[s], e.amount);
        current[s] = Math.max(current[s], Math.min(current[s] + amount, v.base[s] + amount));
      }
    } else if (e.type === "drain") {
      for (const s of e.skills) current[s] = Math.max(0, current[s] - levelAmount(current[s], e.amount));
    } else {
      for (const s of e.skills) {
        if (s === "hitpoints") continue; // restores never heal
        if (current[s] < v.base[s]) current[s] = Math.min(v.base[s], current[s] + levelAmount(v.base[s], e.amount));
      }
    }
  }
  return { base: v.base, current };
}

/** Boosted and drained levels move 1 toward base every 100 ticks (1 minute). OSRS Wiki "Temporary skill boost". */
export const LEVEL_RESTORE_INTERVAL_TICKS = 100;

export function decayTowardBase(current: number, base: number): number {
  return current > base ? current - 1 : current < base ? current + 1 : current;
}
