import { describe, expect, it } from "vitest";
import { z } from "zod";
import { BASE_RUN_DRAIN_PER_TICK } from "../src/systems/upkeep";
import { MAX_RUN_ENERGY, SimulationSetupError, createSimulation, defineMechanic } from "../src";
import { buildTestContent, scenario } from "./harness";

describe("simulation lifecycle", () => {
  it("emits spawn events before the first tick", () => {
    const s = scenario();
    expect(s.events.filter((e) => e.type === "EntitySpawned")).toHaveLength(2);
    expect(s.snapshot.tick).toBe(0);
  });

  it("advances one tick per call", () => {
    const s = scenario().runTicks(3);
    expect(s.snapshot.tick).toBe(3);
  });

  it("rejects unknown encounters and unavailable modifiers", () => {
    const content = buildTestContent();
    expect(() => createSimulation({ seed: 1, encounterId: "nope" }, content)).toThrow(SimulationSetupError);
    expect(() => createSimulation({ seed: 1, encounterId: "test-encounter", modifierIds: ["nope"] }, content)).toThrow(
      SimulationSetupError,
    );
  });
});

describe("movement", () => {
  it("applies commands on the next tick, not immediately", () => {
    const s = scenario().command({ type: "move", to: { x: 1, y: 4 } });
    expect(s.snapshot.player.pos).toEqual({ x: 1, y: 1 });
    s.runTicks(1);
    expect(s.snapshot.player.pos).not.toEqual({ x: 1, y: 1 });
  });

  it("runs 2 tiles per tick and walks 1", () => {
    const run = scenario().command({ type: "move", to: { x: 1, y: 9 } }).runTicks(1);
    expect(run.snapshot.player.pos).toEqual({ x: 1, y: 3 });

    const walk = scenario()
      .command({ type: "setRun", running: false })
      .command({ type: "move", to: { x: 1, y: 9 } })
      .runTicks(1);
    expect(walk.snapshot.player.pos).toEqual({ x: 1, y: 2 });
  });

  it("drains run energy while running and regenerates while idle", () => {
    const s = scenario().command({ type: "move", to: { x: 1, y: 9 } }).runTicks(1);
    expect(s.snapshot.player.runEnergy).toBe(MAX_RUN_ENERGY - BASE_RUN_DRAIN_PER_TICK);
    s.runTicks(3); // still running: 8 tiles takes 4 ticks
    expect(s.snapshot.player.runEnergy).toBe(MAX_RUN_ENERGY - 4 * BASE_RUN_DRAIN_PER_TICK);
    s.runTicks(20); // idle: regenerates back to full
    expect(s.snapshot.player.runEnergy).toBe(MAX_RUN_ENERGY);
  });

  it("attack walks the player next to the target", () => {
    const s = scenario().command({ type: "attack", targetId: "npc-1" }).runTicks(10);
    const { pos } = s.snapshot.player;
    const npc = s.snapshot.npcs[0]!;
    const adjacentX = pos.y >= npc.pos.y && pos.y < npc.pos.y + 2 && (pos.x === npc.pos.x - 1 || pos.x === npc.pos.x + 2);
    const adjacentY = pos.x >= npc.pos.x && pos.x < npc.pos.x + 2 && (pos.y === npc.pos.y - 1 || pos.y === npc.pos.y + 2);
    expect(adjacentX || adjacentY).toBe(true);
    expect(s.snapshot.player.targetId).toBe("npc-1");
  });
});

describe("mechanics and modifiers", () => {
  it("modifier pipelines change values and loss checks end the fight", () => {
    const s = scenario({ modifierIds: ["exhausting"] });
    // Run back and forth until run energy hits 0.
    for (let i = 0; i < 40 && !s.snapshot.outcome; i++) {
      s.command({ type: "move", to: i % 2 ? { x: 1, y: 1 } : { x: 1, y: 11 } }).runTicks(5);
    }
    expect(s.snapshot.outcome?.result).toBe("loss");
    expect(s.snapshot.outcome?.reason).toBe("runEnergy reached 0");
    expect(s.events.some((e) => e.type === "EncounterEnded")).toBe(true);
  });

  it("content can register its own mechanics", () => {
    const winAtTick = defineMechanic({
      id: "win-at-tick",
      description: "test",
      params: z.object({ tick: z.number() }),
      create: ({ tick }) => ({ hooks: { checkWin: (ctx) => (ctx.tick >= tick ? "survived" : undefined) } }),
    });
    const content = buildTestContent({
      mechanics: [winAtTick],
      encounters: [
        {
          id: "survive",
          name: "Survive",
          description: "",
          arenaId: "test-arena",
          playerSpawn: "player",
          winCondition: "none",
          mechanics: [{ id: "win-at-tick", params: { tick: 5 } }, { id: "announce", params: { text: "Go!" } }],
        },
      ],
    });
    const s = scenario({ encounterId: "survive" }, content).runTicks(10);
    expect(s.snapshot.outcome).toEqual({ result: "win", reason: "survived", tick: 5 });
    expect(s.events).toContainEqual({ type: "MechanicMessage", mechanicId: "announce", text: "Go!" });
  });

  it("rejects bad mechanic params when the simulation is built", () => {
    const content = buildTestContent({
      encounters: [
        { id: "bad", name: "Bad", description: "", arenaId: "test-arena", playerSpawn: "player",
          mechanics: [{ id: "announce", params: { text: 5 } }] },
      ],
    });
    expect(() => createSimulation({ seed: 1, encounterId: "bad" }, content)).toThrow(/Invalid params/);
  });
});
