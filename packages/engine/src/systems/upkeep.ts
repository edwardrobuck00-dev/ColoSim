import { LEVEL_RESTORE_INTERVAL_TICKS, decayTowardBase } from "../combat/consumables";
import { drainPrayerTick } from "../combat/prayer";
import { regenSpecialEnergy } from "../combat/special-attack";
import type { World } from "../core/world";
import { engineContext } from "../mechanics/runtime";
import { MAX_RUN_ENERGY, isAlive } from "../entities/types";
import { PIPELINES } from "../mechanics/pipelines";
import { drainPrayerPoints, hasUtility } from "../player/prayers";
import { clamp } from "../util/math";
import { HITPOINT_REGEN_INTERVAL, regenerateNpcHitpoints } from "./lifecycle";

/**
 * Placeholder rates (hundredths of a percent per tick). Real weight- and
 * agility-based formulas arrive later.
 */
export const BASE_RUN_DRAIN_PER_TICK = 67;
export const BASE_RUN_REGEN_PER_TICK = 27;

/** Preserve must be active this long before it postpones a boost decay (15 s). OSRS Wiki "Preserve". */
export const PRESERVE_WARMUP_TICKS = 25;
/** Preserve postpones a boost decay by 30 s. */
export const PRESERVE_EXTENSION_TICKS = 50;

const COMBAT_SKILLS = ["attack", "strength", "defence", "ranged", "magic"] as const;

/** Phase 8: resource upkeep: hitpoints, prayer, levels, special energy and run energy. */
export function runUpkeep(world: World): void {
  regenerateNpcHitpoints(world);
  const p = world.player;
  if (!isAlive(p)) return;
  drainPrayer(world);
  playerHitpoints(world);
  restoreLevels(world);
  const spec = regenSpecialEnergy(p.specialEnergy, p.specialRegenTimer);
  p.specialEnergy = spec.energy;
  p.specialRegenTimer = spec.timer;
  runEnergy(world);
}

/** Active prayers drain points through the drain counter; at 0 points all prayers switch off. */
function drainPrayer(world: World): void {
  const p = world.player;
  if (p.activePrayers.length === 0) return;
  const base = p.activePrayers.reduce((sum, id) => sum + (world.content.prayers.get(id)?.drainEffect ?? 0), 0);
  const total = Math.max(0, world.pipelines.run(PIPELINES.prayerDrainEffect, base, engineContext(world)));
  const { counter, pointsLost } = drainPrayerTick(p.prayerDrainCounter, total, p.bonuses.prayer);
  p.prayerDrainCounter = counter;
  drainPrayerPoints(world, pointsLost);
}

/**
 * The player's own hitpoint timer: every interval (100 ticks; 50 with Rapid
 * Heal), damaged hitpoints regenerate by 1 and overhealed hitpoints drop by 1.
 * Toggling Rapid Heal resets the timer (OSRS Wiki "Rapid Heal").
 */
function playerHitpoints(world: World): void {
  const p = world.player;
  const base = world.pipelines.run(PIPELINES.hitpointRegenInterval, HITPOINT_REGEN_INTERVAL, engineContext(world));
  const interval = Math.max(1, hasUtility(world, p, "rapid-heal") ? Math.floor(base / 2) : base);
  p.hpRegenTimer += 1;
  if (p.hpRegenTimer < interval) return;
  p.hpRegenTimer = 0;
  const change = p.hitpoints < p.maxHitpoints ? 1 : p.hitpoints > p.maxHitpoints ? -1 : 0;
  if (change === 0) return;
  p.hitpoints += change;
  world.events.push({ type: "Regenerated", entityId: p.id, amount: change, hitpoints: p.hitpoints });
}

/**
 * Every 100 ticks drained combat levels restore by 1. Boosted levels decay by
 * 1 at the same time unless Preserve has been active for 25+ ticks, which
 * postpones that decay by 50 ticks. Rapid Restore runs a separate 100-tick
 * timer from its activation that restores drained levels again.
 * Sources: OSRS Wiki "Temporary skill boost", "Preserve", "Rapid Restore".
 */
function restoreLevels(world: World): void {
  const p = world.player;
  const restoreDrained = () => {
    for (const k of COMBAT_SKILLS) if (p.levels[k] < p.stats[k]) p.levels[k] += 1;
  };
  const decayBoosted = () => {
    for (const k of COMBAT_SKILLS) if (p.levels[k] > p.stats[k]) p.levels[k] = decayTowardBase(p.levels[k], p.stats[k]);
  };

  if (world.tick % LEVEL_RESTORE_INTERVAL_TICKS === 0) {
    restoreDrained();
    const preserved = p.preserveSince !== null && world.tick - p.preserveSince >= PRESERVE_WARMUP_TICKS;
    if (preserved) p.pendingBoostDecayTick = world.tick + PRESERVE_EXTENSION_TICKS;
    else decayBoosted();
  }
  if (p.pendingBoostDecayTick !== null && world.tick >= p.pendingBoostDecayTick) {
    p.pendingBoostDecayTick = null;
    decayBoosted();
  }
  if (hasUtility(world, p, "rapid-restore")) {
    p.rapidRestoreTimer += 1;
    if (p.rapidRestoreTimer >= LEVEL_RESTORE_INTERVAL_TICKS) {
      p.rapidRestoreTimer = 0;
      restoreDrained();
    }
  }
}

function runEnergy(world: World): void {
  const p = world.player;
  const ctx = engineContext(world);
  const ranThisTick = world.events.some((e) => e.type === "EntityMoved" && e.entityId === p.id && e.running);
  if (ranThisTick) {
    const drain = world.pipelines.run(PIPELINES.runEnergyDrain, BASE_RUN_DRAIN_PER_TICK, ctx);
    p.runEnergy = clamp(p.runEnergy - drain, 0, MAX_RUN_ENERGY);
    if (p.runEnergy === 0 && p.running) {
      p.running = false;
      world.events.push({ type: "RunToggled", running: false });
    }
  } else {
    const regen = world.pipelines.run(PIPELINES.runEnergyRegen, BASE_RUN_REGEN_PER_TICK, ctx);
    p.runEnergy = clamp(p.runEnergy + regen, 0, MAX_RUN_ENERGY);
  }
}
