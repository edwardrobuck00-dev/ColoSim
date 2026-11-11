import type { ConfigKind } from "./kinds";

/**
 * One saved configuration. `revision` and `updatedAt` let a future cloud
 * store sync and resolve conflicts (last writer wins per record, or a merge
 * UI); `origin` says where the record lives.
 */
export interface ConfigRecord<D = unknown> {
  id: string;
  kind: ConfigKind;
  name: string;
  notes: string;
  data: D;
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
  /** Increments on every change. */
  revision: number;
  origin: "local" | "cloud";
}

/**
 * Where configurations are kept. The library talks only to this interface,
 * so local IndexedDB storage can be swapped for (or combined with) a cloud
 * implementation without changing callers. All methods are async.
 */
export interface ConfigStore {
  list(kind?: ConfigKind): Promise<ConfigRecord[]>;
  get(id: string): Promise<ConfigRecord | undefined>;
  put(record: ConfigRecord): Promise<void>;
  delete(id: string): Promise<void>;
}

/** In-memory store: tests, and the fallback when IndexedDB is unavailable (private browsing). */
export class MemoryConfigStore implements ConfigStore {
  private readonly rows = new Map<string, ConfigRecord>();

  async list(kind?: ConfigKind): Promise<ConfigRecord[]> {
    return [...this.rows.values()].filter((r) => !kind || r.kind === kind).map((r) => structuredCloneSafe(r));
  }

  async get(id: string): Promise<ConfigRecord | undefined> {
    const r = this.rows.get(id);
    return r ? structuredCloneSafe(r) : undefined;
  }

  async put(record: ConfigRecord): Promise<void> {
    this.rows.set(record.id, structuredCloneSafe(record));
  }

  async delete(id: string): Promise<void> {
    this.rows.delete(id);
  }
}

const structuredCloneSafe = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
