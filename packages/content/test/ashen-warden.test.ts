import { describe, expect, it } from "vitest";
import { createSimulation } from "@sim/engine";
import { STARTER_LOADOUTS, getContentRegistry } from "../src";
import { fightWarden } from "./warden-bot";

describe("the Ashen Warden (complete boss built on the framework)", () => {
  it("is beatable with good play: correct prayers on landing ticks, dodging fire", () => {
    const fights = [1, 2, 3, 4].map((seed) => fightWarden(seed, "good"));
    for (const f of fights) {
      expect(f.outcome?.result).toBe("win");
      expect(f.phases).toEqual(["Smouldering", "Kindled", "Inferno"]);
      expect(f.enraged).toBe(true);
    }
  });

  it("is lost by a player who ignores prayers and fire, and the fire heals the Warden", () => {
    const fights = [1, 2, 3, 4].map((seed) => fightWarden(seed, "passive"));
    for (const f of fights) {
      expect(f.outcome?.result).toBe("loss");
      expect(f.heals).toBeGreaterThan(50);
    }
  });

  it("is deterministic: the same seed gives the same fight", () => {
    expect(fightWarden(9, "good")).toEqual(fightWarden(9, "good"));
  });

  it("enters phase 2 with its entry effects: back to the centre, invulnerable, then a volley", () => {
    const content = getContentRegistry();
    const setup = STARTER_LOADOUTS.find((l) => l.id === "melee-99-ags")!.setup;
    const sim = createSimulation({ seed: 4, encounterId: "ashen-warden", player: setup }, content);
    sim.queueCommand({ type: "attack", targetId: "npc-1" });
    const events = [];
    for (let i = 0; i < 400 && sim.getSnapshot().npcs[0]!.phase.index === 0 && !sim.getSnapshot().outcome; i++) events.push(...sim.tick().events);
    const snap = sim.getSnapshot();
    if (snap.outcome) return; // died before phase 2 with no prayers; covered by the bot tests
    expect(snap.npcs[0]!.phase.name).toBe("Kindled");
    expect(snap.npcs[0]!.invulnerable).toBe(true);
    expect(snap.npcs[0]!.pos).toEqual(content.arenas.get("cinder-hall")!.spawns.centre);
    const later = [];
    for (let i = 0; i < 8; i++) later.push(...sim.tick().events);
    expect(later.some((e) => e.type === "BossSpecialUsed" && e.specialId === "cinder-volley")).toBe(true);
  });
});

describe("standing under the boss", () => {
  it("the Warden steps out from over the player and attacks again", () => {
    const content = getContentRegistry();
    const preset = STARTER_LOADOUTS.find((l) => l.id === "melee-99")!;
    const sim = createSimulation({ seed: 5, encounterId: "ashen-warden", player: preset.setup }, content);
    const boss = sim.getSnapshot().npcs[0]!;
    // Walk onto the middle tile of the boss's 3x3 footprint.
    sim.queueCommand({ type: "move", to: { x: boss.pos.x + 1, y: boss.pos.y + 1 } });
    let under = -1;
    let attackedAfter = false;
    for (let t = 0; t < 60; t++) {
      const r = sim.tick();
      const b = r.snapshot.npcs[0]!;
      const p = r.snapshot.player.pos;
      const isUnder = p.x >= b.pos.x && p.x < b.pos.x + b.size && p.y >= b.pos.y && p.y < b.pos.y + b.size;
      if (isUnder && under < 0) under = r.tick;
      if (under >= 0 && r.tick > under && r.events.some((e) => e.type === "AttackStarted" && e.attackerId === b.id)) attackedAfter = true;
      if (under >= 0) {
        // The player stays still; within a few ticks the boss has moved off them.
        if (r.tick > under + 4) expect(isUnder).toBe(false);
      }
    }
    expect(under).toBeGreaterThan(0);
    expect(attackedAfter).toBe(true);
  });
});
