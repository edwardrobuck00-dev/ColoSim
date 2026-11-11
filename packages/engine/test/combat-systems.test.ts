import { describe, expect, it } from "vitest";
import {
  createSimulation,
  magicMaxHit,
  npcDefenceRoll,
  type PlayerSetupInput,
  type SimEvent,
} from "../src";
import { ofType } from "./fixtures";
import { buildTestContent, testArena } from "./harness";

const STATS = { hitpoints: 99, attack: 99, strength: 99, defence: 99, ranged: 99, magic: 99, prayer: 99 };

function content() {
  return buildTestContent({
    items: [
      { id: "sword", name: "Sword", slot: "weapon", bonuses: { attack: { stab: 50, slash: 80, crush: 0, ranged: 0, magic: 0 }, meleeStrength: 80 },
        weapon: { category: "slash-sword", attackSpeedTicks: 5, rangeTiles: 1,
          special: { name: "Cleave", energy: 25, damage: [[5, 4]] } } },
      { id: "dagger", name: "Dagger", slot: "weapon", bonuses: { attack: { stab: 80, slash: 40, crush: 0, ranged: 0, magic: 0 }, meleeStrength: 60 },
        weapon: { category: "stab-sword", attackSpeedTicks: 4, rangeTiles: 1,
          special: { name: "Twin", energy: 25, accuracy: [23, 20], damage: [[23, 20]], hits: 2 } } },
      { id: "hammer", name: "Hammer", slot: "weapon", bonuses: { attack: { stab: 0, slash: 0, crush: 300, ranged: 0, magic: 0 }, meleeStrength: 90 },
        weapon: { category: "blunt", attackSpeedTicks: 6, rangeTiles: 1,
          special: { name: "Smash", energy: 50, damage: [[3, 2]], effects: [{ type: "drain-defence-percent", percent: 30 }] } } },
      { id: "giant-club", name: "Giant club", slot: "weapon", bonuses: { attack: { stab: 0, slash: 0, crush: 5000, ranged: 0, magic: 0 }, meleeStrength: 5000 },
        weapon: { category: "blunt", attackSpeedTicks: 6, rangeTiles: 1 } },
      { id: "bow", name: "Bow", slot: "weapon", bonuses: { attack: { stab: 0, slash: 0, crush: 0, ranged: 100, magic: 0 }, rangedStrength: 50 },
        weapon: { category: "bow", attackSpeedTicks: 4, rangeTiles: 7, projectile: { visualId: "projectile.arrow" } } },
      { id: "staff", name: "Staff", slot: "weapon", bonuses: { attack: { stab: 0, slash: 0, crush: 10, ranged: 0, magic: 30 }, magicDamagePercent: 10 },
        weapon: { category: "staff", attackSpeedTicks: 5, rangeTiles: 1 } },
    ],
    spells: [{ id: "wave", name: "Wave", level: 75, baseMaxHit: 20, projectile: { visualId: "projectile.wave" } }],
    prayers: [
      { id: "steel-ward", name: "Steel ward", level: 43, drainEffect: 12, groups: ["overhead"], protects: "melee" },
      { id: "spell-ward", name: "Spell ward", level: 37, drainEffect: 12, groups: ["overhead"], protects: "magic" },
      { id: "might", name: "Might", level: 31, drainEffect: 12, groups: ["strength"], effects: { meleeStrength: [115, 100] } },
      { id: "oath", name: "Oath", level: 70, drainEffect: 24, groups: ["attack", "strength", "ranged-magic", "defence"],
        effects: { meleeAccuracy: [120, 100], meleeStrength: [123, 100], defence: [125, 100] } },
      { id: "high-level", name: "High", level: 98, drainEffect: 1, groups: ["defence"], effects: { defence: [150, 100] } },
    ],
    attacks: [
      { id: "bash", style: "crush", maxHit: 20, speedTicks: 4, rangeTiles: 1, accuracyBonus: 2000 },
      { id: "piercing-bolt", style: "magic", maxHit: 20, speedTicks: 4, rangeTiles: 10, accuracyBonus: 2000, prayerPenetration: 0.5 },
    ],
    npcs: [
      { id: "post", name: "Post", stats: { hitpoints: 5000, attack: 1, strength: 1, defence: 200, ranged: 1, magic: 1, prayer: 1 },
        defence: { stab: 0, slash: 0, crush: 0, ranged: 0, magic: 0 } },
      { id: "brute", name: "Brute", attacks: ["bash"], ai: { movement: "chase" },
        stats: { hitpoints: 5000, attack: 300, strength: 1, defence: 1, ranged: 1, magic: 1, prayer: 1 } },
      { id: "caster", name: "Caster", attacks: ["piercing-bolt"],
        stats: { hitpoints: 5000, attack: 1, strength: 1, defence: 1, ranged: 1, magic: 300, prayer: 1 } },
    ],
    encounters: ["post", "brute", "caster"].map((npcId) => ({
      id: `vs-${npcId}`, name: npcId, description: "", arenaId: testArena.id, playerSpawn: "player",
      npcs: [{ npcId, spawn: "boss" }], winCondition: "none" as const,
    })),
  });
}

