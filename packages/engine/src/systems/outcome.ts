import type { World } from "../core/world";
import { mechanicContext } from "../mechanics/runtime";
import { isAlive } from "../entities/types";

/** Phase 9: win and loss checks, built-in first, then mechanic-defined. */
export function checkOutcome(world: World): void {
  if (world.outcome) return;
  const end = (result: "win" | "loss", reason: string) => {
    world.outcome = { result, reason, tick: world.tick };
    world.events.push({ type: "EncounterEnded", outcome: world.outcome });
  };

  if (!isAlive(world.player) && world.encounter.playerDeath === "end") return end("loss", "player died");

  for (const m of world.mechanics) {
    const reason = m.instance.hooks?.checkLoss?.(mechanicContext(world, m.id));
    if (reason) return end("loss", reason);
  }

  // Won once every NPC that will not respawn is down (dying counts: the kill happened this tick).
  const permanent = world.npcs.filter((n) => world.content.npcs.get(n.defId)!.respawnTicks === undefined);
  if (world.encounter.winCondition === "all-npcs-dead" && permanent.length > 0 && permanent.every((n) => !isAlive(n))) {
    return end("win", "all enemies defeated");
  }

  for (const m of world.mechanics) {
    const reason = m.instance.hooks?.checkWin?.(mechanicContext(world, m.id));
    if (reason) return end("win", reason);
  }
}
