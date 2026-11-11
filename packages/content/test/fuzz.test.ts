import { createSimulation, recordTick, startFightStats, summarize, verifyReplay, type PlayerCommand, type SimEvent, type WorldSnapshot } from "@sim/engine";
import { describe, expect, it } from "vitest";
import { STARTER_LOADOUTS, getContentRegistry } from "../src";

/**
 * Invariant fuzzing: random player inputs against every encounter and preset,
 * checking rules that must hold on every tick, then that the fight replays to
 * the same state hash. Seeds are fixed, so failures are reproducible.
 */
const content = getContentRegistry();
const SLOTS = ["head", "cape", "neck", "ammo", "weapon", "body", "shield", "legs", "hands", "feet", "ring"] as const;
const PRAYER_IDS = [...content.prayers.keys()];

/** A tiny deterministic generator for choosing inputs (separate from the engine's RNG). */
function lcg(seed: number) {
  let s = seed >>> 0;
  return (n: number) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s % n;
  };
}

function randomCommand(r: (n: number) => number, snap: WorldSnapshot): PlayerCommand | null {
  const npc = snap.npcs.find((n) => n.alive);
  switch (r(14)) {
    case 0: case 1: case 2: return npc ? { type: "attack", targetId: npc.id } : null;
    case 3: return { type: "move", to: { x: r(snap.arena.width + 2) - 1, y: r(snap.arena.height + 2) - 1 } };
    case 4: return { type: "togglePrayer", prayerId: PRAYER_IDS[r(PRAYER_IDS.length)]! };
    case 5: return { type: "useItem", inventorySlot: r(28) };
    case 6: return { type: "equipItem", inventorySlot: r(28) };
    case 7: return { type: "unequipItem", slot: SLOTS[r(SLOTS.length)]! };
    case 8: return { type: "toggleSpecial" };
    case 9: return { type: "setCombatStyle", index: r(6) };
    case 10: return { type: "setRun", running: r(2) === 0 };
    case 11: return { type: "moveItem", from: r(28), to: r(28) };
    case 12: return { type: "stop" };
    default: return null;
  }
}

