import { describe, expect, it } from "vitest";
import { explainEvent, recordTick, startFightStats, summarize, type FightStats, type SimEvent, type TickResult, type WorldSnapshot } from "@sim/engine";
import { getContentRegistry } from "../src";
import { fightWarden } from "./warden-bot";

const content = getContentRegistry();
const isProtection = (id: string) => !!content.prayers.get(id)?.protects;

/** Plays a Warden fight, folding stats and keeping every tick for independent cross-checks. */
function analysed(seed: number, skill: "good" | "passive") {
  let stats: FightStats | null = null;
  const ticks: TickResult[] = [];
  let first: WorldSnapshot | null = null;
  const result = fightWarden(seed, skill, "melee-99", (r, initial) => {
    if (!stats) {
      stats = startFightStats(initial);
      first = initial;
    }
    recordTick(stats, r, isProtection);
    ticks.push(r);
  });
  return { result, stats: stats!, ticks, first: first! };
}

const all = (ticks: TickResult[]) => ticks.flatMap((t) => t.events.map((e) => ({ tick: t.tick, e })));
const hits = (ticks: TickResult[]) => all(ticks).map((x) => x.e).filter((e): e is Extract<SimEvent, { type: "HitLanded" }> => e.type === "HitLanded");

describe("combat analytics are computed from engine events", () => {
  const won = analysed(2, "good");
  const lost = analysed(3, "passive");

  it("damage totals equal the sum of HitLanded amounts, and match the hitpoints actually lost", () => {
    for (const f of [won, lost]) {
      const dealt = hits(f.ticks).filter((h) => h.sourceId === "player");
      const taken = hits(f.ticks).filter((h) => h.targetId === "player");
      expect(f.stats.dealt.damage).toBe(dealt.reduce((s, h) => s + h.amount, 0));
      expect(f.stats.received.damage).toBe(taken.reduce((s, h) => s + h.amount, 0));
      expect(f.stats.dealt.maxHit).toBe(Math.max(0, ...dealt.map((h) => h.amount)));
      expect(f.stats.dealt.hits).toBe(dealt.length);
      expect(f.stats.dealt.missed).toBe(dealt.filter((h) => !h.detail.accurate).length);
      expect(f.stats.dealt.successful + f.stats.dealt.missed).toBe(f.stats.dealt.hits);
      // Misses always deal 0 (the engine's accuracy roll decides).
      expect(dealt.filter((h) => !h.detail.accurate).every((h) => h.amount === 0)).toBe(true);
      // Hitpoints the boss lost = damage dealt - healing (mechanics) - natural regeneration.
      const npc0 = f.first.npcs[0]!;
      const last = f.ticks[f.ticks.length - 1]!.snapshot.npcs[0]!;
      expect(npc0.hitpoints - last.hitpoints).toBe(f.stats.dealt.damage - f.stats.boss.healed - f.stats.boss.regenerated);
    }
  });

  it("the won fight records three phases, the enrage, the kill and real DPS", () => {
    const s = won.stats;
    expect(won.result.outcome?.result).toBe("win");
    expect(s.boss.phases.map((p) => p.name)).toEqual(["Kindled", "Inferno"]);
    expect(s.boss.enrages).toHaveLength(1);
    expect(s.kills).toHaveLength(1);
    expect(s.deaths).toEqual([]);
    const sum = summarize(s);
    expect(sum.dps).toBeCloseTo(s.dealt.damage / (s.combatTicks * 0.6), 9);
    expect(sum.averageHit).toBeCloseTo(s.dealt.damage / s.dealt.hits, 9);
    expect(sum.accuracy).toBeGreaterThan(0.3);
    expect(s.combatTicks).toBeLessThanOrEqual(sum.durationTicks);
    expect(s.prayer.activations["piety"]).toBeGreaterThanOrEqual(1);
    expect(s.received.blockedByPrayer).toBeGreaterThan(0);
    expect(s.received.preventedByPrayer).toBeGreaterThan(0);
  });

  it("the lost fight records the player's death and the fire that healed the boss", () => {
    const s = lost.stats;
    expect(lost.result.outcome?.result).toBe("loss");
    expect(s.deaths).toHaveLength(1);
    expect(s.deaths[0]!.tick).toBe(all(lost.ticks).find((x) => x.e.type === "EntityDied" && x.e.entityId === "player")!.tick);
    expect(s.received.hazard.damage).toBeGreaterThan(0);
    expect(s.boss.healed).toBe(all(lost.ticks).reduce((n, x) => n + (x.e.type === "NpcHealed" ? x.e.amount : 0), 0));
  });

  it("player hitpoints reconcile: start - taken + food + potions + regeneration + Redemption = end", () => {
    for (const f of [won, lost]) {
      const s = f.stats;
      const end = f.ticks[f.ticks.length - 1]!.snapshot.player.hitpoints;
      expect(f.first.player.hitpoints - s.received.damage + s.food.healed + s.potions.healed + s.playerRegenerated + s.redemptionHealed).toBe(end);
    }
  });

  it("prayer points: start - drained + restored = end; food healing matches the eat events", () => {
    for (const f of [won, lost]) {
      const end = f.ticks[f.ticks.length - 1]!.snapshot.player;
      if (end.life !== "alive") continue;
      expect(f.first.player.prayerPoints - f.stats.prayer.pointsDrained + f.stats.prayer.pointsRestored).toBe(end.prayerPoints);
    }
    const eats = all(won.ticks).map((x) => x.e).filter((e): e is Extract<SimEvent, { type: "ItemConsumed" }> => e.type === "ItemConsumed" && e.kind !== "potion");
    expect(won.stats.food.healed).toBe(eats.reduce((s, e) => s + (e.hitpointsAfter - e.hitpointsBefore), 0));
    expect(summarize(won.stats).foodEaten).toBe(eats.length);
  });

  it("every event can be explained, and hits explain their rolls", () => {
    const names = {
      entity: (id: string) => (id === "player" ? "You" : "The Ashen Warden"),
      attack: (id: string) => content.attacks.get(id)?.name ?? content.items.get(id)?.name ?? id,
      item: (id: string) => content.items.get(id)?.name ?? id,
      prayer: (id: string) => content.prayers.get(id)?.name ?? id,
    };
    for (const { tick, e } of all(won.ticks)) {
      const x = explainEvent(e, tick, names);
      expect(x.title.length, e.type).toBeGreaterThan(0);
    }
    const miss = all(won.ticks).find((x) => x.e.type === "HitLanded" && x.e.sourceId === "player" && !x.e.detail.accurate)!;
    const why = explainEvent(miss.e, miss.tick, names).why.join(" ");
    expect(why).toContain("chance to hit");
    expect(why).toContain("accuracy roll failed");
    const blocked = all(won.ticks).find((x) => x.e.type === "HitLanded" && x.e.blockedByPrayer)!;
    expect(explainEvent(blocked.e, blocked.tick, names).why.join(" ")).toMatch(/Protect from (Magic|Missiles|Melee) was active/);
  });
});
