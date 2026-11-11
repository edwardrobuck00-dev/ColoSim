import type { ArenaVisual } from "@sim/assets";
import type { WorldSnapshot } from "@sim/engine";
import {
  AdditiveBlending, BoxGeometry, BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry,
  DodecahedronGeometry, Group, HemisphereLight, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshLambertMaterial, PlaneGeometry, PointLight, Points, PointsMaterial, Sprite, SpriteMaterial,
  type DirectionalLight,
} from "three";
import type { TextureFactory } from "../effects/textures";

export interface ArenaScene {
  group: Group;
  /** Animated details (flames, embers). */
  update(dt: number, nowMs: number): void;
  dispose(): void;
}

/** Deterministic per-tile noise in [0, 1). */
export function tileNoise(x: number, y: number): number {
  let h = Math.imul(x * 374761393 + y * 668265263, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 0x1_0000_0000;
}

/** Smooth value noise built from tileNoise, for terrain colour blotches. */
export function smoothNoise(x: number, y: number, scale: number): number {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const s = (t: number) => t * t * (3 - 2 * t);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const top = lerp(tileNoise(x0, y0), tileNoise(x0 + 1, y0), s(tx));
  const bottom = lerp(tileNoise(x0, y0 + 1), tileNoise(x0 + 1, y0 + 1), s(tx));
  return lerp(top, bottom, s(ty));
}

/** Matte flat-shaded material (no specular), the classic low-poly look. */
const matte = (color: string | Color) => new MeshLambertMaterial({ color, flatShading: true });
const hex = (c: Color) => `#${c.getHexString()}`;
const tint = (color: string, k: number) => hex(new Color(color).multiplyScalar(k));

/**
 * Builds the arena. One unit = one tile; tile (x, y) spans world X [x, x+1]
 * and Z [-(y+1), -y]. The floor is a single vertex-coloured terrain mesh
 * (no visible tile boxes; tile markers show the grid where it matters),
 * surrounded by a fence or tiered stone stands. Lighting is soft and even,
 * with no shadow maps.
 */
export function buildArena(
  arena: WorldSnapshot["arena"],
  visual: ArenaVisual,
  sun: DirectionalLight,
  textures: TextureFactory,
): ArenaScene {
  const group = new Group();
  group.name = "arena";
  const { width: w, height: h } = arena;
  const animated: Array<(dt: number, now: number) => void> = [];
  const cx = w / 2;
  const cz = -h / 2;

  group.add(new HemisphereLight(visual.skyColor, visual.groundColor, visual.ambientIntensity));
  sun.color.set(visual.sunColor);
  sun.intensity = visual.sunIntensity;
  sun.position.set(cx - w * 0.5, Math.max(w, h) * 1.2, cz + h * 0.9);
  sun.target.position.set(cx, 0, cz);

  // Ground beyond the arena.
  const outside = new Mesh(new PlaneGeometry(400, 400).rotateX(-Math.PI / 2), matte(tint(visual.edgeColor, 0.75)));
  outside.position.set(cx, -0.02, cz);
  group.add(outside);

  group.add(buildFloor(w, h, visual));

  if (visual.surround === "stands") group.add(buildStands(w, h, visual));
  else group.add(buildFence(w, h, visual));

  for (const t of arena.blocked) group.add(buildObstacle(visual, t.x + 0.5, -(t.y + 0.5), tileNoise(t.x, t.y)));

  if (visual.braziers) {
    const spots: Array<[number, number]> = [[-1, -1], [w, -1], [-1, h], [w, h]];
    // Only two braziers cast light: each point light adds cost to every lit pixel.
    for (const [k, [x, y]] of spots.entries()) {
      const br = buildBrazier(textures, k === 0 || k === 3);
      br.group.position.set(x + 0.5, visual.surround === "stands" ? 1.75 : 1.2, -(y + 0.5));
      group.add(br.group);
      animated.push(br.update);
    }
  }

  if (visual.embers) {
    const em = buildEmbers(w, h);
    group.add(em.points);
    animated.push(em.update);
  }

  return {
    group,
    update: (dt, now) => animated.forEach((f) => f(dt, now)),
    dispose: () =>
      group.traverse((o) => {
        const mesh = o as Mesh;
        if (mesh.isMesh) mesh.geometry.dispose();
      }),
  };
}

/** Terrain: two vertices per tile edge, coloured with smooth blotches and darker, worn edges. */
function buildFloor(w: number, h: number, v: ArenaVisual): Mesh {
  const seg = 2;
  const geo = new PlaneGeometry(w, h, w * seg, h * seg).rotateX(-Math.PI / 2);
  geo.translate(w / 2, 0, -h / 2);
  const pos = geo.attributes.position!;
  const colors = new Float32Array(pos.count * 3);
  const a = new Color(v.floorColor);
  const b = new Color(v.floorAltColor);
  const edge = new Color(v.edgeColor);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = -pos.getZ(i);
    const n = smoothNoise(x, y, 4) * 0.6 + smoothNoise(x + 40, y + 40, 1.5) * 0.4;
    c.copy(a).lerp(b, Math.min(1, Math.max(0, (n - 0.25) * 2)));
    const fine = tileNoise(Math.round(x * seg), Math.round(y * seg));
    c.multiplyScalar(0.9 + fine * 0.16);
    const d = Math.min(x, y, w - x, h - y);
    if (d < 1.6) c.lerp(edge, (1 - d / 1.6) * 0.55);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new BufferAttribute(colors, 3));
  const floor = new Mesh(geo, new MeshLambertMaterial({ vertexColors: true }));
  floor.name = "floor";
  return floor;
}

