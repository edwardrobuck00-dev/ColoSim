import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createSimulation, verifyReplay, type PlayerCommand } from "../src";
import { buildTestContent } from "./harness";

const commandArb: fc.Arbitrary<PlayerCommand> = fc.oneof(
  fc.record({ type: fc.constant("move" as const), to: fc.record({ x: fc.integer({ min: -2, max: 13 }), y: fc.integer({ min: -2, max: 13 }) }) }),
  fc.record({ type: fc.constant("setRun" as const), running: fc.boolean() }),
  fc.constant({ type: "attack", targetId: "npc-1" } as const),
  fc.constant({ type: "stop" } as const),
);

/** A list of (ticks to wait, command) pairs. */
const scriptArb = fc.array(fc.tuple(fc.integer({ min: 0, max: 6 }), commandArb), { maxLength: 30 });

function run(seed: number, script: Array<[number, PlayerCommand]>) {
  const content = buildTestContent();
  const sim = createSimulation({ seed, encounterId: "test-encounter" }, content);
  for (const [wait, cmd] of script) {
    sim.queueCommand(cmd);
    for (let i = 0; i <= wait; i++) sim.tick();
  }
  return { sim, content };
}

describe("determinism", () => {
  it("same seed and inputs always give the same state hash", () => {
    fc.assert(
      fc.property(fc.integer(), scriptArb, (seed, script) => {
        expect(run(seed, script).sim.getStateHash()).toBe(run(seed, script).sim.getStateHash());
      }),
      { numRuns: 60 },
    );
  });

  it("replays re-simulate to the recorded checkpoints", () => {
    fc.assert(
      fc.property(fc.integer(), scriptArb, (seed, script) => {
        const { sim, content } = run(seed, script);
        const result = verifyReplay(sim.toReplay(), content);
        expect(result.ok).toBe(true);
        expect(result.finalHash).toBe(sim.getStateHash());
      }),
      { numRuns: 40 },
    );
  });

  it("detects a tampered replay", () => {
    const { sim, content } = run(5, [[3, { type: "move", to: { x: 10, y: 10 } }]]);
    const replay = sim.toReplay();
    replay.inputLog[0]!.commands[0] = { type: "move", to: { x: 0, y: 10 } };
    expect(verifyReplay(replay, content).ok).toBe(false);
  });
});
