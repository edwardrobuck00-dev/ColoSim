import type { HitStyle, SimEvent } from "../api/events";
import type { WorldSnapshot } from "../api/snapshot";
import type { TickResult } from "../api/simulation";
import { TICK_MS } from "../core/version";
import { PLAYER_ID } from "../entities/types";

/**
 * Combat statistics built only from engine events and snapshots: every
 * number here can be traced back to the events that produced it. Fold each
 * tick result into the stats with `recordTick`; read derived figures
 * (DPS, averages, accuracy) with `summarize`.
 */

/** A tick counts as "in combat" if the player attacked, was attacked, or was hit within this many ticks. */
export const COMBAT_WINDOW_TICKS = 10;

export interface HitTotals {
  /** Hits that landed (each hit of a multi-hit special counts). */
  hits: number;
  /** Accurate rolls (may still deal 0). */
  successful: number;
  /** Inaccurate rolls: always 0 damage. */
  missed: number;
  damage: number;
  maxHit: number;
  /** Damage lost to the target running out of hitpoints. */
  overkill: number;
  byStyle: Partial<Record<HitStyle, { hits: number; damage: number }>>;
}

export interface FightStats {
  firstTick: number | null;
  lastTick: number;
  combatTicks: number;
  lastCombatActivity: number | null;
  /** Player attacks started (a special with two hits is one attack). */
  attacksStarted: number;
  dealt: HitTotals & {
    special: { used: number; energySpent: number; hits: number; damage: number };
    immuneHits: number;
  };
  received: HitTotals & {
    blockedByPrayer: number;
    /** Damage the protection prayers stopped (rolled minus taken). */
    preventedByPrayer: number;
    hazard: { hits: number; damage: number };
  };
  prayer: {
    activations: Record<string, number>;
    ticksActive: Record<string, number>;
    /** Ticks with any protection prayer up. */
    protectedTicks: number;
    pointsDrained: number;
    pointsDrainedByMechanics: number;
    pointsRestored: number;
    switchedOffBy: Record<string, number>;
  };
  food: { eaten: Record<string, number>; healed: number; wasted: number };
  potions: { doses: Record<string, number>; prayerRestored: number; healed: number };
  /** Hitpoints Redemption healed. */
  redemptionHealed: number;
  boss: {
    phases: Array<{ tick: number; npcId: string; index: number; name: string | null; hitpoints: number; maxHitpoints: number }>;
    enrages: Array<{ tick: number; npcId: string; cause: "hitpoints" | "time" }>;
    specials: Record<string, number>;
    attacks: number;
    healed: number;
    /** Natural regeneration (not a mechanic). */
    regenerated: number;
  };
  /** The player's natural regeneration (+) and overheal decay (-). */
  playerRegenerated: number;
  deaths: Array<{ tick: number; killerId: string | null }>;
  kills: Array<{ tick: number; npcId: string }>;
  /** Special energy at the end of the previous tick (to measure what each special cost). */
  lastSpecialEnergy: number;
}

const totals = (): HitTotals => ({ hits: 0, successful: 0, missed: 0, damage: 0, maxHit: 0, overkill: 0, byStyle: {} });

export function createFightStats(): FightStats {
  return {
    firstTick: null,
    lastTick: 0,
    combatTicks: 0,
    lastCombatActivity: null,
    attacksStarted: 0,
    dealt: { ...totals(), special: { used: 0, energySpent: 0, hits: 0, damage: 0 }, immuneHits: 0 },
    received: { ...totals(), blockedByPrayer: 0, preventedByPrayer: 0, hazard: { hits: 0, damage: 0 } },
    prayer: { activations: {}, ticksActive: {}, protectedTicks: 0, pointsDrained: 0, pointsDrainedByMechanics: 0, pointsRestored: 0, switchedOffBy: {} },
    food: { eaten: {}, healed: 0, wasted: 0 },
    potions: { doses: {}, prayerRestored: 0, healed: 0 },
    redemptionHealed: 0,
    boss: { phases: [], enrages: [], specials: {}, attacks: 0, healed: 0, regenerated: 0 },
    playerRegenerated: 0,
    deaths: [],
    kills: [],
    lastSpecialEnergy: 100,
  };
}

