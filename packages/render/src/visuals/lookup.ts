/**
 * Maps an entity to its visual ID. Supplied by the app (which knows the content
 * registry), so the renderer never imports game data.
 */
export type VisualLookup = (entity: { kind: "player" | "npc"; defId: string | null }) => string | null;
