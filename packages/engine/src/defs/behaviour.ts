import { z } from "zod";
import { IdSchema, StyleBonusesSchema } from "./common";

/**
 * Data-driven NPC and boss behaviour. A boss is a list of phases; each phase
 * says how the NPC moves, which attacks it uses and in what pattern, how often
 * it uses a special attack, and what happens when the phase begins. An
 * optional enrage makes it faster and harder hitting. The engine runs this
 * data generically (systems/npc-turns.ts, npc/behaviour.ts); nothing here is
 * specific to one boss.
 */

const RatioSchema = z.tuple([z.number().int().min(0), z.number().int().min(1)]);

/** How a phase chooses its next normal attack (among attacks currently in range). */
export const AttackPatternSchema = z.discriminatedUnion("type", [
  /** Fixed cycle: A, B, C, A, B, C... (skips attacks that are out of range). */
  z.object({ type: z.literal("rotation"), attacks: z.array(IdSchema).min(1) }),
  /** Weighted random pick each attack (the "ai" RNG stream). */
  z.object({
    type: z.literal("random"),
    attacks: z.array(z.object({ attack: IdSchema, weight: z.number().positive().default(1) })).min(1),
  }),
  /**
   * Uses one attack `every` times, then switches to another: the next in the
   * list ("rotation") or a different one at random ("random").
   */
  z.object({
    type: z.literal("switch"),
    attacks: z.array(IdSchema).min(2),
    every: z.number().int().min(1),
    order: z.enum(["rotation", "random"]).default("rotation"),
  }),
]);
export type AttackPattern = z.infer<typeof AttackPatternSchema>;

/** Things that happen once, on the tick a phase begins. */
export const PhaseEntrySchema = z.object({
  /** Overhead text (yellow, above the NPC). */
  say: z.string().optional(),
  /** Chatbox line. */
  message: z.string().optional(),
  /** Takes no damage for this many ticks. */
  invulnerableTicks: z.number().int().min(0).default(0),
  /** Does not move or attack for this many ticks. */
  pauseTicks: z.number().int().min(0).default(0),
  /** Teleports to this arena spawn point. */
  moveTo: z.string().optional(),
  /** Heals this percentage of max hitpoints. */
  healPercent: z.number().min(0).max(100).default(0),
  /** Uses this special attack immediately (after the pause, if any). */
  special: IdSchema.optional(),
});

export const PhaseSchema = z.object({
  id: IdSchema,
  name: z.string().optional(),
  /** Begins when hitpoints fall to this percentage or below. Ignored for the first phase. */
  atHpPercent: z.number().min(0).max(100).optional(),
  movement: z.enum(["stationary", "chase"]).default("chase"),
  pattern: AttackPatternSchema,
  /** Used instead of the pattern when the target is within this attack's range (e.g. a slam when adjacent). */
  closeRange: z.object({ attack: IdSchema, chance: z.number().min(0).max(1).default(1) }).optional(),
  /** Overrides every attack's speed in this phase. */
  attackSpeedTicks: z.number().int().min(1).optional(),
  /** Defence bonuses in this phase (default: the NPC's own). */
  defence: StyleBonusesSchema.optional(),
  /** Every `every`-th attack is a special attack instead, taken from `ids`. */
  specials: z
    .object({
      every: z.number().int().min(1),
      ids: z.array(IdSchema).min(1),
      order: z.enum(["rotation", "random"]).default("rotation"),
    })
    .optional(),
  onEnter: PhaseEntrySchema.default({ invulnerableTicks: 0, pauseTicks: 0, healPercent: 0 }),
});
export type PhaseDef = z.infer<typeof PhaseSchema>;

/** Enrage: below a hitpoint threshold, after a time limit, or both (whichever comes first). */
export const EnrageSchema = z
  .object({
    atHpPercent: z.number().min(0).max(100).optional(),
    afterTicks: z.number().int().min(1).optional(),
    /** Added to attack speed (negative = faster). Never below 1 tick. */
    attackSpeedDelta: z.number().int().default(-1),
    maxHitMultiplier: RatioSchema.default([1, 1]),
    accuracyMultiplier: RatioSchema.default([1, 1]),
    say: z.string().optional(),
    message: z.string().optional(),
  })
  .refine((e) => e.atHpPercent !== undefined || e.afterTicks !== undefined, "enrage needs atHpPercent or afterTicks");
export type EnrageDef = z.infer<typeof EnrageSchema>;

/**
 * A boss special attack: a named use of a registered special kind (see
 * npc/specials.ts) with its parameters.
 */
export const BossSpecialSchema = z.object({
  id: IdSchema,
  name: z.string(),
  kind: IdSchema,
  params: z.record(z.string(), z.unknown()).default({}),
  /** Animation cue played when the special starts. */
  animationCue: z.string().default("attack.special"),
  /** Overhead text when the special starts. */
  say: z.string().optional(),
  /** Attack cooldown after the special (default: the phase's normal speed). */
  cooldownTicks: z.number().int().min(1).optional(),
});
export type BossSpecialDef = z.infer<typeof BossSpecialSchema>;

export const BehaviourSchema = z.object({
  phases: z.array(PhaseSchema).min(1),
  enrage: EnrageSchema.optional(),
});
export type BehaviourDef = z.infer<typeof BehaviourSchema>;
