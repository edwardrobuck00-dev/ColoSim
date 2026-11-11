import {
  ConfigLibrary, IndexedDbConfigStore, MemoryConfigStore, type ConfigKind, type ConfigStore,
} from "@sim/storage";
import { createSimulation, SimulationSetupError, type PlayerSetup, type SetupItem } from "@sim/engine";
import { content } from "./content";
import { db } from "./storage";

const itemId = (e: SetupItem | null | undefined) => (e ? (typeof e === "string" ? e : e.itemId) : null);

function unknownIds(data: Record<string, unknown>): string | null {
  const items: string[] = [];
  const eq = data.equipment as Record<string, SetupItem> | undefined;
  for (const e of Object.values(eq ?? {})) items.push(itemId(e)!);
  for (const e of (data.inventory as Array<SetupItem | null> | undefined) ?? []) if (e) items.push(itemId(e)!);
  const missingItem = items.find((id) => !content.items.has(id));
  if (missingItem) return `Unknown item "${missingItem}" (not in this version's item database)`;
  const prayers = [...((data.prayers ?? data.start ?? []) as string[]), ...((data.quickPrayers ?? data.quick ?? []) as string[])];
  const missingPrayer = prayers.find((id) => !content.prayers.has(id));
  if (missingPrayer) return `Unknown prayer "${missingPrayer}"`;
  const spell = data.autocastSpellId as string | null | undefined;
  if (spell && !content.spells.has(spell)) return `Unknown spell "${spell}"`;
  return null;
}

/** Content checks on top of the schemas: every referenced item, prayer, spell and encounter exists; loadouts start a fight. */
export function validateConfig(kind: ConfigKind, data: unknown): string | null {
  const d = data as Record<string, unknown>;
  const unknown = unknownIds(d);
  if (unknown) return unknown;
  if (kind === "encounter") {
    const enc = content.encounters.get(d.encounterId as string);
    if (!enc) return `Unknown encounter "${String(d.encounterId)}"`;
    const bad = (d.modifierIds as string[]).find((m) => !enc.modifiers.includes(m));
    if (bad) return `"${bad}" is not a modifier of ${enc.name}`;
  }
  if (kind === "loadout") {
    try {
      createSimulation({ seed: 1, encounterId: "training-grounds", player: d as PlayerSetup }, content);
    } catch (e) {
      return e instanceof SimulationSetupError ? e.message : (e as Error).message;
    }
  }
  return null;
}

function makeStore(): ConfigStore {
  try {
    if (typeof indexedDB === "undefined") throw new Error("no IndexedDB");
    return new IndexedDbConfigStore(db);
  } catch {
    return new MemoryConfigStore(); // private browsing: saved until the tab closes
  }
}

/**
 * The app's saved configurations. Local (IndexedDB) for now; a cloud store
 * implementing ConfigStore can replace or wrap this without touching callers.
 */
export const configs = new ConfigLibrary(makeStore(), { validate: validateConfig });
