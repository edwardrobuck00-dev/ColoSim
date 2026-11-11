import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createSimulation, defineMechanic, defineSpecialKind, type BehaviourDef, type NpcDefInput, type NpcState, type PlayerCommand,
  type SimEvent,
} from "../src";
import { ofType } from "./fixtures";
import { buildTestContent, testArena } from "./harness";

/*
 * A test-only boss built entirely from data, plus one custom special kind and
 * one helper mechanic registered from the test. Nothing here touches engine code.
 */

const ATTACKS = [
  { id: "zap", style: "magic" as const, maxHit: 5, speedTicks: 2, rangeTiles: 15, accuracyBonus: 9000, projectile: { visualId: "p.zap" } },
  { id: "shot", style: "ranged" as const, maxHit: 5, speedTicks: 2, rangeTiles: 15, accuracyBonus: 9000, projectile: { visualId: "p.shot" } },
  { id: "smack", style: "crush" as const, maxHit: 5, speedTicks: 2, rangeTiles: 1, accuracyBonus: 9000 },
];

/** Sets the boss's hitpoints on a given tick (tests only: mutates through the read-only view). */
const setBossHp = defineMechanic({
  id: "test.set-boss-hp",
  description: "test helper",
  params: z.object({ tick: z.number().int(), hp: z.number().int() }),
  create: ({ tick, hp }) => ({
    hooks: {
      onTick: (ctx) => {
        if (ctx.tick === tick) (ctx.npcs[0] as NpcState).hitpoints = hp;
      },
    },
  }),
});

/** A custom special kind: proves new kinds plug in without engine changes. */
const tauntKind = defineSpecialKind({
  id: "test.taunt",
  description: "Says something, then fires two zaps one tick apart.",
  params: z.object({ text: z.string() }),
  attackRefs: () => ["zap"],
  perform: (ctx, p) => {
    ctx.say(p.text);
    ctx.attack("zap", 0);
    ctx.attack("zap", 1);
  },
});

function boss(behaviour: BehaviourDef | Record<string, unknown>, extra: Partial<NpcDefInput> = {}): NpcDefInput {
  return {
    id: "trial",
    name: "Trial Boss",
    size: 2,
    stats: { hitpoints: 100, attack: 200, strength: 1, defence: 1, ranged: 200, magic: 200, prayer: 1 },
    behaviour: behaviour as NpcDefInput["behaviour"],
    specials: [
      { id: "rain", name: "Rain", kind: "tile-aoe", params: { area: { shape: "around-target", radius: 0 }, delayTicks: 3, damage: [10, 10], lingerTicks: 3, lingerDamage: 2 } },
      { id: "volley", name: "Volley", kind: "volley", params: { attacks: [{ attack: "zap", delayTicks: 0 }, { attack: "shot", delayTicks: 2 }] } },
      { id: "taunt", name: "Taunt", kind: "test.taunt", params: { text: "Come on!" } },
    ],
    ...extra,
  };
}

function setup(npc: NpcDefInput, mechanics: Array<{ id: string; params?: Record<string, unknown> }> = []) {
  const content = buildTestContent({
    attacks: ATTACKS,
    npcs: [npc],
    mechanics: [setBossHp],
    specialKinds: [tauntKind],
    arenas: [{ ...testArena, id: "trial-arena", spawns: { ...testArena.spawns, center: { x: 9, y: 9 } } }],
    prayers: [
      { id: "pmagic", name: "Protect from Magic", level: 1, drainEffect: 0, groups: ["overhead"], protects: "magic" },
      { id: "pmissiles", name: "Protect from Missiles", level: 1, drainEffect: 0, groups: ["overhead"], protects: "ranged" },
    ],
    encounters: [{
      id: "trial", name: "Trial", description: "", arenaId: "trial-arena", playerSpawn: "player",
      npcs: [{ npcId: "trial", spawn: "boss" }], winCondition: "none", mechanics,
    }],
  });
  const sim = createSimulation({ seed: 3, encounterId: "trial" }, content);
  const log: Array<{ tick: number; e: SimEvent }> = [];
  const run = (n: number, ...cmds: PlayerCommand[]) => {
    for (const c of cmds) sim.queueCommand(c);
    for (let i = 0; i < n; i++) {
      const r = sim.tick();
      for (const e of r.events) log.push({ tick: r.tick, e });
    }
  };
  const of = <T extends SimEvent["type"]>(type: T) => log.filter((l) => l.e.type === type) as Array<{ tick: number; e: Extract<SimEvent, { type: T }> }>;
  const npcAttacks = () => of("AttackStarted").filter((l) => l.e.attackerId === "npc-1").map((l) => l.e.attackId);
  return { sim, run, log, of, npcAttacks };
}

