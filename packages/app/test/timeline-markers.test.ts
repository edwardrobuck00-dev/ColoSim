import { STARTER_LOADOUTS } from "@sim/content";
import { FightHistory, createSimulation } from "@sim/engine";
import { describe, expect, it } from "vitest";
import { markersFor } from "../src/ui/hud/FightControls";
import { content } from "../src/services/content";

describe("timeline markers", () => {
  it("are found incrementally, match a full scan, and reset after a rewind", () => {
    const sim = createSimulation({ seed: 4, encounterId: "ashen-warden", player: STARTER_LOADOUTS.find((l) => l.id === "melee-99")!.setup }, content);
    const history = new FightHistory({ snapshot: sim.getSnapshot(), events: sim.getInitialEvents(), hash: sim.getStateHash() });
    sim.queueCommand({ type: "attack", targetId: "npc-1" });
    sim.queueCommand({ type: "toggleSpecial" });
    let markers = markersFor(history, 0);
    for (let i = 0; i < 80; i++) {
      const r = sim.tick();
      history.record(r);
      markers = markersFor(history, r.tick);
      if (r.outcome) break;
    }
    const full = new Set(history.ticksWhere((e) => e.type === "SpecialUsed" || e.type === "BossSpecialUsed" || e.type === "BossPhaseChanged" || e.type === "BossEnraged" || e.type === "EntityDied"));
    expect(new Set(markers.map((m) => m.tick))).toEqual(full);
    expect(markers.some((m) => m.kind === "spec")).toBe(true);

    // Rewind: everything after tick 5 is discarded.
    history.truncateAfter(5);
    expect(markersFor(history, 5).every((m) => m.tick <= 5)).toBe(true);
  });
});
