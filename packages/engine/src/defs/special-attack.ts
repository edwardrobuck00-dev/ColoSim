import { z } from "zod";
import { CombatStyleSchema } from "./common";

const FactorSchema = z.tuple([z.number().int(), z.number().int().positive()]);

export const SpecialEffectSchema = z.discriminatedUnion("type", [
  /** Lower the target's Defence by a percentage of its current level (on an accurate hit). */
  z.object({ type: z.literal("drain-defence-percent"), percent: z.number().int().min(1).max(100) }),
  /** Drain the target's levels by the damage dealt, in the given order. */
  z.object({
    type: z.literal("drain-levels-by-damage"),
    order: z.array(z.enum(["defence", "strength", "attack", "magic", "ranged"])).min(1),
  }),
]);
export type SpecialEffect = z.infer<typeof SpecialEffectSchema>;

/**
 * A weapon's special attack, described by the documented building blocks:
 * energy cost, accuracy and damage multipliers (integer fractions, applied in
 * order with truncation), hit count and effects.
 */
export const SpecialAttackDefSchema = z.object({
  name: z.string().min(1),
  /** Energy cost in percent (5 to 100). */
  energy: z.number().int().min(1).max(100),
  /** Multiplier on the attack roll, e.g. [2, 1] for double accuracy. */
  accuracy: FactorSchema.optional(),
  /** Multipliers on the max hit, applied in order: e.g. [[11, 10], [5, 4]]. */
  damage: z.array(FactorSchema).default([]),
  /** Number of hits. */
  hits: z.number().int().min(1).max(4).default(1),
  /** If true, every hit shares the first hit's accuracy roll. */
  linkedAccuracy: z.boolean().default(false),
  /** Defence type the special rolls against, if different from the selected style. */
  defenceStyle: CombatStyleSchema.optional(),
  effects: z.array(SpecialEffectSchema).default([]),
  animationCue: z.string().optional(),
});
export type SpecialAttackDef = z.infer<typeof SpecialAttackDefSchema>;
export type SpecialAttackDefInput = z.input<typeof SpecialAttackDefSchema>;
