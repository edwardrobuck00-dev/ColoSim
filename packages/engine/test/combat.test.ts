import { describe, expect, it } from "vitest";
import {
  Grid,
  Rng,
  chaseStep,
  hitChance,
  hitDelayTicks,
  inAttackRange,
  selectAttack,
  strengthMaxHit,
  type AttackDef,
  type SimEvent,
} from "../src";
import { buildTestContent, scenario, testArena } from "./harness";

describe("formulas", () => {
  it("hit chance follows the two-branch formula", () => {
    expect(hitChance(1000, 0)).toBeCloseTo(1 - 2 / 2002);
    expect(hitChance(0, 1000)).toBe(0);
    expect(hitChance(500, 999)).toBeCloseTo(500 / 2000);
  });

  it("max hit grows with level and strength bonus", () => {
    expect(strengthMaxHit(107, 0)).toBe(11); // 99 strength, no bonus
    expect(strengthMaxHit(107, 100)).toBeGreaterThan(strengthMaxHit(107, 0));
  });

  it("hit delay depends on style and distance", () => {
    expect(hitDelayTicks("slash", 1)).toBe(0);
    expect(hitDelayTicks("ranged", 1)).toBe(1);
    expect(hitDelayTicks("ranged", 9)).toBe(3);
    expect(hitDelayTicks("magic", 2)).toBe(2);
  });
});

describe("range", () => {
  const boss = { pos: { x: 5, y: 5 }, size: 3 };
  it("melee needs orthogonal adjacency to any footprint tile", () => {
    expect(inAttackRange({ pos: { x: 4, y: 6 }, size: 1 }, boss, 1)).toBe(true);
    expect(inAttackRange({ pos: { x: 4, y: 4 }, size: 1 }, boss, 1)).toBe(false); // diagonal corner
    expect(inAttackRange({ pos: { x: 6, y: 6 }, size: 1 }, boss, 1)).toBe(false); // underneath
  });

  it("ranged uses Chebyshev distance", () => {
    expect(inAttackRange({ pos: { x: 0, y: 0 }, size: 1 }, boss, 5)).toBe(true);
    expect(inAttackRange({ pos: { x: 0, y: 0 }, size: 1 }, boss, 4)).toBe(false);
  });
});

describe("chaseStep", () => {
  it("steps diagonally toward the target when possible", () => {
    expect(chaseStep(new Grid(10, 10), { x: 0, y: 0 }, 1, { x: 5, y: 5 })).toEqual({ x: 1, y: 1 });
  });

  it("never steps onto the target", () => {
    expect(chaseStep(new Grid(10, 10), { x: 0, y: 0 }, 1, { x: 1, y: 1 })).toEqual({ x: 1, y: 0 });
  });

  it("gets stuck behind an obstacle (safespot)", () => {
    const g = new Grid(10, 10, [{ x: 1, y: 0 }, { x: 1, y: 1 }]);
    expect(chaseStep(g, { x: 0, y: 0 }, 1, { x: 5, y: 0 })).toBeNull();
  });
});

describe("selectAttack", () => {
  const a = { id: "a" } as AttackDef;
  const b = { id: "b" } as AttackDef;
  it("sequence skips attacks that are out of range", () => {
    const pick = selectAttack([a, b], (x) => x.id === "b", "sequence", 0, Rng.fromSeed(1));
    expect(pick).toEqual({ attack: b, nextRotationIndex: 2 });
  });
});

// ---------- full scenarios ----------

const combatContent = () =>
  buildTestContent({
    items: [
      { id: "test-sword", name: "Test sword", slot: "weapon", bonuses: { attack: { stab: 0, slash: 80, crush: 0, ranged: 0, magic: 0 }, meleeStrength: 80 },
        weapon: { category: "slash-sword", attackSpeedTicks: 4, rangeTiles: 1, animationCue: "attack.slash" } },
      { id: "test-bow", name: "Test bow", slot: "weapon", bonuses: { attack: { stab: 0, slash: 0, crush: 0, ranged: 80, magic: 0 }, rangedStrength: 60 },
        weapon: { category: "bow", attackSpeedTicks: 4, rangeTiles: 8, projectile: { visualId: "projectile.test-arrow" } } },
    ],
    attacks: [
      { id: "bite", style: "crush", maxHit: 5, speedTicks: 4, rangeTiles: 1 },
      { id: "spit", style: "magic", maxHit: 5, speedTicks: 4, rangeTiles: 10, projectile: { visualId: "projectile.spit" } },
    ],
    npcs: [
      { id: "weak", name: "Weak", size: 1, stats: { hitpoints: 20, attack: 1, strength: 1, defence: 1, ranged: 1, magic: 1, prayer: 1 } },
      { id: "chaser", name: "Chaser", size: 2, attacks: ["bite"], ai: { movement: "chase" },
        stats: { hitpoints: 500, attack: 50, strength: 1, defence: 1, ranged: 1, magic: 1, prayer: 1 } },
      { id: "spitter", name: "Spitter", size: 1, attacks: ["spit"],
        stats: { hitpoints: 500, attack: 1, strength: 1, defence: 1, ranged: 1, magic: 50, prayer: 1 } },
    ],
    encounters: ["weak", "chaser", "spitter"].map((npcId) => ({
      id: `fight-${npcId}`, name: npcId, description: "", arenaId: testArena.id, playerSpawn: "player",
      npcs: [{ npcId, spawn: "boss" }],
    })),
  });

