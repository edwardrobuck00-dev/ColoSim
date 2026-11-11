import type { Tile } from "../defs/common";

export const tileKey = (t: Tile): number => (t.y << 16) | (t.x & 0xffff);
export const sameTile = (a: Tile, b: Tile): boolean => a.x === b.x && a.y === b.y;

/** Chebyshev distance: the number of 8-directional steps between two tiles. */
export const chebyshev = (a: Tile, b: Tile): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Tiles orthogonally adjacent to a size x size footprint whose south-west corner is `origin`. */
export function tilesAdjacentToFootprint(origin: Tile, size: number): Tile[] {
  const out: Tile[] = [];
  for (let i = 0; i < size; i++) {
    out.push({ x: origin.x + i, y: origin.y - 1 });
    out.push({ x: origin.x + i, y: origin.y + size });
    out.push({ x: origin.x - 1, y: origin.y + i });
    out.push({ x: origin.x + size, y: origin.y + i });
  }
  return out;
}

export function footprintContains(origin: Tile, size: number, t: Tile): boolean {
  return t.x >= origin.x && t.y >= origin.y && t.x < origin.x + size && t.y < origin.y + size;
}
