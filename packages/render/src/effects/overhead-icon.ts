import { Sprite, SpriteMaterial } from "three";
import type { OverheadKind, TextureFactory } from "./textures";

const ICON_SIZE = 0.5;

/** The overhead prayer badge above a character. Hidden when no overhead is active. */
export class OverheadIcon {
  readonly sprite: Sprite;
  private kind: OverheadKind | null = null;

  constructor(private readonly textures: TextureFactory) {
    this.sprite = new Sprite(new SpriteMaterial({ depthTest: false, transparent: true }));
    this.sprite.scale.set(ICON_SIZE, ICON_SIZE, 1);
    this.sprite.renderOrder = 902;
    this.sprite.visible = false;
    this.sprite.name = "overhead-icon";
  }

  set(kind: OverheadKind | null): void {
    if (kind === this.kind) return;
    this.kind = kind;
    this.sprite.visible = kind !== null;
    if (kind) {
      this.sprite.material.map = this.textures.overhead(kind);
      this.sprite.material.needsUpdate = true;
    }
  }

  get current(): OverheadKind | null {
    return this.kind;
  }

  dispose(): void {
    this.sprite.material.dispose();
  }
}
