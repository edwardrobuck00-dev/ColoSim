import type { PlayerCommand } from "../api/commands";
import type { EncounterOutcome, SimEvent } from "../api/events";
import type { ArenaDef } from "../defs/arena";
import type { Tile } from "../defs/common";
import type { EncounterDef } from "../defs/encounter";
import type { ContentRegistry } from "../defs/registry";
import type { NpcState, PlayerState } from "../entities/types";
import type { Grid } from "../map/grid";
import type { ActiveMechanic } from "../mechanics/registry";
import type { PipelineRegistry } from "../mechanics/pipelines";
import type { RngStreams } from "./rng";
import type { Scheduler } from "./scheduler";

/** The complete mutable state of one fight. Owned by the engine; never exposed directly. */
export interface World {
  tick: number;
  readonly content: ContentRegistry;
  readonly encounter: EncounterDef;
  readonly modifierIds: string[];
  readonly arena: ArenaDef;
  readonly grid: Grid;
  readonly rng: RngStreams;
  readonly scheduler: Scheduler;
  readonly pipelines: PipelineRegistry;
  readonly mechanics: ActiveMechanic[];
  player: PlayerState;
  npcs: NpcState[];
  /** Commands waiting for the next tick. */
  pendingCommands: PlayerCommand[];
  /** Events produced during the current tick. */
  events: SimEvent[];
  outcome: EncounterOutcome | null;
  /** Counter for engine-generated IDs (projectiles). Part of the hashed state. */
  nextId: number;
  /** Telegraphed and burning tiles from boss special attacks (npc/hazards.ts). */
  hazards: Hazard[];
}

/** Tiles marked by a special attack: a warning until `detonateTick`, then optionally burning until `lingerUntil`. */
export interface Hazard {
  id: string;
  sourceId: string;
  name: string;
  tiles: Tile[];
  detonateTick: number;
  damageMin: number;
  damageMax: number;
  lingerUntil: number;
  lingerDamage: number;
}
