import { Group, Sprite, SpriteMaterial } from "three";

const VISIBLE_AFTER_HIT_SECONDS = 6;

/**
 * Health bar floating above a character. Shown while the entity is in combat
 * (recently hit) or below full health; hidden on death.
 */
export class OverheadBar {
  readonly group = new Group();
  private readonly back: Sprite;
  private readonly fill: Sprite;
  private readonly width: number;
  private shown = 0;
  private ratio = 1;
  private target = 1;

  constructor(size: number, private readonly alwaysWhenDamaged = true) {
    this.width = 0.9 * Math.max(1, size * 0.7);
    const height = 0.11;
    this.back = new Sprite(new SpriteMaterial({ color: "#6b1010", depthTest: false }));
    this.fill = new Sprite(new SpriteMaterial({ color: "#36c24a", depthTest: false }));
    for (const s of [this.back, this.fill]) {
      s.center.set(0, 0.5);
      s.position.x = -this.width / 2;
      s.scale.set(this.width, height, 1);
      s.renderOrder = 900;
    }
    this.fill.renderOrder = 901;
    this.group.add(this.back, this.fill);
    this.group.visible = false;
  }

  setHealth(hp: number, max: number): void {
    this.target = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;
  }

  /** Call when the entity takes a hit, to keep the bar on screen for a while. */
  ping(): void {
    this.shown = VISIBLE_AFTER_HIT_SECONDS;
  }

  hide(): void {
    this.shown = 0;
    this.target = 0;
    this.group.visible = false;
  }

  update(dt: number, dead: boolean): void {
    this.shown = Math.max(0, this.shown - dt);
    this.ratio += (this.target - this.ratio) * Math.min(1, dt * 10);
    this.fill.scale.x = Math.max(0.0001, this.width * this.ratio);
    this.group.visible = !dead && (this.shown > 0 || (this.alwaysWhenDamaged && this.target < 1));
  }

  /** The health ratio the bar is moving to (the simulation's value). */
  get targetRatio(): number {
    return this.target;
  }

  get displayedRatio(): number {
    return this.ratio;
  }
}
