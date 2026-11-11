import { PerspectiveCamera, Vector3 } from "three";
import { lerp } from "../interpolation";

/**
 * Orbit camera around a target point. Has no input listeners of its own:
 * the app's input layer calls rotate() and zoom() from keybinds and mouse.
 */
export class OrbitCamera {
  readonly camera = new PerspectiveCamera(45, 1, 0.1, 500);
  yaw = 0;
  pitch = 0.9;
  distance = 18;
  readonly target = new Vector3();
  private readonly desiredTarget = new Vector3();

  static readonly MIN_PITCH = 0.3;
  static readonly MAX_PITCH = 1.45;
  static readonly MIN_DISTANCE = 5;
  static readonly MAX_DISTANCE = 45;

  rotate(deltaYaw: number, deltaPitch: number): void {
    this.yaw += deltaYaw;
    this.pitch = Math.min(OrbitCamera.MAX_PITCH, Math.max(OrbitCamera.MIN_PITCH, this.pitch + deltaPitch));
  }

  zoom(factor: number): void {
    this.distance = Math.min(OrbitCamera.MAX_DISTANCE, Math.max(OrbitCamera.MIN_DISTANCE, this.distance * factor));
  }

  /** Moves the focus point smoothly over the next few frames. */
  follow(x: number, z: number, snap = false): void {
    this.desiredTarget.set(x, 0, z);
    if (snap) this.target.copy(this.desiredTarget);
  }

  /** Default view of an arena: looking north, zoomed to fit, focused on `focus`. */
  frame(arenaWidth: number, arenaHeight: number, focus: { x: number; z: number }): void {
    this.yaw = 0;
    // Close, fairly steep view like the classic default camera; zoom out with the wheel.
    this.pitch = 0.78;
    this.distance = Math.min(OrbitCamera.MAX_DISTANCE, Math.max(12, Math.max(arenaWidth, arenaHeight) * 0.85));
    this.follow(focus.x, focus.z, true);
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  update(dtSeconds: number): void {
    const k = 1 - Math.exp(-dtSeconds * 6);
    this.target.set(
      lerp(this.target.x, this.desiredTarget.x, k),
      0,
      lerp(this.target.z, this.desiredTarget.z, k),
    );
    const horizontal = Math.cos(this.pitch) * this.distance;
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * horizontal,
      Math.sin(this.pitch) * this.distance,
      this.target.z + Math.cos(this.yaw) * horizontal,
    );
    this.camera.lookAt(this.target);
  }
}