/** A row of boxes around the arena, `offset` tiles outside the floor edge. */
function ring(w: number, h: number, offset: number, depth: number, height: number, y: number, color: string, jitter = 0.08): InstancedMesh {
  const spots: Array<{ x: number; z: number; sx: number; sz: number }> = [];
  const lo = -offset - depth / 2;
  const hiX = w + offset + depth / 2;
  const hiY = h + offset + depth / 2;
  for (let x = Math.floor(lo); x < Math.ceil(hiX); x++) {
    spots.push({ x: x + 0.5, z: -lo, sx: 1, sz: depth }, { x: x + 0.5, z: -hiY, sx: 1, sz: depth });
  }
  for (let yy = Math.floor(lo + depth); yy < Math.ceil(hiY - depth); yy++) {
    spots.push({ x: lo, z: -(yy + 0.5), sx: depth, sz: 1 }, { x: hiX, z: -(yy + 0.5), sx: depth, sz: 1 });
  }
  const mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), matte("#ffffff"), spots.length);
  const m = new Matrix4();
  const base = new Color(color);
  const c = new Color();
  spots.forEach((s, i) => {
    const n = tileNoise(Math.floor(s.x * 3), Math.floor(s.z * 3 + offset * 7));
    m.makeScale(s.sx * 1.001, height, s.sz).setPosition(s.x, y + height / 2, s.z);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.copy(base).multiplyScalar(1 - jitter + n * jitter * 2));
  });
  return mesh;
}

/** Tiered stone stands: a podium wall with a capstone, then rising tiers, banners on the wall. */
function buildStands(w: number, h: number, v: ArenaVisual): Group {
  const g = new Group();
  g.name = "stands";
  const wall = v.wallColor;
  g.add(ring(w, h, 0.5, 1, 1.4, 0, tint(wall, 0.82)));
  g.add(ring(w, h, 0.5, 1.15, 0.18, 1.4, tint(wall, 1.12), 0.04)); // capstone
  for (let k = 0; k < 4; k++) {
    g.add(ring(w, h, 1.6 + k * 1.1, 1.1, 0.75, 1.4 + k * 0.75, tint(wall, 0.95 - k * 0.04)));
  }
  g.add(ring(w, h, 6.2, 1.2, 2.6, 0, tint(wall, 0.7))); // back wall

  // Banners hanging on the podium wall, two per side.
  const cloth = matte("#9a2a22");
  const trim = matte("#d8b04a");
  const banner = (x: number, z: number, rotY: number) => {
    const b = new Group();
    b.add(new Mesh(new BoxGeometry(0.7, 1.0, 0.05), cloth));
    const t = new Mesh(new BoxGeometry(0.74, 0.1, 0.07), trim);
    t.position.y = 0.48;
    b.add(t);
    const tip = new Mesh(new ConeGeometry(0.35, 0.3, 4), cloth);
    tip.rotation.set(Math.PI, Math.PI / 4, 0);
    tip.scale.z = 0.12;
    tip.position.y = -0.62;
    b.add(tip);
    b.position.set(x, 0.85, z);
    b.rotation.y = rotY;
    g.add(b);
  };
  for (const f of [0.3, 0.7]) {
    banner(w * f, 0.03, 0); // south wall, facing north
    banner(w * f, -h - 0.03, Math.PI);
    banner(-0.03, -h * f, -Math.PI / 2);
    banner(w + 0.03, -h * f, Math.PI / 2);
  }
  return g;
}

/** Low wooden fence: posts every two tiles with two rails. */
function buildFence(w: number, h: number, v: ArenaVisual): Group {
  const g = new Group();
  g.name = "fence";
  const wood = matte(v.wallColor);
  const dark = matte(tint(v.wallColor, 0.75));
  const o = 0.5;
  const corners: Array<[number, number]> = [[-o, o], [w + o, o], [w + o, -h - o], [-o, -h - o]];
  for (let i = 0; i < 4; i++) {
    const [x1, z1] = corners[i]!;
    const [x2, z2] = corners[(i + 1) % 4]!;
    const len = Math.hypot(x2 - x1, z2 - z1);
    const posts = Math.ceil(len / 2);
    for (let k = 0; k < posts; k++) {
      const t = k / posts;
      const post = new Mesh(new BoxGeometry(0.16, 1.0, 0.16), dark);
      post.position.set(x1 + (x2 - x1) * t, 0.5, z1 + (z2 - z1) * t);
      g.add(post);
    }
    for (const y of [0.45, 0.8]) {
      const rail = new Mesh(new BoxGeometry(len, 0.08, 0.06), wood);
      rail.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
      rail.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
      g.add(rail);
    }
  }
  return g;
}

