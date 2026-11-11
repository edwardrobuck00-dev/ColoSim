import { CombatStatsSchema, IdSchema, PlayerSetupSchema, SetupItemSchema } from "@sim/engine";
import { z } from "zod";
import { SpeedSchema } from "../settings";

/**
 * Kinds of saved configuration. A loadout is a complete player setup; the
 * other player kinds are parts of one (so an equipment setup can be applied
 * to any loadout); an encounter preset is the settings for starting a fight.
 */
export const CONFIG_KINDS = ["loadout", "equipment", "stats", "inventory", "prayers", "encounter"] as const;
export type ConfigKind = (typeof CONFIG_KINDS)[number];

export const CONFIG_KIND_LABELS: Record<ConfigKind, string> = {
  loadout: "Loadouts",
  equipment: "Equipment",
  stats: "Stats",
  inventory: "Inventory",
  prayers: "Prayers",
  encounter: "Encounter presets",
};

const QuickPrayers = z.array(IdSchema).default([]);

export const EquipmentConfigSchema = z.object({
  equipment: z.record(z.string(), SetupItemSchema).default({}),
  combatStyle: z.number().int().min(0).default(0),
  autocastSpellId: IdSchema.nullable().default(null),
});
export const StatsConfigSchema = CombatStatsSchema;
export const InventoryConfigSchema = z.object({ inventory: z.array(SetupItemSchema.nullable()).max(28).default([]) });
export const PrayerConfigSchema = z.object({
  /** Prayers active when the fight starts. */
  start: z.array(IdSchema).default([]),
  /** Quick prayers: toggled together from the prayer orb. */
  quick: QuickPrayers,
});
export const LoadoutConfigSchema = PlayerSetupSchema.extend({ quickPrayers: QuickPrayers });
export const EncounterConfigSchema = z.object({
  encounterId: IdSchema,
  modifierIds: z.array(IdSchema).default([]),
  /** A preset loadout ID, a saved loadout ("custom:<id>"), or null for the default. */
  loadoutId: z.string().nullable().default(null),
  seed: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("random") }),
    z.object({ mode: z.literal("fixed"), value: z.number().int() }),
  ]).default({ mode: "random" }),
  speed: SpeedSchema,
  autoRetaliate: z.boolean().default(true),
});

export const CONFIG_SCHEMAS = {
  loadout: LoadoutConfigSchema,
  equipment: EquipmentConfigSchema,
  stats: StatsConfigSchema,
  inventory: InventoryConfigSchema,
  prayers: PrayerConfigSchema,
  encounter: EncounterConfigSchema,
} as const;

export type ConfigData<K extends ConfigKind> = z.infer<(typeof CONFIG_SCHEMAS)[K]>;
export type LoadoutConfig = ConfigData<"loadout">;
export type EncounterConfig = ConfigData<"encounter">;

/** Current schema version per kind. Bump it and add a migration when a kind's data changes shape. */
export const CONFIG_SCHEMA_VERSION: Record<ConfigKind, number> = {
  loadout: 1, equipment: 1, stats: 1, inventory: 1, prayers: 1, encounter: 1,
};

/**
 * Upgrades stored or imported data written with an older schema version.
 * Keyed by kind, then by the version being upgraded *from*.
 */
export const CONFIG_MIGRATIONS: Partial<Record<ConfigKind, Record<number, (data: unknown) => unknown>>> = {};

export function migrateConfigData(kind: ConfigKind, version: number, data: unknown): unknown {
  let v = version;
  let d = data;
  while (v < CONFIG_SCHEMA_VERSION[kind]) {
    const step = CONFIG_MIGRATIONS[kind]?.[v];
    if (!step) throw new Error(`No migration for ${kind} from version ${v}`);
    d = step(d);
    v++;
  }
  return d;
}
