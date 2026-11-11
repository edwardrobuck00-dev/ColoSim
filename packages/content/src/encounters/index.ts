import { CONTENT_PACKS } from "../packs";
import type { EncounterBundle } from "./types";

/** Every encounter bundle, from all content packs (add bosses in packs/index.ts). */
export const ENCOUNTER_BUNDLES: EncounterBundle[] = CONTENT_PACKS.flatMap((p) => p.encounters ?? []);
export type { EncounterBundle } from "./types";
