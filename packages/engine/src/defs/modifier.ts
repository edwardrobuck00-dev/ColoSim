import { z } from "zod";
import { IdSchema, MechanicRefSchema } from "./common";

/** A named bundle of mechanics layered on top of an encounter (a "contract"-style variant). */
export const ModifierDefSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  description: z.string(),
  mechanics: z.array(MechanicRefSchema).default([]),
  tags: z.array(z.string()).default([]),
});
export type ModifierDef = z.infer<typeof ModifierDefSchema>;
export type ModifierDefInput = z.input<typeof ModifierDefSchema>;
