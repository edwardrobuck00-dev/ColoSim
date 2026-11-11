import type { Hazard, World } from "../core/world";
import { isAlive } from "../entities/types";
import { dealDamage } from "../systems/combat-events";

/**
 * Tiles marked by special attacks. On its detonation tick a hazard hits a
 * player standing on one of its tiles (damage rolled on the "hazards" RNG
 * stream, never reduced by prayers). Afterwards it may keep burning: a player
 * on a burning tile takes the linger damage once per tick (overlapping fires
 * do not stack). Expired hazards are removed.
 */
export function runHazards(world: World): void {
  if (world.hazards.length === 0) return;
  const p = world.player;
  const on = (tiles: Array<{ x: number; y: number }>) => tiles.some((t) => t.x === p.pos.x && t.y === p.pos.y);
  const rng = world.rng.get("hazards");
  let burned = false;
  for (const h of world.hazards) {
    if (!isAlive(p)) break;
    if (world.tick === h.detonateTick) {
      if (on(h.tiles)) {
        const damage = rng.range(h.damageMin, h.damageMax);
        dealDamage(world, p, {
          sourceId: h.sourceId, attackId: h.id, damage, maxHit: h.damageMax, style: "typeless",
          detail: hazardDetail(h, "detonation", damage, `you were on a marked tile when ${h.name} detonated (${h.damageMin} to ${h.damageMax} damage)`),
        });
      }
    } else if (world.tick > h.detonateTick && world.tick <= h.lingerUntil && !burned && h.lingerDamage > 0 && on(h.tiles)) {
      burned = true;
      dealDamage(world, p, {
        sourceId: h.sourceId, attackId: h.id, damage: h.lingerDamage, maxHit: h.lingerDamage, style: "typeless",
        detail: hazardDetail(h, "burning", h.lingerDamage, `you stood on ground still burning from ${h.name} (${h.lingerDamage} per tick)`),
      });
    }
  }
  world.hazards = world.hazards.filter((h) => world.tick < Math.max(h.detonateTick, h.lingerUntil));
}

function hazardDetail(h: Hazard, stage: "detonation" | "burning", damage: number, reason: string) {
  return {
    attackId: h.id, startedTick: h.detonateTick, special: true, reason, accurate: true, rolled: damage,
    hazard: { name: h.name, stage },
  };
}
