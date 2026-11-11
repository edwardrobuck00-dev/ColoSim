import { PROJECTILE_VISUALS, resolveArenaVisual, resolveProjectileVisual, resolveVisual } from "@sim/assets";
import type { SimEvent, Tile, TickResult, WorldSnapshot } from "@sim/engine";
import {
  Color, DirectionalLight, Fog, Group, NoToneMapping, SRGBColorSpace, Scene, Vector3, WebGLRenderer,
  type Object3D,
} from "three";
import { OrbitCamera } from "./camera/orbit-camera";
import { ModelCache } from "./characters/model-cache";
import { OverheadBar } from "./effects/overhead-bar";
import { ProjectileLayer } from "./effects/projectiles";
import { HazardLayer } from "./effects/hazards";
import { BurstLayer } from "./effects/bursts";
import { SplatLayer } from "./effects/splats";
import { OverheadIcon } from "./effects/overhead-icon";
import { createCanvasTextureFactory, type OverheadKind, type TextureFactory } from "./effects/textures";
import type { Vec3 } from "./effects/timing";
import { EntityView } from "./entities/entity-view";
import { TileOverlays } from "./overlays/tile-overlays";
import { pickGroundTile, pickObject, toNdc } from "./picking";
import type { RenderState } from "./debug/consistency";
import { buildArena, type ArenaScene } from "./scene/arena-builder";
import type { VisualLookup } from "./visuals/lookup";

export interface SceneRendererOptions {
  canvas: HTMLCanvasElement;
  visualLookup: VisualLookup;
  /** Visual ID of the arena (from the arena definition). */
  arenaVisualId: string | null;
  /** Shared model cache. Omit to create one; pass null to never load models. */
  models?: ModelCache | null;
  textures?: TextureFactory;
}

/**
 * Turns engine tick results into an animated 3D scene. Reads snapshots and
 * events only; it can never change simulation state.
 *
 * Timeline: tick N's events arrive in applyTick(N). Between ticks, frame()
 * receives alpha (0..1), and the scene shows the world at fractional tick
 * (N - 1 + alpha): positions interpolate from N-1 to N, and projectiles fly
 * so that they arrive exactly when their hit is applied.
 */
export class SceneRenderer {
  readonly orbit = new OrbitCamera();
  private readonly gl: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly sun = new DirectionalLight();
  private readonly overlays = new TileOverlays();
  private readonly views = new Map<string, EntityView>();
  private readonly textures: TextureFactory;
  private readonly models: ModelCache | null;
  private readonly splats: SplatLayer;
  private readonly projectiles: ProjectileLayer;
  private readonly hazards = new HazardLayer();
  private readonly bursts = new BurstLayer();
  private arena: ArenaScene | null = null;
  private arenaSize = { width: 0, height: 0 };
  private followPlayer = true;
  private lastFrameMs: number | null = null;
  private nowMs = 0;
  private tick = 0;
  private alpha = 1;

  constructor(private readonly opts: SceneRendererOptions) {
    this.gl = new WebGLRenderer({ canvas: opts.canvas, antialias: true });
    this.gl.setPixelRatio(Math.min(2, globalThis.devicePixelRatio ?? 1));
    // Classic look: no shadow maps or filmic tone mapping. Flat, evenly lit
    // colours; characters get a soft blob shadow instead.
    this.gl.shadowMap.enabled = false;
    this.gl.toneMapping = NoToneMapping;
    this.gl.outputColorSpace = SRGBColorSpace;

    this.textures = opts.textures ?? createCanvasTextureFactory();
    this.models = opts.models === undefined ? new ModelCache() : opts.models;
    this.splats = new SplatLayer(this.textures);
    this.projectiles = new ProjectileLayer(this.textures);

    this.hazards.onDetonate = (tiles) => {
      for (const t of tiles) this.bursts.spawn(t.x + 0.5, -(t.y + 0.5), "#ff8a2a", 0.7, 0.45);
    };
    this.scene.add(this.sun, this.sun.target, this.overlays.group, this.hazards.group, this.bursts.group, this.splats.group, this.projectiles.group);
  }

