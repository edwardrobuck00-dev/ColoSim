import { Sprite, SpriteMaterial } from "three";
import type { TextureFactory } from "./textures";

/** How long overhead text stays up: about five game ticks. */
export const OVERHEAD_TEXT_SECONDS = 3;

/** Text a character "says", shown above its head for a few seconds. */
export class OverheadText {
  readonly sprite: Sprite;
  private left = 0;

  constructor(private readonly textures: TextureFactory) {
    this.sprite = new Sprite(new SpriteMaterial({ depthTest: false, transparent: true }));
    this.sprite.scale.set(4, 0.5, 1);
    this.sprite.renderOrder = 903;
    this.sprite.visible = false;
    this.sprite.name = "overhead-text";
  }

  show(text: string, color = "#ffff00"): void {
    this.sprite.material.map = this.textures.text(text, color);
    this.sprite.material.needsUpdate = true;
    this.sprite.visible = true;
    this.left = OVERHEAD_TEXT_SECONDS;
  }

  update(dt: number): void {
    if (this.left <= 0) return;
    this.left -= dt;
    if (this.left <= 0) this.sprite.visible = false;
  }

  get showing(): boolean {
    return this.sprite.visible;
  }

  dispose(): void {
    this.sprite.material.dispose();
  }
}
