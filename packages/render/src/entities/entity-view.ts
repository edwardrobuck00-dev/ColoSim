import type { VisualDef } from "@sim/assets";
import type { Tile } from "@sim/engine";
import { AdditiveBlending, CircleGeometry, Group, Mesh, MeshBasicMaterial, Sprite, SpriteMaterial } from "three";
import type { Locomotion } from "../animation/animator";
import { Character } from "../characters/character";
import type { ModelCache } from "../characters/model-cache";
import { itemAppearance } from "@sim/assets";
import { propForItem } from "../characters/weapon-props";
import type { Outfit } from "../characters/rigs";
import { tileToWorld } from "../coords";
import { OverheadBar } from "../effects/overhead-bar";
import { OverheadIcon } from "../effects/overhead-icon";
import { OverheadText } from "../effects/overhead-text";
import { blankTextureFactory, type OverheadKind, type TextureFactory } from "../effects/textures";
import type { Vec3 } from "../effects/timing";
import { lerp } from "../interpolation";

const TURN_RATE = 14; // radians per second

/** Shortest signed angle from a to b. */
export function angleDelta(a: number, b: number): number {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

/**
 * Everything on screen for one engine entity: the character (placeholder or
 * model), its overhead health bar, smoothed movement between tiles and facing.
 */
export class EntityView {
  readonly root = new Group();
  readonly character: Character;
  readonly bar: OverheadBar;
  readonly overhead: OverheadIcon;
  readonly speech: OverheadText;
  private readonly shadow: Mesh;
  /** Golden shimmer shown while the entity is immune. */
  private readonly shield: Sprite;
  private status = { enraged: false, immune: false };
  private shieldPhase = 0;
  targetId: string | null = null;
  /** Time (ms) after which a despawned entity's view should be removed. */
  removeAfterMs: number | null = null;
  private deathEndsMs = 0;
  private from: Tile;
  private to: Tile;
  private running = false;
  private yaw = 0;
  private dead = false;

  constructor(
    readonly entityId: string,
    readonly kind: "player" | "npc",
    readonly size: number,
    visual: VisualDef,
    pos: Tile,
    cache: ModelCache | null,
    textures: TextureFactory = blankTextureFactory,
  ) {
    this.character = new Character(entityId, visual, size, cache);
    this.bar = new OverheadBar(size, kind === "npc");
    this.bar.group.position.y = this.character.height + 0.35;
    this.overhead = new OverheadIcon(textures);
    this.overhead.sprite.position.y = this.character.height + 0.8;
    this.shield = new Sprite(new SpriteMaterial({ map: textures.glow("#ffd84a"), color: "#ffd84a", transparent: true, depthWrite: false, blending: AdditiveBlending }));
    this.shield.scale.set(size * 1.6, this.character.height * 1.25, 1);
    this.shield.position.y = this.character.height * 0.5;
    this.shield.visible = false;
    this.shield.name = "immune-shield";
    this.speech = new OverheadText(textures);
    this.speech.sprite.position.y = this.character.height + 1.35;
    // Soft round shadow under the feet (the scene has no shadow maps).
    const blob = new Mesh(
      new CircleGeometry(0.42 * Math.max(1, size * 0.85), 20).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.28, depthWrite: false }),
    );
    blob.position.y = 0.012;
    blob.renderOrder = 1;
    this.shadow = blob;
    this.root.add(this.character.object, this.bar.group, this.overhead.sprite, this.speech.sprite, blob, this.shield);
    this.root.name = `entity:${entityId}`;
    this.from = pos;
    this.to = pos;
    this.update(1, 0, null);
  }

  /** New engine tile for this tick. */
  moveTo(pos: Tile, running: boolean): void {
    this.from = this.to;
    this.to = pos;
    this.running = running;
  }

  /** Snap without animating (e.g. on reset). */
  placeAt(pos: Tile): void {
    this.from = pos;
    this.to = pos;
  }

  /** The tile the view is heading to (the simulation's tile for this tick). */
  get tile(): Tile {
    return { ...this.to };
  }

  get isMoving(): boolean {
    return this.from.x !== this.to.x || this.from.y !== this.to.y;
  }

  get height(): number {
    return this.character.height;
  }

  /**
   * Shows worn equipment: the held weapon (by item, or by category when the
   * item has no appearance) and, on humanoids, the armour and cape.
   */
  setEquipment(equipment: Record<string, { itemId: string } | undefined>, weaponCategory: string | null): void {
    const prop = propForItem(equipment.weapon?.itemId ?? null, weaponCategory);
    this.character.setWeaponProp(prop.kind, prop.color, prop.accent);
    const outfit: Outfit = {};
    for (const slot of ["head", "cape", "neck", "body", "legs", "shield", "hands", "feet"] as const) {
      const id = equipment[slot]?.itemId;
      outfit[slot] = id ? itemAppearance(id, slot) : null;
    }
    this.character.setOutfit(outfit);
  }

  playAction(cue: string): void {
    this.character.animator.play(cue);
  }

  onHit(hitpoints: number, max: number): void {
    this.bar.setHealth(hitpoints, max);
    this.bar.ping();
    this.character.flash();
    this.character.animator.play("hit");
  }

  setHealth(hitpoints: number, max: number): void {
    this.bar.setHealth(hitpoints, max);
  }

  /** Shows the active overhead prayer, or hides the badge with null. */
  setOverhead(kind: OverheadKind | null): void {
    this.overhead.set(this.dead ? null : kind);
  }

  /** Boss state from the snapshot: a red tint while enraged, a golden shimmer while immune. */
  setStatus(status: { enraged: boolean; immune: boolean }): void {
    if (status.enraged !== this.status.enraged) this.character.setTint(status.enraged ? "#ff2a10" : null);
    this.shield.visible = status.immune && !this.dead;
    this.status = { ...status };
  }

  get currentStatus(): { enraged: boolean; immune: boolean } {
    return { ...this.status };
  }

  /** Shows text above the character's head for a few seconds. */
  say(text: string, color?: string): void {
    this.speech.show(text, color);
  }

  /** Plays the death animation. The body stays until despawn() (a dead player in "end" mode stays down). */
  die(nowMs: number): void {
    if (this.dead) return;
    this.dead = true;
    this.bar.hide();
    this.overhead.set(null);
    this.shadow.visible = false;
    this.shield.visible = false;
    const seconds = this.character.animator.play("death");
    this.deathEndsMs = nowMs + Math.max(0.5, seconds) * 1000;
  }

  /** The engine despawned the entity: remove it once the death animation has finished. */
  despawn(nowMs: number): void {
    this.removeAfterMs = Math.max(nowMs, this.deathEndsMs) + 400;
  }

  get isDead(): boolean {
    return this.dead;
  }

  /**
   * Per frame. `alpha` is progress from the previous tick's tile to this
   * tick's tile (linear, so consecutive steps join into smooth motion).
   * `faceToward` is a world point to turn toward, usually the target.
   */
  update(alpha: number, dt: number, faceToward: Vec3 | null): void {
    const a = tileToWorld(this.from, this.size);
    const b = tileToWorld(this.to, this.size);
    const t = Math.min(1, Math.max(0, alpha));
    this.root.position.set(lerp(a.x, b.x, t), 0, lerp(a.z, b.z, t));

    const moving = this.isMoving && t < 1;
    const loco: Locomotion = this.dead ? "idle" : moving ? (this.running ? "run" : "walk") : "idle";
    this.character.animator.setLocomotion(loco);

    let desired: number | null = null;
    if (moving) desired = Math.atan2(b.x - a.x, b.z - a.z);
    else if (faceToward) {
      const dx = faceToward.x - this.root.position.x;
      const dz = faceToward.z - this.root.position.z;
      if (dx * dx + dz * dz > 0.01) desired = Math.atan2(dx, dz);
    }
    if (desired !== null && !this.dead) {
      const d = angleDelta(this.yaw, desired);
      const step = TURN_RATE * dt;
      this.yaw += Math.abs(d) <= step || dt === 0 ? d : Math.sign(d) * step;
    }
    this.character.object.rotation.y = this.yaw;

    this.character.update(dt);
    this.bar.update(dt, this.dead);
    this.speech.update(dt);
    if (this.shield.visible) {
      this.shieldPhase += dt;
      this.shield.material.opacity = 0.35 + 0.2 * Math.sin(this.shieldPhase * 6);
    }
  }

  worldPosition(): Vec3 {
    return { x: this.root.position.x, y: 0, z: this.root.position.z };
  }

  dispose(): void {
    this.character.dispose();
    this.overhead.dispose();
    this.speech.dispose();
  }
}
