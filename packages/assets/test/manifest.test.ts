import { describe, expect, it } from "vitest";
import { FALLBACK_PROJECTILE, FALLBACK_VISUAL, resolveArenaVisual, resolveProjectileVisual, resolveVisual } from "../src";

describe("asset manifest", () => {
  it("resolves known visuals", () => {
    expect(resolveVisual("player").placeholder.rig).toBe("humanoid");
    expect(resolveProjectileVisual("projectile.arrow").shape).toBe("arrow");
    expect(resolveArenaVisual("arena.cinder-hall").braziers).toBe(true);
  });

  it("falls back for unknown IDs instead of throwing", () => {
    expect(resolveVisual("nope")).toBe(FALLBACK_VISUAL);
    expect(resolveProjectileVisual("nope")).toBe(FALLBACK_PROJECTILE);
    expect(resolveArenaVisual(undefined).id).toBe("fallback");
  });
});
