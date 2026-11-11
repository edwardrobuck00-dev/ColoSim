import type { PlayerCommand } from "../api/commands";
import type { World } from "../core/world";
import type { CombatStats } from "../defs/common";
import { missingRequirements } from "./inventory";
import { dropUnusablePrayers } from "./prayers";

type ConfigCommand = Extract<PlayerCommand, { type: "setBaseLevel" | "setCurrentLevel" | "setHitpoints" | "setPrayerPoints" }>;

/**
 * Applies a player configuration command. Returns a rejection reason or null.
 *
 * - Base level: a boost or drain is kept relative to the new base (99 -> 118
 *   boosted, base set to 80, becomes 99). Lowering a level below a worn item's
 *   requirement is refused; prayers whose requirements are no longer met
 *   switch off. Hitpoints and Prayer also set max hitpoints / prayer points.
 * - Current level / hitpoints / prayer points: set directly (hitpoints up to
 *   max, prayer points up to the Prayer level).
 */
export function configurePlayer(world: World, cmd: ConfigCommand): string | null {
  const p = world.player;
  const push = (field: string, value: number) => world.events.push({ type: "PlayerConfigured", field, value });

  switch (cmd.type) {
    case "setBaseLevel": {
      const stats: CombatStats = { ...p.stats, [cmd.skill]: cmd.level };
      for (const stack of Object.values(p.equipment)) {
        const def = stack ? world.content.items.get(stack.itemId) : undefined;
        const missing = def ? missingRequirements(stats, def) : [];
        if (def && missing.length) return `${def.name} requires ${missing.join(", ")}`;
      }
      const delta = cmd.level - p.stats[cmd.skill];
      p.stats = stats;
      if (cmd.skill === "hitpoints") {
        p.maxHitpoints = cmd.level;
        p.hitpoints = Math.max(1, Math.min(p.hitpoints + delta, cmd.level));
      } else if (cmd.skill === "prayer") {
        p.maxPrayerPoints = cmd.level;
        p.prayerPoints = Math.max(0, Math.min(p.prayerPoints + delta, cmd.level));
      } else {
        p.levels[cmd.skill] = Math.max(0, p.levels[cmd.skill] + delta);
      }
      dropUnusablePrayers(world);
      push(`base.${cmd.skill}`, cmd.level);
      return null;
    }
    case "setCurrentLevel":
      p.levels[cmd.skill] = cmd.level;
      push(`current.${cmd.skill}`, cmd.level);
      return null;
    case "setHitpoints":
      p.hitpoints = Math.min(cmd.value, p.maxHitpoints);
      push("hitpoints", p.hitpoints);
      return null;
    case "setPrayerPoints":
      p.prayerPoints = Math.min(cmd.value, p.maxPrayerPoints);
      push("prayerPoints", p.prayerPoints);
      return null;
  }
}
