import { clonePlain } from "@sim/engine";
import { describe, expect, it } from "vitest";
import { CONTENT_PACKS, ContentValidationError, buildFromPacks, getContentPacks, getContentRegistry, itemClass, mergePacks, searchItems, type ContentPack } from "../src";

describe("content packs", () => {
  it("loads every pack and records where each definition came from", () => {
    const { packs, provenance } = getContentPacks();
    expect(packs.map((p) => p.id)).toEqual(["osrs-base", "training-grounds", "ashen-warden"]);
    expect(provenance.get("item:abyssal-whip")).toBe("osrs-base");
    expect(provenance.get("npc:ashen-warden")).toBe("ashen-warden");
    expect(provenance.get("arena:cinder-hall")).toBe("ashen-warden");
    expect(provenance.get("mechanic:ashen-warden.kindling")).toBe("ashen-warden");
    // Every registry entry has a pack.
    const c = getContentRegistry();
    for (const id of c.items.keys()) expect(provenance.get(`item:${id}`)).toBeDefined();
    for (const id of c.encounters.keys()) expect(provenance.get(`encounter:${id}`)).toBeDefined();
    expect(packs[0]!.counts.item).toBe(c.items.size);
  });

  it("reports IDs that two packs both define, naming both packs", () => {
    const base = CONTENT_PACKS[0]!;
    const clash: ContentPack = { id: "extra-items", name: "Extra", version: "0.1.0", items: [clonePlain(base.items![0]!)] };
    const merged = mergePacks([...CONTENT_PACKS, clash]);
    expect(merged.issues).toEqual([`item "${base.items![0]!.id}" is defined in both pack "osrs-base" and pack "extra-items"`]);
    expect(() => buildFromPacks([...CONTENT_PACKS, clash])).toThrow(ContentValidationError);
  });

  it("reports duplicate packs, bad pack IDs and missing dependencies", () => {
    const lonely: ContentPack = { id: "Bad_ID", name: "x", version: "0.1.0", requires: ["nope"] };
    const merged = mergePacks([CONTENT_PACKS[0]!, CONTENT_PACKS[0]!, lonely]);
    expect(merged.issues).toContain('pack "osrs-base" is listed more than once');
    expect(merged.issues).toContain('pack "Bad_ID": ID must be kebab-case');
    expect(merged.issues).toContain('pack "Bad_ID" requires pack "nope", which is not loaded');
  });

  it("a boss pack can be left out without breaking the rest", () => {
    const { registry } = buildFromPacks(CONTENT_PACKS.filter((p) => p.id !== "ashen-warden"));
    expect([...registry.encounters.keys()]).toEqual(["training-grounds"]);
    expect(registry.arenas.has("cinder-hall")).toBe(false);
  });

  it("a new pack adds a boss without touching existing content", () => {
    const warden = CONTENT_PACKS.find((p) => p.id === "ashen-warden")!;
    const b = clonePlain(warden.encounters![0]!);
    // Re-ID everything so it is a distinct boss reusing the same behaviour data.
    b.encounter = { ...b.encounter, id: "ember-twin", name: "Ember Twin", npcs: (b.encounter.npcs ?? []).map((n) => ({ ...n, npcId: "ember-twin" })), modifiers: [] };
    b.npcs = b.npcs.map((n) => ({ ...n, id: "ember-twin", name: "Ember Twin" }));
    b.attacks = [];
    b.modifiers = [];
    b.mechanics = [];
    const pack: ContentPack = { id: "ember-twin", name: "Ember Twin", version: "0.1.0", requires: ["ashen-warden"], encounters: [b] };
    const { registry, merged } = buildFromPacks([...CONTENT_PACKS, pack]);
    expect(registry.encounters.has("ember-twin")).toBe(true);
    expect(merged.provenance.get("npc:ember-twin")).toBe("ember-twin");
  });
});