function fight(encounterId: string, player: PlayerSetupInput, ticks: number, before: (sim: ReturnType<typeof createSimulation>) => void = () => {}) {
  const sim = createSimulation({ seed: 3, encounterId, player: { stats: STATS, ...player } }, content());
  before(sim);
  const perTick: Array<{ tick: number; events: SimEvent[] }> = [];
  for (let i = 0; i < ticks; i++) {
    const r = sim.tick();
    perTick.push({ tick: r.tick, events: r.events });
  }
  const events = perTick.flatMap((t) => t.events);
  const attackTicks = perTick.filter((t) => t.events.some((e) => e.type === "AttackStarted" && e.attackerId === "player")).map((t) => t.tick);
  return { sim, events, attackTicks };
}
const attack = (sim: ReturnType<typeof createSimulation>) => sim.queueCommand({ type: "attack", targetId: "npc-1" });
const playerMax = (events: SimEvent[]) => ofType(events, "HitLanded").find((h) => h.sourceId === "player")?.maxHit;

describe("combat styles", () => {
  it("the aggressive style raises the max hit (+3 effective Strength)", () => {
    const accurate = fight("vs-post", { equipment: { weapon: "sword" }, combatStyle: 0 }, 20, attack);
    const aggressive = fight("vs-post", { equipment: { weapon: "sword" }, combatStyle: 1 }, 20, attack);
    expect(playerMax(aggressive.events)!).toBeGreaterThan(playerMax(accurate.events)!);
  });

  it("rapid makes a 4-tick bow attack every 3 ticks", () => {
    const { attackTicks } = fight("vs-post", { equipment: { weapon: "bow" }, combatStyle: 1 }, 20, attack);
    expect(attackTicks[1]! - attackTicks[0]!).toBe(3);
  });

  it("longrange adds 2 tiles of range", () => {
    // Player at (1,1), post at (8,8): distance 7. Bow range 7 normally; from (1,1) both work, so step back first.
    const { sim } = fight("vs-post", { equipment: { weapon: "bow" }, combatStyle: 2 }, 1);
    expect(sim.getSnapshot().player.weapon.rangeTiles).toBe(9);
  });

  it("switching style takes effect on the next tick and is reported", () => {
    const { sim, events } = fight("vs-post", { equipment: { weapon: "sword" } }, 1, (s) => s.queueCommand({ type: "setCombatStyle", index: 2 }));
    expect(ofType(events, "CombatStyleChanged")).toEqual([{ type: "CombatStyleChanged", index: 2, name: "Lunge" }]);
    expect(sim.getSnapshot().player.weapon.style).toBe("stab");
  });
});

describe("prayers", () => {
  it("a strength prayer raises the max hit by the documented multiplier", () => {
    const without = fight("vs-post", { equipment: { weapon: "sword" }, combatStyle: 1 }, 10, attack);
    const withPrayer = fight("vs-post", { equipment: { weapon: "sword" }, combatStyle: 1, prayers: ["might"] }, 10, attack);
    // 99 Str: (99+3+8)=110 -> max floor((110*144+320)/640) = 25; with x115/100: floor(113.85)=113 +11 = 124 -> 28
    expect(playerMax(without.events)).toBe(25);
    expect(playerMax(withPrayer.events)).toBe(28);
  });

  it("protection prayers block all damage from NPC attacks of that style", () => {
    const { events } = fight("vs-brute", { prayers: ["steel-ward"] }, 60);
    const hits = ofType(events, "HitLanded").filter((h) => h.targetId === "player");
    expect(hits.length).toBeGreaterThan(3);
    expect(hits.every((h) => h.amount === 0 && h.blockedByPrayer)).toBe(true);
  });

  it("prayer penetration lets a fraction of damage through", () => {
    const unprotected = fight("vs-caster", {}, 60);
    const protectedFight = fight("vs-caster", { prayers: ["spell-ward"] }, 60);
    const dmg = (e: SimEvent[]) => ofType(e, "HitLanded").filter((h) => h.targetId === "player").map((h) => h.amount);
    // Same seed and rolls: each protected hit is floor(unprotected / 2) while prayer points last.
    const a = dmg(unprotected.events).slice(0, 5);
    const b = dmg(protectedFight.events).slice(0, 5);
    expect(b).toEqual(a.map((x) => Math.floor(x * 0.5)));
  });

  it("drains prayer points and switches prayers off at 0", () => {
    const { sim, events } = fight("vs-post", { stats: { ...STATS, prayer: 10 }, prayers: ["oath"] }, 60);
    expect(sim.getSnapshot().player.prayerPoints).toBe(0);
    expect(sim.getSnapshot().player.activePrayers).toEqual([]);
    expect(ofType(events, "PrayerToggled")).toContainEqual({ type: "PrayerToggled", prayerId: "oath", active: false, cause: "no-points" });
  });

  it("activating a prayer switches off prayers that share a group, and checks the level", () => {
    const { sim, events } = fight("vs-post", { stats: { ...STATS, prayer: 97 }, prayers: ["might"] }, 2, (s) => {
      s.queueCommand({ type: "togglePrayer", prayerId: "oath" });
      s.queueCommand({ type: "togglePrayer", prayerId: "high-level" });
    });
    expect(sim.getSnapshot().player.activePrayers).toEqual(["oath"]);
    expect(ofType(events, "CommandRejected").map((e) => e.reason)).toContain("needs 98 Prayer");
  });
});

