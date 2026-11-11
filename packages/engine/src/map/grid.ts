import type { ArenaDef } from "../defs/arena";
import type { Tile } from "../defs/common";

/** Walkability grid for an arena. (0,0) is the south-west corner; +y is north. */
export class Grid {
  readonly width: number;
  readonly height: number;
  private readonly blocked: Uint8Array;

  constructor(width: number, height: number, blocked: readonly Tile[] = []) {
    this.width = width;
    this.height = height;
    this.blocked = new Uint8Array(width * height);
    for (const t of blocked) if (this.inBounds(t)) this.blocked[t.y * width + t.x] = 1;
  }

  static fromArena(arena: ArenaDef): Grid {
    return new Grid(arena.width, arena.height, arena.blocked);
  }

  inBounds(t: Tile): boolean {
    return t.x >= 0 && t.y >= 0 && t.x < this.width && t.y < this.height;
  }

  isWalkable(t: Tile): boolean {
    return this.inBounds(t) && this.blocked[t.y * this.width + t.x] === 0;
  }

  /**
   * Whether a single step of (dx, dy) from `from` is allowed. Diagonal steps
   * need both adjacent orthogonal tiles to be walkable (no corner cutting).
   */
  canStep(from: Tile, dx: number, dy: number): boolean {
    const to = { x: from.x + dx, y: from.y + dy };
    if (!this.isWalkable(to)) return false;
    if (dx !== 0 && dy !== 0) {
      return this.isWalkable({ x: from.x + dx, y: from.y }) && this.isWalkable({ x: from.x, y: from.y + dy });
    }
    return true;
  }
}
