import { z } from "zod";

/** Lower-case kebab IDs, optionally namespaced with dots: "training-dummy", "npc.ashen-warden". */
export const IdSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:[-.][a-z0-9]+)*$/, "IDs must be lower-case kebab-case (dots allowed)");

export const TileSchema = z.object({ x: z.number().int(), y: z.number().int() });
export type Tile = z.infer<typeof TileSchema>;

export const CombatStatsSchema = z.object({
  hitpoints: z.number().int().min(1),
  attack: z.number().int().min(1),
  strength: z.number().int().min(1),
  defence: z.number().int().min(1),
  ranged: z.number().int().min(1),
  magic: z.number().int().min(1),
  prayer: z.number().int().min(1),
});
export type CombatStats = z.infer<typeof CombatStatsSchema>;

export const COMBAT_STYLES = ["stab", "slash", "crush", "ranged", "magic"] as const;
export const CombatStyleSchema = z.enum(COMBAT_STYLES);
export type CombatStyle = z.infer<typeof CombatStyleSchema>;

/** Bonus per style. Used for both attack and defence bonuses. */
export const StyleBonusesSchema = z.object({
  stab: z.number().int().default(0),
  slash: z.number().int().default(0),
  crush: z.number().int().default(0),
  ranged: z.number().int().default(0),
  magic: z.number().int().default(0),
});
export type StyleBonuses = z.infer<typeof StyleBonusesSchema>;

/** A reference from data to a registered mechanic module, with its parameters. */
export const MechanicRefSchema = z.object({
  id: IdSchema,
  params: z.record(z.string(), z.unknown()).default({}),
});
export type MechanicRef = z.infer<typeof MechanicRefSchema>;
