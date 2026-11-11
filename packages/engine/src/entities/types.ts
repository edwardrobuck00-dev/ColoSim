import type { CombatStats, Tile } from "../defs/common";
import type { EquipmentSlot, ItemBonuses } from "../defs/item";
import type { PlayerWeapon } from "../player/weapon";

export const PLAYER_ID = "player";

/** Run energy is stored in hundredths of a percent: 10000 = 100%. */
export const MAX_RUN_ENERGY = 10_000;

/** Ticks a dying player stays on the ground before despawning (respawn mode). */
export const PLAYER_DEATH_TICKS = 3;

/**
 * Life cycle shared by players and NPCs:
 * alive -> (hitpoints reach 0) -> dying -> (deathTicks later) -> dead
 *   -> (respawnTicks later, if the entity respawns) -> alive
 * Only "alive" entities move, attack, or can be hit.
 */
export type LifeState = "alive" | "dying" | "dead";

/** An item in a slot. Quantity is the stack size (ammo) or doses left (potions). */
export interface ItemStack {
  itemId: string;
  quantity: number;
}

/** Current (boosted or drained) combat levels. Hitpoints and prayer are tracked as points. */
export interface CurrentLevels {
  attack: number;
  strength: number;
  defence: number;
  ranged: number;
  magic: number;
}

interface Lifecycle {
  life: LifeState;
  /** Where the entity (re)spawns. */
  spawnPos: Tile;
  diedAtTick: number | null;
  /** Tick on which a dying entity becomes dead (despawns). */
  despawnTick: number | null;
  /** Tick on which a dead entity respawns, if it will. */
  respawnTick: number | null;
}

export interface PlayerState extends Lifecycle {
  id: typeof PLAYER_ID;
  kind: "player";
  pos: Tile;
  stats: CombatStats;
  hitpoints: number;
  maxHitpoints: number;
  prayerPoints: number;
  maxPrayerPoints: number;
  runEnergy: number;
  running: boolean;
  /** Remaining tiles to walk, next step first. */
  path: Tile[];
  /** Entity the player is trying to reach or attack. */
  targetId: string | null;
  /** Worn items by slot. */
  equipment: Partial<Record<EquipmentSlot, ItemStack>>;
  /** 28 inventory slots. */
  inventory: Array<ItemStack | null>;
  /** Current levels (potions boost them, brews drain them); `stats` holds base levels. */
  levels: CurrentLevels;
  /** First ticks on which normal food, combo food and potions can be consumed again. */
  foodReadyTick: number;
  comboReadyTick: number;
  potionReadyTick: number;
  /** Summed equipment bonuses (derived from `equipment`). */
  bonuses: ItemBonuses;
  weapon: PlayerWeapon;
  /** First tick on which the player may attack again. */
  nextAttackTick: number;
  /** Index into the weapon category's combat styles. */
  combatStyleIndex: number;
  activePrayers: string[];
  /** Prayer drain counter (see combat/prayer.ts). */
  prayerDrainCounter: number;
  /** Overhead prayers cannot be (re)activated before this tick (encounter mechanics). */
  overheadsLockedUntil: number;
  /** Ticks since the last natural hitpoint change (regen or overheal decay). */
  hpRegenTimer: number;
  /** Ticks since Rapid Restore last restored (or was switched on). */
  rapidRestoreTimer: number;
  /** Tick Preserve was switched on, or null. */
  preserveSince: number | null;
  /** When Preserve postpones a boost decay, the tick it will happen instead. */
  pendingBoostDecayTick: number | null;
  /** Special attack energy, 0 to 100. */
  specialEnergy: number;
  specialRegenTimer: number;
  /** The next attack uses the weapon's special attack. */
  specialArmed: boolean;
  autocastSpellId: string | null;
  /** Fight back automatically when hit while idle. */
  autoRetaliate: boolean;
  /** The NPC whose hit landed most recently (for auto retaliate). */
  lastAttackerId: string | null;
}

export interface NpcState extends Lifecycle {
  id: string;
  kind: "npc";
  defId: string;
  name: string;
  /** South-west tile of the NPC's footprint. */
  pos: Tile;
  size: number;
  hitpoints: number;
  maxHitpoints: number;
  targetId: string | null;
  nextAttackTick: number;
  /** Position in the attack rotation (for "sequence" selection). */
  rotationIndex: number;
  /** Current levels; special attacks can drain them. Reset on respawn. */
  levels: CombatStats;
  /** Behaviour state (phases, patterns, enrage); see npc/behaviour.ts. */
  boss: BossState;
}

export interface BossState {
  phaseIndex: number;
  phaseStartTick: number;
  /** Attacks (normal and special) made in the current phase. */
  attackCount: number;
  /** Specials used in the current phase (picks the next one in rotation). */
  specialCount: number;
  /** The attack a "switch" pattern is repeating, and how many times it has been used. */
  switchAttackId: string | null;
  switchCount: number;
  enraged: boolean;
  /** Takes no damage before this tick. */
  invulnerableUntil: number;
  /** Does not move or attack before this tick (phase transitions). */
  busyUntil: number;
  /** A special queued by a phase entry, used when the pause ends. */
  pendingSpecial: string | null;
}

export type EntityState = PlayerState | NpcState;

export const isAlive = (e: { life: LifeState }): boolean => e.life === "alive";
