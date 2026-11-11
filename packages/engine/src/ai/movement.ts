import type { Tile } from "../defs/common";
import type { Grid } from "../map/grid";
import { footprintContains } from "../map/tiles";

/** Whether a size x size footprint can stand with its south-west corner at `origin`. */
export function footprintWalkable(grid: Grid, origin: Tile, size: number): boolean {
  for (let dx = 0; dx < size; dx++) {
    for (let dy = 0; dy < size; dy++) if (!grid.isWalkable({ x: origin.x + dx, y: origin.y + dy })) return false;
  }
  return true;
}

function canStepSized(grid: Grid, from: Tile, size: number, dx: number, dy: number, avoid: Tile): boolean {
  const to = { x: from.x + dx, y: from.y + dy };
  if (!footprintWalkable(grid, to, size) || footprintContains(to, size, avoid)) return false;
  if (dx !== 0 && dy !== 0) {
    return canStepSized(grid, from, size, dx, 0, avoid) && canStepSized(grid, from, size, 0, dy, avoid);
  }
  return true;
}

/**
 * One "direct" chase step toward a target tile, the simple way NPCs move in
 * tick-based games: try diagonal, then horizontal, then vertical. NPCs can be
 * stuck behind obstacles; that is intended and is how players "safespot".
 * Never steps onto `avoid` (the target's tile). Returns the new origin or null.
 */
export function chaseStep(grid: Grid, origin: Tile, size: number, target: Tile): Tile | null {
  const dx = target.x < origin.x ? -1 : target.x > origin.x + size - 1 ? 1 : 0;
  const dy = target.y < origin.y ? -1 : target.y > origin.y + size - 1 ? 1 : 0;
  const options: Array<[number, number]> = [[dx, dy], [dx, 0], [0, dy]];
  for (const [sx, sy] of options) {
    if ((sx !== 0 || sy !== 0) && canStepSized(grid, origin, size, sx, sy, target)) {
      return { x: origin.x + sx, y: origin.y + sy };
    }
  }
  return null;
}

/**
 * When the target stands under an NPC, the NPC steps out so it can attack
 * again (no attack can reach a target inside the attacker's own footprint).
 * Each tick it takes the cardinal step that uncovers the target soonest,
 * so it never turns back; `pick` breaks ties (the "ai" RNG stream).
 */
export function stepOutStep(grid: Grid, origin: Tile, size: number, target: Tile, pick: (n: number) => number): Tile | null {
  if (!footprintContains(origin, size, target)) return null;
  const options = [
    { d: { x: 1, y: 0 }, steps: target.x - origin.x + 1 },
    { d: { x: -1, y: 0 }, steps: origin.x + size - target.x },
    { d: { x: 0, y: 1 }, steps: target.y - origin.y + 1 },
    { d: { x: 0, y: -1 }, steps: origin.y + size - target.y },
  ].filter((o) => footprintWalkable(grid, { x: origin.x + o.d.x, y: origin.y + o.d.y }, size));
  if (options.length === 0) return null;
  const best = Math.min(...options.map((o) => o.steps));
  const ties = options.filter((o) => o.steps === best);
  const o = ties.length === 1 ? ties[0]! : ties[pick(ties.length)]!;
  return { x: origin.x + o.d.x, y: origin.y + o.d.y };
}
