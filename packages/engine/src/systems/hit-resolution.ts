import type { World } from "../core/world";
import { startDelayedAttack } from "../npc/turn";
import { runDueEvents } from "./combat-events";

/** Phase 6: hits made this tick that land immediately (melee). */
export function resolveHits(world: World): void {
  runDueEvents(world, (p) => startDelayedAttack(world, p));
}
