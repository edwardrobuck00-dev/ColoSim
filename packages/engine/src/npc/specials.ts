import { z } from "zod";
import type { Rng } from "../core/rng";
import type { Tile } from "../defs/common";
import type { NpcState, PlayerState } from "../entities/types";

/** A telegraphed area attack on tiles. */
export interface HazardSpec {
  name: string;
  tiles: Tile[];
  /** Ticks from now until the tiles detonate (the warning lasts this long). */
  delayTicks: number;
  /** Damage on detonation to a player standing on a marked tile. Not reduced by prayers. */
  damage: [min: number, max: number];
  /** After detonating, the tiles keep burning for this many ticks... */
  lingerTicks: number;
  /** ...dealing this much damage each tick to a player standing on them. */
  lingerDamage: number;
}

/**
 * What a special attack may do. Specials act only through this object, so a
 * new kind never needs to know engine internals.
 */
export interface SpecialContext {
  readonly tick: number;
  readonly npc: Readonly<NpcState>;
  readonly target: Readonly<PlayerState>;
  readonly arena: { width: number; height: number };
  isWalkable(tile: Tile): boolean;
  /** The "ai" RNG stream (deterministic). */
  rng: Rng;
  /** Starts one of the NPC's attack definitions at the target, now or after `delayTicks`. */
  attack(attackId: string, delayTicks?: number): void;
  /** Marks tiles that detonate later. */
  hazard(spec: HazardSpec): void;
  /** Overhead text above the NPC. */
  say(text: string): void;
}

export interface SpecialKindDefinition<S extends z.ZodType = z.ZodType> {
  id: string;
  description: string;
  params: S;
  /** Attack IDs the params refer to, so content validation can check them. */
  attackRefs?(params: z.infer<S>): string[];
  perform(ctx: SpecialContext, params: z.infer<S>): void;
}

export function defineSpecialKind<S extends z.ZodType>(def: SpecialKindDefinition<S>): SpecialKindDefinition<S> {
  return def;
}

export class SpecialKindError extends Error {
  override name = "SpecialKindError";
}

/** Special attack kinds known to the engine, looked up by the `kind` used in data. */
export class SpecialKindRegistry {
  private readonly defs = new Map<string, SpecialKindDefinition>();

  register(def: SpecialKindDefinition): this {
    if (this.defs.has(def.id)) throw new SpecialKindError(`Special kind "${def.id}" is already registered`);
    this.defs.set(def.id, def);
    return this;
  }

  has(id: string): boolean {
    return this.defs.has(id);
  }

  get(id: string): SpecialKindDefinition | undefined {
    return this.defs.get(id);
  }

  list(): SpecialKindDefinition[] {
    return [...this.defs.values()];
  }

  /** Throws SpecialKindError if the kind is unknown or the params are invalid. */
  validate(kind: string, params: unknown): unknown {
    const def = this.defs.get(kind);
    if (!def) throw new SpecialKindError(`Unknown special kind "${kind}"`);
    const parsed = def.params.safeParse(params);
    if (!parsed.success) throw new SpecialKindError(`Invalid params for special kind "${kind}": ${parsed.error.message}`);
    return parsed.data;
  }
}

/* ---------------- Built-in kinds ---------------- */

/**
 * Several attacks in quick succession, each at its own tick offset: for
 * example magic, then ranged two ticks later. Tests tick-precise prayer switching.
 */
export const volleySpecial = defineSpecialKind({
  id: "volley",
  description: "Several attacks at set tick offsets (e.g. magic, then ranged 2 ticks later).",
  params: z.object({
    attacks: z.array(z.object({ attack: z.string(), delayTicks: z.number().int().min(0) })).min(1),
  }),
  attackRefs: (p) => p.attacks.map((a) => a.attack),
  perform: (ctx, p) => {
    for (const a of p.attacks) ctx.attack(a.attack, a.delayTicks);
  },
});

