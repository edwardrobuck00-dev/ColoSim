import type { ProjectileVisual } from "@sim/assets";
import {
  AdditiveBlending, ConeGeometry, CylinderGeometry, DodecahedronGeometry, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, OctahedronGeometry,
  SphereGeometry, Sprite, SpriteMaterial, Vector3, type Object3D,
} from "three";
import type { TextureFactory } from "./textures";
import { arcPoint, flightProgress, type Vec3 } from "./timing";

export interface ProjectileEndpoints {
  /** Current world position of the source (captured once at launch). */
  from: Vec3;
  /** Called every frame: the target's current world position (it may be moving). */
  to: () => Vec3 | null;
}

interface Flight {
  id: string;
  launchTick: number;
  landTick: number;
  visual: ProjectileVisual;
  object: Group;
  trail: Sprite[];
  history: Vec3[];
  from: Vec3;
  to: () => Vec3 | null;
  lastTo: Vec3;
  spin: number;
}

const TRAIL = 6;

/** Projectiles in flight, timed to land exactly when the engine applies the hit. */
export class ProjectileLayer {
  readonly group = new Group();
  private readonly flights = new Map<string, Flight>();

  constructor(private readonly textures: TextureFactory) {
    this.group.name = "projectiles";
  }

  launch(id: string, visual: ProjectileVisual, launchTick: number, landTick: number, ends: ProjectileEndpoints): void {
    const object = buildProjectile(visual, this.textures);
    const trail: Sprite[] = [];
    if (visual.trail) {
      for (let i = 0; i < TRAIL; i++) {
        const s = new Sprite(new SpriteMaterial({
          map: this.textures.glow(visual.glowColor), color: visual.glowColor, blending: AdditiveBlending,
          depthWrite: false, transparent: true, opacity: 0.5 * (1 - i / TRAIL),
        }));
        s.scale.setScalar(visual.size * 2.2 * (1 - i / (TRAIL + 2)));
        s.visible = false;
        trail.push(s);
        this.group.add(s);
      }
    }
    const to = ends.to() ?? ends.from;
    object.position.set(ends.from.x, ends.from.y, ends.from.z);
    this.group.add(object);
    this.flights.set(id, { id, launchTick, landTick, visual, object, trail, history: [], from: ends.from, to: ends.to, lastTo: to, spin: 0 });
  }

  /**
   * `tickFloat` is the fractional tick being shown; `appliedTick` is the last
   * simulation tick applied. A projectile is removed exactly when its hit has
   * been applied (as it leaves the simulation snapshot); until then a paused
   * or stepped view holds it at the target.
   */
  update(tickFloat: number, dt: number, appliedTick = Math.ceil(tickFloat)): void {
    for (const f of this.flights.values()) {
      const t = flightProgress(tickFloat, f.launchTick, f.landTick);
      if (appliedTick >= f.landTick) {
        this.remove(f);
        continue;
      }
      f.lastTo = f.to() ?? f.lastTo;
      const p = arcPoint(f.from, f.lastTo, f.visual.arcHeight, t);
      const ahead = arcPoint(f.from, f.lastTo, f.visual.arcHeight, Math.min(1, t + 0.02));
      f.object.position.set(p.x, p.y, p.z);
      f.object.lookAt(new Vector3(ahead.x, ahead.y, ahead.z));
      if (f.visual.spin) {
        f.spin += dt * 12;
        (f.object.children[0] as Object3D | undefined)?.rotation.set(0, 0, f.spin);
      }
      f.history.unshift(p);
      f.history.length = Math.min(f.history.length, TRAIL);
      f.trail.forEach((s, i) => {
        const h = f.history[i + 1];
        s.visible = !!h;
        if (h) s.position.set(h.x, h.y, h.z);
      });
    }
  }

  get count(): number {
    return this.flights.size;
  }

  get ids(): string[] {
    return [...this.flights.keys()];
  }

  clear(): void {
    for (const f of [...this.flights.values()]) this.remove(f);
  }

  private remove(f: Flight): void {
    this.group.remove(f.object, ...f.trail);
    f.object.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    this.flights.delete(f.id);
  }
}

/** Builds a projectile pointing along +Z (lookAt aims +Z at the target). */
function buildProjectile(v: ProjectileVisual, textures: TextureFactory): Group {
  const g = new Group();
  const core = new MeshBasicMaterial({ color: v.color });
  const spinner = new Group();
  g.add(spinner);
  if (v.shape === "arrow") {
    const shaft = new Mesh(new CylinderGeometry(0.035, 0.035, v.size, 5), core);
    shaft.rotation.x = Math.PI / 2;
    const head = new Mesh(new ConeGeometry(0.07, 0.18, 5), new MeshBasicMaterial({ color: "#c9ced6" }));
    head.rotation.x = Math.PI / 2;
    head.position.z = v.size / 2 + 0.05;
    const fletch = new Mesh(new ConeGeometry(0.09, 0.16, 3), new MeshBasicMaterial({ color: "#d94a3a" }));
    fletch.rotation.x = -Math.PI / 2;
    fletch.position.z = -v.size / 2;
    spinner.add(shaft, head, fletch);
  } else if (v.shape === "rock") {
    // A chunky lobbed rock: flat-shaded so its tumbling reads clearly.
    const m = new Mesh(new DodecahedronGeometry(v.size, 0), new MeshLambertMaterial({ color: v.color, flatShading: true, emissive: v.glowColor, emissiveIntensity: 0.35 }));
    spinner.add(m);
  } else if (v.shape === "shard") {
    const m = new Mesh(new OctahedronGeometry(v.size, 0), core);
    m.scale.set(0.6, 0.6, 1.6);
    spinner.add(m);
  } else {
    spinner.add(new Mesh(new SphereGeometry(v.size, 12, 8), core));
  }
  if (v.shape !== "arrow" && v.shape !== "rock") {
    const halo = new Sprite(new SpriteMaterial({
      map: textures.glow(v.glowColor), color: v.glowColor, blending: AdditiveBlending, depthWrite: false, transparent: true,
    }));
    halo.scale.setScalar(v.size * 5);
    g.add(halo);
  }
  return g;
}
