import {
  ArenaDefSchema,
  AttackDefSchema,
  EncounterDefSchema,
  ItemDefSchema,
  PrayerDefSchema,
  SpellDefSchema,
  type PrayerDefInput,
  type SpellDefInput,
  ModifierDefSchema,
  NpcDefSchema,
  createDefaultMechanicRegistry,
  createDefaultSpecialKindRegistry,
  npcAttackRefs,
  phaseAttackIds,
  hashState,
  type ArenaDefInput,
  type ContentRegistry,
  type ItemDefInput,
  type MechanicRef,
  type MechanicRegistry,
} from "@sim/engine";
import type { z } from "zod";
import type { EncounterBundle } from "./encounters/types";

export class ContentValidationError extends Error {
  override name = "ContentValidationError";
  constructor(readonly issues: string[]) {
    super(`Content failed validation with ${issues.length} issue(s):\n  - ${issues.join("\n  - ")}`);
  }
}

export interface RawContent {
  items: ItemDefInput[];
  prayers: PrayerDefInput[];
  spells: SpellDefInput[];
  arenas: ArenaDefInput[];
  encounters: EncounterBundle[];
}

/**
 * Validates every definition, resolves every cross-reference and registers
 * content mechanics. Collects all problems before throwing, so authors see
 * every mistake at once.
 */
