import type { CombatStats, Tile } from "../defs/common";
import type { EquipmentSlot, ItemBonuses } from "../defs/item";
import type { NpcDef } from "../defs/npc";
import type { PlayerWeapon } from "../player/weapon";
import { MAX_SPECIAL_ENERGY } from "../combat/special-attack";
import { MAX_RUN_ENERGY, PLAYER_ID, type BossState, type ItemStack, type NpcState, type PlayerState } from "./types";

export interface PlayerInit {
  pos: Tile;
  stats: CombatStats;
  bonuses: ItemBonuses;
  weapon: PlayerWeapon;
  combatStyleIndex: number;
  prayers: string[];
  /** Set when a setup prayer is Preserve: it counts as active since tick 0. */
  preserveActive?: boolean;
  autocastSpellId: string | null;
  autoRetaliate?: boolean;
  equipment: Partial<Record<EquipmentSlot, ItemStack>>;
  inventory: Array<ItemStack | null>;
}

export function createPlayer(init: PlayerInit): PlayerState {
  const { pos, stats } = init;
  return {
    id: PLAYER_ID,
    kind: "player",
    pos: { ...pos },
    stats: { ...stats },
    hitpoints: stats.hitpoints,
    maxHitpoints: stats.hitpoints,
    prayerPoints: stats.prayer,
    maxPrayerPoints: stats.prayer,
    runEnergy: MAX_RUN_ENERGY,
    running: true,
    path: [],
    targetId: null,
    equipment: init.equipment,
    inventory: init.inventory,
    levels: { attack: stats.attack, strength: stats.strength, defence: stats.defence, ranged: stats.ranged, magic: stats.magic },
    foodReadyTick: 0,
    comboReadyTick: 0,
    potionReadyTick: 0,
    bonuses: init.bonuses,
    weapon: init.weapon,
    nextAttackTick: 0,
    combatStyleIndex: init.combatStyleIndex,
    activePrayers: [...init.prayers],
    prayerDrainCounter: 0,
    overheadsLockedUntil: 0,
    hpRegenTimer: 0,
    rapidRestoreTimer: 0,
    preserveSince: init.preserveActive ? 0 : null,
    pendingBoostDecayTick: null,
    specialEnergy: MAX_SPECIAL_ENERGY,
    specialRegenTimer: 0,
    specialArmed: false,
    autocastSpellId: init.autocastSpellId,
    autoRetaliate: init.autoRetaliate ?? false,
    lastAttackerId: null,
    life: "alive",
    spawnPos: { ...pos },
    diedAtTick: null,
    despawnTick: null,
    respawnTick: null,
  };
}

export function createNpc(id: string, def: NpcDef, pos: Tile): NpcState {
  return {
    id,
    kind: "npc",
    defId: def.id,
    name: def.name,
    pos: { ...pos },
    size: def.size,
    hitpoints: def.stats.hitpoints,
    maxHitpoints: def.stats.hitpoints,
    targetId: null,
    nextAttackTick: 0,
    rotationIndex: 0,
    levels: { ...def.stats },
    boss: newBossState(),
    life: "alive",
    spawnPos: { ...pos },
    diedAtTick: null,
    despawnTick: null,
    respawnTick: null,
  };
}

export function newBossState(): BossState {
  return {
    phaseIndex: 0, phaseStartTick: 0, attackCount: 0, specialCount: 0, switchAttackId: null, switchCount: 0,
    enraged: false, invulnerableUntil: 0, busyUntil: 0, pendingSpecial: null,
  };
}
