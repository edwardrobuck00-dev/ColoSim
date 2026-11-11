import type { Tile } from "@sim/engine";
import { EdgesGeometry, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, PlaneGeometry } from "three";

function tileQuad(color: number, opacity: number, y: number): Group {
  const g = new Group();
  const plane = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  if (opacity > 0) g.add(new Mesh(plane, new MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })));
  g.add(new LineSegments(new EdgesGeometry(plane), new LineBasicMaterial({ color })));
  g.position.y = y;
  g.visible = false;
  return g;
}

/**
 * Flat markers on the floor: hover highlight, walk destination, the player's
 * true tile (where the engine has them, as opposed to the smoothed model) and
 * the current target's footprint.
 */
export class TileOverlays {
  readonly group = new Group();
  private readonly hover = tileQuad(0xffffff, 0.12, 0.01);
  private readonly destination = tileQuad(0xffd23f, 0.22, 0.012);
  private readonly trueTile = tileQuad(0x7fe3ff, 0, 0.014);
  private readonly target = tileQuad(0xff7a3d, 0.1, 0.016);

  constructor() {
    this.group.name = "overlays";
    this.group.add(this.hover, this.destination, this.trueTile, this.target);
  }

  setHover(t: Tile | null): void {
    place(this.hover, t, 1);
  }

  setDestination(t: Tile | null): void {
    place(this.destination, t, 1);
  }

  setTrueTile(t: Tile | null): void {
    place(this.trueTile, t, 1);
  }

  setTargetFootprint(origin: Tile | null, size = 1): void {
    place(this.target, origin, size);
  }
}

function place(obj: Group, t: Tile | null, size: number): void {
  obj.visible = t !== null;
  if (!t) return;
  obj.scale.set(size, 1, size);
  obj.position.set(t.x + size / 2, obj.position.y, -(t.y + size / 2));
}
