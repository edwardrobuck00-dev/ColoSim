import { z } from "zod";

/**
 * User settings, stored as one versioned JSON blob in localStorage so they can
 * be read synchronously at startup. Unknown or invalid data falls back to defaults.
 */
export const SETTINGS_KEY = "sim.settings";
export const SETTINGS_VERSION = 2;

export const KeybindsSchema = z.object({
  cameraLeft: z.string().default("ArrowLeft"),
  cameraRight: z.string().default("ArrowRight"),
  cameraUp: z.string().default("ArrowUp"),
  cameraDown: z.string().default("ArrowDown"),
  toggleRun: z.string().default("KeyR"),
  pause: z.string().default("Space"),
  step: z.string().default("Period"),
  stepBack: z.string().default("Comma"),
  goLive: z.string().default("End"),
  reset: z.string().default("Backspace"),
  cameraReset: z.string().default("KeyC"),
  protectMelee: z.string().default("Digit1"),
  protectRanged: z.string().default("Digit2"),
  protectMagic: z.string().default("Digit3"),
  toggleSpecial: z.string().default("KeyE"),
  // Interface tabs (classic F-key layout; remappable on the Settings page).
  tabCombat: z.string().default("F1"),
  tabSkills: z.string().default("F2"),
  tabInventory: z.string().default("F3"),
  tabEquipment: z.string().default("F4"),
  tabPrayer: z.string().default("F5"),
  tabMagic: z.string().default("F6"),
  tabInfo: z.string().default("F7"),
  tabSimulation: z.string().default("F8"),
  toggleAnalytics: z.string().default("KeyL"),
});
export type Keybinds = z.infer<typeof KeybindsSchema>;

export const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4] as const;

/** The supported speed closest to `v` (non-numbers give 1x), so stored and linked speeds always match a menu option. */
export function snapSpeed(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 1;
  return SPEED_OPTIONS.reduce((best, o) => (Math.abs(o - v) < Math.abs(best - v) ? o : best), 1 as number);
}

/** A speed field: any number is accepted and snapped to the nearest supported option. */
export const SpeedSchema = z.number().default(1).transform(snapSpeed);

export const SettingsSchema = z.object({
  version: z.literal(SETTINGS_VERSION).default(SETTINGS_VERSION),
  /** Simulation speed multiplier: 1 = real time (600 ms per tick). Never changes outcomes. */
  speed: SpeedSchema,
  /** Reset repeats the same seed, so the same inputs give the same fight. */
  lockSeed: z.boolean().default(false),
  followCamera: z.boolean().default(true),
  showTickCounter: z.boolean().default(true),
  showHoverTile: z.boolean().default(true),
  /** Fight back automatically when hit while idle (applied when a fight starts; toggle in the Combat tab). */
  autoRetaliate: z.boolean().default(true),
  keybinds: KeybindsSchema.default(KeybindsSchema.parse({})),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({});

/** The subset of the Web Storage API we need; injectable for tests. */
export type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Upgrades stored settings from older versions. */
export function migrateSettings(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const r = { ...(raw as Record<string, unknown>) };
  if (r.version === 1) {
    // v1 stored milliseconds per tick; v2 stores a speed multiplier.
    if (typeof r.tickMs === "number" && r.tickMs > 0) r.speed = Math.min(8, Math.max(0.25, 600 / r.tickMs));
    delete r.tickMs;
    r.version = 2;
  }
  return r;
}

export function loadSettings(store: KeyValueStore | undefined = globalThis.localStorage): Settings {
  if (!store) return DEFAULT_SETTINGS;
  try {
    const raw = store.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = SettingsSchema.safeParse(migrateSettings(JSON.parse(raw)));
    return parsed.success ? parsed.data : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings, store: KeyValueStore | undefined = globalThis.localStorage): void {
  store?.setItem(SETTINGS_KEY, JSON.stringify(SettingsSchema.parse(settings)));
}
