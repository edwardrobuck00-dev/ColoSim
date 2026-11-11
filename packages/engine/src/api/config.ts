import { z } from "zod";
import { CombatStatsSchema, IdSchema } from "../defs/common";

export const DEFAULT_PLAYER_STATS = {
  hitpoints: 99, attack: 99, strength: 99, defence: 99, ranged: 99, magic: 99, prayer: 99,
} as const;

/** An item ID, or an item with a quantity (ammo stacks, potion doses). */
export const SetupItemSchema = z.union([IdSchema, z.object({ itemId: IdSchema, quantity: z.number().int().min(1) })]);
export type SetupItem = z.infer<typeof SetupItemSchema>;

export const PlayerSetupSchema = z.object({
  stats: CombatStatsSchema.default(DEFAULT_PLAYER_STATS),
  /** Worn items by slot. */
  equipment: z.record(z.string(), SetupItemSchema).default({}),
  /** Up to 28 inventory slots (null for empty). */
  inventory: z.array(SetupItemSchema.nullable()).max(28).default([]),
  /** Index into the weapon category's combat styles. */
  combatStyle: z.number().int().min(0).default(0),
  /** Prayers active when the fight starts. */
  prayers: z.array(IdSchema).default([]),
  /** Spell to autocast (staves only). */
  autocastSpellId: IdSchema.nullable().default(null),
  /** Fight back automatically when hit while idle (the classic "Auto Retaliate" option). */
  autoRetaliate: z.boolean().default(false),
});
export type PlayerSetup = z.infer<typeof PlayerSetupSchema>;

export const SimulationConfigSchema = z.object({
  seed: z.number().int(),
  encounterId: IdSchema,
  modifierIds: z.array(IdSchema).default([]),
  player: PlayerSetupSchema.default({
    stats: DEFAULT_PLAYER_STATS, equipment: {}, inventory: [], combatStyle: 0, prayers: [], autocastSpellId: null, autoRetaliate: false,
  }),
});
export type SimulationConfig = z.infer<typeof SimulationConfigSchema>;
export type SimulationConfigInput = z.input<typeof SimulationConfigSchema>;
export type PlayerSetupInput = z.input<typeof PlayerSetupSchema>;
