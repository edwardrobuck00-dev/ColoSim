import { Group, Sprite, SpriteMaterial, type Object3D } from "three";
import { splatAnimation, splatSlot } from "./timing";
import type { SplatKind, TextureFactory } from "./textures";

const SPLAT_SIZE = 0.62;

interface Live {
  sprite: Sprite;
  age: number;
  slotIndex: number;
  slot: { x: number; y: number };
  anchor: Object3D;
  baseY: number;
}

/** Damage splats: billboards that pop, hold and fade over the hit entity. */
export class SplatLayer {
  readonly group = new Group();
  private readonly live: Live[] = [];

  constructor(private readonly textures: TextureFactory) {
    this.group.name = "splats";
  }

  /** `anchor` is the entity's root; `height` is where on the body the splat sits. */
  add(anchor: Object3D, height: number, amount: number, maxHit: number, forceKind?: SplatKind): void {
    const kind: SplatKind = forceKind ?? (amount === 0 ? "miss" : amount >= maxHit && maxHit > 0 ? "max" : "hit");
    const material = new SpriteMaterial({ map: this.textures.splat(amount, kind), depthTest: false, transparent: true });
    const sprite = new Sprite(material);
    sprite.renderOrder = 1000;
    // First slot not used by a splat still showing on this entity.
    const used = new Set(this.live.filter((l) => l.anchor === anchor).map((l) => l.slotIndex));
    let slotIndex = 0;
    while (used.has(slotIndex)) slotIndex++;
    this.live.push({ sprite, age: 0, slotIndex, slot: splatSlot(slotIndex), anchor, baseY: height });
    this.group.add(sprite);
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const l = this.live[i]!;
      l.age += dt;
      const a = splatAnimation(l.age);
      if (a.done) {
        this.group.remove(l.sprite);
        l.sprite.material.dispose();
        this.live.splice(i, 1);
        continue;
      }
      const p = l.anchor.position;
      l.sprite.position.set(p.x + l.slot.x * SPLAT_SIZE, l.baseY + l.slot.y * SPLAT_SIZE + a.rise, p.z);
      l.sprite.scale.setScalar(SPLAT_SIZE * a.scale);
      l.sprite.material.opacity = a.opacity;
    }
  }

  /** Slot indices currently used on an anchor (for tests). */
  slotsOn(anchor: Object3D): number[] {
    return this.live.filter((l) => l.anchor === anchor).map((l) => l.slotIndex);
  }

  get count(): number {
    return this.live.length;
  }

  clear(): void {
    for (const l of this.live) {
      this.group.remove(l.sprite);
      l.sprite.material.dispose();
    }
    this.live.length = 0;
  }
}