const bump = (r: Record<string, number>, k: string, n = 1) => {
  r[k] = (r[k] ?? 0) + n;
};

function addHit(t: HitTotals, e: Extract<SimEvent, { type: "HitLanded" }>): void {
  t.hits++;
  if (e.detail.accurate) t.successful++;
  else t.missed++;
  t.damage += e.amount;
  t.maxHit = Math.max(t.maxHit, e.amount);
  t.overkill += e.detail.overkill;
  const s = (t.byStyle[e.style] ??= { hits: 0, damage: 0 });
  s.hits++;
  s.damage += e.amount;
}

/**
 * Folds one tick into the stats. `isProtection` says whether a prayer ID is a
 * protection prayer (from content). Mutates and returns `stats`.
 */
export function recordTick(stats: FightStats, result: Pick<TickResult, "tick" | "events" | "snapshot">, isProtection: (prayerId: string) => boolean): FightStats {
  const { tick, events, snapshot } = result;
  if (stats.firstTick === null) stats.firstTick = tick;
  stats.lastTick = tick;
  let activity = false;

  for (const e of events) {
    switch (e.type) {
      case "AttackStarted":
        if (e.attackerId === PLAYER_ID) {
          stats.attacksStarted++;
          activity = true;
        } else if (e.targetId === PLAYER_ID) {
          stats.boss.attacks++;
          activity = true;
        }
        break;
      case "HitLanded":
        if (e.sourceId === PLAYER_ID) {
          addHit(stats.dealt, e);
          if (e.immune) stats.dealt.immuneHits++;
          if (e.detail.special) {
            stats.dealt.special.hits++;
            stats.dealt.special.damage += e.amount;
          }
          activity = true;
        } else if (e.targetId === PLAYER_ID) {
          addHit(stats.received, e);
          if (e.blockedByPrayer) {
            stats.received.blockedByPrayer++;
            stats.received.preventedByPrayer += Math.max(0, e.detail.rolled - e.detail.afterPrayer);
          }
          if (e.detail.hazard) {
            stats.received.hazard.hits++;
            stats.received.hazard.damage += e.amount;
          }
          activity = true;
        }
        break;
      case "SpecialUsed":
        stats.dealt.special.used++;
        break;
      case "PrayerToggled":
        if (e.active) bump(stats.prayer.activations, e.prayerId);
        else bump(stats.prayer.switchedOffBy, e.cause);
        break;
      case "PrayerDrained":
        stats.prayer.pointsDrained += e.amount;
        if (e.cause === "mechanic") stats.prayer.pointsDrainedByMechanics += e.amount;
        break;
      case "ItemConsumed": {
        const prayer = e.changes.find((c) => c.skill === "prayer");
        if (prayer && prayer.to > prayer.from) {
          stats.prayer.pointsRestored += prayer.to - prayer.from;
          stats.potions.prayerRestored += prayer.to - prayer.from;
        }
        if (e.kind === "potion") {
          bump(stats.potions.doses, e.itemId);
          stats.potions.healed += e.hitpointsAfter - e.hitpointsBefore;
        } else {
          bump(stats.food.eaten, e.itemId);
          stats.food.healed += Math.max(0, e.hitpointsAfter - e.hitpointsBefore);
        }
        break;
      }
      case "BossPhaseChanged":
        stats.boss.phases.push({ tick, npcId: e.npcId, index: e.phaseIndex, name: e.name, hitpoints: e.hitpoints, maxHitpoints: e.maxHitpoints });
        break;
      case "BossEnraged":
        stats.boss.enrages.push({ tick, npcId: e.npcId, cause: e.cause });
        break;
      case "BossSpecialUsed":
        bump(stats.boss.specials, e.name);
        activity = true;
        break;
      case "RedemptionTriggered":
        stats.redemptionHealed += e.healed;
        break;
      case "NpcHealed":
        stats.boss.healed += e.amount;
        break;
      case "Regenerated":
        if (e.entityId === PLAYER_ID) stats.playerRegenerated += e.amount;
        else stats.boss.regenerated += e.amount;
        break;
      case "EntityDied":
        if (e.entityId === PLAYER_ID) stats.deaths.push({ tick, killerId: e.killerId });
        else stats.kills.push({ tick, npcId: e.entityId });
        break;
      default:
        break;
    }
  }

  // Special energy actually spent this tick (from the snapshot, so free specials count as 0).
  const used = events.filter((e) => e.type === "SpecialUsed");
  if (used.length) {
    const left = (used[used.length - 1] as Extract<SimEvent, { type: "SpecialUsed" }>).energyLeft;
    stats.dealt.special.energySpent += Math.max(0, stats.lastSpecialEnergy - left);
  }
  stats.lastSpecialEnergy = snapshot.player.specialEnergy;

  // Per-tick state: prayers held this tick, time in combat.
  for (const id of snapshot.player.activePrayers) bump(stats.prayer.ticksActive, id);
  if (snapshot.player.activePrayers.some(isProtection)) stats.prayer.protectedTicks++;
  if (activity) stats.lastCombatActivity = tick;
  if (stats.lastCombatActivity !== null && tick - stats.lastCombatActivity < COMBAT_WINDOW_TICKS && snapshot.player.life === "alive") stats.combatTicks++;
  return stats;
}

