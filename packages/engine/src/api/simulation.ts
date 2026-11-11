import { npcAttackRefs } from "../npc/behaviour";
import { RngStreams } from "../core/rng";
import { clonePlain } from "../util/clone";
import { Scheduler } from "../core/scheduler";
import { hashState } from "../core/state-hash";
import { TICK_PIPELINE } from "../core/tick-pipeline";
import { ENGINE_VERSION } from "../core/version";
import type { World } from "../core/world";
import { mechanicContext } from "../mechanics/runtime";
import type { ContentRegistry } from "../defs/registry";
import { createNpc, createPlayer } from "../entities/factory";
import { Grid } from "../map/grid";
import { PipelineRegistry } from "../mechanics/pipelines";
import { totalBonuses } from "../player/equipment";
import { weaponFromItem } from "../player/weapon";
import { combatStyles } from "../combat/weapon-categories";
import { INVENTORY_SIZE, defaultQuantity, missingRequirements } from "../player/inventory";
import type { EquipmentSlot } from "../defs/item";
import type { ItemStack } from "../entities/types";
import type { SetupItem } from "./config";
import type { ItemDef } from "../defs/item";
import type { ActiveMechanic } from "../mechanics/registry";
import { CHECKPOINT_INTERVAL, type Checkpoint, type InputLog, type Replay } from "../replay/input-log";
import { PlayerCommandSchema, type PlayerCommand } from "./commands";
import { SimulationConfigSchema, type SimulationConfig, type SimulationConfigInput } from "./config";
import type { EncounterOutcome, SimEvent } from "./events";
import { buildSnapshot } from "./snapshot-builder";
import type { WorldSnapshot } from "./snapshot";

export class SimulationSetupError extends Error {
  override name = "SimulationSetupError";
}

export interface TickResult {
  tick: number;
  snapshot: WorldSnapshot;
  events: SimEvent[];
  outcome: EncounterOutcome | null;
  /** Player commands applied at the start of this tick (the inputs a replay stores). */
  commands: PlayerCommand[];
  /** Hash of the full simulation state after this tick (see getStateHash). */
  hash: string;
}

/** The engine's only public entry point. Hosts call `tick()` every TICK_MS. */
export interface Simulation {
  readonly config: SimulationConfig;
  queueCommand(command: PlayerCommand): void;
  tick(): TickResult;
  getSnapshot(): WorldSnapshot;
  getInputLog(): InputLog;
  getStateHash(): string;
  /** Events produced before the first tick (spawns, start messages). */
  getInitialEvents(): SimEvent[];
  toReplay(): Replay;
}

export function createSimulation(configInput: SimulationConfigInput, content: ContentRegistry): Simulation {
  const config = SimulationConfigSchema.parse(configInput);
  const world = buildWorld(config, content);
  const inputLog: InputLog = [];
  const checkpoints: Checkpoint[] = [];

  // Start-of-encounter events and hooks run before tick 1.
  world.events.push({ type: "EncounterStarted", encounterId: config.encounterId, modifierIds: [...config.modifierIds] });
  world.events.push({ type: "EntitySpawned", entityId: world.player.id, kind: "player", defId: null, pos: { ...world.player.pos }, size: 1 });
  for (const n of world.npcs) {
    world.events.push({ type: "EntitySpawned", entityId: n.id, kind: "npc", defId: n.defId, pos: { ...n.pos }, size: n.size });
  }
  for (const m of world.mechanics) m.instance.hooks?.onEncounterStart?.(mechanicContext(world, m.id));
  const initialEvents = world.events;
  world.events = [];

  const stateHash = () =>
    hashState({
      tick: world.tick,
      player: world.player,
      npcs: world.npcs,
      rng: world.rng.getState(),
      scheduler: world.scheduler.serialize(),
      outcome: world.outcome,
      nextId: world.nextId,
      hazards: world.hazards,
    });

  return {
    config,
    queueCommand(command) {
      if (world.outcome) return;
      world.pendingCommands.push(PlayerCommandSchema.parse(command));
    },
    tick() {
      if (world.outcome) {
        return { tick: world.tick, snapshot: buildSnapshot(world, config.seed), events: [], outcome: world.outcome, commands: [], hash: stateHash() };
      }
      world.tick += 1;
      world.events = [];
      const commands = world.pendingCommands.map((c) => clonePlain(c));
      if (commands.length > 0) inputLog.push({ tick: world.tick, commands: commands.map((c) => clonePlain(c)) });
      for (const [, system] of TICK_PIPELINE) system(world);
      if (world.tick % CHECKPOINT_INTERVAL === 0) checkpoints.push({ tick: world.tick, hash: stateHash() });
      const events = world.events;
      world.events = [];
      return { tick: world.tick, snapshot: buildSnapshot(world, config.seed), events, outcome: world.outcome, commands, hash: stateHash() };
    },
    getSnapshot: () => buildSnapshot(world, config.seed),
    getInputLog: () => clonePlain(inputLog),
    getStateHash: stateHash,
    getInitialEvents: () => clonePlain(initialEvents),
    toReplay: () => ({
      format: 1,
      engineVersion: ENGINE_VERSION,
      contentHash: content.contentHash,
      config: clonePlain(config),
      inputLog: clonePlain(inputLog),
      checkpoints: [...checkpoints, { tick: world.tick, hash: stateHash() }],
      durationTicks: world.tick,
      outcome: world.outcome ? { ...world.outcome } : null,
    }),
  };
}

