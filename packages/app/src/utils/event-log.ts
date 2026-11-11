import type { SimEvent } from "@sim/engine";

export type LogCategory = "system" | "combat" | "mechanic" | "action" | "warning";

export interface LogEntry {
  id: number;
  tick: number;
  category: LogCategory;
  text: string;
}

/** Turns an engine event into a combat log line, or null if it should not be logged. */
export function describeEvent(e: SimEvent, nameOf: (entityId: string) => string): { category: LogCategory; text: string } | null {
  switch (e.type) {
    case "EncounterStarted":
      return { category: "system", text: "Encounter started." };
    case "MechanicMessage":
      return { category: "mechanic", text: e.text };
    case "TargetChanged":
      return e.targetId ? { category: "action", text: `Target: ${nameOf(e.targetId)}.` } : null;
    case "RunToggled":
      return { category: "action", text: e.running ? "Run enabled." : "Run disabled." };
    case "CommandRejected":
      return { category: "warning", text: `Can't ${e.command}: ${e.reason}.` };
    case "EncounterEnded":
      return { category: "system", text: `${e.outcome.result === "win" ? "Victory" : "Defeat"}: ${e.outcome.reason}.` };
    case "HitLanded": {
      const src = nameOf(e.sourceId);
      const dst = nameOf(e.targetId);
      if (e.style === "typeless") return e.amount > 0 ? { category: "combat", text: `The fire burns you for ${e.amount}.` } : null;
      if (e.immune) return { category: "combat", text: `${dst} is immune right now.` };
      if (e.blockedByPrayer && e.amount === 0) return { category: "combat", text: `Your prayer blocks ${src}'s attack.` };
      if (e.amount === 0) return { category: "combat", text: e.sourceId === "player" ? `You miss ${dst}.` : `${src} misses you.` };
      return { category: "combat", text: e.sourceId === "player" ? `You hit ${dst} for ${e.amount}.` : `${src} hits you for ${e.amount}.` };
    }
    case "AutoRetaliateChanged":
      return { category: "action", text: `Auto Retaliate ${e.enabled ? "on" : "off"}.` };
    case "BossPhaseChanged":
      return { category: "mechanic", text: `${nameOf(e.npcId)} enters ${e.name ? `the ${e.name} phase` : `phase ${e.phaseIndex + 1}`}.` };
    case "BossEnraged":
      return { category: "mechanic", text: `${nameOf(e.npcId)} becomes enraged!` };
    case "BossSpecialUsed":
      return { category: "mechanic", text: `${nameOf(e.npcId)} uses ${e.name}!` };
    case "NpcSaid":
      return { category: "mechanic", text: `${nameOf(e.entityId)}: ${e.text}` };
    case "NpcHealed":
      return { category: "mechanic", text: `${nameOf(e.entityId)} feeds on the fire and heals ${e.amount}.` };
    case "PrayerToggled":
      return { category: "action", text: `${nameOf(e.prayerId)} ${e.active ? "on" : "off"}.` };
    case "OverheadsLocked":
      return { category: "mechanic", text: `Your overhead prayers are disabled until tick ${e.untilTick}.` };
    case "RedemptionTriggered":
      return { category: "combat", text: `Redemption heals you for ${e.healed} and drains your prayer.` };
    case "PlayerConfigured":
      return { category: "system", text: `Set ${configLabel(e.field)} to ${e.value}.` };
    case "SpecialUsed":
      return { category: "combat", text: `${e.name}! (${e.energyLeft}% special energy left)` };
    case "CombatStyleChanged":
      return { category: "action", text: `Combat style: ${e.name}.` };
    case "AutocastChanged":
      return { category: "action", text: e.spellId ? `Autocasting ${nameOf(e.spellId)}.` : "Autocast off." };
    case "ItemEquipped":
      return { category: "action", text: `Equipped ${nameOf(e.itemId)}.` };
    case "ItemUnequipped":
      return { category: "action", text: `Removed ${nameOf(e.itemId)}.` };
    case "ItemConsumed": {
      const healed = e.hitpointsAfter - e.hitpointsBefore;
      return { category: "action", text: `${nameOf(e.itemId)}${healed > 0 ? `: +${healed} Hitpoints` : ""}${e.dosesLeft > 0 ? ` (${e.dosesLeft} left)` : ""}.` };
    }
    case "LevelDrained":
      return { category: "combat", text: `${nameOf(e.entityId)}'s ${e.skill} drained to ${e.to}.` };
    case "EntitySpawned":
      if (!e.respawn) return null;
      return { category: "system", text: e.entityId === "player" ? "You respawn." : `${nameOf(e.entityId)} respawns.` };
    case "EntityDied":
      return { category: "system", text: e.entityId === "player" ? "You have been defeated." : `${nameOf(e.entityId)} is defeated.` };
    default:
      return null;
  }
}

/** "base.attack" -> "base Attack", "current.strength" -> "current Strength", "prayerPoints" -> "Prayer points". */
function configLabel(field: string): string {
  if (field === "prayerPoints") return "Prayer points";
  if (field === "hitpoints") return "Hitpoints";
  const [kind, skill = ""] = field.split(".");
  return `${kind} ${skill.charAt(0).toUpperCase()}${skill.slice(1)}`;
}
