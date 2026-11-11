import type { Tile } from "@sim/engine";
import { Plane, Raycaster, Vector2, Vector3, type Camera, type Object3D } from "three";
import { worldToTile } from "./coords";

const ground = new Plane(new Vector3(0, 1, 0), 0);
const raycaster = new Raycaster();
const ndc = new Vector2();
const hit = new Vector3();

/** Converts client coordinates to normalised device coordinates for a given element rectangle. */
export function toNdc(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }) {
  return { x: ((clientX - rect.left) / rect.width) * 2 - 1, y: -((clientY - rect.top) / rect.height) * 2 + 1 };
}

export function pickGroundTile(camera: Camera, x: number, y: number): Tile | null {
  ndc.set(x, y);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.ray.intersectPlane(ground, hit) ? worldToTile(hit.x, hit.z) : null;
}

export function pickObject(camera: Camera, x: number, y: number, objects: Object3D[], recursive = false): Object3D | null {
  ndc.set(x, y);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObjects(objects, recursive)[0]?.object ?? null;
}
