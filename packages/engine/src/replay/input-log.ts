import type { PlayerCommand } from "../api/commands";
import type { SimulationConfig } from "../api/config";
import type { EncounterOutcome } from "../api/events";

/** Commands applied on one tick. Ticks with no commands are omitted. */
export interface InputLogEntry {
  tick: number;
  commands: PlayerCommand[];
}
export type InputLog = InputLogEntry[];

export interface Checkpoint {
  tick: number;
  hash: string;
}

/** Everything needed to reproduce a fight exactly. A few KB for a typical fight. */
export interface Replay {
  format: 1;
  engineVersion: string;
  contentHash: string;
  config: SimulationConfig;
  inputLog: InputLog;
  checkpoints: Checkpoint[];
  durationTicks: number;
  outcome: EncounterOutcome | null;
}

/** How often (in ticks) the simulation records a state hash. */
export const CHECKPOINT_INTERVAL = 50;
