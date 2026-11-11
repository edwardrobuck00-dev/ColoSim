import type { AttackDefInput, EncounterDefInput, MechanicDefinition, ModifierDefInput, NpcDefInput, SpecialKindDefinition } from "@sim/engine";

/** Everything one encounter contributes to the registry. Each boss folder exports one. */
export interface EncounterBundle {
  encounter: EncounterDefInput;
  npcs: NpcDefInput[];
  attacks: AttackDefInput[];
  modifiers: ModifierDefInput[];
  // Each mechanic has its own params schema, so the list is heterogeneous.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mechanics: MechanicDefinition<any>[];
  /** Custom special attack kinds this encounter adds (most bosses only use the built-in ones). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  specialKinds?: SpecialKindDefinition<any>[];
}
