import { createSimulation, type PlayerCommand, type Tile, type TickResult, type WorldSnapshot } from "@sim/engine";
import { STARTER_LOADOUTS, getContentRegistry } from "../src";

const PROTECT = { magic: "protect-from-magic", ranged: "protect-from-missiles", melee: "protect-from-melee" } as const;

/**
 * A scripted player for balance tests. "good": Piety, switches protection
 * prayer on the tick before each hit lands (melee when adjacent and nothing
 * is incoming), steps off telegraphed or burning tiles, eats below 50 HP and
 * drinks restores below 20 prayer. "passive": attacks and eats, nothing else.
 */
export function fightWarden(seed: number, skill: "good" | "passive", loadoutId = "melee-99", onTick?: (r: TickResult, initial: WorldSnapshot) => void) {
  const content = getContentRegistry();
  const setup = STARTER_LOADOUTS.find((l) => l.id === loadoutId)!.setup;
  const sim = createSimulation({ seed, encounterId: "ashen-warden", player: setup }, content);
  const send = (c: PlayerCommand) => sim.queueCommand(c);
  let snap = sim.getSnapshot();
  const initial = snap;
  const phases = new Set<string>();
  let enraged = false;
  let heals = 0;

  send({ type: "attack", targetId: "npc-1" });
  if (skill === "good") send({ type: "togglePrayer", prayerId: "piety" });

  for (let i = 0; i < 1500 && !snap.outcome; i++) {
    const r = sim.tick();
    onTick?.(r, initial);
    snap = r.snapshot;
    for (const e of r.events) if (e.type === "NpcHealed") heals += e.amount;
    const boss = snap.npcs[0];
    if (boss) {
      if (boss.phase.name) phases.add(boss.phase.name);
      enraged ||= boss.enraged;
    }
    const p = snap.player;
    if (p.life !== "alive" || !boss?.alive) continue;
    const slotOf = (pred: (id: string) => boolean) => p.inventory.findIndex((s) => !!s && pred(s.itemId));

    if (p.hitpoints < 50 && p.eatReadyIn === 0) {
      const food = slotOf((id) => ["anglerfish", "shark", "manta-ray", "cooked-karambwan"].includes(id));
      if (food >= 0) send({ type: "useItem", inventorySlot: food });
    }
    if (skill === "passive") continue;
    if (p.prayerPoints < 20 && p.drinkReadyIn === 0) {
      const restore = slotOf((id) => id === "super-restore" || id === "prayer-potion");
      if (restore >= 0) send({ type: "useItem", inventorySlot: restore });
    }

    // Prayer: match the next hit to land; otherwise melee when adjacent.
    const incoming = snap.projectiles.filter((pr) => pr.targetId === "player" && pr.landTick === snap.tick + 1);
    const style = incoming[0]?.style;
    const adjacent = isAdjacent(p.pos, boss.pos, boss.size);
    const want = style === "magic" ? PROTECT.magic : style === "ranged" ? PROTECT.ranged : adjacent ? PROTECT.melee : null;
    if (want && !p.activePrayers.includes(want) && p.prayerPoints > 0) send({ type: "togglePrayer", prayerId: want });
    if (p.prayerPoints > 0 && !p.activePrayers.includes("piety")) send({ type: "togglePrayer", prayerId: "piety" });

    // Movement: leave danger tiles, otherwise keep attacking.
    const danger = dangerTiles(snap);
    if (danger.has(key(p.pos))) {
      const safe = nearestSafe(snap, p.pos, danger);
      if (safe) send({ type: "move", to: safe });
    } else if (p.targetId !== boss.id && p.destination === null) {
      send({ type: "attack", targetId: boss.id });
    }
  }
  return { outcome: snap.outcome, ticks: snap.tick, hp: snap.npcs[0]?.hitpoints ?? 0, phases: [...phases], enraged, heals };
}

const key = (t: Tile) => `${t.x},${t.y}`;

function isAdjacent(p: Tile, o: Tile, size: number): boolean {
  const dx = p.x < o.x ? o.x - p.x : p.x > o.x + size - 1 ? p.x - (o.x + size - 1) : 0;
  const dy = p.y < o.y ? o.y - p.y : p.y > o.y + size - 1 ? p.y - (o.y + size - 1) : 0;
  return Math.max(dx, dy) === 1 && !(dx === 1 && dy === 1);
}

function dangerTiles(s: WorldSnapshot): Set<string> {
  const out = new Set<string>();
  for (const h of s.hazards) for (const t of h.tiles) out.add(key(t));
  return out;
}

function nearestSafe(s: WorldSnapshot, from: Tile, danger: Set<string>): Tile | null {
  const blocked = new Set(s.arena.blocked.map(key));
  const boss = s.npcs[0]!;
  let best: Tile | null = null;
  let bestD = Infinity;
  for (let x = 0; x < s.arena.width; x++) {
    for (let y = 0; y < s.arena.height; y++) {
      const t = { x, y };
      const inBoss = x >= boss.pos.x && x < boss.pos.x + boss.size && y >= boss.pos.y && y < boss.pos.y + boss.size;
      if (danger.has(key(t)) || blocked.has(key(t)) || inBoss) continue;
      const d = Math.max(Math.abs(x - from.x), Math.abs(y - from.y)) + (isAdjacent(t, boss.pos, boss.size) ? 0 : 0.5);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
  }
  return best;
}
