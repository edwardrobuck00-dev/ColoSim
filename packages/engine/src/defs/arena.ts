import { z } from "zod";
import { IdSchema, TileSchema } from "./common";

export const ArenaDefSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  width: z.number().int().min(4).max(128),
  height: z.number().int().min(4).max(128),
  blocked: z.array(TileSchema).default([]),
  /** Named spawn points referenced by encounters. */
  spawns: z.record(z.string(), TileSchema),
  visualId: IdSchema.optional(),
});
export type ArenaDef = z.infer<typeof ArenaDefSchema>;
export type ArenaDefInput = z.input<typeof ArenaDefSchema>;
