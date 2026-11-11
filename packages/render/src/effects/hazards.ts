import type { HazardSnapshot } from "@sim/engine";
import { AdditiveBlending, ConeGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry, type Material } from "three";

/**
 * Telegraphed and burning tiles (colour language, docs/visual-style.md):
 * - warning: glowing orange-yellow tiles that pulse faster as detonation nears
 * - burning: red-orange tiles with small flickering flames
 * Driven from the snapshot every tick; animated every frame.
 */
interface Live {
  group: Group;
  hazard: HazardSnapshot;
  flames: Mesh[];
}

const TILE = new PlaneGeometry(0.94, 0.94).rotateX(-Math.PI / 2);
const FLAME = new ConeGeometry(0.16, 0.5, 5);

export class HazardLayer {
  readonly group = new Group();
  private readonly live = new Map<string, Live>();
  private readonly warnMat = new MeshBasicMaterial({ color: "#ffb030", transparent: true, opacity: 0.5, depthWrite: false, blending: AdditiveBlending });
  private readonly burnMat = new MeshBasicMaterial({ color: "#ff4a10", transparent: true, opacity: 0.55, depthWrite: false, blending: AdditiveBlending });
  private readonly flameMat = new MeshBasicMaterial({ color: "#ffb347", transparent: true, opacity: 0.85, depthWrite: false, blending: AdditiveBlending });

  constructor() {
    this.group.name = "hazards";
  }

  /** Called with a hazard's tiles when it detonates (for burst effects). */
  onDetonate: ((tiles: HazardSnapshot["tiles"]) => void) | null = null;

  /** Adds new hazards, updates their state, removes expired ones. `tick` is the snapshot's tick. */
  sync(hazards: readonly HazardSnapshot[], tick = Number.POSITIVE_INFINITY): void {
    const seen = new Set<string>();
    for (const h of hazards) {
      seen.add(h.id);
      let l = this.live.get(h.id);
      if (!l) {
        l = { group: new Group(), hazard: h, flames: [] };
        l.group.name = `hazard:${h.id}`;
        this.group.add(l.group);
        this.live.set(h.id, l);
      }
      if (l.hazard.state === "warning" && h.state === "burning") this.onDetonate?.(h.tiles);
      if (l.group.children.length === 0 || l.hazard.state !== h.state) this.build(l, h);
      l.hazard = h;
    }
    for (const [id, l] of this.live) {
      if (seen.has(id)) continue;
      if (l.hazard.state === "warning" && tick >= l.hazard.detonateTick) this.onDetonate?.(l.hazard.tiles);
      this.group.remove(l.group);
      this.live.delete(id);
    }
  }

  private build(l: Live, h: HazardSnapshot): void {
    l.group.clear();
    l.flames = [];
    const mat = h.state === "warning" ? this.warnMat : this.burnMat;
    for (const t of h.tiles) {
      const tile = new Mesh(TILE, mat);
      tile.position.set(t.x + 0.5, 0.02, -(t.y + 0.5));
      tile.renderOrder = 2;
      l.group.add(tile);
      if (h.state === "burning" && h.endTick > h.detonateTick) {
        const flame = new Mesh(FLAME, this.flameMat);
        flame.position.set(t.x + 0.5, 0.25, -(t.y + 0.5));
        l.group.add(flame);
        l.flames.push(flame);
      }
    }
  }

  /** `tickFloat` is the fractional tick being shown; `nowMs` drives the flicker. */
  update(tickFloat: number, nowMs: number): void {
    const t = nowMs / 1000;
    for (const l of this.live.values()) {
      const h = l.hazard;
      if (h.state === "warning") {
        const left = Math.max(0, h.detonateTick - tickFloat);
        const speed = left < 1.5 ? 14 : 6;
        this.warnMat.opacity = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(t * speed));
      } else {
        this.burnMat.opacity = 0.45 + 0.1 * Math.sin(t * 9);
        l.flames.forEach((f, i) => f.scale.set(1, 0.8 + 0.35 * Math.abs(Math.sin(t * 8 + i)), 1));
      }
    }
  }

  get count(): number {
    return this.live.size;
  }

  /** Hazards on screen and the state each is drawn in. */
  get shown(): Array<{ id: string; state: "warning" | "burning" }> {
    return [...this.live.values()].map((l) => ({ id: l.hazard.id, state: l.hazard.state }));
  }

  clear(): void {
    this.group.clear();
    this.live.clear();
  }

  dispose(): void {
    this.clear();
    for (const m of [this.warnMat, this.burnMat, this.flameMat] as Material[]) m.dispose();
  }
}
