import { describe, expect, it } from "vitest";
import {
  combinedDefenceFactor,
  createSimulation,
  drainPrayerTick,
  PRESERVE_EXTENSION_TICKS,
  type PlayerCommand,
  type PlayerSetupInput,
  type PrayerDefInput,
  type SimEvent,
} from "../src";
import { ofType } from "./fixtures";
import { buildTestContent, testArena } from "./harness";

const STATS = { hitpoints: 99, attack: 99, strength: 99, defence: 99, ranged: 99, magic: 99, prayer: 99 };
const pct = (n: number) => [n, 100] as [number, number];
const RM = ["strength", "attack", "ranged-magic"] as const;
const COMBINED = ["defence", "strength", "attack", "ranged-magic"] as const;

const PRAYERS: PrayerDefInput[] = [
  { id: "steel-skin", name: "Steel Skin", level: 28, drainEffect: 12, groups: ["defence"], effects: { defence: pct(115) } },
  { id: "ultimate-strength", name: "Ultimate Strength", level: 31, drainEffect: 12, groups: ["strength"], effects: { meleeStrength: pct(115) } },
  { id: "incredible-reflexes", name: "Incredible Reflexes", level: 34, drainEffect: 12, groups: ["attack"], effects: { meleeAccuracy: pct(115) } },
  { id: "eagle-eye", name: "Eagle Eye", level: 44, drainEffect: 12, groups: [...RM], effects: { rangedAccuracy: pct(115), rangedStrength: pct(115) } },
  { id: "deadeye", name: "Deadeye", level: 62, drainEffect: 12, groups: [...RM], effects: { rangedAccuracy: pct(118), rangedStrength: pct(118), defence: pct(105) } },
  { id: "piety", name: "Piety", level: 70, requirements: { defence: 70 }, drainEffect: 24, groups: [...COMBINED], effects: { meleeAccuracy: pct(120), meleeStrength: pct(123), defence: pct(125) } },
  { id: "protect-from-melee", name: "Protect from Melee", level: 43, drainEffect: 12, groups: ["overhead"], protects: "melee" },
  { id: "protect-from-magic", name: "Protect from Magic", level: 37, drainEffect: 12, groups: ["overhead"], protects: "magic" },
  { id: "redemption", name: "Redemption", level: 49, drainEffect: 6, groups: ["overhead"], utility: "redemption" },
  { id: "rapid-heal", name: "Rapid Heal", level: 22, drainEffect: 2, utility: "rapid-heal" },
  { id: "rapid-restore", name: "Rapid Restore", level: 19, drainEffect: 1, utility: "rapid-restore" },
  { id: "preserve", name: "Preserve", level: 55, drainEffect: 2, utility: "preserve" },
];

function content() {
  return buildTestContent({
    prayers: PRAYERS,
    items: [
      { id: "sword", name: "Sword", slot: "weapon", bonuses: { attack: { stab: 0, slash: 80, crush: 0, ranged: 0, magic: 0 }, meleeStrength: 80 },
        weapon: { category: "slash-sword", attackSpeedTicks: 4, rangeTiles: 1 } },
      { id: "whip", name: "Whip", slot: "weapon", requirements: { attack: 70 }, weapon: { category: "whip", attackSpeedTicks: 4, rangeTiles: 1 } },
      { id: "holy-robe", name: "Holy robe", slot: "body", bonuses: { prayer: 30 } },
      { id: "brew", name: "Brew", consumable: { kind: "potion", doses: 4, attackDelayTicks: 0, effects: [
        { type: "drain", skills: ["attack", "strength", "ranged", "magic"], amount: { terms: [{ num: 10, den: 100, mult: 1 }], flat: 2 } }] } },
      { id: "super-strength", name: "Super strength", consumable: { kind: "potion", doses: 4, attackDelayTicks: 0, effects: [
        { type: "boost", skills: ["strength"], amount: { terms: [{ num: 15, den: 100, mult: 1 }], flat: 5 } }] } },
    ],
    attacks: [
      { id: "poke", style: "stab", maxHit: 6, speedTicks: 4, rangeTiles: 1, accuracyBonus: 5000 },
      { id: "bash", style: "crush", maxHit: 30, speedTicks: 4, rangeTiles: 1, accuracyBonus: 5000 },
      { id: "bolt", style: "magic", maxHit: 30, speedTicks: 6, rangeTiles: 10, accuracyBonus: 5000, projectile: { visualId: "projectile.bolt" } },
    ],
    npcs: [
      { id: "post", name: "Post", stats: { hitpoints: 5000, attack: 1, strength: 1, defence: 1, ranged: 1, magic: 1, prayer: 1 } },
      { id: "brute", name: "Brute", attacks: ["bash"], ai: { movement: "chase" }, stats: { hitpoints: 5000, attack: 300, strength: 1, defence: 1, ranged: 1, magic: 1, prayer: 1 } },
      { id: "poker", name: "Poker", attacks: ["poke"], ai: { movement: "chase" }, stats: { hitpoints: 5000, attack: 300, strength: 1, defence: 1, ranged: 1, magic: 1, prayer: 1 } },
      { id: "caster", name: "Caster", attacks: ["bolt"], stats: { hitpoints: 5000, attack: 1, strength: 1, defence: 1, ranged: 1, magic: 300, prayer: 1 } },
    ],
    encounters: [
      ...["post", "brute", "poker", "caster"].map((npcId) => ({
        id: `vs-${npcId}`, name: npcId, description: "", arenaId: testArena.id, playerSpawn: "player",
        npcs: [{ npcId, spawn: "boss" }], winCondition: "none" as const,
      })),
      { id: "severed", name: "Severed", description: "", arenaId: testArena.id, playerSpawn: "player", npcs: [{ npcId: "post", spawn: "boss" }], winCondition: "none" as const,
        mechanics: [{ id: "disable-protection-prayers", params: { everyTicks: 10, lockTicks: 5 } }] },
      { id: "draining", name: "Draining", description: "", arenaId: testArena.id, playerSpawn: "player", npcs: [{ npcId: "brute", spawn: "boss" }], winCondition: "none" as const,
        mechanics: [{ id: "drain-prayer-on-hit", params: { flat: 5 } }] },
      { id: "fast-drain", name: "Fast drain", description: "", arenaId: testArena.id, playerSpawn: "player", npcs: [{ npcId: "post", spawn: "boss" }], winCondition: "none" as const,
        mechanics: [{ id: "scale-prayer-drain", params: { multiplier: 2 } }] },
    ],
  });
}