  /** Builds the arena and entities from the first snapshot. Called on every (re)start. */
  loadEncounter(snapshot: WorldSnapshot, initialEvents: SimEvent[] = []): void {
    this.clearEntities();
    this.splats.clear();
    this.projectiles.clear();
    this.hazards.clear();
    this.bursts.clear();
    if (this.arena) {
      this.scene.remove(this.arena.group);
      this.arena.dispose();
    }

    const visual = resolveArenaVisual(this.opts.arenaVisualId);
    this.scene.background = new Color(visual.background);
    const span = Math.max(snapshot.arena.width, snapshot.arena.height);
    this.scene.fog = new Fog(visual.background, span * 1.4, span * 3.2);
    this.arena = buildArena(snapshot.arena, visual, this.sun, this.textures);
    this.scene.add(this.arena.group);
    this.arenaSize = { width: snapshot.arena.width, height: snapshot.arena.height };
    this.tick = snapshot.tick;

    for (const e of initialEvents) if (e.type === "EntitySpawned") this.spawn(e.entityId, e.kind, e.defId, e.pos, e.size);
    if (!this.views.has(snapshot.player.id)) this.spawn(snapshot.player.id, "player", null, snapshot.player.pos, 1);
    for (const n of snapshot.npcs) if (n.life === "alive" && !this.views.has(n.id)) this.spawn(n.id, "npc", n.defId, n.pos, n.size);
    this.syncSnapshot(snapshot);

    this.resetCamera();
    this.warmUp();
  }

  /**
   * Shows the world exactly as a snapshot describes it (used to review an
   * earlier tick or jump around a replay): entities at their tiles, health,
   * deaths, overheads, boss state, hazards and projectiles in flight. Keeps
   * the arena and camera.
   */
  showSnapshot(snapshot: WorldSnapshot): void {
    this.clearEntities();
    this.splats.clear();
    this.projectiles.clear();
    this.hazards.clear();
    this.bursts.clear();
    this.tick = snapshot.tick;
    const p = snapshot.player;
    this.spawn(p.id, "player", null, p.pos, 1);
    if (p.life !== "alive") this.views.get(p.id)?.die(this.nowMs);
    for (const n of snapshot.npcs) {
      if (n.life === "dead") continue;
      this.spawn(n.id, "npc", n.defId, n.pos, n.size);
      if (n.life === "dying") this.views.get(n.id)?.die(this.nowMs);
    }
    this.syncSnapshot(snapshot);
    for (const pr of snapshot.projectiles) this.launchProjectile(pr.id, pr.sourceId, pr.targetId, pr.visualId, pr.launchTick, pr.landTick);
  }

  private launchProjectile(id: string, sourceId: string, targetId: string, visualId: string, launchTick: number, landTick: number): void {
    const src = this.views.get(sourceId);
    const dst = this.views.get(targetId);
    if (!src || !dst) return;
    const from = src.worldPosition();
    this.projectiles.launch(id, resolveProjectileVisual(visualId), launchTick, landTick, {
      from: { x: from.x, y: src.height * 0.62, z: from.z },
      to: () => (this.views.has(targetId) ? chest(dst) : null),
    });
  }

