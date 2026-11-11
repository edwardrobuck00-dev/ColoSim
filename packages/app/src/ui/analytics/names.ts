import type { NameLookup, WorldSnapshot } from "@sim/engine";
import { content } from "../../services/content";

/** Display names for explanations: NPCs from the snapshot, everything else from content. */
export function nameLookup(snapshot: WorldSnapshot | null): NameLookup {
  return {
    entity: (id) => (id === "player" ? "You" : (snapshot?.npcs.find((n) => n.id === id)?.name ?? id)),
    attack: (id) => content.attacks.get(id)?.name ?? content.items.get(id)?.name ?? content.spells.get(id)?.name
      ?? snapshot?.npcs.map((n) => content.npcs.get(n.defId)?.specials.find((s) => s.id === id)?.name).find(Boolean) ?? id,
    item: (id) => content.items.get(id)?.name ?? id,
    prayer: (id) => content.prayers.get(id)?.name ?? id,
  };
}
