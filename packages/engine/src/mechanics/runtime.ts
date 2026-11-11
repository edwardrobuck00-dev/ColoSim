import type { World } from "../core/world";
import { deactivatePrayers, drainPrayerPoints } from "../player/prayers";
import type { MechanicContext } from "./context";
import type { MechanicHooks } from "./hooks";

/** Builds the restricted context mechanics receive. */
export function mechanicContext(world: World, mechanicId: string): MechanicContext {
  return {
    tick: world.tick,
    player: world.player,
    npcs: world.npcs,
    rng: (stream) => world.rng.get(stream),
    message: (text) => world.events.push({ type: "MechanicMessage", mechanicId, text }),
    npc: {
      heal: (npcId, amount) => {
        const n = world.npcs.find((x) => x.id === npcId);
        if (!n || n.life !== "alive" || amount <= 0) return;
        const healed = Math.min(amount, n.maxHitpoints - n.hitpoints);
        if (healed <= 0) return;
        n.hitpoints += healed;
        world.events.push({ type: "NpcHealed", entityId: n.id, amount: healed, hitpoints: n.hitpoints });
      },
      say: (npcId, text) => world.events.push({ type: "NpcSaid", entityId: npcId, text }),
    },
    prayer: {
      drainPoints: (points) => drainPrayerPoints(world, points, "mechanic"),
      deactivate: (which) => deactivatePrayers(world, which),
      lockOverheads: (ticks) => {
        world.player.overheadsLockedUntil = Math.max(world.player.overheadsLockedUntil, world.tick + ticks);
        world.events.push({ type: "OverheadsLocked", untilTick: world.player.overheadsLockedUntil });
      },
    },
  };
}

/** Context for engine-owned pipeline runs (not tied to one mechanic). */
export function engineContext(world: World): MechanicContext {
  return mechanicContext(world, "engine");
}

/** Calls one hook on every active mechanic, in attachment order. */
export function runHook<K extends keyof MechanicHooks>(
  world: World,
  hook: K,
  ...args: MechanicHooks[K] extends ((ctx: MechanicContext, ...rest: infer A) => unknown) | undefined ? A : never
): void {
  for (const m of world.mechanics) {
    const fn = m.instance.hooks?.[hook] as ((ctx: MechanicContext, ...rest: unknown[]) => unknown) | undefined;
    fn?.(mechanicContext(world, m.id), ...args);
  }
}
