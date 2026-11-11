import type { Tile } from "../defs/common";

/** What line of sight needs to know about the map. */
export interface SightMap {
  isWalkable(t: Tile): boolean;
}

export interface Footprint {
  pos: Tile;
  size: number;
}

/** Per-axis tile gap between two footprints: 0 = overlapping on that axis, 1 = touching. */
function axisGap(aStart: number, aSize: number, bStart: number, bSize: number): number {
  return Math.max(0, bStart - (aStart + aSize - 1), aStart - (bStart + bSize - 1));
}

export function footprintGap(a: Footprint, b: Footprint): { dx: number; dy: number } {
  return { dx: axisGap(a.pos.x, a.size, b.pos.x, b.size), dy: axisGap(a.pos.y, a.size, b.pos.y, b.size) };
}

/** Chebyshev distance between the closest tiles of two footprints (0 when they overlap). */
export function footprintDistance(a: Footprint, b: Footprint): number {
  const { dx, dy } = footprintGap(a, b);
  return Math.max(dx, dy);
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Line of sight between two footprints: a straight line (Bresenham) from the
 * attacker's tile nearest the target to the target's tile nearest the
 * attacker, blocked by any unwalkable tile strictly between them. Pillars and
 * walls therefore block projectiles, which is what makes safespots work.
 * This is a simplification of the game's projectile clipping (see docs,
 * uncertainty U13): the game also distinguishes walls that block movement
 * but not projectiles, which these arenas do not have.
 */
export function hasLineOfSight(map: SightMap, a: Footprint, b: Footprint): boolean {
  const from = { x: clamp(b.pos.x, a.pos.x, a.pos.x + a.size - 1), y: clamp(b.pos.y, a.pos.y, a.pos.y + a.size - 1) };
  const to = { x: clamp(from.x, b.pos.x, b.pos.x + b.size - 1), y: clamp(from.y, b.pos.y, b.pos.y + b.size - 1) };
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - x);
  const dy = -Math.abs(to.y - y);
  const sx = x < to.x ? 1 : -1;
  const sy = y < to.y ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    if (x === to.x && y === to.y) return true;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
    if ((x !== to.x || y !== to.y) && !map.isWalkable({ x, y })) return false;
  }
}

/**
 * Whether `attacker` can hit `target` from where it stands. Melee (range 1)
 * needs orthogonal adjacency; diagonal does not count. Longer ranges use
 * Chebyshev distance and, when a map is given, need line of sight.
 */
export function inAttackRange(attacker: Footprint, target: Footprint, rangeTiles: number, map?: SightMap): boolean {
  const { dx, dy } = footprintGap(attacker, target);
  const d = Math.max(dx, dy);
  if (d === 0) return false;
  if (rangeTiles <= 1) return d === 1 && (dx === 0 || dy === 0);
  if (d > rangeTiles) return false;
  return d <= 1 || !map || hasLineOfSight(map, attacker, target);
}