function checkInvariants(s: WorldSnapshot, prev: WorldSnapshot, events: SimEvent[], where: string): string[] {
  const bad: string[] = [];
  const p = s.player;
  const blocked = new Set(s.arena.blocked.map((t) => `${t.x},${t.y}`));
  const walkable = (x: number, y: number) => x >= 0 && y >= 0 && x < s.arena.width && y < s.arena.height && !blocked.has(`${x},${y}`);
  if (p.hitpoints < 0 || p.hitpoints > p.maxHitpoints + 40) bad.push(`player hp ${p.hitpoints}/${p.maxHitpoints}`);
  if (p.prayerPoints < 0 || p.prayerPoints > p.maxPrayerPoints) bad.push(`prayer ${p.prayerPoints}/${p.maxPrayerPoints}`);
  if (p.specialEnergy < 0 || p.specialEnergy > 100) bad.push(`spec ${p.specialEnergy}`);
  if (p.runEnergy < 0 || p.runEnergy > 10000) bad.push(`run ${p.runEnergy}`);
  if (!walkable(p.pos.x, p.pos.y)) bad.push(`player on unwalkable ${JSON.stringify(p.pos)}`);
  if (p.prayerPoints === 0 && p.activePrayers.length > 0 && p.life === "alive") bad.push(`prayers on at 0 points: ${p.activePrayers}`);
  for (const [k, v] of Object.entries(p.levels)) if (v < 0) bad.push(`level ${k} ${v}`);
  const step = Math.max(Math.abs(p.pos.x - prev.player.pos.x), Math.abs(p.pos.y - prev.player.pos.y));
  if (step > 2 && !events.some((e) => e.type === "EntityMoved" && e.entityId === p.id && e.teleport) && !events.some((e) => e.type === "EntitySpawned")) bad.push(`player moved ${step} tiles`);
  const items = [...p.inventory.filter(Boolean), ...Object.values(p.equipment)];
  for (const it of items) if (!it || it.quantity <= 0) bad.push(`empty stack ${JSON.stringify(it)}`);
  if (p.inventory.length > 28) bad.push(`inventory ${p.inventory.length}`);
  const eq = p.equipment;
  if (eq.shield && eq.weapon && content.items.get(eq.weapon.itemId)?.weapon?.twoHanded) bad.push("shield with two-handed weapon");
  for (const [slot, e] of Object.entries(eq)) if (content.items.get(e.itemId)?.slot !== slot) bad.push(`${e.itemId} in ${slot}`);
  for (const n of s.npcs) {
    if (n.hitpoints < 0 || n.hitpoints > n.maxHitpoints) bad.push(`npc hp ${n.hitpoints}/${n.maxHitpoints}`);
    for (let dx = 0; dx < n.size; dx++) for (let dy = 0; dy < n.size; dy++) if (!walkable(n.pos.x + dx, n.pos.y + dy)) bad.push(`npc on unwalkable ${JSON.stringify(n.pos)}`);
    for (const [k, v] of Object.entries(n.levels)) if (v < 0) bad.push(`npc level ${k} ${v}`);
  }
  for (const e of events) {
    if (e.type === "HitLanded") {
      if (e.amount < 0) bad.push(`negative hit`);
      if (e.sourceId === "player" && e.amount > 200) bad.push(`player hit over cap`);
      if (e.detail.rolled > e.maxHit && e.style !== "typeless") bad.push(`rolled ${e.detail.rolled} over max ${e.maxHit}`);
    }
    if (e.type === "ProjectileLaunched" && e.landTick <= e.launchTick) bad.push("projectile lands before launch");
  }
  return bad.map((b) => `${where} tick ${s.tick}: ${b}`);
}
describe("invariant fuzzing (random inputs, every encounter and preset)", () => {
  const cases = [...content.encounters.keys()].flatMap((enc) => STARTER_LOADOUTS.map((l) => [enc, l.id] as const));
  it.each(cases)("%s with %s", (encounterId, loadoutId) => {
    const preset = STARTER_LOADOUTS.find((l) => l.id === loadoutId)!;
    const problems: string[] = [];
    let fought = 0;
    for (const seed of [1, 2]) {
      const r = lcg(seed * 7919 + encounterId.length);
      const sim = createSimulation({ seed, encounterId, player: preset.setup }, content);
      let prev = sim.getSnapshot();
      let stats = startFightStats(prev);
      sim.queueCommand({ type: "attack", targetId: prev.npcs[0]!.id });
      const raw = { dealt: 0, received: 0, playerHits: 0, misses: 0, eaten: 0, specs: 0, deaths: 0 };
      for (let t = 0; t < 600; t++) {
        if (r(3) === 0) {
          const c = randomCommand(r, prev);
          if (c) sim.queueCommand(c);
        }
        const res = sim.tick();
        problems.push(...checkInvariants(res.snapshot, prev, res.events, `${encounterId}/${loadoutId}/seed ${seed}`));
        stats = recordTick(stats, res, (id) => !!content.prayers.get(id)?.protects);
        for (const e of res.events) {
          if (e.type === "HitLanded" && e.sourceId === "player") { raw.dealt += e.amount; raw.playerHits++; if (!e.detail.accurate) raw.misses++; }
          if (e.type === "HitLanded" && e.targetId === "player") raw.received += e.amount;
          if (e.type === "SpecialUsed") raw.specs++;
          if (e.type === "EntityDied" && e.entityId === "player") raw.deaths++;
          if (e.type === "ItemConsumed" && content.items.get(e.itemId)?.consumable?.kind !== "potion") raw.eaten++;
        }
        prev = res.snapshot;
        if (res.outcome) break;
      }
      const where = `${encounterId}/${loadoutId}/seed ${seed}`;
      if (stats.dealt.damage !== raw.dealt) problems.push(`${where}: analytics dealt ${stats.dealt.damage} != events ${raw.dealt}`);
      if (stats.received.damage !== raw.received) problems.push(`${where}: analytics received ${stats.received.damage} != events ${raw.received}`);
      if (stats.dealt.hits !== raw.playerHits) problems.push(`${where}: analytics hits ${stats.dealt.hits} != events ${raw.playerHits}`);
      if (stats.dealt.missed !== raw.misses) problems.push(`${where}: analytics misses ${stats.dealt.missed} != events ${raw.misses}`);
      if (stats.deaths.length !== raw.deaths) problems.push(`${where}: analytics deaths ${stats.deaths.length} != events ${raw.deaths}`);
      fought += raw.playerHits;
      const sum = summarize(stats);
      if (!Number.isFinite(sum.dps) || sum.dps < 0) problems.push(`${where}: dps ${sum.dps}`);
      const v = verifyReplay(sim.toReplay(), content);
      if (!v.ok) problems.push(`replay mismatch: ${JSON.stringify(v).slice(0, 300)}`);
    }
    expect(problems.slice(0, 15)).toEqual([]);
    expect(fought).toBeGreaterThan(5); // the random inputs really did fight
  });
});
