import type { MechanicRegistry } from "../mechanics/registry";
import type { SpecialKindRegistry } from "../npc/specials";
import type { ArenaDef } from "./arena";
import type { AttackDef } from "./attack";
import type { EncounterDef } from "./encounter";
import type { ItemDef } from "./item";
import type { ModifierDef } from "./modifier";
import type { NpcDef } from "./npc";
import type { PrayerDef } from "./prayer";
import type { SpellDef } from "./spell";

/** Validated, cross-referenced game data. Built by the content package; consumed by the engine. */
export interface ContentRegistry {
  readonly items: ReadonlyMap<string, ItemDef>;
  readonly npcs: ReadonlyMap<string, NpcDef>;
  readonly attacks: ReadonlyMap<string, AttackDef>;
  readonly prayers: ReadonlyMap<string, PrayerDef>;
  readonly spells: ReadonlyMap<string, SpellDef>;
  readonly arenas: ReadonlyMap<string, ArenaDef>;
  readonly encounters: ReadonlyMap<string, EncounterDef>;
  readonly modifiers: ReadonlyMap<string, ModifierDef>;
  readonly mechanics: MechanicRegistry;
  /** Boss special attack kinds (built-in plus content-registered). */
  readonly specialKinds: SpecialKindRegistry;
  /** Stable hash of all definitions, stored in replays. */
  readonly contentHash: string;
}
