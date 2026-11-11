import { AdditiveBlending, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry } from "three";

interface Live {
  mesh: Mesh<RingGeometry, MeshBasicMaterial>;
  age: number;
  seconds: number;
  radius: number;
}

const RING = new RingGeometry(0.75, 1, 28).rotateX(-Math.PI / 2);

/**
 * Short expanding rings on the floor: fire bursting on detonated tiles,
 * phase changes, enrage, special attacks. Purely visual; each is triggered
 * by an engine event.
 */
export class BurstLayer {
  readonly group = new Group();
  private readonly live: Live[] = [];

  constructor() {
    this.group.name = "bursts";
  }

  spawn(x: number, z: number, color: string, radius = 1, seconds = 0.5): void {
    const mesh = new Mesh(RING, new MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, blending: AdditiveBlending, side: DoubleSide }));
    mesh.position.set(x, 0.05, z);
    mesh.scale.setScalar(0.2 * radius);
    mesh.renderOrder = 3;
    this.group.add(mesh);
    this.live.push({ mesh, age: 0, seconds, radius });
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const l = this.live[i]!;
      l.age += dt;
      const k = Math.min(1, l.age / l.seconds);
      l.mesh.scale.setScalar(l.radius * (0.2 + 0.8 * k));
      l.mesh.material.opacity = 0.9 * (1 - k);
      if (k >= 1) {
        this.group.remove(l.mesh);
        l.mesh.material.dispose();
        this.live.splice(i, 1);
      }
    }
  }

  get count(): number {
    return this.live.length;
  }

  clear(): void {
    for (const l of this.live) l.mesh.material.dispose();
    this.live.length = 0;
    this.group.clear();
  }
}