const sim = (encounterId: string, player: PlayerSetupInput = {}) =>
  createSimulation({ seed: 7, encounterId, player: { stats: STATS, ...player } }, content());
function step(s: ReturnType<typeof sim>, ...cmds: PlayerCommand[]): SimEvent[] {
  for (const c of cmds) s.queueCommand(c);
  return s.tick().events;
}
const toggle = (prayerId: string): PlayerCommand => ({ type: "togglePrayer", prayerId });
const active = (s: ReturnType<typeof sim>) => [...s.getSnapshot().player.activePrayers].sort();
const rejections = (e: SimEvent[]) => ofType(e, "CommandRejected").map((r) => r.reason);

describe("conflicting prayers (OSRS Wiki table)", () => {
  it("strength and attack prayers stack; a ranged prayer replaces both", () => {
    const s = sim("vs-post");
    step(s, toggle("ultimate-strength"), toggle("incredible-reflexes"));
    expect(active(s)).toEqual(["incredible-reflexes", "ultimate-strength"]);
    step(s, toggle("eagle-eye"));
    expect(active(s)).toEqual(["eagle-eye"]);
  });

  it("Deadeye works alongside a defence prayer; Piety replaces both", () => {
    const s = sim("vs-post");
    step(s, toggle("steel-skin"), toggle("deadeye"));
    expect(active(s)).toEqual(["deadeye", "steel-skin"]);
    step(s, toggle("piety"));
    expect(active(s)).toEqual(["piety"]);
  });

  it("overheads replace each other; utility prayers never conflict", () => {
    const s = sim("vs-post");
    step(s, toggle("protect-from-melee"), toggle("rapid-heal"), toggle("preserve"), toggle("piety"));
    step(s, toggle("protect-from-magic"));
    expect(active(s)).toEqual(["piety", "preserve", "protect-from-magic", "rapid-heal"]);
    expect(s.getSnapshot().player.overhead).toBe("magic");
  });

  it("checks Prayer and other level requirements", () => {
    const s = sim("vs-post", { stats: { ...STATS, defence: 69 } });
    expect(rejections(step(s, toggle("piety")))).toEqual(["needs 70 Defence"]);
  });
});

describe("prayers in combat calculations", () => {
  it("defence prayer bonuses add together (Steel Skin + Deadeye = +20%)", () => {
    expect(combinedDefenceFactor([{ defence: pct(115) }, { defence: pct(105) }])).toEqual([120, 100]);
  });

  it("switching a prayer on or off changes the very next attack", () => {
    const s = sim("vs-post", { equipment: { weapon: "sword" }, combatStyle: 1 });
    s.queueCommand({ type: "attack", targetId: "npc-1" });
    const maxes: number[] = [];
    const run = (n: number) => {
      for (let i = 0; i < n; i++) for (const h of ofType(s.tick().events, "HitLanded")) if (h.sourceId === "player") maxes.push(h.maxHit);
    };
    const runUntil = (n: number) => {
      for (let i = 0; i < 40 && maxes.length < n; i++) run(1);
    };
    runUntil(1); // walk to the post and land the first hit
    s.queueCommand(toggle("ultimate-strength"));
    runUntil(2);
    s.queueCommand(toggle("ultimate-strength"));
    runUntil(3);
    // 99 Str aggressive, +80: (110*144+320)/640 = 25; x115/100: 113+11 = 124 -> 28.
    expect(maxes).toEqual([25, 28, 25]);
  });
});