  /**
   * Compiles the shaders for every effect before the fight starts. Without
   * this, the first projectile, splat and health bar each stall a frame while
   * the browser compiles their shaders mid-fight.
   */
  private warmUp(): void {
    const splats = new SplatLayer(this.textures);
    const projectiles = new ProjectileLayer(this.textures);
    const anchor = new Group();
    splats.add(anchor, 1, 1, 2);
    splats.add(anchor, 1, 2, 2);
    splats.add(anchor, 1, 0, 2);
    splats.update(0.2);
    let n = 0;
    for (const v of PROJECTILE_VISUALS.values()) {
      projectiles.launch(`warmup-${n++}`, v, 1, 3, { from: { x: 0, y: 1, z: 0 }, to: () => ({ x: 1, y: 1, z: 1 }) });
    }
    projectiles.update(1.5, 0.1);
    projectiles.update(1.6, 0.1);
    const bar = new OverheadBar(1);
    bar.setHealth(1, 2);
    bar.ping();
    bar.update(0.016, false);
    const icon = new OverheadIcon(this.textures);
    icon.set("melee");
    const warm = new Group();
    warm.add(splats.group, projectiles.group, bar.group, icon.sprite);
    this.scene.add(warm);
    // Hazard materials (warning and burning tiles).
    this.hazards.sync([
      { id: "warm-a", sourceId: "", name: "", tiles: [{ x: 0, y: 0 }], state: "warning", detonateTick: 1, endTick: 1 },
      { id: "warm-b", sourceId: "", name: "", tiles: [{ x: 1, y: 0 }], state: "burning", detonateTick: 1, endTick: 3 },
    ]);
    const hidden = this.overlays.group.children.filter((c) => !c.visible);
    for (const c of hidden) c.visible = true;
    this.gl.compile(this.scene, this.orbit.camera);
    for (const c of hidden) c.visible = false;
    this.scene.remove(warm);
    splats.clear();
    projectiles.clear();
    icon.dispose();
    this.hazards.clear();
  }

  /** Called once per engine tick. */
  applyTick(result: TickResult): void {
    this.tick = result.tick;
    const s = result.snapshot;
    for (const e of result.events) this.handleEvent(e, s);

    const ran = new Set(result.events.flatMap((e) => (e.type === "EntityMoved" && e.running ? [e.entityId] : [])));
    this.views.get(s.player.id)?.moveTo(s.player.pos, ran.has(s.player.id));
    for (const n of s.npcs) this.views.get(n.id)?.moveTo(n.pos, ran.has(n.id));
    this.syncSnapshot(s);
  }

  /** Called every animation frame. `alpha` is 0..1 progress through the current tick. */
  frame(alpha: number, nowMs: number): void {
    const dt = this.lastFrameMs === null ? 0 : Math.min(0.1, (nowMs - this.lastFrameMs) / 1000);
    this.lastFrameMs = nowMs;
    this.nowMs = nowMs;
    this.alpha = alpha;

    for (const view of [...this.views.values()]) {
      if (view.removeAfterMs !== null && nowMs >= view.removeAfterMs) {
        this.removeView(view.entityId);
        continue;
      }
      const target = view.targetId ? this.views.get(view.targetId) : undefined;
      view.update(alpha, dt, target && !target.isDead ? target.worldPosition() : null);
    }

    this.projectiles.update(this.tick - 1 + alpha, dt, this.tick);
    this.splats.update(dt);
    this.hazards.update(this.tick - 1 + alpha, nowMs);
    this.bursts.update(dt);
    this.arena?.update(dt, nowMs);

    if (this.followPlayer) {
      const focus = this.cameraFocus();
      if (focus) this.orbit.follow(focus.x, focus.z);
    }
    this.orbit.update(dt);
    this.gl.render(this.scene, this.orbit.camera);
  }

  resize(width: number, height: number): void {
    this.gl.setSize(width, height, false);
    this.orbit.setAspect(width / Math.max(1, height));
  }

  /** Back to the default framing for this arena. */
  resetCamera(): void {
    const focus = this.cameraFocus() ?? { x: this.arenaSize.width / 2, z: -this.arenaSize.height / 2 };
    this.orbit.frame(this.arenaSize.width, this.arenaSize.height, focus);
  }

  /** Screen position (CSS pixels, relative to the viewport) of an entity's centre. For tests and tooltips. */
  screenPosition(entityId: string): { x: number; y: number } | null {
    const v = this.views.get(entityId);
    if (!v) return null;
    const p = v.worldPosition();
    const ndc = new Vector3(p.x, v.height * 0.45, p.z).project(this.orbit.camera);
    const r = this.opts.canvas.getBoundingClientRect();
    return { x: r.left + ((ndc.x + 1) / 2) * r.width, y: r.top + ((1 - ndc.y) / 2) * r.height };
  }

