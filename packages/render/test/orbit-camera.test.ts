import { describe, expect, it } from "vitest";
import { OrbitCamera } from "../src";

describe("OrbitCamera", () => {
  it("clamps pitch and zoom", () => {
    const c = new OrbitCamera();
    c.rotate(0, 100);
    expect(c.pitch).toBe(OrbitCamera.MAX_PITCH);
    c.zoom(0.0001);
    expect(c.distance).toBe(OrbitCamera.MIN_DISTANCE);
  });

  it("looks at the followed point after snapping", () => {
    const c = new OrbitCamera();
    c.follow(5, -5, true);
    c.update(0.016);
    expect(c.target.x).toBeCloseTo(5);
    expect(c.camera.position.y).toBeGreaterThan(0);
  });
});
