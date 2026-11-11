import { clonePlain, createSimulation, missingRequirements } from "@sim/engine";
import { describe, expect, it } from "vitest";
import { ContentValidationError, STARTER_LOADOUTS, buildRegistry, getContentRegistry } from "../src";
import { CONTENT_PACKS, ENCOUNTER_BUNDLES, mergePacks } from "../src";

const base = mergePacks(CONTENT_PACKS).raw;
const ARENAS = base.arenas;

describe("content integrity", () => {
  const content = getContentRegistry();

  it("builds a valid registry", () => {
    expect(content.encounters.size).toBeGreaterThan(0);
    expect(content.items.size).toBeGreaterThan(80);
    expect(content.contentHash).toMatch(/^[0-9a-f]{8}$/);
  });

  it("every encounter, with every modifier enabled, starts and runs", () => {
    for (const enc of content.encounters.values()) {
      const sim = createSimulation({ seed: 1, encounterId: enc.id, modifierIds: enc.modifiers }, content);
      for (let i = 0; i < 25; i++) sim.tick();
      expect(sim.getSnapshot().tick).toBeGreaterThan(0);
    }
  });

  it("starter loadouts use real items, in matching slots, and meet every requirement", () => {
    for (const preset of STARTER_LOADOUTS) {
      for (const [slot, entry] of Object.entries(preset.setup.equipment ?? {})) {
        const itemId = typeof entry === "string" ? entry : entry.itemId;
        const item = content.items.get(itemId);
        expect(item, `${preset.id}: ${itemId}`).toBeDefined();
        expect(item?.slot, `${preset.id}: ${itemId}`).toBe(slot);
        expect(missingRequirements(preset.setup.stats as never, item!), `${preset.id}: ${itemId}`).toEqual([]);
      }
      for (const entry of preset.setup.inventory ?? []) {
        if (entry) expect(content.items.has(typeof entry === "string" ? entry : entry.itemId), `${preset.id}`).toBe(true);
      }
    }
  });

  it("every starter loadout starts a fight", () => {
    for (const preset of STARTER_LOADOUTS) {
      expect(() => createSimulation({ seed: 1, encounterId: "training-grounds", player: preset.setup }, content), preset.id).not.toThrow();
    }
  });

  it("reports every broken reference at once", () => {
    const bad = clonePlain(ENCOUNTER_BUNDLES[0]!);
    bad.encounter = { ...bad.encounter, arenaId: "missing-arena", modifiers: ["missing-mod"] };
    bad.mechanics = [];
    try {
      buildRegistry({ items: base.items, prayers: base.prayers, spells: base.spells, arenas: ARENAS, encounters: [bad] });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ContentValidationError);
      const { issues } = e as ContentValidationError;
      expect(issues.some((i) => i.includes("missing-arena"))).toBe(true);
      expect(issues.some((i) => i.includes("missing-mod"))).toBe(true);
    }
  });

  it("catches mistakes in boss behaviour data", () => {
    const bundle = clonePlain(ENCOUNTER_BUNDLES.find((b) => b.encounter.id === "ashen-warden")!);
    const npc = bundle.npcs[0]!;
    const phases = npc.behaviour!.phases;
    phases[0]!.pattern = { type: "rotation", attacks: ["no-such-attack"] };
    phases[1]!.specials = { every: 3, ids: ["no-such-special"] };
    phases[2]!.atHpPercent = 90; // higher than the phase before it
    phases[1]!.onEnter = { ...phases[1]!.onEnter, moveTo: "nowhere" };
    npc.specials![0] = { ...npc.specials![0]!, kind: "no-such-kind" };
    try {
      buildRegistry({ items: base.items, prayers: base.prayers, spells: base.spells, arenas: ARENAS, encounters: [bundle] });
      expect.unreachable();
    } catch (e) {
      const { issues } = e as ContentValidationError;
      for (const text of ["no-such-attack", "no-such-special", "lower than the previous phase", "nowhere", "no-such-kind"]) {
        expect(issues.some((i) => i.includes(text)), text).toBe(true);
      }
    }
  });
});