const phase = (over: Record<string, unknown>) => ({ id: "one", movement: "stationary", pattern: { type: "rotation", attacks: ["zap", "shot"] }, ...over });

describe("attack patterns", () => {
  it("rotation cycles its attacks", () => {
    const t = setup(boss({ phases: [phase({})] }));
    t.run(12);
    expect(t.npcAttacks().slice(0, 4)).toEqual(["zap", "shot", "zap", "shot"]);
  });

  it("switch uses one attack `every` times before changing", () => {
    const t = setup(boss({ phases: [phase({ pattern: { type: "switch", attacks: ["zap", "shot"], every: 3 } })] }));
    t.run(25);
    expect(t.npcAttacks().slice(0, 9)).toEqual(["zap", "zap", "zap", "shot", "shot", "shot", "zap", "zap", "zap"]);
  });

  it("random follows its weights and is deterministic per seed", () => {
    const run = () => {
      const t = setup(boss({ phases: [phase({ pattern: { type: "random", attacks: [{ attack: "zap", weight: 3 }, { attack: "shot", weight: 1 }] } })] }));
      t.run(300);
      return t.npcAttacks();
    };
    const a = run();
    expect(run()).toEqual(a);
    const zaps = a.filter((x) => x === "zap").length / a.length;
    expect(zaps).toBeGreaterThan(0.6);
    expect(zaps).toBeLessThan(0.9);
  });

  it("uses the close-range attack when the player is next to it", () => {
    const t = setup(boss({ phases: [phase({ closeRange: { attack: "smack" } })] }));
    t.run(3);
    expect(t.npcAttacks()).not.toContain("smack");
    t.run(20, { type: "move", to: { x: 7, y: 8 } });
    expect(t.npcAttacks().slice(-2)).toEqual(["smack", "smack"]);
  });
});

describe("special attacks", () => {
  it("every N-th attack is a special, in rotation", () => {
    const t = setup(boss({ phases: [phase({ specials: { every: 3, ids: ["volley", "taunt"] } })] }));
    t.run(14);
    expect(t.of("BossSpecialUsed").map((l) => l.e.specialId)).toEqual(["volley", "taunt"]);
  });

  it("a volley starts its attacks at their tick offsets; switching prayer as each lands blocks both", () => {
    const t = setup(boss({ phases: [phase({ specials: { every: 1, ids: ["volley"] }, attackSpeedTicks: 20 })] }));
    t.run(1, { type: "togglePrayer", prayerId: "pmagic" });
    const first = t.of("BossSpecialUsed")[0]!.tick;
    t.run(2);
    const launches = t.of("ProjectileLaunched").filter((l) => l.e.sourceId === "npc-1");
    expect(launches.map((l) => [l.e.style, l.tick - first])).toEqual([["magic", 0], ["ranged", 2]]);
    const [zap, shot] = launches.map((l) => l.e.landTick);
    expect(zap!).toBeLessThan(shot!);
    // Protection is checked when each hit lands: switch on the shot's landing tick.
    while (t.sim.getSnapshot().tick < shot! - 1) t.run(1);
    t.run(1, { type: "togglePrayer", prayerId: "pmissiles" });
    const hits = t.of("HitLanded").filter((l) => l.e.targetId === "player");
    expect(hits.map((h) => [h.e.style, h.e.blockedByPrayer, h.e.amount])).toEqual([["magic", true, 0], ["ranged", true, 0]]);
  });

  it("tile AoE hits a player who stays, misses one who moves, and lingering fire burns each tick", () => {
    const stay = setup(boss({ phases: [phase({ specials: { every: 1, ids: ["rain"] }, attackSpeedTicks: 20 })] }));
    stay.run(8);
    const placed = stay.of("HazardPlaced")[0]!;
    expect(placed.e.tiles).toEqual([{ x: 1, y: 1 }]);
    const typeless = stay.of("HitLanded").filter((l) => l.e.style === "typeless");
    expect(typeless.map((l) => [l.tick - placed.tick, l.e.amount])).toEqual([[3, 10], [4, 2], [5, 2], [6, 2]]);

    const move = setup(boss({ phases: [phase({ specials: { every: 1, ids: ["rain"] }, attackSpeedTicks: 20 })] }));
    move.run(1);
    move.run(8, { type: "move", to: { x: 3, y: 1 } });
    expect(move.of("HitLanded").filter((l) => l.e.style === "typeless")).toEqual([]);
  });

  it("a custom special kind registered by content works without engine changes", () => {
    const t = setup(boss({ phases: [phase({ specials: { every: 1, ids: ["taunt"] }, attackSpeedTicks: 10 })] }));
    t.run(3);
    expect(t.of("NpcSaid")[0]!.e.text).toBe("Come on!");
    const zaps = t.of("AttackStarted").filter((l) => l.e.attackId === "zap");
    expect(zaps.map((z2) => z2.tick)).toEqual([1, 2]);
  });
});