/** Stats for a fight starting from `initial` (the tick-0 snapshot). */
export function startFightStats(initial: WorldSnapshot): FightStats {
  const s = createFightStats();
  s.lastSpecialEnergy = initial.player.specialEnergy;
  return s;
}

export interface FightSummary {
  durationTicks: number;
  durationSeconds: number;
  combatSeconds: number;
  /** Damage dealt per second of time in combat. */
  dps: number;
  /** Damage dealt per second over the whole fight. */
  dpsOverall: number;
  /** Damage taken per second of time in combat. */
  incomingDps: number;
  /** Mean damage of all player hits, misses included. */
  averageHit: number;
  /** Mean damage of accurate hits. */
  averageSuccessfulHit: number;
  /** Share of player hits that were accurate (0 to 1). */
  accuracy: number;
  /** Share of NPC hits on the player that were accurate. */
  bossAccuracy: number;
  /** Share of in-fight ticks with a protection prayer up. */
  protectionUptime: number;
  foodEaten: number;
  potionDoses: number;
}

export function summarize(s: FightStats): FightSummary {
  const durationTicks = s.firstTick === null ? 0 : s.lastTick - s.firstTick + 1;
  const sec = (ticks: number) => (ticks * TICK_MS) / 1000;
  const per = (n: number, d: number) => (d > 0 ? n / d : 0);
  return {
    durationTicks,
    durationSeconds: sec(durationTicks),
    combatSeconds: sec(s.combatTicks),
    dps: per(s.dealt.damage, sec(s.combatTicks)),
    dpsOverall: per(s.dealt.damage, sec(durationTicks)),
    incomingDps: per(s.received.damage, sec(s.combatTicks)),
    averageHit: per(s.dealt.damage, s.dealt.hits),
    averageSuccessfulHit: per(s.dealt.damage, s.dealt.successful),
    accuracy: per(s.dealt.successful, s.dealt.hits),
    bossAccuracy: per(s.received.successful - s.received.hazard.hits, s.received.hits - s.received.hazard.hits),
    protectionUptime: per(s.prayer.protectedTicks, durationTicks),
    foodEaten: Object.values(s.food.eaten).reduce((a, b) => a + b, 0),
    potionDoses: Object.values(s.potions.doses).reduce((a, b) => a + b, 0),
  };
}
