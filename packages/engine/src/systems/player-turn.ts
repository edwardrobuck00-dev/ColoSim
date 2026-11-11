import { inAttackRange } from "../combat/range";
import type { World } from "../core/world";
import type { Tile } from "../defs/common";
import { isAlive, type NpcState } from "../entities/types";
import { findPathToAny } from "../map/pathfinding";
import { attackProfile } from "../player/attack-profile";
import { ammoReady, spendAmmo } from "../player/inventory";
import { playerAttackSpec, startAttack } from "./combat-events";

/** Walkable tiles from which the player could hit `npc` with `range`. */
function attackPositions(world: World, npc: NpcState, range: number): Tile[] {
  const out: Tile[] = [];
  for (let x = npc.pos.x - range; x < npc.pos.x + npc.size + range; x++) {
    for (let y = npc.pos.y - range; y < npc.pos.y + npc.size + range; y++) {
      const t = { x, y };
      if (world.grid.isWalkable(t) && inAttackRange({ pos: t, size: 1 }, npc, range, world.grid)) out.push(t);
    }
  }
  return out;
}

/**
 * Auto retaliate: a player who is idle (no target, not walking) when an NPC's
 * hit lands targets that NPC. Walking somewhere is never interrupted.
 */
function autoRetaliate(world: World): void {
  const p = world.player;
  const attacker = p.lastAttackerId;
  p.lastAttackerId = null;
  if (!p.autoRetaliate || !attacker || p.targetId || p.path.length > 0) return;
  if (!world.npcs.some((n) => n.id === attacker && isAlive(n))) return;
  p.targetId = attacker;
  world.events.push({ type: "TargetChanged", entityId: p.id, targetId: attacker });
}

/**
 * Phase 5: player movement and attacks. Walking takes 1 step per tick,
 * running 2. With a target, the player paths into range of the current
 * combat style, stops as soon as they are in range, and attacks whenever the
 * cooldown has passed. An armed special attack is used if there is energy.
 */
export function runPlayerTurn(world: World): void {
  const p = world.player;
  if (!isAlive(p)) return;
  autoRetaliate(world);

  const target = p.targetId ? world.npcs.find((n) => n.id === p.targetId && isAlive(n)) : undefined;
  if (p.targetId && !target) {
    p.targetId = null;
    p.path = [];
    world.events.push({ type: "TargetChanged", entityId: p.id, targetId: null });
  }
  const range = attackProfile(p, world.content).rangeTiles;
  const inRange = () => !!target && inAttackRange({ pos: p.pos, size: 1 }, target, range, world.grid);

  if (target) {
    p.path = inRange() ? [] : (findPathToAny(world.grid, p.pos, attackPositions(world, target, range)) ?? []);
  }

  if (p.path.length > 0) {
    const maxSteps = p.running && p.path.length >= 2 ? 2 : 1;
    const from = { ...p.pos };
    let steps = 0;
    while (steps < maxSteps && p.path.length > 0 && !inRange()) {
      p.pos = p.path.shift()!;
      steps++;
    }
    if (steps > 0) world.events.push({ type: "EntityMoved", entityId: p.id, from, to: { ...p.pos }, running: steps === 2 });
  }

  if (target && inRange() && world.tick >= p.nextAttackTick) {
    const prof = attackProfile(p, world.content);
    if (prof.cls === "ranged") {
      const ammo = ammoReady(p, world.content);
      if (!ammo.ok) {
        // Out of (or wrong) ammunition: stop attacking.
        world.events.push({ type: "CommandRejected", command: "attack", reason: ammo.reason });
        p.targetId = null;
        world.events.push({ type: "TargetChanged", entityId: p.id, targetId: null });
        return;
      }
    }
    let useSpecial = false;
    const special = p.weapon.special;
    if (p.specialArmed && special) {
      p.specialArmed = false;
      if (p.specialEnergy >= special.energy) {
        p.specialEnergy -= special.energy;
        useSpecial = true;
        world.events.push({ type: "SpecialUsed", name: special.name, energyLeft: p.specialEnergy });
      } else {
        world.events.push({ type: "CommandRejected", command: "toggleSpecial", reason: "not enough special attack energy" });
      }
      world.events.push({ type: "SpecialToggled", armed: false });
    }
    startAttack(world, p, target, playerAttackSpec(world, p, target, useSpecial));
    if (prof.cls === "ranged" && p.equipment.ammo) {
      const ammoId = p.equipment.ammo.itemId;
      if (spendAmmo(p, world.content, world.rng.get("misc"))) {
        world.events.push({ type: "AmmoUsed", itemId: ammoId, remaining: p.equipment.ammo?.quantity ?? 0 });
      }
    }
  }
}
