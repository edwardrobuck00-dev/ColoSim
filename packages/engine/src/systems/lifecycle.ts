import { newBossState } from "../entities/factory";
import type { World } from "../core/world";
import { engineContext, runHook } from "../mechanics/runtime";
import { MAX_RUN_ENERGY, PLAYER_DEATH_TICKS, isAlive, type EntityState } from "../entities/types";
import { PIPELINES } from "../mechanics/pipelines";

/** Default ticks between natural hitpoint regeneration (1 HP each). */
export const HITPOINT_REGEN_INTERVAL = 100;

/** Starts the death sequence: alive -> dying. Safe to call more than once. */
export function killEntity(world: World, e: EntityState, killerId: string | null): void {
  if (!isAlive(e)) return;
  const deathTicks = e.kind === "npc" ? world.content.npcs.get(e.defId)!.deathTicks : PLAYER_DEATH_TICKS;
  e.hitpoints = 0;
  e.life = "dying";
  e.diedAtTick = world.tick;
  e.despawnTick = world.tick + deathTicks;
  e.targetId = null;
  if (e.kind === "player") {
    e.path = [];
    for (const id of e.activePrayers) world.events.push({ type: "PrayerToggled", prayerId: id, active: false, cause: "death" });
    e.activePrayers = [];
    e.specialArmed = false;
  }
  world.events.push({ type: "EntityDied", entityId: e.id, killerId });
  runHook(world, "onEntityDeath", { entityId: e.id, killerId });
}

/** Ticks after despawning before `e` respawns, or null if it never does. */
function respawnDelay(world: World, e: EntityState): number | null {
  if (e.kind === "npc") return world.content.npcs.get(e.defId)!.respawnTicks ?? null;
  return world.encounter.playerDeath === "respawn" ? world.encounter.playerRespawnTicks : null;
}

function respawn(world: World, e: EntityState): void {
  e.life = "alive";
  e.hitpoints = e.maxHitpoints;
  e.pos = { ...e.spawnPos };
  e.diedAtTick = null;
  e.despawnTick = null;
  e.respawnTick = null;
  e.targetId = null;
  e.nextAttackTick = world.tick + 1;
  if (e.kind === "npc") {
    e.rotationIndex = 0;
    e.boss = newBossState();
    e.levels = { ...world.content.npcs.get(e.defId)!.stats };
  } else {
    e.path = [];
    e.prayerPoints = e.maxPrayerPoints;
    e.levels = { attack: e.stats.attack, strength: e.stats.strength, defence: e.stats.defence, ranged: e.stats.ranged, magic: e.stats.magic };
    e.overheadsLockedUntil = 0;
    e.pendingBoostDecayTick = null;
    e.runEnergy = MAX_RUN_ENERGY;
  }
  const size = e.kind === "npc" ? e.size : 1;
  world.events.push({ type: "EntitySpawned", entityId: e.id, kind: e.kind, defId: e.kind === "npc" ? e.defId : null, pos: { ...e.pos }, size, respawn: true });
  runHook(world, "onEntityRespawn", e.id);
}

/**
 * Phase 7: the life cycle of every entity.
 * - alive with 0 hitpoints (e.g. from a mechanic) -> dying
 * - dying, despawn tick reached -> dead (EntityDespawned)
 * - dead, respawn tick reached -> alive again at its spawn point
 */
export function runLifecycle(world: World): void {
  for (const e of [world.player, ...world.npcs] as EntityState[]) {
    if (isAlive(e) && e.hitpoints <= 0) killEntity(world, e, null);

    if (e.life === "dying" && e.despawnTick !== null && world.tick >= e.despawnTick) {
      // A player in "end" mode stays down: the encounter is already over.
      if (e.kind === "player" && world.encounter.playerDeath === "end") continue;
      e.life = "dead";
      world.events.push({ type: "EntityDespawned", entityId: e.id });
      const delay = respawnDelay(world, e);
      e.respawnTick = delay === null ? null : world.tick + delay;
    } else if (e.life === "dead" && e.respawnTick !== null && world.tick >= e.respawnTick) {
      respawn(world, e);
    }
  }
}

/** NPC natural regeneration: 1 hitpoint every interval (the player has its own timer, see upkeep). */
export function regenerateNpcHitpoints(world: World): void {
  const interval = Math.max(1, world.pipelines.run(PIPELINES.hitpointRegenInterval, HITPOINT_REGEN_INTERVAL, engineContext(world)));
  if (world.tick % interval !== 0) return;
  for (const n of world.npcs) {
    if (isAlive(n) && n.hitpoints < n.maxHitpoints) {
      n.hitpoints += 1;
      world.events.push({ type: "Regenerated", entityId: n.id, amount: 1, hitpoints: n.hitpoints });
    }
  }
}
