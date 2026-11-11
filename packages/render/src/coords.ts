import type { Tile } from "@sim/engine";

/**
 * World space: 1 unit = 1 tile. Tile (x, y) maps to world X = x, Z = -y, so
 * north (+y) points away from a camera placed to the south.
 * Entities are centred on their footprint.
 */
export function tileToWorld(t: Tile, size = 1): { x: number; z: number } {
  return { x: t.x + size / 2, z: -(t.y + size / 2) };
}

export function worldToTile(x: number, z: number): Tile {
  return { x: Math.floor(x), y: Math.floor(-z) };
}