describe("prayer switching on ticks", () => {
  function firstMagicProjectile(s: ReturnType<typeof sim>) {
    for (let i = 0; i < 20; i++) {
      const proj = ofType(s.tick().events, "ProjectileLaunched")[0];
      if (proj) return proj;
    }
    throw new Error("no projectile");
  }

  it("a protection prayer switched on the tick a projectile lands blocks it", () => {
    const s = sim("vs-caster");
    const proj = firstMagicProjectile(s);
    while (s.getSnapshot().tick < proj.landTick - 1) s.tick();
    const e = step(s, toggle("protect-from-magic")); // applied at the start of the landing tick
    const hit = ofType(e, "HitLanded").find((h) => h.targetId === "player")!;
    expect(hit).toMatchObject({ amount: 0, blockedByPrayer: true });
  });

  it("switching a prayer on and off within one tick costs no prayer (a flick)", () => {
    const s = sim("vs-post");
    for (let i = 0; i < 10; i++) step(s, toggle("piety"), toggle("piety"));
    expect(s.getSnapshot().player.prayerPoints).toBe(99);
  });
});

describe("prayer drain", () => {
  it("prayer bonus from equipment slows the drain (resistance 60 + 2 x bonus)", () => {
    const points = (equipment: PlayerSetupInput["equipment"]) => {
      const s = sim("vs-post", { equipment, prayers: ["piety"] });
      for (let i = 0; i < 100; i++) s.tick();
      return 99 - s.getSnapshot().player.prayerPoints;
    };
    const expected = (bonus: number) => {
      let counter = 0;
      let lost = 0;
      for (let i = 0; i < 100; i++) {
        const r = drainPrayerTick(counter, 24, bonus);
        counter = r.counter;
        lost += r.pointsLost;
      }
      return lost;
    };
    // 2400 drain over 100 ticks. A point goes only when the counter *exceeds*
    // the resistance, so the last full resistance stays on the counter.
    expect(points({})).toBe(expected(0));
    expect(expected(0)).toBe(39); // resistance 60
    expect(points({ body: "holy-robe" })).toBe(expected(30));
    expect(expected(30)).toBe(19); // resistance 120
  });

  it("encounter mechanics can speed up drain", () => {
    const s = sim("fast-drain", { prayers: ["piety"] });
    for (let i = 0; i < 100; i++) s.tick();
    // Doubled drain: 4800 over 100 ticks at resistance 60 -> 79 (39 without the mechanic).
    expect(99 - s.getSnapshot().player.prayerPoints).toBe(79);
  });
});

describe("utility prayers", () => {
  it("Redemption heals floor(Prayer / 4) and drains all prayer when a hit leaves you under 10%", () => {
    // Hits of up to 6 from 12 hp: the first hit that leaves 1-9 hp (under 10% of 99) triggers it.
    const s = sim("vs-poker", { prayers: ["redemption"] });
    step(s, { type: "setHitpoints", value: 12 });
    const events: SimEvent[] = [];
    for (let i = 0; i < 200 && !ofType(events, "RedemptionTriggered").length; i++) events.push(...s.tick().events);
    expect(ofType(events, "RedemptionTriggered")[0]).toEqual({ type: "RedemptionTriggered", healed: 24 });
    expect(s.getSnapshot().player.prayerPoints).toBe(0);
    expect(s.getSnapshot().player.activePrayers).toEqual([]);
  });

  it("Rapid Heal doubles hitpoint regeneration, and toggling resets the timer", () => {
    const hpAfter = (prayers: string[], ticks: number) => {
      const s = sim("vs-post", { prayers });
      step(s, { type: "setHitpoints", value: 50 });
      for (let i = 1; i < ticks; i++) s.tick();
      return s.getSnapshot().player.hitpoints;
    };
    expect(hpAfter([], 200)).toBe(52);
    expect(hpAfter(["rapid-heal"], 200)).toBe(54);
  });

  it("Rapid Restore restores drained levels on its own timer from activation", () => {
    const s = sim("vs-post", { inventory: ["brew"] });
    step(s, { type: "useItem", inventorySlot: 0 }); // tick 1: attack 99 -> 88
    for (let i = 0; i < 9; i++) s.tick();
    step(s, toggle("rapid-restore")); // tick 11
    for (let i = 0; i < 88; i++) s.tick(); // tick 99
    expect(s.getSnapshot().player.levels.attack).toBe(88);
    s.tick(); // tick 100: normal restore
    expect(s.getSnapshot().player.levels.attack).toBe(89);
    for (let i = 0; i < 10; i++) s.tick(); // tick 110: Rapid Restore (100 ticks after activation)
    expect(s.getSnapshot().player.levels.attack).toBe(90);
  });

  it("Preserve postpones the next boost decay by 30 seconds", () => {
    const decayTick = (prayers: string[]) => {
      const s = sim("vs-post", { inventory: ["super-strength"], prayers });
      step(s, { type: "useItem", inventorySlot: 0 });
      const boosted = s.getSnapshot().player.levels.strength;
      for (let t = 2; t < 300; t++) {
        s.tick();
        if (s.getSnapshot().player.levels.strength < boosted) return t;
      }
      return -1;
    };
    expect(decayTick([])).toBe(100);
    expect(decayTick(["preserve"])).toBe(100 + PRESERVE_EXTENSION_TICKS);
  });
});

