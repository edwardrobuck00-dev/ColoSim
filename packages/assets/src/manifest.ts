import {
  ArenaVisualSchema,
  ProjectileVisualSchema,
  VisualDefSchema,
  type ArenaVisual,
  type ArenaVisualInput,
  type ProjectileVisual,
  type ProjectileVisualInput,
  type VisualDef,
  type VisualDefInput,
} from "./visual-def";

// All visuals are original designs built from primitives at runtime.
//
// Colour language (keep consistent so reactions transfer between fights):
//   magic attacks   blue / violet glowing orbs
//   ranged attacks  green projectiles (arrows, thrown rocks)
//   melee           red: the attacker's weapon swing and red hitsplats
//   fire            orange (player fire spells, braziers)

const entityVisuals: VisualDefInput[] = [
  { id: "player", placeholder: { rig: "humanoid", color: "#6b5a3a", accentColor: "#d9a77a", height: 1.75 } },
  { id: "npc.training-dummy", placeholder: { rig: "dummy", color: "#b08850", accentColor: "#d9c38f", height: 1.6 } },
  {
    id: "npc.ashen-warden",
    placeholder: { rig: "brute", color: "#4a3a34", accentColor: "#8a7a6a", glowColor: "#ff8a2a", height: 3.6 },
  },
];

const projectileVisuals: ProjectileVisualInput[] = [
  { id: "projectile.arrow", shape: "arrow", color: "#d9c9a3", glowColor: "#fff3d0", size: 0.7, arcHeight: 0.6, trail: false },
  { id: "projectile.bolt", shape: "arrow", color: "#8a8f99", glowColor: "#e6ecf5", size: 0.5, arcHeight: 0.15, trail: false },
  { id: "projectile.arcane-bolt", shape: "orb", color: "#9fd4ff", glowColor: "#4aa8ff", size: 0.22, arcHeight: 0.2, spin: true },
  { id: "projectile.fire-bolt", shape: "shard", color: "#ffd08a", glowColor: "#ff5a14", size: 0.3, arcHeight: 0.3, spin: true },
  // The Ashen Warden: magic is a blue-violet orb, ranged a green lobbed rock.
  { id: "projectile.warden-magic", shape: "orb", color: "#c9b8ff", glowColor: "#6a4aff", size: 0.32, arcHeight: 0.4, spin: true },
  { id: "projectile.warden-ranged", shape: "rock", color: "#5fbf3a", glowColor: "#2f8f1a", size: 0.3, arcHeight: 2.2, spin: true, trail: false },
];

const arenaVisuals: ArenaVisualInput[] = [
  {
    id: "arena.training-yard",
    floorColor: "#5f7a34", floorAltColor: "#6e8a3c", edgeColor: "#6b5a3a",
    wallColor: "#7a5a36", background: "#8fb3d9",
    skyColor: "#ffffff", groundColor: "#5a6a3a", sunColor: "#fff6e0", sunIntensity: 1.6, ambientIntensity: 1.5,
    obstacle: "post", surround: "fence",
  },
  {
    id: "arena.cinder-hall",
    floorColor: "#b8935a", floorAltColor: "#93703f", edgeColor: "#6e5232",
    wallColor: "#9a8262", background: "#2a1d14",
    skyColor: "#fff2dc", groundColor: "#5a4030", sunColor: "#ffe2b8", sunIntensity: 1.4, ambientIntensity: 1.3,
    obstacle: "pillar", surround: "stands", braziers: true, embers: true,
  },
];

export const FALLBACK_VISUAL: VisualDef = VisualDefSchema.parse({
  id: "fallback",
  placeholder: { rig: "shape", color: "#ff00ff", height: 1 },
});

export const FALLBACK_PROJECTILE: ProjectileVisual = ProjectileVisualSchema.parse({
  id: "fallback", shape: "orb", color: "#ff00ff", glowColor: "#ff00ff", size: 0.2,
});

export const FALLBACK_ARENA: ArenaVisual = ArenaVisualSchema.parse({
  id: "fallback",
  floorColor: "#555555", floorAltColor: "#4d4d4d", edgeColor: "#333333", wallColor: "#333333", background: "#111111",
  skyColor: "#ffffff", groundColor: "#444444", sunColor: "#ffffff", sunIntensity: 1.5, ambientIntensity: 0.8,
  obstacle: "rock",
});

const index = <T extends { id: string }>(items: T[]): ReadonlyMap<string, T> => new Map(items.map((v) => [v.id, v]));

export const VISUALS = index(entityVisuals.map((v) => VisualDefSchema.parse(v)));
export const PROJECTILE_VISUALS = index(projectileVisuals.map((v) => ProjectileVisualSchema.parse(v)));
export const ARENA_VISUALS = index(arenaVisuals.map((v) => ArenaVisualSchema.parse(v)));

/** Never throws: unknown IDs get a bright magenta fallback so they are easy to spot. */
export function resolveVisual(id: string | undefined | null): VisualDef {
  return (id && VISUALS.get(id)) || FALLBACK_VISUAL;
}

export function resolveProjectileVisual(id: string | undefined | null): ProjectileVisual {
  return (id && PROJECTILE_VISUALS.get(id)) || FALLBACK_PROJECTILE;
}

export function resolveArenaVisual(id: string | undefined | null): ArenaVisual {
  return (id && ARENA_VISUALS.get(id)) || FALLBACK_ARENA;
}

export function hasVisual(id: string): boolean {
  return VISUALS.has(id) || ARENA_VISUALS.has(id) || PROJECTILE_VISUALS.has(id);
}
