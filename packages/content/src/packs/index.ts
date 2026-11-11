import { ashenWardenPack } from "../encounters/ashen-warden";
import { trainingGroundsPack } from "../encounters/training-grounds";
import { osrsBasePack } from "./osrs-base";
import type { ContentPack } from "./types";

/**
 * Every content pack the game loads, in order. To add a boss, create its
 * folder under src/encounters (pnpm new:boss scaffolds one) and list its pack here.
 */
export const CONTENT_PACKS: ContentPack[] = [osrsBasePack, trainingGroundsPack, ashenWardenPack];

export { mergePacks, type MergedContent, type PackSummary, type Provenance } from "./merge";
export type { ContentKind, ContentPack } from "./types";
