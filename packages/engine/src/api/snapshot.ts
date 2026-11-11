import type { CombatStyle, Tile } from "../defs/common";
import type { LifeState } from "../entities/types";
import type { EncounterOutcome } from "./events";

/** Read-only, structured-cloneable view of the world after a tick. */
export interface WorldSnapshot {
  tick: number;
  seed: number;
  encounterId: string;
  modifierIds: string[];
  arena: { id: string; width: number; height: number; blocked: Tile[] };
  player: PlayerSnapshot;
  npcs: NpcSnapshot[];
  /** Hits travelling as projectiles that have not landed yet. */
  projectiles: ProjectileSnapshot[];
  hazards: HazardSnapshot[];
  outcome: EncounterOutcome | null;
}

export interface ProjectileSnapshot {
  id: string;
  sourceId: string;
  targetId: string;
  visualId: string;
  style: CombatStyle;
  launchTick: number;
  landTick: number;
}

export interface PlayerSnapshot {
  id: string;
  pos: Tile;
  hitpoints: number;
  maxHitpoints: number;
  prayerPoints: number;
  maxPrayerPoints: number;
  /** 0 to 10000 (hundredths of a percent). */
  runEnergy: number;
  running: boolean;
  destination: Tile | null;
  targetId: string | null;
  weapon: { name: string; category: string; style: CombatStyle; speedTicks: number; rangeTiles: number; hasSpecial: boolean; specialEnergy: number | null };
  /** The weapon's combat styles and the selected one. */
  combatStyles: Array<{ name: string; attackType: CombatStyle; stance: string }>;
  combatStyleIndex: number;
  activePrayers: string[];
  /** The active overhead: "melee" | "ranged" | "magic" | "redemption" | null. */
  overhead: string | null;
  /** Ticks until overhead prayers can be switched on again (encounter mechanics). */
  overheadsLockedFor: number;
  /**
   * The player's current attack against their target (or the first living
   * NPC), from the combat formulas with current levels, prayers, stance and
   * gear. Values are before encounter pipelines. Null with no NPC to compare.
   */
  offence: { npcId: string; style: CombatStyle; attackRoll: number; defenceRoll: number; maxHit: number; hitChance: number } | null;
  /** The player's defence roll against each attack style. */
  defenceRolls: Record<CombatStyle, number>;
  /** Ticks until the next natural hitpoint change. */
  hpRegenIn: number;
  /** Worn items and the 28 inventory slots. */
  equipment: Record<string, { itemId: string; quantity: number }>;
  inventory: Array<{ itemId: string; quantity: number } | null>;
  /** Base and current (boosted/drained) levels. */
  baseLevels: { attack: number; strength: number; defence: number; ranged: number; magic: number; prayer: number; hitpoints: number };
  levels: { attack: number; strength: number; defence: number; ranged: number; magic: number };
  /** Summed equipment bonuses. */
  bonuses: { attack: Record<CombatStyle, number>; defence: Record<CombatStyle, number>; meleeStrength: number; rangedStrength: number; magicDamagePercent: number; prayer: number };
  /** Ticks until food / combo food / potions can be used again. */
  eatReadyIn: number;
  comboReadyIn: number;
  drinkReadyIn: number;
  /** 0 to 100. */
  specialEnergy: number;
  specialArmed: boolean;
  autocastSpellId: string | null;
  autoRetaliate: boolean;
  nextAttackTick: number;
  /** Ticks until the player may attack again (0 = ready). */
  attackReadyIn: number;
  life: LifeState;
  /** Tick on which the player respawns, while dead in respawn mode. */
  respawnTick: number | null;
}

export interface NpcSnapshot {
  id: string;
  defId: string;
  name: string;
  pos: Tile;
  size: number;
  hitpoints: number;
  maxHitpoints: number;
  /** Current levels (special attacks can drain them). */
  levels: { attack: number; strength: number; defence: number; ranged: number; magic: number };
  /** Shorthand for life === "alive". */
  alive: boolean;
  life: LifeState;
  respawnTick: number | null;
  targetId: string | null;
  nextAttackTick: number;
  attackReadyIn: number;
  /** Current phase of the NPC's behaviour (index from 0, of `count`). */
  phase: { index: number; count: number; id: string; name: string | null };
  enraged: boolean;
  /** Takes no damage right now (phase transition). */
  invulnerable: boolean;
}

/** Tiles marked by a boss special attack. */
export interface HazardSnapshot {
  id: string;
  sourceId: string;
  name: string;
  tiles: Tile[];
  /** "warning" until the detonation tick, then "burning" while it lingers. */
  state: "warning" | "burning";
  detonateTick: number;
  /** Last tick the hazard exists. */
  endTick: number;
}
