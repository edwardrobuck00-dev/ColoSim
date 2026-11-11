import type { SimEvent } from "../api/events";
import { PLAYER_ID } from "../entities/types";

/** How events are grouped in the log. */
export type EventCategory =
  | "damage-dealt" | "damage-taken" | "attack" | "prayer" | "consumable" | "special" | "boss" | "movement"
  | "equipment" | "system" | "warning";

export interface ExplainedEvent {
  category: EventCategory;
  /** Who did it: "You", the NPC's name, or "Encounter". */
  actor: string;
  /** One line for the log row. */
  title: string;
  /** Numbers the engine recorded for this event. */
  facts: Array<[label: string, value: string]>;
  /** Why it happened, in order, from the engine's own data. */
  why: string[];
}

/** Display names, so explanations read naturally. */
export interface NameLookup {
  entity(id: string): string;
  attack(id: string): string;
  item(id: string): string;
  prayer(id: string): string;
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const PRAYER_CAUSE: Record<string, string> = {
  player: "You switched it.",
  conflict: "Another prayer that uses the same slot replaced it.",
  "no-points": "Prayer points ran out, which switches every prayer off.",
  mechanic: "An encounter mechanic switched it off.",
  requirements: "A level change means its requirements are no longer met.",
  death: "Prayers switch off when you die.",
  redemption: "Redemption triggered and drained all prayer points.",
};

/** Explains one engine event. `tick` is the tick it happened on. */
export function explainEvent(e: SimEvent, tick: number, n: NameLookup): ExplainedEvent {
  const you = (id: string) => (id === PLAYER_ID ? "You" : n.entity(id));
  switch (e.type) {
    case "HitLanded": {
      const d = e.detail;
      const dealt = e.sourceId === PLAYER_ID;
      const src = you(e.sourceId);
      const dst = e.targetId === PLAYER_ID ? "you" : n.entity(e.targetId);
      const facts: ExplainedEvent["facts"] = [
        ["Damage", String(e.amount)],
        ["Max hit", String(e.maxHit)],
        ["Style", e.style],
        ["Target hitpoints", `${d.targetHitpointsBefore} -> ${e.targetHitpoints}`],
      ];
      const why: string[] = [];
      if (d.hazard) {
        why.push(cap(d.reason) + ".");
        why.push(`Rolled ${d.rolled}. Prayers never reduce fire damage.`);
      } else {
        why.push(`Attack: ${d.reason} (started on tick ${d.startedTick}, landed on tick ${tick}${tick > d.startedTick ? `, a ${tick - d.startedTick}-tick hit delay` : ", melee lands at once"}).`);
        if (d.attackRoll !== undefined && d.defenceRoll !== undefined && d.hitChance !== undefined) {
          facts.push(["Attack roll", String(d.attackRoll)], ["Defence roll", String(d.defenceRoll)], ["Hit chance", pct(d.hitChance)]);
          why.push(`Attack roll ${d.attackRoll} against defence roll ${d.defenceRoll} gives a ${pct(d.hitChance)} chance to hit.`);
        }
        why.push(d.accurate ? `The accuracy roll succeeded, then damage was rolled from 0 to ${e.maxHit}: ${d.rolled}.` : "The accuracy roll failed, so the hit deals 0.");
      }
      if (d.protectionPrayer) why.push(`${n.prayer(d.protectionPrayer)} was active against this ${e.style} attack: ${d.rolled} rolled, ${d.afterPrayer} after the prayer.`);
      else if (!dealt && !d.hazard && d.accurate) why.push(`No protection prayer against ${e.style} was active.`);
      if (d.afterModifiers !== d.afterPrayer) why.push(`Encounter modifiers changed the damage from ${d.afterPrayer} to ${d.afterModifiers}.`);
      if (e.immune) why.push(`${n.entity(e.targetId)} was immune (phase transition), so the hit dealt 0.`);
      if (d.overkill > 0) why.push(`${d.overkill} damage was lost because the target only had ${d.targetHitpointsBefore} hitpoints left.`);
      if (d.special) facts.push(["Special", "yes"]);
      const title = d.hazard
        ? `${d.hazard.name} burns you for ${e.amount}`
        : e.amount > 0
          ? `${src} ${dealt ? "hit" : "hits"} ${dst} for ${e.amount}`
          : e.blockedByPrayer ? `${n.prayer(d.protectionPrayer ?? "")} blocks ${src}'s attack`
          : d.accurate ? `${src} ${dealt ? "hit" : "hits"} ${dst} for 0` : `${src} ${dealt ? "miss" : "misses"} ${dst}`;
      return { category: dealt ? "damage-dealt" : "damage-taken", actor: src, title, facts, why };
    }
    case "AttackStarted":
      return {
        category: e.special ? "special" : "attack",
        actor: you(e.attackerId),
        title: `${you(e.attackerId)} ${e.attackerId === PLAYER_ID ? "attack" : "attacks"}${e.special ? " (special)" : ""}: ${n.attack(e.attackId)}`,
        facts: [["Style", e.style], ["Animation", e.animationCue]],
        why: [cap(e.reason) + "."],
      };
    case "ProjectileLaunched":
      return {
        category: "attack", actor: you(e.sourceId), title: `Projectile launched (${e.style})`,
        facts: [["Launched", `tick ${e.launchTick}`], ["Lands", `tick ${e.landTick}`]],
        why: [`It lands ${e.landTick - e.launchTick} ticks later; the hit is applied (and protection prayers checked) on tick ${e.landTick}.`],
      };
    case "PrayerToggled":
      return {
        category: "prayer", actor: e.cause === "player" ? "You" : "Engine",
        title: `${n.prayer(e.prayerId)} ${e.active ? "on" : "off"}`,
        facts: [["Cause", e.cause]],
        why: [e.active ? "You switched it on; it takes effect from this tick." : (PRAYER_CAUSE[e.cause] ?? e.cause), ...(e.replacedBy ? [`Replaced by ${n.prayer(e.replacedBy)}.`] : [])],
      };
    case "PrayerDrained":
      return {
        category: "prayer", actor: e.cause === "prayers" ? "You" : "Encounter",
        title: `-${e.amount} prayer point${e.amount === 1 ? "" : "s"} (${e.pointsLeft} left)`,
        facts: [["Cause", e.cause], ["Active prayers", e.activePrayers.map((p) => n.prayer(p)).join(", ") || "none"]],
        why: [e.cause === "prayers" ? "Active prayers add their drain effect to a counter every tick; each time it passes the drain resistance (60 + 2 x prayer bonus) a point is lost." : "An encounter mechanic drained prayer points."],
      };
    case "ItemConsumed":
      return {
        category: "consumable", actor: "You",
        title: `${e.kind === "potion" ? "Drank" : "Ate"} ${n.item(e.itemId)}${e.dosesLeft > 0 ? ` (${e.dosesLeft} left)` : ""}`,
        facts: e.changes.map((c) => [cap(c.skill), `${c.from} -> ${c.to}`] as [string, string]),
        why: [
          e.changes.length ? `Changed ${e.changes.map((c) => `${c.skill} by ${c.to - c.from > 0 ? "+" : ""}${c.to - c.from}`).join(", ")}.` : "Nothing changed (already at the cap).",
          ...(e.attackDelayTicks > 0 ? [`Adds ${e.attackDelayTicks} ticks to your attack timer.`] : []),
        ],
      };
    case "SpecialUsed":
      return { category: "special", actor: "You", title: `Special attack: ${e.name}`, facts: [["Energy left", `${e.energyLeft}%`]], why: ["You armed the special attack and had enough energy when the attack started."] };
    case "BossSpecialUsed":
      return { category: "boss", actor: n.entity(e.npcId), title: `${n.entity(e.npcId)} uses ${e.name}`, facts: [], why: [`Used because: ${e.reason}.`] };
    case "BossPhaseChanged": {
      const hp = pct(e.hitpoints / Math.max(1, e.maxHitpoints));
      return {
        category: "boss", actor: n.entity(e.npcId),
        title: `${n.entity(e.npcId)} enters ${e.name ?? `phase ${e.phaseIndex + 1}`}`,
        facts: [["Hitpoints", `${e.hitpoints}/${e.maxHitpoints} (${hp})`], ["Threshold", e.threshold === null ? "-" : `${e.threshold}%`]],
        why: [e.threshold === null ? "First phase." : `Its hitpoints fell to ${hp}, at or below this phase's ${e.threshold}% threshold, checked at the start of its turn.`],
      };
    }
    case "BossEnraged":
      return {
        category: "boss", actor: n.entity(e.npcId), title: `${n.entity(e.npcId)} enrages`,
        facts: [["Hitpoints", `${e.hitpoints}/${e.maxHitpoints}`], ["Cause", e.cause]],
        why: [e.cause === "hitpoints" ? `Its hitpoints fell to ${pct(e.hitpoints / Math.max(1, e.maxHitpoints))}, at or below the ${e.threshold}% enrage threshold.` : `The fight reached tick ${tick}, its ${e.afterTicks}-tick time limit.`],
      };
    case "HazardPlaced":
      return {
        category: "boss", actor: n.entity(e.sourceId), title: `${e.name}: ${e.tiles.length} tile${e.tiles.length === 1 ? "" : "s"} marked`,
        facts: [["Detonates", `tick ${e.detonateTick}`], ["Burns until", e.lingerUntil > e.detonateTick ? `tick ${e.lingerUntil}` : "-"]],
        why: [`Anyone on these tiles on tick ${e.detonateTick} is hit; that leaves ${e.detonateTick - tick - 1} tick${e.detonateTick - tick - 1 === 1 ? "" : "s"} of movement after you react.`],
      };
    case "NpcHealed":
      return { category: "boss", actor: n.entity(e.entityId), title: `${n.entity(e.entityId)} heals ${e.amount}`, facts: [["Hitpoints", String(e.hitpoints)]], why: ["An encounter rule healed it (for the Ashen Warden: fire damage you take)."] };
    case "Regenerated":
      return {
        category: "system", actor: you(e.entityId), title: `${you(e.entityId)} ${e.amount > 0 ? "regenerated" : "lost overheal:"} ${e.amount > 0 ? "+" : ""}${e.amount} hitpoint`,
        facts: [["Hitpoints", String(e.hitpoints)]],
        why: [e.amount > 0 ? "Natural regeneration: 1 hitpoint every 100 ticks (50 with Rapid Heal for the player)." : "Hitpoints above the maximum drop by 1 on the same timer."],
      };
    case "NpcSaid":
      return { category: "boss", actor: n.entity(e.entityId), title: `${n.entity(e.entityId)}: "${e.text}"`, facts: [], why: [] };
    case "EntityMoved":
      return {
        category: "movement", actor: you(e.entityId), title: `${you(e.entityId)} ${e.teleport ? "teleported" : e.running ? "ran" : "walked"} to ${e.to.x},${e.to.y}`,
        facts: [["From", `${e.from.x},${e.from.y}`]], why: e.teleport ? ["A phase began that moves the boss."] : [],
      };
    case "EntityDied":
      return { category: "system", actor: you(e.entityId), title: `${you(e.entityId)} ${e.entityId === PLAYER_ID ? "were" : "was"} defeated`, facts: [["Killed by", e.killerId ? you(e.killerId) : "-"]], why: ["Hitpoints reached 0."] };
    case "CommandRejected":
      return { category: "warning", actor: "You", title: `Can't ${e.command}`, facts: [], why: [cap(e.reason) + "."] };
    case "TargetChanged":
      return { category: "attack", actor: you(e.entityId), title: e.targetId ? `${you(e.entityId)} targets ${you(e.targetId)}` : `${you(e.entityId)} stops targeting`, facts: [], why: [] };
    case "CombatStyleChanged":
      return { category: "equipment", actor: "You", title: `Combat style: ${e.name}`, facts: [], why: [] };
    case "ItemEquipped":
      return { category: "equipment", actor: "You", title: `Equipped ${n.item(e.itemId)} (${e.slot})`, facts: [], why: ["Bonuses and the weapon are recalculated at once."] };
    case "ItemUnequipped":
      return { category: "equipment", actor: "You", title: `Removed ${n.item(e.itemId)} (${e.slot})`, facts: [], why: [] };
    case "LevelDrained":
      return { category: "special", actor: you(e.entityId), title: `${you(e.entityId)}'s ${e.skill} drained ${e.from} -> ${e.to}`, facts: [], why: ["A special attack effect lowered the level."] };
    case "RedemptionTriggered":
      return { category: "prayer", actor: "You", title: `Redemption heals ${e.healed}`, facts: [], why: ["A hit left you below 10% hitpoints with Redemption active."] };
    case "OverheadsLocked":
      return { category: "boss", actor: "Encounter", title: `Overheads disabled until tick ${e.untilTick}`, facts: [], why: ["An encounter mechanic switched off your protection prayers and locked them."] };
    case "MechanicMessage":
      return { category: "boss", actor: "Encounter", title: e.text, facts: [["Mechanic", e.mechanicId]], why: [] };
    case "EncounterEnded":
      return { category: "system", actor: "Encounter", title: `${e.outcome.result === "win" ? "Victory" : "Defeat"}: ${e.outcome.reason}`, facts: [], why: [] };
    default:
      return { category: "system", actor: "Engine", title: e.type.replace(/([a-z])([A-Z])/g, "$1 $2"), facts: [], why: [] };
  }
}
