import { describe, expect, it } from "vitest";
import { HITPOINT_REGEN_INTERVAL, PIPELINES, createSimulation, hitDelayTicks, type SimEvent, type SimulationConfigInput } from "../src";
import { STATS_10, STATS_99, combatContent, ofType, pipelineMechanic, recorderMechanic } from "./fixtures";

function run(config: Partial<SimulationConfigInput> & { encounterId: string }, ticks: number, content = combatContent(), attack = true) {
  const sim = createSimulation({ seed: 5, ...config }, content);
  if (attack) sim.queueCommand({ type: "attack", targetId: "npc-1" });
  const perTick: Array<{ tick: number; events: SimEvent[] }> = [];
  for (let i = 0; i < ticks; i++) {
    const r = sim.tick();
    perTick.push({ tick: r.tick, events: r.events });
  }
  const events = perTick.flatMap((t) => t.events);
  const ticksOf = (pred: (e: SimEvent) => boolean) => perTick.filter((t) => t.events.some(pred)).map((t) => t.tick);
  return { sim, events, ticksOf };
}

const sword = { stats: STATS_99, equipment: { weapon: "sword4" } };
const maul = { stats: STATS_99, equipment: { weapon: "maul6" } };
const bow = { stats: STATS_99, equipment: { weapon: "bow" } };
const playerAttacks = (e: SimEvent) => e.type === "AttackStarted" && e.attackerId === "player";

describe("attack cooldowns and weapon speed", () => {
  it("a 4-tick weapon attacks exactly every 4 ticks once in range", () => {
    const { ticksOf } = run({ encounterId: "vs-dummy", player: sword }, 40);
    const t = ticksOf(playerAttacks);
    expect(t.length).toBeGreaterThan(4);
    expect(t.slice(1).map((x, i) => x - t[i]!)).toEqual(Array(t.length - 1).fill(4));
  });

  it("a 6-tick weapon attacks every 6 ticks", () => {
    const { ticksOf } = run({ encounterId: "vs-dummy", player: maul }, 40);
    const t = ticksOf(playerAttacks);
    expect(t.slice(1).map((x, i) => x - t[i]!)).toEqual(Array(t.length - 1).fill(6));
  });

  it("the cooldown survives moving away and re-attacking", () => {
    const sim = createSimulation({ seed: 1, encounterId: "vs-dummy", player: bow }, combatContent());
    sim.queueCommand({ type: "attack", targetId: "npc-1" });
    const first = sim.tick(); // in range at once: attacks on tick 1
    expect(ofType(first.events, "AttackStarted")).toHaveLength(1);
    sim.queueCommand({ type: "move", to: { x: 2, y: 1 } });
    sim.tick(); // tick 2: moving
    sim.queueCommand({ type: "attack", targetId: "npc-1" });
    const t3 = sim.tick(); // tick 3: still on cooldown (next attack tick 4)
    expect(ofType(t3.events, "AttackStarted")).toHaveLength(0);
    expect(t3.snapshot.player.attackReadyIn).toBe(1);
    expect(ofType(sim.tick().events, "AttackStarted")).toHaveLength(1); // tick 4
  });

  it("an attack-speed pipeline changes the cadence", () => {
    const fast = pipelineMechanic("haste", PIPELINES.attackSpeed, (v) => v - 2);
    const content = combatContent([fast], [{ id: "haste" }]);
    const { ticksOf } = run({ encounterId: "vs-dummy", player: maul }, 30, content);
    const t = ticksOf(playerAttacks);
    expect(t[1]! - t[0]!).toBe(4);
  });
});

describe("attack, hit and projectile timing", () => {
  it("melee hits land on the attack tick", () => {
    const { ticksOf } = run({ encounterId: "vs-dummy", player: sword }, 30);
    expect(ticksOf(playerAttacks)).toEqual(ticksOf((e) => e.type === "HitLanded" && e.sourceId === "player"));
  });

  it("ranged hits land after the distance-based delay, and the projectile is in the state until then", () => {
    const sim = createSimulation({ seed: 1, encounterId: "vs-dummy", player: bow }, combatContent());
    sim.queueCommand({ type: "attack", targetId: "npc-1" });
    const r1 = sim.tick();
    const launched = ofType(r1.events, "ProjectileLaunched")[0]!;
    const expectedDelay = hitDelayTicks("ranged", 7); // player (1,1) to dummy (8,8)
    expect(launched.landTick - launched.launchTick).toBe(expectedDelay);
    expect(r1.snapshot.projectiles.map((p) => p.id)).toEqual([launched.projectileId]);

    let landed = -1;
    for (let i = 0; i < 5 && landed < 0; i++) {
      const r = sim.tick();
      if (ofType(r.events, "HitLanded").length) {
        landed = r.tick;
        expect(r.snapshot.projectiles.find((p) => p.id === launched.projectileId)).toBeUndefined();
      }
    }
    expect(landed).toBe(launched.landTick);
  });
});