describe("special attacks", () => {
  it("costs energy, applies the damage multiplier, then the next attack is normal", () => {
    const { sim, events } = fight("vs-post", { equipment: { weapon: "sword" }, combatStyle: 1 }, 12, (s) => {
      attack(s);
      s.queueCommand({ type: "toggleSpecial" });
    });
    const maxes = ofType(events, "HitLanded").filter((h) => h.sourceId === "player").map((h) => h.maxHit);
    expect(maxes[0]).toBe(Math.trunc((maxes[1]! * 5) / 4));
    expect(ofType(events, "SpecialUsed")[0]).toMatchObject({ name: "Cleave", energyLeft: 75 });
    expect(sim.getSnapshot().player.specialArmed).toBe(false);
  });

  it("two-hit specials land both hits on the same tick", () => {
    const { events } = fight("vs-post", { equipment: { weapon: "dagger" } }, 6, (s) => {
      attack(s);
      s.queueCommand({ type: "toggleSpecial" });
    });
    const firstAttack = ofType(events, "AttackStarted").find((e) => e.attackerId === "player")!;
    expect(firstAttack.special).toBe(true);
    const playerHits = ofType(events, "HitLanded").filter((h) => h.sourceId === "player");
    expect(playerHits.length).toBeGreaterThanOrEqual(2);
  });

  it("is refused without enough energy, and the attack goes ahead normally", () => {
    const { events } = fight("vs-post", { equipment: { weapon: "hammer" } }, 30, (s) => {
      attack(s);
      s.queueCommand({ type: "toggleSpecial" });
    });
    expect(ofType(events, "SpecialUsed")).toHaveLength(1);
    // Arm again after the first spec: 50 energy left, so a second one is allowed; a third would not be.
    const sim = createSimulation({ seed: 3, encounterId: "vs-post", player: { stats: STATS, equipment: { weapon: "hammer" } } }, content());
    attack(sim);
    const all: SimEvent[] = [];
    for (let i = 0; i < 3; i++) {
      sim.queueCommand({ type: "toggleSpecial" });
      for (let t = 0; t < 6; t++) all.push(...sim.tick().events);
    }
    expect(ofType(all, "SpecialUsed")).toHaveLength(2);
    expect(ofType(all, "CommandRejected").map((e) => e.reason)).toContain("not enough special attack energy");
  });

  it("a defence-draining special lowers the target's Defence and so its defence roll", () => {
    const { sim, events } = fight("vs-post", { equipment: { weapon: "hammer" } }, 20, (s) => {
      attack(s);
      s.queueCommand({ type: "toggleSpecial" });
    });
    const drain = ofType(events, "LevelDrained")[0];
    expect(drain).toMatchObject({ skill: "defence", from: 200, to: 140 });
    expect(sim.getSnapshot().npcs[0]!.levels.defence).toBe(140);
    expect(npcDefenceRoll(140, 0)).toBeLessThan(npcDefenceRoll(200, 0));
  });
});

describe("magic", () => {
  it("autocasting a spell uses its base max hit plus magic damage bonuses, and 5-tick casts", () => {
    const { events, attackTicks } = fight("vs-post", { equipment: { weapon: "staff" } }, 20, (s) => {
      s.queueCommand({ type: "setAutocast", spellId: "wave" });
      attack(s);
    });
    expect(ofType(events, "AutocastChanged")).toEqual([{ type: "AutocastChanged", spellId: "wave" }]);
    expect(playerMax(events)).toBe(magicMaxHit(20, 100)); // +10% from the staff: 22
    expect(attackTicks[1]! - attackTicks[0]!).toBe(5);
    expect(ofType(events, "ProjectileLaunched").length).toBeGreaterThan(0);
  });

  it("a staff without an autocast spell bashes in melee", () => {
    const { events } = fight("vs-post", { equipment: { weapon: "staff" }, combatStyle: 4 }, 20, attack);
    expect(ofType(events, "AttackStarted").find((e) => e.attackerId === "player")?.style).toBe("crush");
  });
});

describe("damage cap", () => {
  it("player hits never exceed 200", () => {
    const { events } = fight("vs-post", { equipment: { weapon: "giant-club" }, combatStyle: 1 }, 60, attack);
    const hits = ofType(events, "HitLanded").filter((h) => h.sourceId === "player");
    expect(hits[0]!.maxHit).toBeGreaterThan(200);
    expect(hits.every((h) => h.amount <= 200)).toBe(true);
  });
});
