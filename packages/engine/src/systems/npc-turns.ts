import type { World } from "../core/world";
import { isAlive } from "../entities/types";
import { runNpcTurn } from "../npc/turn";

/**
 * Phase 4: each living NPC takes its turn, in spawn order, before the player.
 * Behaviour (phases, patterns, specials, enrage) comes from data; see npc/turn.ts.
 */
export function runNpcTurns(world: World): void {
  for (const npc of world.npcs) if (isAlive(npc)) runNpcTurn(world, npc);
}
