import type { SimDatabase } from "../db";
import type { ConfigKind } from "./kinds";
import type { ConfigRecord, ConfigStore } from "./store";

/** Configurations in the browser's IndexedDB (the `configs` table). */
export class IndexedDbConfigStore implements ConfigStore {
  constructor(private readonly db: SimDatabase) {}

  list(kind?: ConfigKind): Promise<ConfigRecord[]> {
    return kind ? this.db.configs.where("kind").equals(kind).toArray() : this.db.configs.toArray();
  }

  get(id: string): Promise<ConfigRecord | undefined> {
    return this.db.configs.get(id);
  }

  async put(record: ConfigRecord): Promise<void> {
    await this.db.configs.put(record);
  }

  delete(id: string): Promise<void> {
    return this.db.configs.delete(id);
  }
}
