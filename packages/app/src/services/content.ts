import { getContentRegistry } from "@sim/content";
import type { ContentRegistry } from "@sim/engine";
import type { VisualLookup } from "@sim/render";
import { setLogNames, setProtectionPrayers } from "../state/session-store";

/** The validated content registry, built once at startup. */
export const content: ContentRegistry = getContentRegistry();

// Prayer and spell names for combat log lines.
setProtectionPrayers((id) => !!content.prayers.get(id)?.protects);
setLogNames((id) => content.items.get(id)?.name ?? content.prayers.get(id)?.name ?? content.spells.get(id)?.name ?? id);

/** Maps engine entities to visual IDs, so the renderer never needs game data. */
export function createVisualLookup(registry: ContentRegistry): VisualLookup {
  return ({ kind, defId }) => (kind === "player" ? "player" : (defId && registry.npcs.get(defId)?.visualId) || null);
}

export function arenaVisualIdFor(registry: ContentRegistry, encounterId: string): string | null {
  const enc = registry.encounters.get(encounterId);
  return (enc && registry.arenas.get(enc.arenaId)?.visualId) ?? null;
}
