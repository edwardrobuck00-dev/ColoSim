import type { ArenaDefInput, ItemDefInput, PrayerDefInput, SpellDefInput } from "@sim/engine";
import type { EncounterBundle } from "../encounters/types";
import type { LoadoutPreset } from "../loadouts/starter";

/**
 * A self-contained unit of game content. The game's content is the merge of
 * every pack in CONTENT_PACKS (packs/index.ts). A new boss is one folder that
 * exports one pack (its encounter, NPCs, attacks, modifiers, mechanics and
 * arena) plus one line in that list; a batch of new items can be its own pack
 * too. IDs are global: two packs may not define the same item, arena, NPC and
 * so on, and the merge reports which packs clash.
 */
export interface ContentPack {
  /** Stable kebab-case ID, used in provenance and error messages. */
  id: string;
  name: string;
  /** Semver of the pack's content; bump when definitions change. */
  version: string;
  description?: string;
  /** IDs of packs this one references (for example an arena or items from another pack). */
  requires?: string[];
  items?: ItemDefInput[];
  prayers?: PrayerDefInput[];
  spells?: SpellDefInput[];
  arenas?: ArenaDefInput[];
  encounters?: EncounterBundle[];
  loadouts?: LoadoutPreset[];
}

/** Every kind of definition a pack can hold, as named in provenance. */
export type ContentKind = "item" | "prayer" | "spell" | "arena" | "encounter" | "npc" | "attack" | "modifier" | "mechanic" | "special-kind" | "loadout";
