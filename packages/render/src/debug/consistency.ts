import type { WorldSnapshot } from "@sim/engine";

/** What the renderer is currently showing, for checking against the simulation. */
export interface RenderState {
  tick: number;
  entities: Array<{
    id: string;
    tile: { x: number; y: number };
    dead: boolean;
    healthRatio: number;
    overhead: string | null;
    enraged: boolean;
    immune: boolean;
  }>;
  projectiles: string[];
  hazards: Array<{ id: string; state: "warning" | "burning" }>;
}

/**
 * Differences between what is drawn and the simulation snapshot. An empty
 * list means the scene shows exactly the simulation's state (positions,
 * health, death, overhead prayer, boss status, projectiles in flight,
 * telegraphed and burning tiles). Views of entities that have despawned may
 * linger while their death animation finishes; that is allowed.
 */
export function compareRenderToSnapshot(r: RenderState, s: WorldSnapshot): string[] {
  const out: string[] = [];
  if (r.tick !== s.tick) out.push(`tick: drawn ${r.tick}, simulation ${s.tick}`);
  const view = new Map(r.entities.map((e) => [e.id, e]));
  const ratio = (hp: number, max: number) => (max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0);
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

  const p = s.player;
  const pv = view.get(p.id);
  if (!pv) out.push("player: not drawn");
  else {
    if (pv.tile.x !== p.pos.x || pv.tile.y !== p.pos.y) out.push(`player: drawn at ${pv.tile.x},${pv.tile.y}, simulation ${p.pos.x},${p.pos.y}`);
    if (pv.dead !== (p.life !== "alive")) out.push(`player: drawn ${pv.dead ? "dead" : "alive"}, simulation ${p.life}`);
    if (p.life === "alive" && !near(pv.healthRatio, ratio(p.hitpoints, p.maxHitpoints))) out.push(`player: health bar ${pv.healthRatio}, simulation ${p.hitpoints}/${p.maxHitpoints}`);
    if (p.life === "alive" && pv.overhead !== (p.overhead ?? null)) out.push(`player: overhead drawn ${pv.overhead}, simulation ${p.overhead}`);
  }

  for (const n of s.npcs) {
    const v = view.get(n.id);
    if (n.life === "dead") continue; // despawned; a view may still be finishing its death animation
    if (!v) {
      out.push(`${n.id}: not drawn`);
      continue;
    }
    if (v.tile.x !== n.pos.x || v.tile.y !== n.pos.y) out.push(`${n.id}: drawn at ${v.tile.x},${v.tile.y}, simulation ${n.pos.x},${n.pos.y}`);
    if (v.dead !== (n.life !== "alive")) out.push(`${n.id}: drawn ${v.dead ? "dead" : "alive"}, simulation ${n.life}`);
    if (n.life === "alive") {
      if (!near(v.healthRatio, ratio(n.hitpoints, n.maxHitpoints))) out.push(`${n.id}: health bar ${v.healthRatio}, simulation ${n.hitpoints}/${n.maxHitpoints}`);
      if (v.enraged !== n.enraged) out.push(`${n.id}: enraged drawn ${v.enraged}, simulation ${n.enraged}`);
      if (v.immune !== n.invulnerable) out.push(`${n.id}: immune drawn ${v.immune}, simulation ${n.invulnerable}`);
    }
  }
  for (const e of r.entities) {
    if (e.id !== p.id && !s.npcs.some((n) => n.id === e.id) && !e.dead) out.push(`${e.id}: drawn but not in the simulation`);
  }

  const simProj = new Set(s.projectiles.map((x) => x.id));
  for (const id of simProj) if (!r.projectiles.includes(id)) out.push(`projectile ${id}: in flight but not drawn`);
  for (const id of r.projectiles) if (!simProj.has(id)) out.push(`projectile ${id}: drawn but already landed`);

  const simHaz = new Map(s.hazards.map((h) => [h.id, h.state]));
  for (const [id, state] of simHaz) {
    const drawn = r.hazards.find((h) => h.id === id);
    if (!drawn) out.push(`hazard ${id}: not drawn`);
    else if (drawn.state !== state) out.push(`hazard ${id}: drawn ${drawn.state}, simulation ${state}`);
  }
  for (const h of r.hazards) if (!simHaz.has(h.id)) out.push(`hazard ${h.id}: drawn but gone`);
  return out;
}
