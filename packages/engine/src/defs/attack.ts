import { z } from "zod";
import { CombatStyleSchema, IdSchema } from "./common";

/** One NPC attack. Players' attacks come from their weapon instead. */
export const AttackDefSchema = z.object({
  id: IdSchema,
  name: z.string().optional(),
  style: CombatStyleSchema,
  maxHit: z.number().int().min(0),
  speedTicks: z.number().int().min(1),
  rangeTiles: z.number().int().min(1),
  /** The NPC's attack bonus for this attack (used in (level + 9) * (bonus + 64)). */
  accuracyBonus: z.number().int().default(0),
  /**
   * Fraction of damage that still gets through a matching protection prayer
   * (0 = fully blocked, the normal NPC rule). Some bosses partly pierce prayers.
   */
  prayerPenetration: z.number().min(0).max(1).default(0),
  /** Visual-only: a projectile flies from attacker to target until the hit lands. */
  projectile: z.object({ visualId: IdSchema }).optional(),
  /** Semantic animation name; the renderer maps it to a clip or procedural motion. */
  animationCue: z.string().default("attack"),
});
export type AttackDef = z.infer<typeof AttackDefSchema>;
export type AttackDefInput = z.input<typeof AttackDefSchema>;
