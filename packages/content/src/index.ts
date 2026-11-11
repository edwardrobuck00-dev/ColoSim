import type { ContentRegistry } from "@sim/engine";
import { CONTENT_PACKS, mergePacks, type MergedContent } from "./packs";
import { buildRegistry, ContentValidationError } from "./registry";

export { buildRegistry, ContentValidationError, type RawContent } from "./registry";
export { STARTER_LOADOUTS, type LoadoutPreset } from "./loadouts/starter";
export { ENCOUNTER_BUNDLES, type EncounterBundle } from "./encounters";
export { CONTENT_PACKS, mergePacks, type ContentKind, type ContentPack, type MergedContent, type PackSummary, type Provenance } from "./packs";
export { searchItems, itemClass, type ItemQuery, type ItemClass } from "./search";

/**
 * Merges packs and builds a validated registry. Cross-pack problems and
 * definition problems are reported together in one ContentValidationError.
 */
export function buildFromPacks(packs: MergedContent | Parameters<typeof mergePacks>[0]): { registry: ContentRegistry; merged: MergedContent } {
  const merged = "raw" in packs ? packs : mergePacks(packs);
  let registry: ContentRegistry;
  try {
    registry = buildRegistry(merged.raw);
  } catch (e) {
    if (e instanceof ContentValidationError) throw new ContentValidationError([...merged.issues, ...e.issues]);
    throw e;
  }
  if (merged.issues.length) throw new ContentValidationError(merged.issues);
  return { registry, merged };
}

let cached: { registry: ContentRegistry; merged: MergedContent } | null = null;
const load = () => (cached ??= buildFromPacks(CONTENT_PACKS));

/** The game's full, validated content. Built once and cached. */
export function getContentRegistry(): ContentRegistry {
  return load().registry;
}

/** Which pack each definition came from, and a summary of every loaded pack. */
export function getContentPacks(): { packs: MergedContent["packs"]; provenance: MergedContent["provenance"] } {
  const { merged } = load();
  return { packs: merged.packs, provenance: merged.provenance };
}
