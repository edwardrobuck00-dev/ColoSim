import type { PlayerCommand, Tile } from "@sim/engine";

export interface ClickTarget {
  entityId: string | null;
  tile: Tile | null;
}

/** Left click: an NPC under the cursor is attacked; otherwise walk to the tile. */
export function commandForClick(target: ClickTarget): PlayerCommand | null {
  if (target.entityId) return { type: "attack", targetId: target.entityId };
  if (target.tile) return { type: "move", to: target.tile };
  return null;
}
