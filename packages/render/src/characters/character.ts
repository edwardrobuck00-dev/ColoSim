import type { VisualDef } from "@sim/assets";
import { Color, Group, type Material, type Mesh, type Object3D } from "three";
import type { Animator } from "../animation/animator";
import { GltfAnimator } from "../animation/gltf-animator";
import { ProceduralAnimator } from "../animation/procedural-animator";
import type { ModelCache } from "./model-cache";
import { buildRig, type Outfit, type Rig } from "./rigs";
import { buildWeaponProp, type WeaponProp } from "./weapon-props";

const FLASH_SECONDS = 0.14;

/**
 * One character on screen. Starts as a procedural placeholder; if the visual
 * has a model and a cache is given, swaps to the model once it has loaded.
 * Callers never need to know which one is showing.
 */
export class Character {
  /** Add this to the scene. Its contents may be swapped when a model loads. */
  readonly object = new Group();
  private body: Object3D;
  private rig: Rig | null;
  private _animator: Animator;
  private _height: number;
  private prop: { key: string; object: Object3D } | null = null;
  private outfitKey = "";
  private tintKey = "";
  private tint = new Color(0, 0, 0);
  private readonly originals = new WeakMap<object, Color>();
  private flashLeft = 0;
  private readonly baseEmissive = new Map<{ emissive: Color }, Color>();
  private disposed = false;

  constructor(
    readonly entityId: string,
    visual: VisualDef,
    size: number,
    cache: ModelCache | null,
  ) {
    this.rig = buildRig(visual, size);
    this.body = this.rig.root;
    this._height = this.rig.height;
    this._animator = new ProceduralAnimator(this.rig.joints);
    this.object.add(this.body);
    this.tagMeshes();

    if (visual.model && cache) {
      cache
        .instantiate(visual.model)
        .then(({ scene, animations }) => {
          if (this.disposed) return;
          this.swapBody(scene, new GltfAnimator(scene, animations, visual.animations));
        })
        .catch((e: unknown) => console.warn(`Model for "${visual.id}" failed to load; keeping placeholder.`, e));
    }
  }

  get animator(): Animator {
    return this._animator;
  }

  get height(): number {
    return this._height;
  }

  /** Shows a held weapon (placeholder rigs only; real models carry their own). */
  setWeaponProp(kind: WeaponProp, color?: string, accent?: string): void {
    const key = `${kind}|${color}|${accent}`;
    if (this.prop?.key === key || (!this.prop && kind === "none") || !this.rig) return;
    this.prop?.object.removeFromParent();
    this.prop = null;
    const built = buildWeaponProp(kind, color, accent);
    const hand = built?.hand === "left" ? this.rig.handL : this.rig.handR;
    if (!built || !hand) return;
    hand.add(built.object);
    this.prop = { key, object: built.object };
    this.tagMeshes();
  }

  /** Dresses a placeholder humanoid in its worn equipment. No-op for other rigs. */
  setOutfit(outfit: Outfit): void {
    const key = JSON.stringify(outfit);
    if (key === this.outfitKey || !this.rig?.wear) return;
    this.outfitKey = key;
    this.rig.wear(outfit);
    this.tagMeshes();
  }

  /** A lasting colour tint added to every part's own glow (e.g. red while enraged), or null to remove it. */
  setTint(color: string | null, strength = 0.35): void {
    const key = color ? `${color}|${strength}` : "";
    if (key === this.tintKey) return;
    this.tintKey = key;
    this.tint = color ? new Color(color).multiplyScalar(strength) : new Color(0, 0, 0);
    for (const [mat, base] of this.baseEmissive) mat.emissive.copy(base).add(this.tint);
  }

  /** Brief red flash when hit. */
  flash(): void {
    this.flashLeft = FLASH_SECONDS;
  }

  update(dt: number): void {
    this._animator.update(dt);
    if (this.flashLeft > 0) {
      this.flashLeft = Math.max(0, this.flashLeft - dt);
      const k = this.flashLeft / FLASH_SECONDS;
      for (const [mat, base] of this.baseEmissive) mat.emissive.copy(base).add(this.tint).lerp(FLASH_COLOR, k * 0.3);
    }
  }

  dispose(): void {
    this.disposed = true;
    this._animator.dispose();
    this.object.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        for (const mat of ([] as Material[]).concat(m.material)) mat.dispose();
      }
    });
  }

  private swapBody(next: Object3D, animator: Animator): void {
    this.object.remove(this.body);
    this._animator.dispose();
    this.body = next;
    this.rig = null;
    this.prop = null;
    this._animator = animator;
    this.object.add(next);
    this.tagMeshes();
  }

  /** Marks every mesh with the entity ID (for picking) and records base emissive colours (for flashes). */
  private tagMeshes(): void {
    this.baseEmissive.clear();
    this.object.traverse((o) => {
      o.userData.entityId = this.entityId;
      const m = o as Mesh;
      if (!m.isMesh) return;
      for (const mat of ([] as Material[]).concat(m.material)) {
        const std = mat as unknown as { emissive?: Color };
        if (!std.emissive) continue;
        // The material's own glow, recorded the first time it is seen (before any tint).
        let base = this.originals.get(std);
        if (!base) {
          base = std.emissive.clone();
          this.originals.set(std, base);
        }
        this.baseEmissive.set(std as { emissive: Color }, base);
        std.emissive.copy(base).add(this.tint);
      }
    });
  }
}

const FLASH_COLOR = new Color("#ff2a1a");
