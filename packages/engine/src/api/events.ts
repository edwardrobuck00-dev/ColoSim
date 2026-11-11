import type { CombatStyle, Tile } from "../defs/common";

/** Why a prayer switched on or off. */
export type PrayerCause = "player" | "conflict" | "no-points" | "mechanic" | "requirements" | "death" | "redemption";

/**
 * The combat engine's own breakdown of one hit: the numbers it rolled and
 * every step that changed the damage. Lets the event log explain a hit.
 */
export interface HitDetail {
  /** Attack ID (NPC attack, weapon item, spell) and the tick it started. */
  attackId: string;
  startedTick: number;
  special: boolean;
  /** Why this attack was chosen (boss pattern, close range, special...). */
  reason: string;
  /** After accuracy pipelines. Absent for hazards. */
  attackRoll?: number;
  defenceRoll?: number;
  /** Probability the attack was accurate (0 to 1). */
  hitChance?: number;
  accurate: boolean;
  /** Damage rolled (0 if inaccurate), before prayers and modifiers. */
  rolled: number;
  /** Protection prayer that reduced it, if any, and the damage after it. */
  protectionPrayer?: string;
  afterPrayer: number;
  /** After encounter damage modifiers (pipelines). */
  afterModifiers: number;
  /** Damage lost because the target had fewer hitpoints left. */
  overkill: number;
  /** Target hitpoints before the hit. */
  targetHitpointsBefore: number;
  /** For hazards: the special's name and whether the tile detonated or was burning. */
  hazard?: { name: string; stage: "detonation" | "burning" };
}

/** Attack style of a hit; "typeless" hits (hazards) ignore protection prayers. */
export type HitStyle = CombatStyle | "typeless";

export interface EncounterOutcome {
  result: "win" | "loss";
  reason: string;
  tick: number;
}

/**
 * What happened during a tick. Events describe gameplay facts only, never
 * presentation; the renderer and UI decide how each one looks.
 */
export type SimEvent =
  | { type: "EncounterStarted"; encounterId: string; modifierIds: string[] }
  | { type: "EntitySpawned"; entityId: string; kind: "player" | "npc"; defId: string | null; pos: Tile; size: number; respawn?: boolean }
  | { type: "EntityDespawned"; entityId: string }
  | { type: "EntityDied"; entityId: string; killerId: string | null }
  | { type: "EntityMoved"; entityId: string; from: Tile; to: Tile; running: boolean; teleport?: boolean }
  | { type: "BossPhaseChanged"; npcId: string; phaseIndex: number; phaseId: string; name: string | null; hitpoints: number; maxHitpoints: number; threshold: number | null }
  | { type: "BossEnraged"; npcId: string; cause: "hitpoints" | "time"; hitpoints: number; maxHitpoints: number; threshold: number | null; afterTicks: number | null }
  | { type: "BossSpecialUsed"; npcId: string; specialId: string; name: string; reason: string }
  | { type: "NpcSaid"; entityId: string; text: string }
  | { type: "NpcHealed"; entityId: string; amount: number; hitpoints: number }
  /** Natural hitpoint regeneration (+1), or overheal wearing off (-1). */
  | { type: "Regenerated"; entityId: string; amount: number; hitpoints: number }
  | { type: "HazardPlaced"; hazardId: string; sourceId: string; name: string; tiles: Tile[]; detonateTick: number; lingerUntil: number }
  | { type: "RunToggled"; running: boolean }
  | { type: "PrayerToggled"; prayerId: string; active: boolean; cause: PrayerCause; replacedBy?: string }
  /** Prayer points lost: from active prayers draining, or an encounter mechanic. */
  | { type: "PrayerDrained"; amount: number; cause: "prayers" | "mechanic"; pointsLeft: number; activePrayers: string[] }
  | { type: "OverheadsLocked"; untilTick: number }
  | { type: "RedemptionTriggered"; healed: number }
  | { type: "PlayerConfigured"; field: string; value: number }
  | { type: "SpecialToggled"; armed: boolean }
  | { type: "SpecialUsed"; name: string; energyLeft: number }
  | { type: "CombatStyleChanged"; index: number; name: string }
  | { type: "AutocastChanged"; spellId: string | null }
  | { type: "AutoRetaliateChanged"; enabled: boolean }
  | { type: "LevelDrained"; entityId: string; skill: string; from: number; to: number }
  | { type: "ItemEquipped"; slot: string; itemId: string }
  | { type: "ItemUnequipped"; slot: string; itemId: string }
  | { type: "ItemConsumed"; itemId: string; kind: "food" | "combo-food" | "potion"; hitpointsBefore: number; hitpointsAfter: number; dosesLeft: number; changes: Array<{ skill: string; from: number; to: number }>; attackDelayTicks: number }
  | { type: "AmmoUsed"; itemId: string; remaining: number }
  | { type: "TargetChanged"; entityId: string; targetId: string | null }
  | {
      type: "AttackStarted";
      attackerId: string;
      targetId: string;
      /** NPC attack ID, or the player's weapon item ID ("unarmed" without one). */
      attackId: string;
      /** "typeless" for boss special attacks (their own hits carry real styles). */
      style: HitStyle;
      animationCue: string;
      special: boolean;
      /** Why this attack happened (combat style and weapon, boss pattern step, special...). */
      reason: string;
    }
  | {
      type: "ProjectileLaunched";
      projectileId: string;
      sourceId: string;
      targetId: string;
      visualId: string;
      style: CombatStyle;
      launchTick: number;
      /** Tick on which the hit lands (and the projectile disappears). */
      landTick: number;
    }
  | {
      type: "HitLanded";
      sourceId: string;
      targetId: string;
      /** 0 means the attack missed (shown as a block). */
      amount: number;
      maxHit: number;
      /** "typeless" for hazards (tiles that detonate or burn): never reduced by prayers. */
      style: HitStyle;
      targetHitpoints: number;
      /** True when the target was invulnerable (phase transitions). */
      immune?: boolean;
      /** How the engine arrived at this damage. */
      detail: HitDetail;
      /** True when a protection prayer reduced (or fully blocked) the hit. */
      blockedByPrayer?: boolean;
    }
  | { type: "CommandRejected"; command: string; reason: string }
  | { type: "MechanicMessage"; mechanicId: string; text: string }
  | { type: "EncounterEnded"; outcome: EncounterOutcome };

export type SimEventType = SimEvent["type"];
