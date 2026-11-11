import type { ArenaDefInput } from "./arena";
import type { AttackDefInput } from "./attack";
import type { EncounterDefInput } from "./encounter";
import type { ItemDefInput } from "./item";
import type { ModifierDefInput } from "./modifier";
import type { NpcDefInput } from "./npc";
import type { PrayerDefInput } from "./prayer";
import type { SpellDefInput } from "./spell";

/**
 * Typed identity helpers for authoring content. They give autocomplete and
 * type errors at the call site; full validation (defaults, references,
 * mechanic params) happens once, when the content registry is built.
 */
export const defineItem = (def: ItemDefInput): ItemDefInput => def;
export const defineNpc = (def: NpcDefInput): NpcDefInput => def;
export const defineArena = (def: ArenaDefInput): ArenaDefInput => def;
export const defineEncounter = (def: EncounterDefInput): EncounterDefInput => def;
export const defineModifier = (def: ModifierDefInput): ModifierDefInput => def;
export const defineAttack = (def: AttackDefInput): AttackDefInput => def;
export const definePrayer = (def: PrayerDefInput): PrayerDefInput => def;
export const defineSpell = (def: SpellDefInput): SpellDefInput => def;