function buildWorld(config: SimulationConfig, content: ContentRegistry): World {
  const encounter = content.encounters.get(config.encounterId);
  if (!encounter) throw new SimulationSetupError(`Unknown encounter "${config.encounterId}"`);
  const arena = content.arenas.get(encounter.arenaId);
  if (!arena) throw new SimulationSetupError(`Unknown arena "${encounter.arenaId}"`);

  const spawnPoint = (name: string) => {
    const t = arena.spawns[name];
    if (!t) throw new SimulationSetupError(`Arena "${arena.id}" has no spawn point "${name}"`);
    return t;
  };

  const npcs = encounter.npcs.map((s, i) => {
    const def = content.npcs.get(s.npcId);
    if (!def) throw new SimulationSetupError(`Unknown NPC "${s.npcId}"`);
    return createNpc(`npc-${i + 1}`, def, spawnPoint(s.spawn));
  });

  for (const s of encounter.npcs) {
    const def = content.npcs.get(s.npcId);
    for (const attackId of def ? npcAttackRefs(def, content.specialKinds) : []) {
      if (!content.attacks.has(attackId)) throw new SimulationSetupError(`Unknown attack "${attackId}"`);
    }
  }

  const setup = config.player;
  const toStack = (entry: SetupItem, where: string): ItemStack => {
    const itemId = typeof entry === "string" ? entry : entry.itemId;
    const item = content.items.get(itemId);
    if (!item) throw new SimulationSetupError(`Unknown item "${itemId}" in ${where}`);
    return { itemId, quantity: typeof entry === "string" ? defaultQuantity(item) : entry.quantity };
  };
  const equipment: Partial<Record<EquipmentSlot, ItemStack>> = {};
  const equipped: ItemDef[] = [];
  for (const [slot, entry] of Object.entries(setup.equipment)) {
    const stack = toStack(entry, `slot "${slot}"`);
    const item = content.items.get(stack.itemId)!;
    if (item.slot !== slot) throw new SimulationSetupError(`Item "${stack.itemId}" cannot be worn in slot "${slot}"`);
    const missing = missingRequirements(setup.stats, item);
    if (missing.length) throw new SimulationSetupError(`${item.name} requires ${missing.join(", ")}`);
    equipment[slot as EquipmentSlot] = stack;
    equipped.push(item);
  }
  if (equipped.some((i) => i.weapon?.twoHanded) && equipment.shield) {
    throw new SimulationSetupError("A two-handed weapon cannot be worn with a shield");
  }
  const inventory: Array<ItemStack | null> = Array.from({ length: INVENTORY_SIZE }, (_, i) => {
    const entry = setup.inventory[i];
    return entry ? toStack(entry, `inventory slot ${i}`) : null;
  });
  const weapon = weaponFromItem(equipped.find((i) => i.slot === "weapon"));
  if (setup.combatStyle >= combatStyles(weapon.category).length) {
    throw new SimulationSetupError(`Combat style ${setup.combatStyle} does not exist for a ${weapon.category} weapon`);
  }
  for (const id of setup.prayers) {
    if (!content.prayers.has(id)) throw new SimulationSetupError(`Unknown prayer "${id}"`);
  }
  if (setup.autocastSpellId && !content.spells.has(setup.autocastSpellId)) {
    throw new SimulationSetupError(`Unknown spell "${setup.autocastSpellId}"`);
  }

  const mechanicRefs = [
    ...encounter.mechanics,
    ...encounter.npcs.flatMap((s) => content.npcs.get(s.npcId)!.mechanics),
    ...config.modifierIds.flatMap((id) => {
      if (!encounter.modifiers.includes(id)) {
        throw new SimulationSetupError(`Modifier "${id}" is not available for encounter "${encounter.id}"`);
      }
      const mod = content.modifiers.get(id);
      if (!mod) throw new SimulationSetupError(`Unknown modifier "${id}"`);
      return mod.mechanics;
    }),
  ];
  const mechanics: ActiveMechanic[] = mechanicRefs.map((ref) => content.mechanics.instantiate(ref));
  const pipelines = new PipelineRegistry();
  for (const m of mechanics) for (const step of m.instance.pipelines ?? []) pipelines.add(step);

  return {
    tick: 0,
    content,
    encounter,
    modifierIds: [...config.modifierIds],
    arena,
    grid: Grid.fromArena(arena),
    rng: new RngStreams(config.seed),
    scheduler: new Scheduler(),
    pipelines,
    mechanics,
    player: createPlayer({
      pos: spawnPoint(encounter.playerSpawn),
      stats: setup.stats,
      bonuses: totalBonuses(equipped),
      weapon,
      combatStyleIndex: setup.combatStyle,
      prayers: setup.prayers,
      preserveActive: setup.prayers.some((id) => content.prayers.get(id)?.utility === "preserve"),
      autocastSpellId: setup.autocastSpellId,
      autoRetaliate: setup.autoRetaliate,
      equipment,
      inventory,
    }),
    npcs,
    pendingCommands: [],
    events: [],
    outcome: null,
    nextId: 0,
    hazards: [],
  };
}