describe("damage resolution and hitpoints", () => {
  it("damage never exceeds the max hit, and hitpoints match the hits", () => {
    const { sim, events } = run({ encounterId: "vs-dummy", player: sword }, 80);
    const hits = ofType(events, "HitLanded");
    expect(hits.every((h) => h.amount >= 0 && h.amount <= h.maxHit)).toBe(true);
    const total = hits.reduce((s, h) => s + h.amount, 0);
    // 80 ticks is less than one regeneration interval, so hitpoints are exactly 1000 minus damage.
    expect(sim.getSnapshot().npcs[0]!.hitpoints).toBe(1000 - total);
  });

  it("damage is capped at the target's remaining hitpoints", () => {
    const { events } = run({ encounterId: "duel", player: sword }, 30);
    const hits = ofType(events, "HitLanded").filter((h) => h.sourceId === "player");
    expect(hits.reduce((s, h) => s + h.amount, 0)).toBe(3);
    expect(hits.at(-1)!.targetHitpoints).toBe(0);
  });

  it("an incoming-damage pipeline modifies hits as they land", () => {
    const zero = pipelineMechanic("immune", PIPELINES.incomingDamage, () => 0);
    const { events } = run({ encounterId: "vs-dummy", player: sword }, 40, combatContent([zero], [{ id: "immune" }]));
    expect(ofType(events, "HitLanded").every((h) => h.amount === 0)).toBe(true);
  });

  it("accuracy pipelines decide hits and misses", () => {
    const blind = pipelineMechanic("blind", PIPELINES.attackRoll, () => 0);
    const { events } = run({ encounterId: "vs-dummy", player: sword }, 40, combatContent([blind], [{ id: "blind" }]));
    expect(ofType(events, "HitLanded").length).toBeGreaterThan(3);
    expect(ofType(events, "HitLanded").every((h) => h.amount === 0)).toBe(true);
  });

  it("hitpoints regenerate by 1 every interval", () => {
    // The spitter damages the player; on the regen tick, HP = previous HP - that tick's damage + 1.
    const s2 = createSimulation({ seed: 1, encounterId: "vs-spitter", player: { stats: STATS_99 } }, combatContent());
    let hpAt99 = -1;
    let hpAt100 = -1;
    for (let t = 1; t <= HITPOINT_REGEN_INTERVAL; t++) {
      const r = s2.tick();
      const regenTickHits = ofType(r.events, "HitLanded").filter((h) => h.targetId === "player").reduce((a, h) => a + h.amount, 0);
      if (t === HITPOINT_REGEN_INTERVAL - 1) hpAt99 = r.snapshot.player.hitpoints;
      if (t === HITPOINT_REGEN_INTERVAL) hpAt100 = r.snapshot.player.hitpoints + regenTickHits;
    }
    expect(hpAt100).toBe(Math.min(99, hpAt99 + 1));
  });
});

describe("combat event processing order", () => {
  it("hooks fire as attack -> hit -> death, with the scheduled land tick", () => {
    const log: string[] = [];
    const content = combatContent([recorderMechanic(log)], [{ id: "recorder" }]);
    run({ encounterId: "vs-glass", player: bow }, 30, content);
    const kinds = log.map((l) => l.split(":")[1]);
    expect(kinds[0]).toBe("attack");
    expect(kinds).toContain("hit");
    expect(kinds.at(-1)).toBe("death");
    const firstAttack = log.find((l) => l.includes(":attack:"))!;
    const land = Number(firstAttack.split("@")[1]);
    const firstHit = log.find((l) => l.includes(":hit:"))!;
    expect(Number(firstHit.split(":")[0])).toBe(land);
  });

  it("hits still in flight when the target dies are dropped", () => {
    const fast = pipelineMechanic("rapid", PIPELINES.attackSpeed, () => 1);
    const { events } = run({ encounterId: "vs-glass", player: bow }, 30, combatContent([fast], [{ id: "rapid" }]));
    const launched = ofType(events, "ProjectileLaunched").length;
    const landed = ofType(events, "HitLanded").length;
    expect(launched).toBeGreaterThan(landed); // some arrows were still flying when Glass died
    expect(ofType(events, "EntityDied")).toHaveLength(1);
  });
});

