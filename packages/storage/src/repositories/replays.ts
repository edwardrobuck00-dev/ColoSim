import type { Replay } from "@sim/engine";
import type { ReplayRecord, SimDatabase } from "../db";

export type ReplaySummary = Omit<ReplayRecord, "replay"> & {
  /** Engine version and content hash the replay was recorded with: it can only be rebuilt when both match. */
  engineVersion: string;
  contentHash: string;
};

/**
 * Replay storage behind an interface, so a remote implementation (share codes,
 * accounts) can replace the local one later without changing callers.
 */
export interface ReplayRepository {
  save(replay: Replay): Promise<string>;
  get(id: string): Promise<Replay | null>;
  list(): Promise<ReplaySummary[]>;
  delete(id: string): Promise<void>;
}

export class LocalReplayRepository implements ReplayRepository {
  constructor(
    private readonly db: SimDatabase,
    private readonly newId: () => string = () => crypto.randomUUID(),
  ) {}

  async save(replay: Replay): Promise<string> {
    const id = this.newId();
    await this.db.replays.put({
      id,
      encounterId: replay.config.encounterId,
      modifierIds: replay.config.modifierIds,
      createdAt: Date.now(),
      durationTicks: replay.durationTicks,
      outcome: replay.outcome,
      seed: replay.config.seed,
      replay,
      schemaVersion: 1,
    });
    return id;
  }

  async get(id: string): Promise<Replay | null> {
    return (await this.db.replays.get(id))?.replay ?? null;
  }

  async list(): Promise<ReplaySummary[]> {
    const rows = await this.db.replays.orderBy("createdAt").reverse().toArray();
    return rows.map(({ replay, ...summary }) => ({ ...summary, engineVersion: replay.engineVersion, contentHash: replay.contentHash }));
  }

  delete(id: string): Promise<void> {
    return this.db.replays.delete(id);
  }
}
