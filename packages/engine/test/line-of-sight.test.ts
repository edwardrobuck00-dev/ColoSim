import { describe, expect, it } from "vitest";
import { Grid, hasLineOfSight, inAttackRange } from "../src";

describe("line of sight", () => {
  // A pillar at (5,5) in an open 12x12 room.
  const grid = new Grid(12, 12, [{ x: 5, y: 5 }]);
  const at = (x: number, y: number, size = 1) => ({ pos: { x, y }, size });

  it("is clear across open floor, and blocked by a pillar in between", () => {
    expect(hasLineOfSight(grid, at(2, 2), at(8, 2))).toBe(true);
    expect(hasLineOfSight(grid, at(2, 5), at(8, 5))).toBe(false);
    expect(hasLineOfSight(grid, at(5, 1), at(5, 9))).toBe(false);
    expect(hasLineOfSight(grid, at(3, 3), at(7, 7))).toBe(false); // through the diagonal
    expect(hasLineOfSight(grid, at(3, 3), at(7, 9))).toBe(true);
  });

  it("is symmetric for single tiles", () => {
    for (const [a, b] of [[at(1, 5), at(10, 5)], [at(2, 7), at(9, 3)], [at(0, 0), at(11, 11)]] as const) {
      expect(hasLineOfSight(grid, a, b)).toBe(hasLineOfSight(grid, b, a));
    }
  });

  it("uses the nearest tiles of large footprints", () => {
    // A 3x3 NPC to the east of the pillar; the player west of it on the same row.
    expect(hasLineOfSight(grid, at(7, 4, 3), at(2, 5))).toBe(false);
    expect(hasLineOfSight(grid, at(7, 4, 3), at(2, 9))).toBe(true);
  });

  it("ranged attacks need sight; melee and touching attackers do not", () => {
    expect(inAttackRange(at(2, 5), at(8, 5), 10, grid)).toBe(false);
    expect(inAttackRange(at(2, 5), at(8, 5), 10)).toBe(true); // no map given: range only
    expect(inAttackRange(at(4, 5), at(6, 5), 10, grid)).toBe(false);
    expect(inAttackRange(at(6, 6), at(5, 6), 1, grid)).toBe(true);
  });
});

describe("line of sight in fights", () => {
  // Fixture arena: a wall at x=5, y=6..8; NPCs spawn at (8,8).
  it("a stationary caster cannot hit a player hiding behind the wall (a safespot)", async () => {
    const { combatContent, STATS_99, ofType } = await import("./fixtures");
    const { createSimulation } = await import("../src");
    const sim = createSimulation({ seed: 1, encounterId: "vs-spitter", player: { stats: STATS_99 } }, combatContent());
    sim.queueCommand({ type: "move", to: { x: 1, y: 7 } });
    const attacks: Array<{ tick: number; x: number; y: number }> = [];
    for (let i = 0; i < 40; i++) {
      const r = sim.tick();
      for (const e of ofType(r.events, "AttackStarted")) if (e.attackerId === "npc-1") attacks.push({ tick: r.tick, ...r.snapshot.player.pos });
    }
    // It may attack while the player is still walking in the open, never once they are behind the wall.
    expect(attacks.filter((a) => a.x === 1 && a.y === 7)).toEqual([]);
    expect(attacks.length).toBeGreaterThan(0);
  });

  it("a ranged player steps out from behind the wall before shooting", async () => {
    const { combatContent, STATS_99, ofType } = await import("./fixtures");
    const { createSimulation } = await import("../src");
    const content = combatContent();
    const sim = createSimulation({ seed: 1, encounterId: "vs-dummy", player: { stats: STATS_99, equipment: { weapon: "bow" } } }, content);
    sim.queueCommand({ type: "move", to: { x: 1, y: 7 } });
    for (let i = 0; i < 12; i++) sim.tick();
    expect(sim.getSnapshot().player.pos).toEqual({ x: 1, y: 7 });
    sim.queueCommand({ type: "attack", targetId: "npc-1" });
    const grid = new Grid(12, 12, [{ x: 5, y: 6 }, { x: 5, y: 7 }, { x: 5, y: 8 }]);
    let shots = 0;
    for (let i = 0; i < 15; i++) {
      const r = sim.tick();
      for (const e of ofType(r.events, "AttackStarted")) {
        if (e.attackerId !== "player") continue;
        shots++;
        const npc = r.snapshot.npcs[0]!;
        expect(hasLineOfSight(grid, { pos: r.snapshot.player.pos, size: 1 }, { pos: npc.pos, size: npc.size })).toBe(true);
      }
    }
    expect(shots).toBeGreaterThan(0);
  });
});
