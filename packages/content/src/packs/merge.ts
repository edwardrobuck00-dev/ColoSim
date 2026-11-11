import type { ArenaDefInput, ItemDefInput, PrayerDefInput, SpellDefInput } from "@sim/engine";
import type { EncounterBundle } from "../encounters/types";
import type { LoadoutPreset } from "../loadouts/starter";
import type { RawContent } from "../registry";
import type { ContentKind, ContentPack } from "./types";

/** Which pack defined each piece of content, keyed "kind:id" (for example "item:abyssal-whip"). */
export type Provenance = ReadonlyMap<string, string>;

export interface PackSummary {
  id: string;
  name: string;
  version: string;
  counts: Partial<Record<ContentKind, number>>;
}

export interface MergedContent {
  raw: RawContent;
  loadouts: LoadoutPreset[];
  provenance: Provenance;
  packs: PackSummary[];
  /** Cross-pack problems: duplicate IDs, duplicate or missing packs. Empty when the packs fit together. */
  issues: string[];
}

const PACK_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Combines packs into one set of raw definitions for buildRegistry, recording
 * where each definition came from. Problems that only show up across packs
 * are collected rather than thrown, so validation can report everything at once.
 */
export function mergePacks(packs: readonly ContentPack[]): MergedContent {
  const issues: string[] = [];
  const provenance = new Map<string, string>();
  const raw: RawContent = { items: [], prayers: [], spells: [], arenas: [], encounters: [] };
  const loadouts: LoadoutPreset[] = [];
  const summaries: PackSummary[] = [];
  const seenPacks = new Set<string>();

  const claim = (kind: ContentKind, id: string, pack: string, counts: PackSummary["counts"]) => {
    const key = `${kind}:${id}`;
    const owner = provenance.get(key);
    if (owner !== undefined && owner !== pack) issues.push(`${kind} "${id}" is defined in both pack "${owner}" and pack "${pack}"`);
    else if (owner === undefined) provenance.set(key, pack);
    counts[kind] = (counts[kind] ?? 0) + 1;
  };
  const idOf = (d: unknown) => String((d as { id?: unknown }).id ?? "<missing id>");

  for (const pack of packs) {
    if (!PACK_ID.test(pack.id)) issues.push(`pack "${pack.id}": ID must be kebab-case`);
    if (seenPacks.has(pack.id)) {
      issues.push(`pack "${pack.id}" is listed more than once`);
      continue;
    }
    seenPacks.add(pack.id);
    const counts: PackSummary["counts"] = {};
    const add = <T>(kind: ContentKind, list: T[] | undefined, into: T[]) => {
      for (const d of list ?? []) {
        claim(kind, idOf(d), pack.id, counts);
        into.push(d);
      }
    };
    add<ItemDefInput>("item", pack.items, raw.items);
    add<PrayerDefInput>("prayer", pack.prayers, raw.prayers);
    add<SpellDefInput>("spell", pack.spells, raw.spells);
    add<ArenaDefInput>("arena", pack.arenas, raw.arenas);
    add<LoadoutPreset>("loadout", pack.loadouts, loadouts);
    for (const b of pack.encounters ?? []) {
      claim("encounter", idOf(b.encounter), pack.id, counts);
      for (const n of b.npcs) claim("npc", idOf(n), pack.id, counts);
      for (const a of b.attacks) claim("attack", idOf(a), pack.id, counts);
      for (const m of b.modifiers) claim("modifier", idOf(m), pack.id, counts);
      for (const m of b.mechanics) claim("mechanic", m.id, pack.id, counts);
      for (const k of b.specialKinds ?? []) claim("special-kind", k.id, pack.id, counts);
      raw.encounters.push(b as EncounterBundle);
    }
    summaries.push({ id: pack.id, name: pack.name, version: pack.version, counts });
  }
  for (const pack of packs) {
    for (const dep of pack.requires ?? []) if (!seenPacks.has(dep)) issues.push(`pack "${pack.id}" requires pack "${dep}", which is not loaded`);
  }
  return { raw, loadouts, provenance, packs: summaries, issues };
}
