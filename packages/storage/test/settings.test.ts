import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, SETTINGS_KEY, loadSettings, saveSettings, type KeyValueStore } from "../src";

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe("settings", () => {
  it("returns defaults when nothing is stored", () => {
    expect(loadSettings(memoryStore())).toEqual(DEFAULT_SETTINGS);
  });

  it("round-trips saved settings", () => {
    const store = memoryStore();
    saveSettings({ ...DEFAULT_SETTINGS, speed: 2, lockSeed: true }, store);
    expect(loadSettings(store)).toMatchObject({ speed: 2, lockSeed: true });
  });

  it("falls back to defaults on corrupt data", () => {
    const store = memoryStore();
    store.setItem(SETTINGS_KEY, "{not json");
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS);
  });

  it("migrates version 1 (milliseconds per tick) to a speed multiplier", () => {
    const store = memoryStore();
    store.setItem(SETTINGS_KEY, JSON.stringify({ version: 1, tickMs: 1200, followCamera: false }));
    const s = loadSettings(store);
    expect(s).toMatchObject({ version: 2, speed: 0.5, followCamera: false });
    expect(s).not.toHaveProperty("tickMs");
  });

  it("fills in fields added in later versions", () => {
    const store = memoryStore();
    store.setItem(SETTINGS_KEY, JSON.stringify({ version: 2, speed: 4 }));
    const s = loadSettings(store);
    expect(s.speed).toBe(4);
    expect(s.keybinds.pause).toBe("Space");
  });
});

describe("speed values", async () => {
  const { snapSpeed, SettingsSchema, CONFIG_SCHEMAS } = await import("../src");
  it("snap to the nearest supported speed everywhere they are stored", () => {
    expect([0.25, 0.3, 0.7, 1, 1.4, 3, 8, 100, Number.NaN].map(snapSpeed)).toEqual([0.25, 0.25, 0.5, 1, 1, 2, 4, 4, 1]);
    expect(SettingsSchema.parse({ speed: 8 }).speed).toBe(4);
    expect(CONFIG_SCHEMAS.encounter.parse({ encounterId: "x", modifierIds: [], loadoutId: null, speed: 3 }).speed).toBe(2);
  });
});
