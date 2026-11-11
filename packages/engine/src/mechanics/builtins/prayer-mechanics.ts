import { z } from "zod";
import { PIPELINES } from "../pipelines";
import { defineMechanic } from "../registry";

/**
 * Encounter prayer mechanics. Used from encounter or modifier data, e.g.
 *   { id: "disable-protection-prayers", params: { everyTicks: 25, lockTicks: 5 } }
 */

/** Every N ticks, switches off overhead prayers and keeps them off for a while. */
export const disableProtectionPrayersMechanic = defineMechanic({
  id: "disable-protection-prayers",
  description: "Periodically switches off overhead prayers and prevents switching them back on for a few ticks.",
  params: z.object({
    everyTicks: z.number().int().min(1),
    lockTicks: z.number().int().min(1),
    /** First activation tick (defaults to everyTicks). */
    firstTick: z.number().int().min(1).optional(),
    message: z.string().default("Your protection prayers have been severed!"),
  }),
  create: ({ everyTicks, lockTicks, firstTick, message }) => ({
    hooks: {
      onTick: (ctx) => {
        const start = firstTick ?? everyTicks;
        if (ctx.tick < start || (ctx.tick - start) % everyTicks !== 0) return;
        ctx.prayer.deactivate("overheads");
        ctx.prayer.lockOverheads(lockTicks);
        ctx.message(message);
      },
    },
  }),
});

/** When the player is hit by matching attacks, drains prayer points (flat plus a percentage of the damage). */
export const drainPrayerOnHitMechanic = defineMechanic({
  id: "drain-prayer-on-hit",
  description: "Hits on the player drain prayer points: flat + percent of damage dealt.",
  params: z.object({
    flat: z.number().int().min(0).default(0),
    percentOfDamage: z.number().min(0).max(1000).default(0),
    /** Only these attack styles (default: all). */
    styles: z.array(z.enum(["stab", "slash", "crush", "ranged", "magic"])).optional(),
    /** Also drain when a protection prayer blocked the hit (damage 0). */
    evenIfBlocked: z.boolean().default(true),
  }),
  create: ({ flat, percentOfDamage, styles, evenIfBlocked }) => ({
    hooks: {
      onHitLanded: (ctx, hit) => {
        if (hit.targetId !== ctx.player.id || hit.sourceId === ctx.player.id) return;
        if (styles && (hit.style === "typeless" || !styles.includes(hit.style))) return;
        if (hit.amount === 0 && !evenIfBlocked) return;
        ctx.prayer.drainPoints(flat + Math.floor((hit.amount * percentOfDamage) / 100));
      },
    },
  }),
});

/** Multiplies the player's total prayer drain effect. */
export const scalePrayerDrainMechanic = defineMechanic({
  id: "scale-prayer-drain",
  description: "Multiplies how fast active prayers drain.",
  params: z.object({ multiplier: z.number().min(0).max(100) }),
  create: ({ multiplier }) => ({
    pipelines: [{ name: PIPELINES.prayerDrainEffect, priority: 100, apply: (v) => v * multiplier }],
  }),
});
