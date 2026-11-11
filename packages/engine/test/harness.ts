import {
  ArenaDefSchema,
  AttackDefSchema,
  ItemDefSchema,
  PrayerDefSchema,
  SpellDefSchema,
  type PrayerDefInput,
  type SpellDefInput,
  type AttackDefInput,
  type ItemDefInput,
  EncounterDefSchema,
  ModifierDefSchema,
  NpcDefSchema,
  createDefaultMechanicRegistry,
  createDefaultSpecialKindRegistry,
  type SpecialKindDefinition,
  createSimulation,
  hashState,
  type ArenaDefInput,
  type ContentRegistry,
  type EncounterDefInput,
  type MechanicDefinition,
  type ModifierDefInput,
  type NpcDefInput,
  type PlayerCommand,
  type SimEvent,
  type SimulationConfigInput,
} from "../src";

/** Minimal content for engine tests, independent of the content package. */
export interface FixtureContent {
  arenas?: ArenaDefInput[];
  npcs?: NpcDefInput[];
  encounters?: EncounterDefInput[];
  modifiers?: ModifierDefInput[];
  attacks?: AttackDefInput[];
  items?: ItemDefInput[];
  prayers?: PrayerDefInput[];
  spells?: SpellDefInput[];
  mechanics?: MechanicDefinition[];
  specialKinds?: SpecialKindDefinition[];
}

export const testArena: ArenaDefInput = {
  id: "test-arena",
  name: "Test Arena",
  width: 12,
  height: 12,
  blocked: [{ x: 5, y: 6 }, { x: 5, y: 7 }, { x: 5, y: 8 }], // off the spawn-to-boss diagonal, so ranged attacks have line of sight
  spawns: { player: { x: 1, y: 1 }, boss: { x: 8, y: 8 } },
};

export const testDummy: NpcDefInput = {
  id: "test-dummy",
  name: "Test Dummy",
  size: 2,
  stats: { hitpoints: 100, attack: 1, strength: 1, defence: 1, ranged: 1, magic: 1, prayer: 1 },
};

export const testEncounter: EncounterDefInput = {
  id: "test-encounter",
  name: "Test Encounter",
  description: "For engine tests.",
  arenaId: "test-arena",
  playerSpawn: "player",
  npcs: [{ npcId: "test-dummy", spawn: "boss" }],
  modifiers: ["exhausting"],
};

export const exhaustingModifier: ModifierDefInput = {
  id: "exhausting",
  name: "Exhausting",
  description: "Run energy drains 10x faster and you lose at 0.",
  mechanics: [
    { id: "scale-resource-rate", params: { pipeline: "runEnergy.drainPerTick", multiplier: 10 } },
    { id: "lose-at-resource-zero", params: { resource: "runEnergy" } },
  ],
};

export function buildTestContent(extra: FixtureContent = {}): ContentRegistry {
  const mechanics = createDefaultMechanicRegistry();
  for (const m of extra.mechanics ?? []) mechanics.register(m);
  const specialKinds = createDefaultSpecialKindRegistry();
  for (const k of extra.specialKinds ?? []) specialKinds.register(k);
  const byId = <T extends { id: string }>(items: T[]) => new Map(items.map((i) => [i.id, i]));
  const arenas = [testArena, ...(extra.arenas ?? [])].map((a) => ArenaDefSchema.parse(a));
  const npcs = [testDummy, ...(extra.npcs ?? [])].map((n) => NpcDefSchema.parse(n));
  const encounters = [testEncounter, ...(extra.encounters ?? [])].map((e) => EncounterDefSchema.parse(e));
  const modifiers = [exhaustingModifier, ...(extra.modifiers ?? [])].map((m) => ModifierDefSchema.parse(m));
  const attacks = (extra.attacks ?? []).map((a) => AttackDefSchema.parse(a));
  const items = (extra.items ?? []).map((i) => ItemDefSchema.parse(i));
  const prayers = (extra.prayers ?? []).map((x) => PrayerDefSchema.parse(x));
  const spells = (extra.spells ?? []).map((x) => SpellDefSchema.parse(x));
  return {
    prayers: byId(prayers),
    spells: byId(spells),
    items: byId(items),
    attacks: byId(attacks),
    arenas: byId(arenas),
    npcs: byId(npcs),
    encounters: byId(encounters),
    modifiers: byId(modifiers),
    mechanics,
    specialKinds,
    contentHash: hashState({ arenas, npcs, encounters, modifiers, attacks, items, prayers, spells }),
  };
}

/** Fluent scenario runner for mechanic and system tests. */
export function scenario(config: Partial<SimulationConfigInput> = {}, content = buildTestContent()) {
  const sim = createSimulation({ seed: 1, encounterId: "test-encounter", ...config }, content);
  const events: SimEvent[] = [...sim.getInitialEvents()];
  return {
    sim,
    events,
    command(cmd: PlayerCommand) {
      sim.queueCommand(cmd);
      return this;
    },
    runTicks(n: number) {
      for (let i = 0; i < n; i++) events.push(...sim.tick().events);
      return this;
    },
    get snapshot() {
      return sim.getSnapshot();
    },
  };
}