export function buildRegistry(raw: RawContent): ContentRegistry {
  const issues: string[] = [];
  const mechanics: MechanicRegistry = createDefaultMechanicRegistry();

  function parseAll<S extends z.ZodType>(kind: string, schema: S, inputs: unknown[]): Map<string, z.infer<S>> {
    const out = new Map<string, z.infer<S>>();
    for (const input of inputs) {
      const id = (input as { id?: unknown }).id ?? "<missing id>";
      const result = schema.safeParse(input);
      if (!result.success) {
        for (const issue of result.error.issues) {
          issues.push(`${kind} "${String(id)}": ${issue.path.join(".") || "(root)"}: ${issue.message}`);
        }
        continue;
      }
      const def = result.data as { id: string };
      if (out.has(def.id)) issues.push(`${kind} "${def.id}" is defined more than once`);
      out.set(def.id, result.data);
    }
    return out;
  }

  const specialKinds = createDefaultSpecialKindRegistry();
  for (const bundle of raw.encounters) {
    for (const k of bundle.specialKinds ?? []) {
      try {
        specialKinds.register(k);
      } catch (e) {
        issues.push((e as Error).message);
      }
    }
    for (const m of bundle.mechanics) {
      try {
        mechanics.register(m);
      } catch (e) {
        issues.push((e as Error).message);
      }
    }
  }

  const items = parseAll("item", ItemDefSchema, raw.items);
  const prayers = parseAll("prayer", PrayerDefSchema, raw.prayers);
  const spells = parseAll("spell", SpellDefSchema, raw.spells);
  const arenas = parseAll("arena", ArenaDefSchema, raw.arenas);
  const npcs = parseAll("npc", NpcDefSchema, raw.encounters.flatMap((b) => b.npcs));
  const attacks = parseAll("attack", AttackDefSchema, raw.encounters.flatMap((b) => b.attacks));
  const modifiers = parseAll("modifier", ModifierDefSchema, raw.encounters.flatMap((b) => b.modifiers));
  const encounters = parseAll("encounter", EncounterDefSchema, raw.encounters.map((b) => b.encounter));

  const checkMechanics = (owner: string, refs: MechanicRef[]) => {
    for (const ref of refs) {
      try {
        mechanics.validate(ref);
      } catch (e) {
        issues.push(`${owner}: ${(e as Error).message}`);
      }
    }
  };

  for (const arena of arenas.values()) {
    for (const [name, t] of Object.entries(arena.spawns)) {
      if (t.x < 0 || t.y < 0 || t.x >= arena.width || t.y >= arena.height) {
        issues.push(`arena "${arena.id}": spawn "${name}" is outside the arena`);
      }
      if (arena.blocked.some((b) => b.x === t.x && b.y === t.y)) {
        issues.push(`arena "${arena.id}": spawn "${name}" is on a blocked tile`);
      }
    }
  }
  for (const npc of npcs.values()) {
    checkMechanics(`npc "${npc.id}"`, npc.mechanics);
    for (const a of npcAttackRefs(npc, specialKinds)) if (!attacks.has(a)) issues.push(`npc "${npc.id}": unknown attack "${a}"`);
    const specialIds = new Set(npc.specials.map((s) => s.id));
    for (const sp of npc.specials) {
      try {
        specialKinds.validate(sp.kind, sp.params);
      } catch (e) {
        issues.push(`npc "${npc.id}" special "${sp.id}": ${(e as Error).message}`);
      }
    }
    const phases = npc.behaviour?.phases ?? [];
    let lastThreshold = 101;
    for (const [i, phase] of phases.entries()) {
      const where = `npc "${npc.id}" phase "${phase.id}"`;
      for (const id of phase.specials?.ids ?? []) if (!specialIds.has(id)) issues.push(`${where}: unknown special "${id}"`);
      if (phase.onEnter.special && !specialIds.has(phase.onEnter.special)) issues.push(`${where}: unknown special "${phase.onEnter.special}"`);
      if (phaseAttackIds(phase).length === 0 && phase.movement === "chase") issues.push(`${where}: chases but has no attacks`);
      if (i > 0) {
        if (phase.atHpPercent === undefined) issues.push(`${where}: needs atHpPercent (only the first phase may omit it)`);
        else if (phase.atHpPercent >= lastThreshold) issues.push(`${where}: atHpPercent must be lower than the previous phase's`);
        else lastThreshold = phase.atHpPercent;
      }
    }
  }
  for (const item of items.values()) {
    if (item.weapon && item.slot !== "weapon") issues.push(`item "${item.id}": has weapon stats but slot "${item.slot}"`);
  }
  for (const mod of modifiers.values()) checkMechanics(`modifier "${mod.id}"`, mod.mechanics);

  for (const enc of encounters.values()) {
    const where = `encounter "${enc.id}"`;
    const arena = arenas.get(enc.arenaId);
    if (!arena) issues.push(`${where}: unknown arena "${enc.arenaId}"`);
    if (arena && !arena.spawns[enc.playerSpawn]) issues.push(`${where}: arena has no spawn "${enc.playerSpawn}"`);
    for (const s of enc.npcs) {
      if (!npcs.has(s.npcId)) issues.push(`${where}: unknown npc "${s.npcId}"`);
      if (arena && !arena.spawns[s.spawn]) issues.push(`${where}: arena has no spawn "${s.spawn}"`);
      for (const phase of npcs.get(s.npcId)?.behaviour?.phases ?? []) {
        const to = phase.onEnter.moveTo;
        if (to && arena && !arena.spawns[to]) issues.push(`${where}: npc "${s.npcId}" phase "${phase.id}" moves to unknown spawn "${to}"`);
      }
    }
    for (const m of enc.modifiers) if (!modifiers.has(m)) issues.push(`${where}: unknown modifier "${m}"`);
    checkMechanics(where, enc.mechanics);
  }

  if (issues.length > 0) throw new ContentValidationError(issues);

  const contentHash = hashState({
    items: [...items.values()],
    prayers: [...prayers.values()],
    spells: [...spells.values()],
    arenas: [...arenas.values()],
    npcs: [...npcs.values()],
    attacks: [...attacks.values()],
    modifiers: [...modifiers.values()],
    encounters: [...encounters.values()],
    mechanics: mechanics.list().map((m) => m.id),
    specialKinds: specialKinds.list().map((k) => k.id),
  });

  return { items, prayers, spells, arenas, npcs, attacks, modifiers, encounters, specialKinds, mechanics, contentHash };
}