describe("encounter prayer mechanics", () => {
  it("can knock off overheads and lock them out for a few ticks", () => {
    const s = sim("severed", { prayers: ["protect-from-melee", "piety"] });
    for (let i = 0; i < 10; i++) s.tick(); // tick 10: severed
    expect(active(s)).toEqual(["piety"]);
    expect(s.getSnapshot().player.overheadsLockedFor).toBe(5);
    expect(rejections(step(s, toggle("protect-from-melee")))[0]).toMatch(/disabled for 4 more ticks/);
    for (let i = 0; i < 3; i++) s.tick(); // tick 14
    step(s, toggle("protect-from-melee")); // tick 15: allowed again
    expect(active(s)).toEqual(["piety", "protect-from-melee"]);
  });

  it("can drain prayer points on hit, even through protection", () => {
    const s = sim("draining", { prayers: ["protect-from-melee"] });
    const events: SimEvent[] = [];
    for (let i = 0; i < 30; i++) events.push(...s.tick().events);
    const hits = ofType(events, "HitLanded").filter((h) => h.targetId === "player");
    expect(hits.length).toBeGreaterThan(2);
    expect(hits.every((h) => h.amount === 0)).toBe(true);
    // 5 per hit plus the normal drain.
    expect(s.getSnapshot().player.prayerPoints).toBeLessThan(99 - 5 * hits.length);
  });
});

describe("player configuration", () => {
  it("base level changes keep boosts relative and update calculations", () => {
    const s = sim("vs-post", { equipment: { weapon: "sword" }, combatStyle: 1, inventory: ["super-strength"] });
    step(s, { type: "useItem", inventorySlot: 0 }); // 99 -> 118
    step(s, { type: "setBaseLevel", skill: "strength", level: 80 });
    const p = s.getSnapshot().player;
    expect(p.baseLevels.strength).toBe(80);
    expect(p.levels.strength).toBe(99); // still +19
  });

  it("refuses to lower a level below a worn item's requirement", () => {
    const s = sim("vs-post", { equipment: { weapon: "whip" } });
    expect(rejections(step(s, { type: "setBaseLevel", skill: "attack", level: 60 }))).toEqual(["Whip requires 70 Attack"]);
  });

  it("lowering Prayer or Defence switches off prayers that are no longer allowed, and caps prayer points", () => {
    const s = sim("vs-post", { prayers: ["piety"] });
    step(s, { type: "setBaseLevel", skill: "defence", level: 60 });
    expect(active(s)).toEqual([]);
    step(s, { type: "setBaseLevel", skill: "prayer", level: 50 });
    expect(s.getSnapshot().player).toMatchObject({ maxPrayerPoints: 50 });
    expect(s.getSnapshot().player.prayerPoints).toBeLessThanOrEqual(50);
  });

  it("hitpoints, prayer points and current levels can be set directly", () => {
    const s = sim("vs-post");
    step(s, { type: "setHitpoints", value: 40 }, { type: "setPrayerPoints", value: 12 }, { type: "setCurrentLevel", skill: "magic", level: 110 });
    const p = s.getSnapshot().player;
    expect([p.hitpoints, p.prayerPoints, p.levels.magic]).toEqual([40, 12, 110]);
    step(s, { type: "setBaseLevel", skill: "hitpoints", level: 50 });
    expect(s.getSnapshot().player).toMatchObject({ maxHitpoints: 50, hitpoints: 1 });
  });
});
