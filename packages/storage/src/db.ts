import type { EncounterOutcome, PlayerSetup, Replay } from "@sim/engine";
import Dexie, { type EntityTable } from "dexie";
import type { ConfigRecord } from "./configs/store";

export interface LoadoutRecord {
  id: string;
  name: string;
  setup: PlayerSetup;
  updatedAt: number;
  schemaVersion: 1;
}

export interface ReplayRecord {
  id: string;
  encounterId: string;
  modifierIds: string[];
  createdAt: number;
  durationTicks: number;
  outcome: EncounterOutcome | null;
  /** The fight's seed (records saved before this field existed lack it). */
  seed?: number;
  replay: Replay;
  schemaVersion: 1;
}

export interface AttemptRecord {
  id?: number;
  encounterId: string;
  /** Sorted, comma-joined modifier IDs, so attempts group by variant. */
  variantKey: string;
  result: "win" | "loss" | "abandoned";
  durationTicks: number;
  createdAt: number;
}

/**
 * IndexedDB schema. Add a new `this.version(n)` block with an `upgrade()`
 * migration for every schema change; never edit an existing version.
 */
export class SimDatabase extends Dexie {
  loadouts!: EntityTable<LoadoutRecord, "id">;
  replays!: EntityTable<ReplayRecord, "id">;
  attempts!: EntityTable<AttemptRecord, "id">;
  configs!: EntityTable<ConfigRecord, "id">;

  constructor(name = "osrs-combat-sim") {
    super(name);
    this.version(1).stores({
      loadouts: "id, name, updatedAt",
      replays: "id, encounterId, createdAt",
      attempts: "++id, [encounterId+variantKey], createdAt",
    });
    // v2: saved configurations of every kind. Existing loadouts move into it (same IDs).
    this.version(2)
      .stores({ configs: "id, kind, name, updatedAt" })
      .upgrade(async (tx) => {
        const old = await tx.table<LoadoutRecord>("loadouts").toArray();
        await tx.table<ConfigRecord>("configs").bulkPut(old.map((l) => ({
          id: l.id, kind: "loadout" as const, name: l.name, notes: "", data: { ...l.setup, quickPrayers: [] },
          schemaVersion: 1, createdAt: l.updatedAt, updatedAt: l.updatedAt, revision: 1, origin: "local" as const,
        })));
      });
  }
}

export const variantKey = (modifierIds: readonly string[]): string => [...modifierIds].sort().join(",");
