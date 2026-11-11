import { z } from "zod";
import { IdSchema, MechanicRefSchema } from "./common";

export const EncounterNpcSpawnSchema = z.object({
  npcId: IdSchema,
  /** Name of a spawn point in the arena. */
  spawn: z.string(),
});

export const WinConditionSchema = z.enum(["all-npcs-dead", "none"]);

export const EncounterDefSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  description: z.string(),
  arenaId: IdSchema,
  playerSpawn: z.string(),
  npcs: z.array(EncounterNpcSpawnSchema).default([]),
  mechanics: z.array(MechanicRefSchema).default([]),
  /** Modifier IDs players may enable for this encounter. */
  modifiers: z.array(IdSchema).default([]),
  winCondition: WinConditionSchema.default("all-npcs-dead"),
  /** "end": dying loses the encounter. "respawn": the player comes back (practice areas). */
  playerDeath: z.enum(["end", "respawn"]).default("end"),
  /** Ticks after the player despawns before they respawn (respawn mode only). */
  playerRespawnTicks: z.number().int().min(1).default(5),
  tags: z.array(z.string()).default([]),
});
export type EncounterDef = z.infer<typeof EncounterDefSchema>;
export type EncounterDefInput = z.input<typeof EncounterDefSchema>;
