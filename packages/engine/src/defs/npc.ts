import { z } from "zod";
import { BehaviourSchema, BossSpecialSchema } from "./behaviour";
import { CombatStatsSchema, IdSchema, MechanicRefSchema, StyleBonusesSchema } from "./common";

export const NpcDefSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  /** Footprint in tiles (size x size). */
  size: z.number().int().min(1).max(7).default(1),
  stats: CombatStatsSchema,
  defence: StyleBonusesSchema.default({ stab: 0, slash: 0, crush: 0, ranged: 0, magic: 0 }),
  /** Attack IDs, in rotation order when `ai.selection` is "sequence". */
  attacks: z.array(IdSchema).default([]),
  ai: z
    .object({
      /** "chase" walks toward the player until an attack is in range. */
      movement: z.enum(["stationary", "chase"]).default("stationary"),
      /** "sequence" cycles through attacks in order; "random" picks any attack in range. */
      selection: z.enum(["sequence", "random"]).default("sequence"),
    })
    .default({ movement: "stationary", selection: "sequence" }),
  /**
   * Phases, attack patterns and enrage. When absent, the NPC uses one phase
   * built from `attacks` and `ai` (see npc/behaviour.ts).
   */
  behaviour: BehaviourSchema.optional(),
  /** Special attacks the behaviour can use, by ID. */
  specials: z.array(BossSpecialSchema).default([]),
  /** Ticks between dying and despawning (the death animation window). */
  deathTicks: z.number().int().min(1).default(3),
  /** If set, the NPC respawns this many ticks after despawning. */
  respawnTicks: z.number().int().min(1).optional(),
  /** Behaviour attached to this NPC wherever it appears. */
  mechanics: z.array(MechanicRefSchema).default([]),
  tags: z.array(z.string()).default([]),
  visualId: IdSchema.optional(),
});
export type NpcDef = z.infer<typeof NpcDefSchema>;
export type NpcDefInput = z.input<typeof NpcDefSchema>;
