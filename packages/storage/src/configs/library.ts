import { CONFIG_KINDS, CONFIG_SCHEMA_VERSION, CONFIG_SCHEMAS, migrateConfigData, type ConfigData, type ConfigKind } from "./kinds";
import type { ConfigRecord, ConfigStore } from "./store";

/** Extra checks that need game content (item IDs exist, levels meet requirements). Return a reason, or null if fine. */
export type ConfigValidator = (kind: ConfigKind, data: unknown) => string | null;

export class ConfigError extends Error {
  override name = "ConfigError";
}

/** A portable file of configurations: export from one device, import on another. */
export interface ConfigBundle {
  format: "osrs-combat-sim/configs";
  version: 1;
  exportedAt: string;
  configs: Array<{ kind: ConfigKind; name: string; notes: string; schemaVersion: number; data: unknown }>;
}

export interface ImportReport {
  imported: ConfigRecord[];
  skipped: Array<{ name: string; kind: string; reason: string }>;
}

/**
 * Saved configurations: create, update, rename, duplicate, delete, list, and
 * export / import bundles. Validates every write against the kind's schema
 * (and optional content checks). Storage is pluggable (ConfigStore).
 */
export class ConfigLibrary {
  constructor(
    private readonly store: ConfigStore,
    private readonly opts: { newId?: () => string; now?: () => number; validate?: ConfigValidator } = {},
  ) {}

  private id(): string {
    return this.opts.newId?.() ?? crypto.randomUUID();
  }

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  /** Parses data for a kind (applying defaults) and runs the content validator. Throws ConfigError. */
  parse<K extends ConfigKind>(kind: K, data: unknown): ConfigData<K> {
    if (!CONFIG_KINDS.includes(kind)) throw new ConfigError(`Unknown configuration kind "${kind}"`);
    const r = CONFIG_SCHEMAS[kind].safeParse(data);
    if (!r.success) throw new ConfigError(`Invalid ${kind}: ${r.error.issues.map((i) => `${i.path.join(".") || "(root)"} ${i.message}`).join("; ")}`);
    const reason = this.opts.validate?.(kind, r.data);
    if (reason) throw new ConfigError(reason);
    return r.data as ConfigData<K>;
  }

  async list<K extends ConfigKind>(kind?: K): Promise<Array<ConfigRecord<ConfigData<K>>>> {
    const rows = await this.store.list(kind);
    return rows.map((r) => this.upgrade(r)).sort((a, b) => a.name.localeCompare(b.name)) as Array<ConfigRecord<ConfigData<K>>>;
  }

  async get<K extends ConfigKind>(id: string): Promise<ConfigRecord<ConfigData<K>> | undefined> {
    const r = await this.store.get(id);
    return r ? (this.upgrade(r) as ConfigRecord<ConfigData<K>>) : undefined;
  }

  async create<K extends ConfigKind>(kind: K, name: string, data: unknown, notes = ""): Promise<ConfigRecord<ConfigData<K>>> {
    const t = this.now();
    const record: ConfigRecord<ConfigData<K>> = {
      id: this.id(), kind, name: cleanName(name), notes, data: this.parse(kind, data),
      schemaVersion: CONFIG_SCHEMA_VERSION[kind], createdAt: t, updatedAt: t, revision: 1, origin: "local",
    };
    await this.store.put(record);
    return record;
  }

  /** Changes name, notes and/or data. */
  async update<K extends ConfigKind>(id: string, patch: { name?: string; notes?: string; data?: unknown }): Promise<ConfigRecord<ConfigData<K>>> {
    const cur = await this.get<K>(id);
    if (!cur) throw new ConfigError("That configuration no longer exists.");
    const next: ConfigRecord<ConfigData<K>> = {
      ...cur,
      name: patch.name !== undefined ? cleanName(patch.name) : cur.name,
      notes: patch.notes ?? cur.notes,
      data: patch.data !== undefined ? this.parse(cur.kind as K, patch.data) : cur.data,
      schemaVersion: CONFIG_SCHEMA_VERSION[cur.kind],
      updatedAt: this.now(),
      revision: cur.revision + 1,
    };
    await this.store.put(next);
    return next;
  }