  /**
   * The camera centres on the player, like the classic game camera: the
   * player is always in the middle of the view and the fight is read around them.
   */
  private cameraFocus(): Vec3 | null {
    const player = this.views.get("player");
    return player ? player.worldPosition() : null;
  }

  pickTile(clientX: number, clientY: number): Tile | null {
    const ndc = toNdc(clientX, clientY, this.opts.canvas.getBoundingClientRect());
    const t = pickGroundTile(this.orbit.camera, ndc.x, ndc.y);
    if (!t || t.x < 0 || t.y < 0 || t.x >= this.arenaSize.width || t.y >= this.arenaSize.height) return null;
    return t;
  }

  pickEntity(clientX: number, clientY: number): string | null {
    const ndc = toNdc(clientX, clientY, this.opts.canvas.getBoundingClientRect());
    const pickables: Object3D[] = [...this.views.values()]
      .filter((v) => v.kind === "npc" && !v.isDead)
      .map((v) => v.character.object);
    const hit = pickObject(this.orbit.camera, ndc.x, ndc.y, pickables, true);
    return (hit?.userData.entityId as string | undefined) ?? null;
  }

  setHoverTile(t: Tile | null): void {
    this.overlays.setHover(t);
  }

  setFollowPlayer(on: boolean): void {
    this.followPlayer = on;
  }

  /** For tests and debugging: what is currently on screen. */
  stats(): { entities: number; projectiles: number; splats: number; hazards: number; tick: number; drawCalls: number; triangles: number; programs: number } {
    const { calls, triangles } = this.gl.info.render;
    return {
      entities: this.views.size, projectiles: this.projectiles.count, splats: this.splats.count, hazards: this.hazards.count, tick: this.tick,
      drawCalls: calls, triangles, programs: this.gl.info.programs?.length ?? 0,
    };
  }

  /** What is currently drawn, for checking against the simulation (see debug/consistency.ts). */
  renderState(): RenderState {
    return {
      tick: this.tick,
      entities: [...this.views.values()].map((v) => ({
        id: v.entityId,
        tile: v.tile,
        dead: v.isDead,
        healthRatio: v.bar.targetRatio,
        overhead: v.overhead.current,
        ...v.currentStatus,
      })),
      projectiles: this.projectiles.ids,
      hazards: this.hazards.shown,
    };
  }

  dispose(): void {
    this.clearEntities();
    this.splats.clear();
    this.projectiles.clear();
    this.arena?.dispose();
    this.gl.dispose();
  }