describe("item search", () => {
  const items = [...getContentRegistry().items.values()];
  const ids = (q: Parameters<typeof searchItems>[1]) => searchItems(items, q).map((i) => i.id);

  it("matches every word against name, ID and tags", () => {
    expect(ids({ text: "dragon scim" })).toEqual(["dragon-scimitar"]);
    expect(ids({ text: "torva" }).sort()).toEqual(["torva-full-helm", "torva-platebody", "torva-platelegs"]);
  });

  it("filters by slot, class and tags", () => {
    expect(ids({ slot: "head", class: "ranged" })).toContain("masori-mask");
    expect(ids({ slot: "head", class: "ranged" })).not.toContain("torva-full-helm");
    expect(ids({ tags: ["category:claw"] })).toEqual(["dragon-claws"]);
    const supplies = searchItems(items, { slot: "supplies" });
    expect(supplies.length).toBeGreaterThan(10);
    expect(supplies.every((i) => itemClass(i) === "supply")).toBe(true);
  });

  it("puts names that start with the text first", () => {
    expect(ids({ text: "shark" })[0]).toBe("shark");
  });

  it("classifies gear by its bonuses", () => {
    const c = getContentRegistry().items;
    expect(itemClass(c.get("ancestral-hat")!)).toBe("magic");
    expect(itemClass(c.get("bandos-chestplate")!)).toBe("melee");
    expect(itemClass(c.get("rune-crossbow")!)).toBe("ranged");
  });
});

describe("expanded item database", () => {
  const c = getContentRegistry().items;

  it("new weapon categories have their wiki combat styles", () => {
    expect(c.get("dragon-spear")!.weapon!.category).toBe("spear");
    expect(c.get("dragon-halberd")!.weapon!.category).toBe("polearm");
    expect(c.get("dragon-claws")!.weapon!.category).toBe("claw");
    expect(c.get("abyssal-bludgeon")!.weapon!.category).toBe("bludgeon");
    expect(c.get("dragon-battleaxe")!.weapon!.category).toBe("axe");
  });

  it("tags items automatically", () => {
    const t = c.get("torva-platebody")!.tags;
    expect(t).toEqual(expect.arrayContaining(["slot:body", "set:torva", "tier:torva"]));
    expect(c.get("dragon-claws")!.tags).toEqual(expect.arrayContaining(["melee", "category:claw", "tier:dragon"]));
    expect(c.get("shark")!.tags).toContain("food");
    expect(c.get("adamant-bolts")!.tags).toContain("ammo:bolt");
  });

  it("records effects that are not modelled", () => {
    expect(c.get("dragon-claws")!.notes.join(" ")).toMatch(/not modelled/);
    expect(c.get("abyssal-whip")!.notes).toEqual([]);
  });
});

describe("adding content leaves existing fights unchanged", () => {
  it("a new item and a new boss do not change a single tick of an existing fight", async () => {
    const { createSimulation } = await import("@sim/engine");
    const base = CONTENT_PACKS[0]!;
    const warden = CONTENT_PACKS.find((p) => p.id === "ashen-warden")!;
    const newItem = { ...clonePlain(base.items!.find((i) => i.id === "abyssal-whip")!), id: "test-whip", name: "Test whip" };
    const b = clonePlain(warden.encounters![0]!);
    b.encounter = { ...b.encounter, id: "ember-twin", npcs: (b.encounter.npcs ?? []).map((n) => ({ ...n, npcId: "ember-twin" })), modifiers: [] };
    b.npcs = b.npcs.map((n) => ({ ...n, id: "ember-twin" }));
    b.attacks = [];
    b.modifiers = [];
    b.mechanics = [];
    const extra: ContentPack = { id: "extra", name: "Extra", version: "0.1.0", items: [newItem], encounters: [b] };
    const before = buildFromPacks(CONTENT_PACKS).registry;
    const after = buildFromPacks([...CONTENT_PACKS, extra]).registry;
    // Existing definitions are untouched.
    for (const [id, item] of before.items) expect(after.items.get(id)).toEqual(item);
    expect(after.npcs.get("ashen-warden")).toEqual(before.npcs.get("ashen-warden"));

    const run = (registry: typeof before) => {
      const setup = (CONTENT_PACKS[0]!.loadouts!.find((l) => l.id === "melee-99")!).setup;
      const sim = createSimulation({ seed: 21, encounterId: "ashen-warden", player: setup }, registry);
      sim.queueCommand({ type: "attack", targetId: "npc-1" });
      const hashes: string[] = [];
      for (let i = 0; i < 150; i++) {
        if (i === 10) sim.queueCommand({ type: "togglePrayer", prayerId: "protect-from-magic" });
        if (i === 40) sim.queueCommand({ type: "useItem", inventorySlot: 6 });
        const r = sim.tick();
        hashes.push(r.hash);
        if (r.outcome) break;
      }
      return hashes;
    };
    expect(run(after)).toEqual(run(before));
  });
});