  /** A copy named "<name> (copy)", "<name> (copy 2)"... */
  async duplicate(id: string): Promise<ConfigRecord> {
    const cur = await this.get(id);
    if (!cur) throw new ConfigError("That configuration no longer exists.");
    const names = new Set((await this.store.list(cur.kind)).map((r) => r.name));
    return this.create(cur.kind, uniqueName(`${cur.name} (copy)`, names), cur.data, cur.notes);
  }

  delete(id: string): Promise<void> {
    return this.store.delete(id);
  }

  /** A bundle of the given configurations (all of them if `ids` is omitted). */
  async exportBundle(ids?: string[]): Promise<ConfigBundle> {
    const rows: ConfigRecord[] = [];
    if (ids) {
      for (const id of ids) {
        const r = await this.get(id);
        if (r) rows.push(r);
      }
    } else rows.push(...(await this.list()));
    return {
      format: "osrs-combat-sim/configs",
      version: 1,
      exportedAt: new Date(this.now()).toISOString(),
      configs: rows.map((r) => ({ kind: r.kind, name: r.name, notes: r.notes, schemaVersion: r.schemaVersion, data: r.data })),
    };
  }

  /**
   * Imports a bundle (a parsed object or JSON text). Every configuration is
   * migrated and validated on its own; invalid ones are skipped with a reason.
   * Imported copies get new IDs; a name already in use gets " (imported)".
   */
  async importBundle(input: unknown): Promise<ImportReport> {
    let bundle: unknown = input;
    if (typeof input === "string") {
      try {
        bundle = JSON.parse(input);
      } catch {
        throw new ConfigError("This file is not valid JSON.");
      }
    }
    const b = bundle as Partial<ConfigBundle>;
    if (b?.format !== "osrs-combat-sim/configs" || !Array.isArray(b.configs)) throw new ConfigError("This file is not a combat simulator configuration export.");
    if (b.version !== 1) throw new ConfigError(`Unsupported export version ${String(b.version)}.`);
    const report: ImportReport = { imported: [], skipped: [] };
    const existing = new Map<string, Set<string>>();
    for (const c of b.configs) {
      const name = typeof c?.name === "string" ? c.name : "(unnamed)";
      const kind = c?.kind as ConfigKind;
      try {
        if (!CONFIG_KINDS.includes(kind)) throw new ConfigError(`unknown kind "${String(c?.kind)}"`);
        const version = Number.isInteger(c.schemaVersion) ? c.schemaVersion : 1;
        if (version > CONFIG_SCHEMA_VERSION[kind]) throw new ConfigError(`made by a newer version of the simulator (${kind} v${version})`);
        const data = migrateConfigData(kind, version, c.data);
        if (!existing.has(kind)) existing.set(kind, new Set((await this.store.list(kind)).map((r) => r.name)));
        const names = existing.get(kind)!;
        const finalName = names.has(name) ? uniqueName(`${name} (imported)`, names) : name;
        const rec = await this.create(kind, finalName, data, typeof c.notes === "string" ? c.notes : "");
        names.add(rec.name);
        report.imported.push(rec);
      } catch (e) {
        report.skipped.push({ name, kind: String(c?.kind), reason: (e as Error).message });
      }
    }
    return report;
  }

  /** Records stored with an older schema version are migrated when read. */
  private upgrade(r: ConfigRecord): ConfigRecord {
    if (r.schemaVersion >= CONFIG_SCHEMA_VERSION[r.kind]) return r;
    return { ...r, data: migrateConfigData(r.kind, r.schemaVersion, r.data), schemaVersion: CONFIG_SCHEMA_VERSION[r.kind] };
  }
}

const cleanName = (s: string) => s.trim().slice(0, 80) || "Untitled";

function uniqueName(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = base.replace(/\)$/, ` ${i})`);
    const name = candidate === base ? `${base} ${i}` : candidate;
    if (!taken.has(name)) return name;
  }
}
