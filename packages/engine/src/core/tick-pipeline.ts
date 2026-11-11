import { applyCommands } from "../systems/commands";
import { runLifecycle } from "../systems/lifecycle";
import { runEncounter } from "../systems/encounter";
import { resolveHits } from "../systems/hit-resolution";
import { runNpcTurns } from "../systems/npc-turns";
import { checkOutcome } from "../systems/outcome";
import { runPlayerTurn } from "../systems/player-turn";
import { runScheduledEvents } from "../systems/scheduled-events";
import type { System } from "../systems/types";
import { runUpkeep } from "../systems/upkeep";

/**
 * The fixed order of one game tick. This order is part of the game's rules:
 * changing it changes outcomes, so it requires an ENGINE_VERSION bump.
 * See docs/tick-order.md.
 */
export const TICK_PIPELINE: ReadonlyArray<readonly [name: string, system: System]> = [
  ["commands", applyCommands],
  ["scheduled-events", runScheduledEvents],
  ["encounter", runEncounter],
  ["npc-turns", runNpcTurns],
  ["player-turn", runPlayerTurn],
  ["hit-resolution", resolveHits],
  ["lifecycle", runLifecycle],
  ["upkeep", runUpkeep],
  ["outcome", checkOutcome],
];
