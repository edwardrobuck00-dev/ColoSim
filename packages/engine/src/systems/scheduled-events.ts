import type { World } from "../core/world";
import { runHazards } from "../npc/hazards";
import { startDelayedAttack } from "../npc/turn";
import { runDueEvents } from "./combat-events";

/**
 * Phase 2: hits scheduled on earlier ticks land (ranged and magic), delayed
 * NPC attacks start, then hazards detonate or burn.
 */
export function runScheduledEvents(world: World): void {
  runDueEvents(world, (p) => startDelayedAttack(world, p));
  runHazards(world);
}