const of = <T extends SimEvent["type"]>(events: SimEvent[], type: T) =>
  events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);

describe("combat scenarios", () => {
  it("the player walks into melee range, attacks on cooldown, and kills the NPC", () => {
    const s = scenario(
      { encounterId: "fight-weak", player: { equipment: { weapon: "test-sword" } } },
      combatContent(),
    ).command({ type: "attack", targetId: "npc-1" });
    s.runTicks(80);

    const attacks = of(s.events, "AttackStarted");
    expect(attacks.length).toBeGreaterThan(1);
    expect(attacks[0]).toMatchObject({ attackerId: "player", animationCue: "attack.slash", style: "slash" });
    // Weapon speed: attacks are 4 ticks apart (tick numbers come from the hits on melee, which land same tick).
    expect(of(s.events, "HitLanded").every((h) => h.amount <= h.maxHit)).toBe(true);
    expect(of(s.events, "EntityDied")).toEqual([{ type: "EntityDied", entityId: "npc-1", killerId: "player" }]);
    expect(s.snapshot.outcome).toMatchObject({ result: "win" });
  });

  it("ranged attacks launch a projectile and land after a delay", () => {
    const s = scenario({ encounterId: "fight-weak", player: { equipment: { weapon: "test-bow" } } }, combatContent())
      .command({ type: "attack", targetId: "npc-1" })
      .runTicks(30);
    const proj = of(s.events, "ProjectileLaunched")[0]!;
    expect(proj).toMatchObject({ sourceId: "player", targetId: "npc-1", visualId: "projectile.test-arrow" });
    expect(proj.landTick).toBeGreaterThan(proj.launchTick);
    // The player stops at range instead of walking up to melee distance.
    expect(Math.abs(s.snapshot.player.pos.x - 8) + Math.abs(s.snapshot.player.pos.y - 8)).toBeGreaterThan(2);
  });

  it("chasing NPCs walk to the player and attack in melee", () => {
    const s = scenario({ encounterId: "fight-chaser" }, combatContent()).runTicks(30);
    expect(of(s.events, "EntityMoved").some((e) => e.entityId === "npc-1")).toBe(true);
    const bites = of(s.events, "AttackStarted").filter((e) => e.attackerId === "npc-1");
    expect(bites.length).toBeGreaterThan(0);
    expect(bites.every((b) => b.attackId === "bite")).toBe(true);
  });

  it("NPC projectile hits land on the scheduled tick", () => {
    const content = combatContent();
    const s = scenario({ encounterId: "fight-spitter" }, content);
    let launched: Extract<SimEvent, { type: "ProjectileLaunched" }> | undefined;
    for (let i = 0; i < 20 && !launched; i++) launched = of(s.sim.tick().events, "ProjectileLaunched")[0];
    expect(launched).toBeDefined();
    let landedAt = -1;
    for (let i = 0; i < 10 && landedAt < 0; i++) {
      const r = s.sim.tick();
      if (of(r.events, "HitLanded").some((h) => h.sourceId === "npc-1")) landedAt = r.tick;
    }
    expect(landedAt).toBe(launched!.landTick);
  });

  it("the player losing all hitpoints ends the fight", () => {
    const s = scenario(
      { encounterId: "fight-chaser", player: { stats: { hitpoints: 10, attack: 1, strength: 1, defence: 1, ranged: 1, magic: 1, prayer: 1 } } },
      combatContent(),
    ).runTicks(400);
    expect(s.snapshot.outcome).toMatchObject({ result: "loss", reason: "player died" });
    expect(s.snapshot.player.hitpoints).toBe(0);
    expect(of(s.events, "EntityDied").some((e) => e.entityId === "player")).toBe(true);
  });

  it("rejects equipment in the wrong slot", () => {
    expect(() => scenario({ encounterId: "fight-weak", player: { equipment: { head: "test-sword" } } }, combatContent())).toThrow(/cannot be worn/);
  });
});
