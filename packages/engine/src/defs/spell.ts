import { z } from "zod";
import { IdSchema } from "./common";

/** A combat spell that can be autocast from a staff. */
export const SpellDefSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  /** Magic level needed to cast. */
  level: z.number().int().min(1).max(99),
  /** Base max hit before magic damage bonuses. */
  baseMaxHit: z.number().int().min(0),
  /** All combat spells take 5 ticks (OSRS Wiki "Attack speed"). */
  speedTicks: z.number().int().min(1).default(5),
  rangeTiles: z.number().int().min(1).max(10).default(10),
  projectile: z.object({ visualId: IdSchema }).optional(),
  animationCue: z.string().default("attack.cast"),
});
export type SpellDef = z.infer<typeof SpellDefSchema>;
export type SpellDefInput = z.input<typeof SpellDefSchema>;
