import { STARTER_LOADOUTS } from "@sim/content";
import { PlayerSetupSchema, SimulationSetupError, createSimulation, type PlayerSetup } from "@sim/engine";
import type { LoadoutConfig } from "@sim/storage";
import { configs } from "./configs";
import { content } from "./content";

export interface Loadout {
  /** Presets use their own IDs; saved loadouts are prefixed "custom:". */
  id: string;
  name: string;
  setup: PlayerSetup;
  /** Prayers the prayer orb toggles in a fight. */
  quickPrayers: string[];
  custom: boolean;
  updatedAt?: number;
}

export const PRESETS: Loadout[] = STARTER_LOADOUTS.map((p) => {
  const setup = PlayerSetupSchema.parse(p.setup);
  return { id: p.id, name: p.name, setup, quickPrayers: defaultQuickPrayers(setup), custom: false };
});

/** A sensible quick-prayer set for presets: the best offensive prayer for the weapon's style, from what the stats allow. */
function defaultQuickPrayers(setup: PlayerSetup): string[] {
  const options = ["piety", "rigour", "augury"].filter((id) => {
    const p = content.prayers.get(id);
    return p && p.level <= setup.stats.prayer && Object.entries(p.requirements).every(([k, v]) => (setup.stats as Record<string, number>)[k]! >= (v as number));
  });
  return options.slice(0, 1);
}

const CUSTOM = "custom:";

const split = (data: LoadoutConfig): { setup: PlayerSetup; quickPrayers: string[] } => {
  const { quickPrayers, ...setup } = data;
  return { setup: PlayerSetupSchema.parse(setup), quickPrayers };
};

export async function listCustomLoadouts(): Promise<Loadout[]> {
  try {
    const rows = await configs.list("loadout");
    // One unreadable record must not hide the others.
    return rows.flatMap((r) => {
      try {
        return [{ id: `${CUSTOM}${r.id}`, name: r.name, ...split(r.data), custom: true, updatedAt: r.updatedAt }];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

export async function findLoadout(id: string): Promise<Loadout | null> {
  const preset = PRESETS.find((p) => p.id === id);
  if (preset) return preset;
  if (!id.startsWith(CUSTOM)) return null;
  try {
    const r = await configs.get<"loadout">(id.slice(CUSTOM.length));
    return r ? { id, name: r.name, ...split(r.data), custom: true, updatedAt: r.updatedAt } : null;
  } catch {
    return null; // unreadable record: treated as missing
  }
}

/** Creates (id null) or updates a saved loadout; returns its app ID ("custom:<id>"). */
export async function saveCustomLoadout(id: string | null, name: string, setup: PlayerSetup, quickPrayers: string[] = []): Promise<string> {
  const data = { ...setup, quickPrayers };
  if (id?.startsWith(CUSTOM)) {
    await configs.update(id.slice(CUSTOM.length), { name, data });
    return id;
  }
  const rec = await configs.create("loadout", name, data);
  return `${CUSTOM}${rec.id}`;
}

export async function deleteCustomLoadout(id: string): Promise<void> {
  if (id.startsWith(CUSTOM)) await configs.delete(id.slice(CUSTOM.length));
}

export const configIdOf = (loadoutId: string): string | null => (loadoutId.startsWith(CUSTOM) ? loadoutId.slice(CUSTOM.length) : null);

/** Null if the engine accepts the setup; otherwise the engine's reason. */
export function validateSetup(setup: PlayerSetup): string | null {
  try {
    createSimulation({ seed: 1, encounterId: "training-grounds", player: setup }, content);
    return null;
  } catch (e) {
    if (e instanceof SimulationSetupError) return e.message;
    return (e as Error).message;
  }
}
