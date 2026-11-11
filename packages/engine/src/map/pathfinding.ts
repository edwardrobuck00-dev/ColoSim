import type { Tile } from "../defs/common";
import type { Grid } from "./grid";
import { tileKey } from "./tiles";

// Fixed neighbour order keeps paths deterministic: W, E, S, N, SW, SE, NW, NE.
const DIRS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1],
];

interface SearchResult {
  parents: Map<number, Tile | null>;
  found: Tile | null;
}

function bfs(grid: Grid, from: Tile, isGoal: (t: Tile) => boolean): SearchResult {
  const parents = new Map<number, Tile | null>([[tileKey(from), null]]);
  if (isGoal(from)) return { parents, found: from };
  const queue: Tile[] = [from];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head]!;
    for (const [dx, dy] of DIRS) {
      if (!grid.canStep(cur, dx, dy)) continue;
      const next = { x: cur.x + dx, y: cur.y + dy };
      const k = tileKey(next);
      if (parents.has(k)) continue;
      parents.set(k, cur);
      if (isGoal(next)) return { parents, found: next };
      queue.push(next);
    }
  }
  return { parents, found: null };
}

function rebuild(parents: Map<number, Tile | null>, end: Tile): Tile[] {
  const path: Tile[] = [];
  let cur: Tile | null = end;
  while (cur) {
    path.push(cur);
    cur = parents.get(tileKey(cur)) ?? null;
  }
  path.reverse();
  return path.slice(1); // exclude the start tile
}

/**
 * Shortest 8-directional path from `from` to any goal tile. Returns the tiles
 * to walk (excluding `from`), or null if no goal is reachable.
 */
export function findPathToAny(grid: Grid, from: Tile, goals: readonly Tile[]): Tile[] | null {
  const goalKeys = new Set(goals.filter((g) => grid.isWalkable(g)).map(tileKey));
  if (goalKeys.size === 0) return null;
  const { parents, found } = bfs(grid, from, (t) => goalKeys.has(tileKey(t)));
  return found ? rebuild(parents, found) : null;
}

/**
 * Path to `to`. If `to` is blocked or unreachable, walks to the reachable tile
 * closest to it instead (ties broken by shorter path, then search order).
 */
export function findPath(grid: Grid, from: Tile, to: Tile): Tile[] {
  const direct = findPathToAny(grid, from, [to]);
  if (direct) return direct;

  const { parents } = bfs(grid, from, () => false);
  let best: Tile = from;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const [key] of parents) {
    const t = { x: key & 0xffff, y: key >> 16 };
    const d = (t.x - to.x) ** 2 + (t.y - to.y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  return rebuild(parents, best);
}