describe("death and respawn", () => {
  it("an NPC goes alive -> dying -> dead -> alive on schedule", () => {
    const sim = createSimulation({ seed: 5, encounterId: "vs-phoenix", player: sword }, combatContent());
    const perTick: Array<{ tick: number; events: SimEvent[] }> = [];
    for (let i = 0; i < 60; i++) {
      const s = sim.getSnapshot();
      // Targets are cleared on death, so re-attack whenever the phoenix is back.
      if (s.npcs[0]!.alive && !s.player.targetId) sim.queueCommand({ type: "attack", targetId: "npc-1" });
      const r = sim.tick();
      perTick.push({ tick: r.tick, events: r.events });
    }
    const events = perTick.flatMap((t) => t.events);
    const ticksOf = (pred: (e: SimEvent) => boolean) => perTick.filter((t) => t.events.some(pred)).map((t) => t.tick);
    const died = ticksOf((e) => e.type === "EntityDied" && e.entityId === "npc-1");
    const despawned = ticksOf((e) => e.type === "EntityDespawned" && e.entityId === "npc-1");
    const respawned = ticksOf((e) => e.type === "EntitySpawned" && e.entityId === "npc-1");
    expect(died.length).toBeGreaterThan(1); // killed, respawned and killed again
    expect(despawned[0]! - died[0]!).toBe(2); // deathTicks
    expect(respawned[0]! - despawned[0]!).toBe(4); // respawnTicks
    const spawn = ofType(events, "EntitySpawned").find((e) => e.entityId === "npc-1")!;
    expect(spawn).toMatchObject({ respawn: true, pos: { x: 8, y: 8 } });
    expect(sim.getSnapshot().outcome).toBeNull(); // winCondition none
  });

  it("dying and dead entities cannot be hit or attacked", () => {
    const sim = createSimulation({ seed: 3, encounterId: "vs-phoenix", player: sword }, combatContent());
    sim.queueCommand({ type: "attack", targetId: "npc-1" });
    let deathTick = -1;
    for (let i = 0; i < 40 && deathTick < 0; i++) {
      const r = sim.tick();
      if (ofType(r.events, "EntityDied").length) deathTick = r.tick;
    }
    const r = sim.tick();
    expect(r.snapshot.npcs[0]!.life).toBe("dying");
    expect(ofType(r.events, "AttackStarted")).toHaveLength(0);
    expect(r.snapshot.player.targetId).toBeNull();
  });

  it("in 'end' mode, the player's death ends the encounter as a loss", () => {
    const { sim, events } = run({ encounterId: "vs-bruiser", player: { stats: STATS_10 } }, 200, combatContent(), false);
    expect(sim.getSnapshot().outcome).toMatchObject({ result: "loss", reason: "player died" });
    expect(sim.getSnapshot().player.life).toBe("dying");
    expect(ofType(events, "EntityDied").map((e) => e.entityId)).toEqual(["player"]);
  });

  it("in 'respawn' mode, the player comes back and the fight goes on", () => {
    const sim = createSimulation({ seed: 9, encounterId: "practice", player: { stats: STATS_10 } }, combatContent());
    const events: SimEvent[] = [];
    let rejected = false;
    for (let i = 0; i < 200; i++) {
      if (sim.getSnapshot().player.life !== "alive") sim.queueCommand({ type: "move", to: { x: 0, y: 0 } });
      const r = sim.tick();
      events.push(...r.events);
      if (ofType(r.events, "CommandRejected").some((e) => e.reason === "you are dead")) rejected = true;
    }
    const deaths = ofType(events, "EntityDied").filter((e) => e.entityId === "player");
    const respawns = ofType(events, "EntitySpawned").filter((e) => e.entityId === "player");
    expect(deaths.length).toBeGreaterThan(0);
    expect(respawns.length).toBeGreaterThan(0);
    expect(rejected).toBe(true);
    expect(sim.getSnapshot().outcome).toBeNull();
  });

  it("NPCs drop their target while the player is down", () => {
    const sim = createSimulation({ seed: 9, encounterId: "practice", player: { stats: STATS_10 } }, combatContent());
    for (let i = 0; i < 300; i++) {
      const r = sim.tick();
      if (r.snapshot.player.life === "dead") {
        expect(r.snapshot.npcs[0]!.targetId).toBeNull();
        return;
      }
    }
    expect.unreachable("the player never died");
  });
});
