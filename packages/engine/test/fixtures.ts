import { z } from "zod";
import { defineMechanic, type MechanicDefinition, type SimEvent } from "../src";
import { buildTestContent, testArena } from "./harness";

/** Content for combat tests: weapons, NPCs with different behaviours, and encounters for each. */
export function combatContent(extraMechanics: MechanicDefinition[] = [], encounterMechanics: Array<{ id: string; params?: Record<string, unknown> }> = []) {
  const npcs = ["dummy", "bruiser", "spitter", "phoenix", "glass"];
  return buildTestContent({
    mechanics: extraMechanics,
    items: [
      { id: "sword4", name: "Sword", slot: "weapon", bonuses: { attack: { stab: 0, slash: 200, crush: 0, ranged: 0, magic: 0 }, meleeStrength: 100 },
        weapon: { category: "slash-sword", attackSpeedTicks: 4, rangeTiles: 1, animationCue: "attack.slash" } },
      { id: "maul6", name: "Maul", slot: "weapon", bonuses: { attack: { stab: 0, slash: 0, crush: 200, ranged: 0, magic: 0 }, meleeStrength: 100 },
        weapon: { category: "blunt", attackSpeedTicks: 6, rangeTiles: 1 } },
      { id: "bow", name: "Bow", slot: "weapon", bonuses: { attack: { stab: 0, slash: 0, crush: 0, ranged: 200, magic: 0 }, rangedStrength: 80 },
        weapon: { category: "bow", attackSpeedTicks: 3, rangeTiles: 9, projectile: { visualId: "projectile.arrow" } } },
    ],
    attacks: [
      { id: "punch", style: "crush", maxHit: 8, speedTicks: 4, rangeTiles: 1, accuracyBonus: 300 },
      { id: "spit", style: "magic", maxHit: 6, speedTicks: 5, rangeTiles: 10, accuracyBonus: 300, projectile: { visualId: "projectile.spit" } },
    ],
    npcs: [
      { id: "dummy", name: "Dummy", stats: { hitpoints: 1000, attack: 1, strength: 1, defence: 1, ranged: 1, magic: 1, prayer: 1 } },
      { id: "bruiser", name: "Bruiser", size: 2, attacks: ["punch"], ai: { movement: "chase" },
        stats: { hitpoints: 1000, attack: 99, strength: 1, defence: 1, ranged: 1, magic: 1, prayer: 1 } },
      { id: "spitter", name: "Spitter", attacks: ["spit"], stats: { hitpoints: 1000, attack: 1, strength: 1, defence: 1, ranged: 1, magic: 99, prayer: 1 } },
      { id: "phoenix", name: "Phoenix", deathTicks: 2, respawnTicks: 4,
        stats: { hitpoints: 5, attack: 1, strength: 1, defence: 1, ranged: 1, magic: 1, prayer: 1 } },
      { id: "glass", name: "Glass", stats: { hitpoints: 3, attack: 1, strength: 1, defence: 1, ranged: 1, magic: 1, prayer: 1 } },
    ],
    encounters: [
      ...npcs.map((npcId) => ({
        id: `vs-${npcId}`, name: npcId, description: "", arenaId: testArena.id, playerSpawn: "player",
        npcs: [{ npcId, spawn: "boss" }], winCondition: "none" as const, mechanics: encounterMechanics,
      })),
      { id: "practice", name: "Practice", description: "", arenaId: testArena.id, playerSpawn: "player",
        npcs: [{ npcId: "bruiser", spawn: "boss" }], winCondition: "none" as const, playerDeath: "respawn" as const, playerRespawnTicks: 4 },
      { id: "duel", name: "Duel", description: "", arenaId: testArena.id, playerSpawn: "player",
        npcs: [{ npcId: "glass", spawn: "boss" }] },
    ],
  });
}

export const STATS_99 = { hitpoints: 99, attack: 99, strength: 99, defence: 99, ranged: 99, magic: 99, prayer: 99 };
export const STATS_10 = { hitpoints: 10, attack: 1, strength: 1, defence: 1, ranged: 1, magic: 1, prayer: 1 };

export const ofType = <T extends SimEvent["type"]>(events: readonly SimEvent[], type: T) =>
  events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);

/** A mechanic that records hook calls into a shared log, for ordering tests. */
export function recorderMechanic(log: string[]) {
  return defineMechanic({
    id: "recorder",
    description: "test",
    params: z.object({}),
    create: () => ({
      hooks: {
        onAttackStart: (ctx, a) => void log.push(`${ctx.tick}:attack:${a.attackerId}->${a.targetId}@${a.landTick}`),
        onHitLanded: (ctx, h) => void log.push(`${ctx.tick}:hit:${h.sourceId}->${h.targetId}:${h.amount}`),
        onEntityDeath: (ctx, d) => void log.push(`${ctx.tick}:death:${d.entityId}:${d.killerId}`),
        onEntityRespawn: (ctx, id) => void log.push(`${ctx.tick}:respawn:${id}`),
      },
    }),
  });
}

/** A mechanic that adds a fixed adjustment to one pipeline. */
export function pipelineMechanic(id: string, pipeline: string, apply: (v: number) => number) {
  return defineMechanic({
    id,
    description: "test",
    params: z.object({}),
    create: () => ({ pipelines: [{ name: pipeline, apply }] }),
  });
}