  private handleEvent(e: SimEvent, s: WorldSnapshot): void {
    switch (e.type) {
      case "EntitySpawned":
        // A respawn replaces the old (dead or despawning) view with a fresh one.
        if (e.respawn) this.removeView(e.entityId);
        this.spawn(e.entityId, e.kind, e.defId, e.pos, e.size);
        break;
      case "AttackStarted": {
        const v = this.views.get(e.attackerId);
        if (v && !v.isDead) {
          v.targetId = e.targetId;
          v.playAction(e.animationCue);
        }
        break;
      }
      case "ProjectileLaunched":
        this.launchProjectile(e.projectileId, e.sourceId, e.targetId, e.visualId, e.launchTick, e.landTick);
        break;
      case "HitLanded": {
        const v = this.views.get(e.targetId);
        if (!v) break;
        const max = e.targetId === s.player.id ? s.player.maxHitpoints : (s.npcs.find((n) => n.id === e.targetId)?.maxHitpoints ?? 1);
        v.onHit(e.targetHitpoints, max);
        this.splats.add(v.root, Math.min(v.height * 0.5, 2), e.amount, e.maxHit);
        break;
      }
      case "ItemConsumed":
        this.views.get(s.player.id)?.playAction(e.kind === "potion" ? "drink" : "eat");
        break;
      case "SpecialUsed": {
        const v = this.views.get(s.player.id);
        if (v) this.burstAt(v, "#ffd84a", 1.4);
        break;
      }
      case "RedemptionTriggered": {
        const v = this.views.get(s.player.id);
        if (v) this.burstAt(v, "#ffffff", 1.6);
        break;
      }
      case "NpcHealed": {
        const v = this.views.get(e.entityId);
        if (v && !v.isDead) this.splats.add(v.root, Math.min(v.height * 0.5, 2), e.amount, 0, "heal");
        break;
      }
      case "BossPhaseChanged": {
        const v = this.views.get(e.npcId);
        if (v) this.burstAt(v, "#ff8a2a", v.size * 1.6, 0.9);
        break;
      }
      case "BossEnraged": {
        const v = this.views.get(e.npcId);
        if (v) this.burstAt(v, "#ff2a10", v.size * 2, 1.1);
        break;
      }
      case "NpcSaid":
        this.views.get(e.entityId)?.say(e.text);
        break;
      case "EntityMoved":
        if (e.teleport) this.views.get(e.entityId)?.placeAt(e.to);
        break;
      case "EntityDied":
        this.views.get(e.entityId)?.die(this.nowMs);
        break;
      case "EntityDespawned": {
        // Removal waits for the death animation (see frame()).
        const v = this.views.get(e.entityId);
        if (v?.isDead) v.despawn(this.nowMs);
        else this.removeView(e.entityId);
        break;
      }
      default:
        break;
    }
  }

  /** Per-tick state that is not driven by events: targets, health, overlays, weapon prop. */
  private syncSnapshot(s: WorldSnapshot): void {
    this.hazards.sync(s.hazards, s.tick);
    const player = this.views.get(s.player.id);
    if (player) {
      player.targetId = s.player.targetId;
      player.setHealth(s.player.hitpoints, s.player.maxHitpoints);
      player.setEquipment(s.player.equipment, s.player.weapon.category);
      player.setOverhead(toOverheadKind(s.player.overhead));
    }
    for (const n of s.npcs) {
      const v = this.views.get(n.id);
      if (!v) continue;
      v.targetId = n.targetId;
      v.setHealth(n.hitpoints, n.maxHitpoints);
      v.setStatus({ enraged: n.enraged, immune: n.invulnerable });
    }
    this.overlays.setDestination(s.player.destination);
    this.overlays.setTrueTile(s.player.pos);
    const target = s.npcs.find((n) => n.id === s.player.targetId && n.alive);
    this.overlays.setTargetFootprint(target?.pos ?? null, target?.size ?? 1);
  }

  private burstAt(v: EntityView, color: string, radius: number, seconds = 0.6): void {
    const p = v.worldPosition();
    this.bursts.spawn(p.x, p.z, color, radius, seconds);
  }

  private spawn(id: string, kind: "player" | "npc", defId: string | null, pos: Tile, size: number): void {
    if (this.views.has(id)) return;
    const view = new EntityView(id, kind, size, resolveVisual(this.opts.visualLookup({ kind, defId })), pos, this.models, this.textures);
    this.views.set(id, view);
    this.scene.add(view.root);
  }

  private removeView(id: string): void {
    const v = this.views.get(id);
    if (!v) return;
    this.scene.remove(v.root);
    v.dispose();
    this.views.delete(id);
  }

  private clearEntities(): void {
    for (const id of [...this.views.keys()]) this.removeView(id);
  }
}

function chest(v: EntityView): Vec3 {
  const p = v.worldPosition();
  return { x: p.x, y: Math.min(v.height * 0.5, 1.8), z: p.z };
}

const OVERHEAD_KINDS: ReadonlySet<string> = new Set<OverheadKind>(["melee", "ranged", "magic", "redemption"]);
function toOverheadKind(overhead: string | null): OverheadKind | null {
  return overhead && OVERHEAD_KINDS.has(overhead) ? (overhead as OverheadKind) : null;
}