const TileShapeSchema = z.discriminatedUnion("shape", [
  /** A square of tiles centred on the target's tile. radius 0 = just the target's tile. */
  z.object({ shape: z.literal("around-target"), radius: z.number().int().min(0).max(5) }),
  /** A square ring around the NPC's footprint, from `inner` to `outer` tiles out (1 = adjacent). */
  z.object({ shape: z.literal("ring-around-self"), inner: z.number().int().min(1), outer: z.number().int().min(1) }),
  /** Random walkable tiles anywhere in the arena, always including the target's tile. */
  z.object({ shape: z.literal("random-tiles"), count: z.number().int().min(1).max(200) }),
  /** A plus shape through the target's tile, `length` tiles each way. */
  z.object({ shape: z.literal("cross-on-target"), length: z.number().int().min(1).max(30) }),
]);

/** Tiles marked for a few ticks, then they detonate; optionally they keep burning. */
export const tileAoeSpecial = defineSpecialKind({
  id: "tile-aoe",
  description: "Telegraphs tiles; a player still on them when they detonate is hit, and lingering fire burns each tick.",
  params: z.object({
    area: TileShapeSchema,
    delayTicks: z.number().int().min(1).default(3),
    damage: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
    lingerTicks: z.number().int().min(0).default(0),
    lingerDamage: z.number().int().min(0).default(0),
  }),
  perform: (ctx, p) => {
    const tiles = areaTiles(ctx, p.area);
    ctx.hazard({
      name: "area",
      tiles,
      delayTicks: p.delayTicks,
      damage: [Math.min(p.damage[0], p.damage[1]), Math.max(p.damage[0], p.damage[1])],
      lingerTicks: p.lingerTicks,
      lingerDamage: p.lingerDamage,
    });
  },
});

function areaTiles(ctx: SpecialContext, area: z.infer<typeof TileShapeSchema>): Tile[] {
  const inside = (t: Tile) => t.x >= 0 && t.y >= 0 && t.x < ctx.arena.width && t.y < ctx.arena.height && ctx.isWalkable(t);
  const out: Tile[] = [];
  const add = (t: Tile) => {
    if (inside(t) && !out.some((o) => o.x === t.x && o.y === t.y)) out.push(t);
  };
  const tp = ctx.target.pos;
  switch (area.shape) {
    case "around-target":
      for (let dx = -area.radius; dx <= area.radius; dx++) for (let dy = -area.radius; dy <= area.radius; dy++) add({ x: tp.x + dx, y: tp.y + dy });
      break;
    case "cross-on-target":
      add(tp);
      for (let d = 1; d <= area.length; d++) {
        add({ x: tp.x + d, y: tp.y });
        add({ x: tp.x - d, y: tp.y });
        add({ x: tp.x, y: tp.y + d });
        add({ x: tp.x, y: tp.y - d });
      }
      break;
    case "ring-around-self": {
      const { pos, size } = ctx.npc;
      for (let r = area.inner; r <= Math.max(area.inner, area.outer); r++) {
        for (let x = pos.x - r; x < pos.x + size + r; x++) {
          for (let y = pos.y - r; y < pos.y + size + r; y++) {
            const edge = x === pos.x - r || x === pos.x + size + r - 1 || y === pos.y - r || y === pos.y + size + r - 1;
            if (edge) add({ x, y });
          }
        }
      }
      break;
    }
    case "random-tiles": {
      add(tp);
      const want = Math.min(area.count, ctx.arena.width * ctx.arena.height);
      for (let tries = 0; out.length < want && tries < want * 20; tries++) {
        add({ x: ctx.rng.int(ctx.arena.width), y: ctx.rng.int(ctx.arena.height) });
      }
      break;
    }
  }
  return out;
}

export const BUILTIN_SPECIAL_KINDS = [volleySpecial, tileAoeSpecial];

/** A registry pre-loaded with the built-in special kinds. Content adds its own on top. */
export function createDefaultSpecialKindRegistry(): SpecialKindRegistry {
  const r = new SpecialKindRegistry();
  for (const k of BUILTIN_SPECIAL_KINDS) r.register(k);
  return r;
}