describe("phases", () => {
  const twoPhases = {
    phases: [
      phase({}),
      phase({
        id: "two", name: "Second wind", atHpPercent: 50, pattern: { type: "rotation", attacks: ["shot"] },
        onEnter: { say: "Enough!", invulnerableTicks: 4, pauseTicks: 3, moveTo: "center" },
      }),
    ],
  };

  it("changes phase at its next turn once hitpoints reach the threshold, with its entry effects", () => {
    // The helper sets hitpoints in the encounter phase, before NPC turns, so the change is on the same tick.
    const t = setup(boss(twoPhases), [{ id: "test.set-boss-hp", params: { tick: 6, hp: 50 } }]);
    t.run(5);
    expect(t.of("BossPhaseChanged")).toEqual([]);
    t.run(1);
    const change = t.of("BossPhaseChanged")[0]!;
    expect(change).toMatchObject({ tick: 6, e: { phaseId: "two", name: "Second wind", phaseIndex: 1 } });
    expect(t.of("NpcSaid").map((l) => l.e.text)).toContain("Enough!");
    expect(t.of("EntityMoved").find((l) => l.e.teleport)?.e.to).toEqual({ x: 9, y: 9 });
    const snap = t.sim.getSnapshot().npcs[0]!;
    expect(snap).toMatchObject({ phase: { index: 1, count: 2, id: "two", name: "Second wind" }, invulnerable: true });
    // Paused for 3 ticks, then only "shot".
    t.run(10);
    const after = t.of("AttackStarted").filter((l) => l.e.attackerId === "npc-1" && l.tick > 6);
    expect(after[0]!.tick).toBeGreaterThanOrEqual(9);
    expect(new Set(after.map((l) => l.e.attackId))).toEqual(new Set(["shot"]));
  });

  it("an invulnerable boss takes no damage", () => {
    const content = setup(boss(twoPhases), [{ id: "test.set-boss-hp", params: { tick: 2, hp: 50 } }]);
    content.run(3);
    expect(content.sim.getSnapshot().npcs[0]!.invulnerable).toBe(true);
  });
});

describe("enrage", () => {
  it("by hitpoints: faster attacks and a bigger max hit", () => {
    const t = setup(
      boss({ phases: [phase({ pattern: { type: "rotation", attacks: ["zap"] }, attackSpeedTicks: 4 })], enrage: { atHpPercent: 30, attackSpeedDelta: -2, maxHitMultiplier: [2, 1], say: "RAAH" } }),
      [{ id: "test.set-boss-hp", params: { tick: 10, hp: 20 } }],
    );
    t.run(30);
    const enraged = t.of("BossEnraged")[0]!;
    expect(enraged.tick).toBe(10);
    const ticks = t.of("AttackStarted").filter((l) => l.e.attackerId === "npc-1").map((l) => l.tick);
    const gaps = ticks.slice(1).map((x, i) => x - ticks[i]!);
    expect(gaps.slice(0, 2)).toEqual([4, 4]);
    expect(gaps.slice(-3)).toEqual([2, 2, 2]);
    const late = t.of("HitLanded").filter((l) => l.e.targetId === "player" && l.tick > 16);
    expect(late.every((l) => l.e.maxHit === 10)).toBe(true);
    expect(t.sim.getSnapshot().npcs[0]!.enraged).toBe(true);
  });

  it("by time limit", () => {
    const t = setup(boss({ phases: [phase({})], enrage: { afterTicks: 7 } }));
    t.run(10);
    expect(t.of("BossEnraged")[0]!.tick).toBe(7);
  });
});

describe("the framework is data only", () => {
  it("is deterministic: the same seed and inputs give the same state hash", () => {
    const run = () => {
      const t = setup(boss({ phases: [phase({ specials: { every: 2, ids: ["rain", "volley"] } })] }));
      t.run(60);
      return t.sim.getStateHash();
    };
    expect(run()).toBe(run());
  });

  it("NPCs without behaviour data still use their attacks list", () => {
    const t = setup({ ...boss({ phases: [phase({})] }), behaviour: undefined, attacks: ["shot"], ai: { movement: "stationary", selection: "sequence" } });
    t.run(6);
    expect(new Set(t.npcAttacks())).toEqual(new Set(["shot"]));
  });
});

it("ofType helper still works with new events", () => {
  expect(ofType([{ type: "BossEnraged", npcId: "x" }] as SimEvent[], "BossEnraged")).toHaveLength(1);
});