function buildObstacle(v: ArenaVisual, x: number, z: number, n: number): Group {
  const g = new Group();
  g.position.set(x, 0, z);
  if (v.obstacle === "pillar") {
    const mat = matte(tint(v.wallColor, 1.05));
    const light = matte(tint(v.wallColor, 1.2));
    g.add(new Mesh(new BoxGeometry(0.98, 0.3, 0.98), light).translateY(0.15));
    // Broken column stumps: tall enough to read as cover, low enough that
    // the camera can always see a player standing behind them.
    const height = 0.8 + n * 0.6;
    g.add(new Mesh(new CylinderGeometry(0.34, 0.38, height, 8), mat).translateY(height / 2 + 0.3));
    const top = new Mesh(new CylinderGeometry(0.3, 0.34, 0.25, 8), light);
    top.position.y = height + 0.38;
    top.rotation.z = 0.25 + n * 0.2;
    g.add(top);
    const rubble = new Mesh(new DodecahedronGeometry(0.16, 0), light);
    rubble.position.set(0.42, 0.12, 0.3 - n * 0.6);
    g.add(rubble);
  } else if (v.obstacle === "post") {
    const wood = matte("#6b4a2e");
    g.add(new Mesh(new CylinderGeometry(0.16, 0.2, 1.5, 7), wood).translateY(0.75));
    g.add(new Mesh(new ConeGeometry(0.2, 0.25, 7), wood).translateY(1.62));
    g.add(new Mesh(new CylinderGeometry(0.2, 0.2, 0.08, 7), matte("#c9b07a")).translateY(1.1));
  } else {
    const rock = new Mesh(new DodecahedronGeometry(0.55, 0), matte(v.wallColor));
    rock.position.y = 0.4;
    rock.rotation.set(n * 3, n * 5, 0);
    g.add(rock);
  }
  return g;
}

function buildBrazier(textures: TextureFactory, withLight: boolean): { group: Group; update: (dt: number, now: number) => void } {
  const g = new Group();
  const iron = matte("#3a3230");
  const stand = new Mesh(new CylinderGeometry(0.08, 0.14, 0.5, 6), iron);
  stand.position.y = -0.25;
  const bowl = new Mesh(new CylinderGeometry(0.42, 0.24, 0.3, 8), iron);
  const flame = new Mesh(new ConeGeometry(0.24, 0.7, 7), new MeshBasicMaterial({ color: "#ffb347", transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false }));
  flame.position.y = 0.45;
  const halo = new Sprite(new SpriteMaterial({ map: textures.glow("#ff7a2a"), color: "#ff7a2a", blending: AdditiveBlending, depthWrite: false, transparent: true }));
  halo.position.y = 0.45;
  halo.scale.setScalar(2.0);
  const light = new PointLight("#ff8a3d", 12, 10, 1.5);
  light.position.y = 0.8;
  g.add(stand, bowl, flame, halo);
  if (withLight) g.add(light);
  const seed = Math.random() * 100; // purely cosmetic flicker; never affects the simulation
  return {
    group: g,
    update: (_dt, now) => {
      const t = now / 1000 + seed;
      const f = 0.85 + 0.1 * Math.sin(t * 9.1) + 0.05 * Math.sin(t * 23.7);
      light.intensity = 12 * f;
      flame.scale.set(1, f * 1.1, 1);
      halo.material.opacity = 0.5 + 0.25 * f;
    },
  };
}

function buildEmbers(w: number, h: number): { points: Points; update: (dt: number, now: number) => void } {
  const count = Math.round(w * h * 0.12);
  const pos = new Float32Array(count * 3);
  const speed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = Math.random() * w;
    pos[i * 3 + 1] = Math.random() * 6;
    pos[i * 3 + 2] = -Math.random() * h;
    speed[i] = 0.3 + Math.random() * 0.6;
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(pos, 3));
  const points = new Points(geo, new PointsMaterial({ color: "#ff9a4d", size: 0.06, transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false }));
  return {
    points,
    update: (dt, now) => {
      for (let i = 0; i < count; i++) {
        pos[i * 3 + 1]! += speed[i]! * dt;
        pos[i * 3]! += Math.sin(now / 900 + i) * dt * 0.15;
        if (pos[i * 3 + 1]! > 6) pos[i * 3 + 1] = 0;
      }
      geo.attributes.position!.needsUpdate = true;
    },
  };
}
