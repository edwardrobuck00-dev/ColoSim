import { z } from "zod";

/**
 * How things look. Gameplay definitions refer to visuals by ID only, so art
 * can change without touching game data, and content can ship before art.
 *
 * To use a real model, set `model` on an entity visual. Until it loads (or if
 * it fails to load) the placeholder rig is shown. See docs/adding-art.md.
 */

/** Procedurally built stand-in characters. Each one has named joints that procedural animations move. */
export const PlaceholderRigSchema = z.enum(["humanoid", "brute", "dummy", "shape"]);
export type PlaceholderRig = z.infer<typeof PlaceholderRigSchema>;

export const ModelRefSchema = z.object({
  /** URL of a GLB file, relative to the site root (e.g. "/models/warden.glb"). */
  url: z.string(),
  /** Uniform scale applied after loading. Author models at 1 unit = 1 tile. */
  scale: z.number().positive().default(1),
  /** Rotation around Y (radians) so the model faces +Z (toward the camera's default view = south). */
  rotationY: z.number().default(0),
  yOffset: z.number().default(0),
});
export type ModelRef = z.infer<typeof ModelRefSchema>;

export const VisualDefSchema = z.object({
  id: z.string(),
  placeholder: z.object({
    rig: PlaceholderRigSchema.default("shape"),
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
    accentColor: z.string().regex(/^#[0-9a-f]{6}$/i).default("#222222"),
    /** Emissive glow colour for parts like eyes, runes or embers. */
    glowColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    /** Height in tiles. Width comes from the entity's size. */
    height: z.number().positive().default(1.6),
  }),
  model: ModelRefSchema.optional(),
  /**
   * Maps engine animation cues (e.g. "attack.slash", "walk", "death") to clip
   * names inside the model. Unmapped cues fall back along their dotted name:
   * "attack.slash" -> "attack" -> "idle".
   */
  animations: z.record(z.string(), z.string()).default({}),
});
export type VisualDef = z.infer<typeof VisualDefSchema>;
export type VisualDefInput = z.input<typeof VisualDefSchema>;

export const ProjectileVisualSchema = z.object({
  id: z.string(),
  shape: z.enum(["orb", "arrow", "shard", "rock"]),
  color: z.string(),
  glowColor: z.string(),
  /** Radius (orb/shard) or length (arrow) in tiles. */
  size: z.number().positive(),
  /** Height of the flight arc at its midpoint, in tiles. 0 = straight line. */
  arcHeight: z.number().min(0).default(0),
  trail: z.boolean().default(true),
  spin: z.boolean().default(false),
});
export type ProjectileVisual = z.infer<typeof ProjectileVisualSchema>;
export type ProjectileVisualInput = z.input<typeof ProjectileVisualSchema>;

export const ArenaVisualSchema = z.object({
  id: z.string(),
  floorColor: z.string(),
  floorAltColor: z.string(),
  /** Darker, worn floor colour near the walls. */
  edgeColor: z.string(),
  wallColor: z.string(),
  background: z.string(),
  /** Hemisphere light colours (from above / from below). */
  skyColor: z.string(),
  groundColor: z.string(),
  sunColor: z.string(),
  sunIntensity: z.number().min(0),
  ambientIntensity: z.number().min(0),
  /** What surrounds the floor: a low wooden fence, or tiered stone stands. */
  surround: z.enum(["fence", "stands"]).default("fence"),
  /** How blocked tiles are drawn. */
  obstacle: z.enum(["pillar", "post", "rock"]),
  /** Fire braziers at the corners, with flickering lights. */
  braziers: z.boolean().default(false),
  /** Floating embers drifting up through the air. */
  embers: z.boolean().default(false),
});
export type ArenaVisual = z.infer<typeof ArenaVisualSchema>;
export type ArenaVisualInput = z.input<typeof ArenaVisualSchema>;
