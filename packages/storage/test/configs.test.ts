import "fake-indexeddb/auto";
import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { ConfigLibrary, IndexedDbConfigStore, MemoryConfigStore, SimDatabase } from "../src";

const stats = { hitpoints: 99, attack: 90, strength: 95, defence: 80, ranged: 70, magic: 60, prayer: 77 };

function lib(validate?: (kind: string, data: unknown) => string | null) {
  let n = 0;
  let t = 1_000;
  return new ConfigLibrary(new MemoryConfigStore(), { newId: () => `id-${++n}`, now: () => (t += 10), validate });
}

describe("ConfigLibrary", () => {
  it("creates every kind with defaults applied, and lists by kind sorted by name", async () => {
    const l = lib();
    await l.create("stats", "Zerker", stats);
    await l.create("stats", "Maxed", { ...stats, attack: 99 });
    await l.create("equipment", "Whip set", { equipment: { weapon: "abyssal-whip" } });
    await l.create("inventory", "Supplies", { inventory: ["shark", null, { itemId: "rune-arrow", quantity: 100 }] });
    await l.create("prayers", "Melee", { start: ["piety"], quick: ["piety", "protect-from-melee"] });
    await l.create("loadout", "Full", { stats, equipment: {}, inventory: [] });
    await l.create("encounter", "Warden practice", { encounterId: "ashen-warden", modifierIds: ["severed-faith"], seed: { mode: "fixed", value: 7 } });
    expect((await l.list("stats")).map((r) => r.name)).toEqual(["Maxed", "Zerker"]);
    const eq = (await l.list("equipment"))[0]!;
    expect(eq.data).toEqual({ equipment: { weapon: "abyssal-whip" }, combatStyle: 0, autocastSpellId: null });
    const full = (await l.list("loadout"))[0]!;
    expect(full.data).toMatchObject({ prayers: [], quickPrayers: [], combatStyle: 0, autoRetaliate: false });
    const enc = (await l.list("encounter"))[0]!;
    expect(enc.data).toMatchObject({ loadoutId: null, speed: 1, autoRetaliate: true, seed: { mode: "fixed", value: 7 } });
    expect(await l.list()).toHaveLength(7);
  });

  it("rejects invalid data with a readable reason, and runs the content validator", async () => {
    const l = lib((kind, data) => (kind === "equipment" && JSON.stringify(data).includes("no-such-item") ? "Unknown item no-such-item" : null));
    await expect(l.create("stats", "Bad", { ...stats, attack: 0 })).rejects.toThrow(/Invalid stats: attack/);
    await expect(l.create("inventory", "Too many", { inventory: Array(29).fill("shark") })).rejects.toThrow(/inventory/);
    await expect(l.create("equipment", "Bad item", { equipment: { weapon: "no-such-item" } })).rejects.toThrow("Unknown item no-such-item");
  });

  it("updates (bumping the revision), renames, duplicates with unique names, and deletes", async () => {
    const l = lib();
    const a = await l.create("stats", "Mine", stats);
    const b = await l.update(a.id, { name: "  Renamed  ", data: { ...stats, attack: 99 } });
    expect(b).toMatchObject({ name: "Renamed", revision: 2, createdAt: a.createdAt });
    expect(b.updatedAt).toBeGreaterThan(a.updatedAt);
    const c1 = await l.duplicate(a.id);
    const c2 = await l.duplicate(a.id);
    expect([c1.name, c2.name]).toEqual(["Renamed (copy)", "Renamed (copy 2)"]);
    expect(c1.data).toEqual(b.data);
    expect(c1.id).not.toBe(a.id);
    await l.delete(a.id);
    expect((await l.list("stats")).map((r) => r.name).sort()).toEqual(["Renamed (copy 2)", "Renamed (copy)"].sort());
    await expect(l.update("missing", { name: "x" })).rejects.toThrow(/no longer exists/);
  });

  it("exports and imports bundles: round trip, name clashes, and per-item validation", async () => {
    const from = lib();
    const s = await from.create("stats", "Zerker", stats);
    await from.create("prayers", "Melee", { start: ["piety"], quick: ["protect-from-melee"] });
    const all = await from.exportBundle();
    expect(all).toMatchObject({ format: "osrs-combat-sim/configs", version: 1 });
    expect(all.configs).toHaveLength(2);
    expect((await from.exportBundle([s.id])).configs.map((c) => c.name)).toEqual(["Zerker"]);

    const to = lib();
    await to.create("stats", "Zerker", { ...stats, attack: 1 });
    const text = JSON.stringify({
      ...all,
      configs: [...all.configs, { kind: "stats", name: "Broken", notes: "", schemaVersion: 1, data: { attack: "lots" } },
        { kind: "weapon-skins", name: "Odd", notes: "", schemaVersion: 1, data: {} },
        { kind: "stats", name: "Future", notes: "", schemaVersion: 99, data: stats }],
    });
    const report = await to.importBundle(text);
    expect(report.imported.map((r) => r.name).sort()).toEqual(["Melee", "Zerker (imported)"]);
    expect(report.skipped.map((s2) => s2.name)).toEqual(["Broken", "Odd", "Future"]);
    expect(report.skipped[2]!.reason).toMatch(/newer version/);
    expect((await to.list("stats")).find((r) => r.name === "Zerker (imported)")!.data).toEqual(stats);
    await expect(to.importBundle("{not json")).rejects.toThrow(/not valid JSON/);
    await expect(to.importBundle({ hello: 1 })).rejects.toThrow(/not a combat simulator configuration/);
  });

  it("works the same on IndexedDB", async () => {
    const db = new SimDatabase(`cfg-${Math.random()}`);
    const l = new ConfigLibrary(new IndexedDbConfigStore(db));
    const a = await l.create("inventory", "Pots", { inventory: ["super-restore"] });
    await l.duplicate(a.id);
    expect((await l.list("inventory")).map((r) => r.name)).toEqual(["Pots", "Pots (copy)"]);
    expect(await l.list("stats")).toEqual([]);
    db.close();
  });
});

describe("database migration v1 -> v2", () => {
  it("moves saved loadouts into the configurations table, keeping their IDs", async () => {
    const name = `migrate-${Math.random()}`;
    const v1 = new Dexie(name);
    v1.version(1).stores({ loadouts: "id, name, updatedAt", replays: "id, encounterId, createdAt", attempts: "++id, [encounterId+variantKey], createdAt" });
    await v1.table("loadouts").put({ id: "abc", name: "Old whip", setup: { stats, equipment: { weapon: "abyssal-whip" }, inventory: [], combatStyle: 1, prayers: [], autocastSpellId: null, autoRetaliate: false }, updatedAt: 5, schemaVersion: 1 });
    v1.close();

    const db = new SimDatabase(name);
    const l = new ConfigLibrary(new IndexedDbConfigStore(db));
    const rows = await l.list("loadout");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "abc", name: "Old whip", kind: "loadout", revision: 1, data: { combatStyle: 1, quickPrayers: [], equipment: { weapon: "abyssal-whip" } } });
    db.close();
  });
});
