import { describe, expect, it } from "vitest";
import { TICK_PIPELINE, createSimulation, type PlayerCommand, type SimEvent } from "../src";
import { STATS_99, combatContent, ofType } from "./fixtures";
import { scenario } from "./harness";

describe("tick progression", () => {
  it("advances exactly one tick per call and starts at tick 0", () => {
    const s = scenario();
    expect(s.snapshot.tick).toBe(0);
    for (let i = 1; i <= 5; i++) expect(s.sim.tick().tick).toBe(i);
  });

  it("runs the documented phases in a fixed order", () => {
    expect(TICK_PIPELINE.map(([name]) => name)).toEqual([
      "commands", "scheduled-events", "encounter", "npc-turns", "player-turn", "hit-resolution", "lifecycle", "upkeep", "outcome",
    ]);
  });

  it("does not advance after the encounter has ended", () => {
    const content = combatContent();
    const sim = createSimulation({ seed: 1, encounterId: "duel", player: { stats: STATS_99, equipment: { weapon: "sword4" } } }, content);
    sim.queueCommand({ type: "attack", targetId: "npc-1" });
    let ended = 0;
    for (let i = 0; i < 100; i++) {
      const r = sim.tick();
      if (r.outcome && !ended) ended = r.tick;
    }
    expect(ended).toBeGreaterThan(0);
    expect(sim.getSnapshot().tick).toBe(ended);
  });
});

describe("player actions and input timing", () => {
  it("commands queued between ticks apply at the start of the next tick and are logged on that tick", () => {
    const s = scenario().runTicks(3);
    s.command({ type: "move", to: { x: 1, y: 6 } });
    expect(s.snapshot.player.pos).toEqual({ x: 1, y: 1 });
    s.runTicks(1);
    expect(s.snapshot.player.pos).toEqual({ x: 1, y: 3 });
    expect(s.sim.getInputLog()).toEqual([{ tick: 4, commands: [{ type: "move", to: { x: 1, y: 6 } }] }]);
  });

  it("several commands in one tick apply in the order received", () => {
    const s = scenario().command({ type: "move", to: { x: 1, y: 6 } }).command({ type: "stop" }).runTicks(1);
    expect(s.snapshot.player.pos).toEqual({ x: 1, y: 1 });
  });

  it("moves 1 tile per tick walking and 2 running, and the last odd tile takes a tick", () => {
    const walk = scenario().command({ type: "setRun", running: false }).command({ type: "move", to: { x: 1, y: 4 } });
    const walkTicks: number[] = [];
    for (let i = 0; i < 4; i++) walkTicks.push(walk.sim.tick().snapshot.player.pos.y);
    expect(walkTicks).toEqual([2, 3, 4, 4]);

    const run = scenario().command({ type: "move", to: { x: 1, y: 6 } });
    const runTicks: number[] = [];
    for (let i = 0; i < 4; i++) runTicks.push(run.sim.tick().snapshot.player.pos.y);
    expect(runTicks).toEqual([3, 5, 6, 6]);
  });
});

describe("NPC actions", () => {
  it("chasing NPCs move one tile per tick, stepping around walls the simple way", () => {
    const sim = createSimulation({ seed: 1, encounterId: "vs-bruiser" }, combatContent());
    const path: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { x, y } = sim.tick().snapshot.npcs[0]!.pos;
      path.push(`${x},${y}`);
    }
    // Diagonal twice, then the wall at x=5 blocks the diagonal and horizontal steps, so it steps down.
    expect(path).toEqual(["7,7", "6,6", "6,5"]);
  });

  it("NPCs act before the player within a tick", () => {
    const content = combatContent();
    const sim = createSimulation({ seed: 2, encounterId: "vs-spitter", player: { stats: STATS_99, equipment: { weapon: "bow" } } }, content);
    sim.queueCommand({ type: "attack", targetId: "npc-1" });
    const r = sim.tick();
    const attackers = ofType(r.events, "AttackStarted").map((e) => e.attackerId);
    expect(attackers).toEqual(["npc-1", "player"]);
  });
});

describe("determinism", () => {
  const script: Array<[number, PlayerCommand]> = [
    [0, { type: "attack", targetId: "npc-1" }],
    [12, { type: "move", to: { x: 0, y: 11 } }],
    [17, { type: "attack", targetId: "npc-1" }],
    [30, { type: "setRun", running: false }],
  ];

  function run(seed: number) {
    const sim = createSimulation({ seed, encounterId: "vs-bruiser", player: { stats: STATS_99, equipment: { weapon: "sword4" } } }, combatContent());
    const events: SimEvent[] = [];
    for (let t = 0; t < 120; t++) {
      for (const [at, cmd] of script) if (at === t) sim.queueCommand(cmd);
      events.push(...sim.tick().events);
    }
    return { events, hash: sim.getStateHash() };
  }

  it("the same seed and inputs reproduce every event exactly", () => {
    const a = run(77);
    const b = run(77);
    expect(ofType(a.events, "HitLanded").length).toBeGreaterThan(5);
    expect(b.events).toEqual(a.events);
    expect(b.hash).toBe(a.hash);
  });

  it("a different seed gives different rolls", () => {
    const damage = (seed: number) => ofType(run(seed).events, "HitLanded").map((h) => h.amount);
    expect(damage(1)).not.toEqual(damage(2));
  });
});
