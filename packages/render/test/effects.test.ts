import { Group } from "three";
import { describe, expect, it } from "vitest";
import { OverheadBar, ProjectileLayer, SPLAT_SECONDS, SplatLayer, arcPoint, blankTextureFactory, flightProgress, splatAnimation, splatSlot } from "../src";
import { resolveProjectileVisual } from "@sim/assets";

describe("splat timing", () => {
  it("appears at full size, holds still, and fades out quickly", () => {
    expect(splatAnimation(0)).toMatchObject({ scale: 1, opacity: 1, rise: 0 });
    expect(splatAnimation(0.5)).toMatchObject({ opacity: 1, done: false });
    expect(splatAnimation(SPLAT_SECONDS - 0.02).opacity).toBeLessThan(0.3);
    expect(splatAnimation(SPLAT_SECONDS).done).toBe(true);
  });

  it("places simultaneous splats in distinct slots", () => {
    const slots = [0, 1, 2, 3].map(splatSlot).map((s) => `${s.x},${s.y}`);
    expect(new Set(slots).size).toBe(4);
  });

  it("SplatLayer adds and expires sprites", () => {
    const layer = new SplatLayer(blankTextureFactory);
    const anchor = new Group();
    layer.add(anchor, 1, 12, 20);
    layer.add(anchor, 1, 0, 20);
    expect(layer.count).toBe(2);
    layer.update(SPLAT_SECONDS + 0.1);
    expect(layer.count).toBe(0);
  });

  it("reuses freed slots instead of stacking on a live splat", () => {
    const layer = new SplatLayer(blankTextureFactory);
    const anchor = new Group();
    layer.add(anchor, 1, 5, 20);
    layer.update(0.6);
    layer.add(anchor, 1, 6, 20); // slot 1
    layer.update(0.7); // the first splat expires; slot 0 frees up
    layer.add(anchor, 1, 7, 20);
    expect(layer.slotsOn(anchor).sort()).toEqual([0, 1]);
  });
});

describe("projectile timing", () => {
  it("flies from tick L-1 and arrives exactly at D-1, when the hit is shown", () => {
    expect(flightProgress(9, 10, 12)).toBe(0);
    expect(flightProgress(10, 10, 12)).toBe(0.5);
    expect(flightProgress(11, 10, 12)).toBe(1);
  });

  it("arcs peak at the midpoint", () => {
    const a = { x: 0, y: 1, z: 0 };
    const b = { x: 10, y: 1, z: 0 };
    expect(arcPoint(a, b, 2, 0.5)).toEqual({ x: 5, y: 3, z: 0 });
    expect(arcPoint(a, b, 2, 1)).toEqual(b);
  });

  it("ProjectileLayer holds a projectile at the target until its hit lands, then removes it", () => {
    const layer = new ProjectileLayer(blankTextureFactory);
    layer.launch("p1", resolveProjectileVisual("projectile.warden-ranged"), 5, 7, { from: { x: 0, y: 1, z: 0 }, to: () => ({ x: 5, y: 1, z: -5 }) });
    layer.update(4.5, 0.016, 5);
    expect(layer.count).toBe(1);
    // Showing tick 6 exactly (e.g. paused at tick 6): arrived, but the hit lands on tick 7.
    layer.update(6, 0.016, 6);
    expect(layer.count).toBe(1);
    // Tick 7 has been applied, even if the view still shows exactly tick 6: gone.
    layer.update(6, 0.016, 7);
    expect(layer.count).toBe(0);
  });
});

describe("OverheadBar", () => {
  it("shows after a hit and eases to the new health", () => {
    const bar = new OverheadBar(1, false);
    bar.update(0.016, false);
    expect(bar.group.visible).toBe(false);
    bar.setHealth(25, 100);
    bar.ping();
    for (let i = 0; i < 60; i++) bar.update(0.016, false);
    expect(bar.group.visible).toBe(true);
    expect(bar.displayedRatio).toBeCloseTo(0.25, 2);
    bar.update(0.016, true);
    expect(bar.group.visible).toBe(false);
  });
});

describe("HazardLayer", () => {
  it("shows warning tiles, swaps to burning tiles with flames, and removes expired hazards", async () => {
    const { HazardLayer } = await import("../src");
    const layer = new HazardLayer();
    const base = { id: "h1", sourceId: "npc-1", name: "area", tiles: [{ x: 1, y: 1 }, { x: 2, y: 1 }], detonateTick: 5, endTick: 9 };
    layer.sync([{ ...base, state: "warning" }]);
    expect(layer.count).toBe(1);
    expect(layer.group.children[0]!.children).toHaveLength(2);
    layer.update(4.2, 1000);
    layer.sync([{ ...base, state: "burning" }]);
    expect(layer.group.children[0]!.children).toHaveLength(4); // two tiles and two flames
    layer.sync([]);
    expect(layer.count).toBe(0);
  });
});

describe("compareRenderToSnapshot", () => {
  it("reports nothing when the drawing matches, and each difference when it does not", async () => {
    const { compareRenderToSnapshot } = await import("../src");
    const snapshot = {
      tick: 7,
      player: { id: "player", pos: { x: 1, y: 2 }, life: "alive", hitpoints: 50, maxHitpoints: 100, overhead: "magic" },
      npcs: [{ id: "npc-1", pos: { x: 5, y: 5 }, life: "alive", hitpoints: 30, maxHitpoints: 60, enraged: true, invulnerable: false }],
      projectiles: [{ id: "proj-1" }],
      hazards: [{ id: "hz-1", state: "warning" }],
    } as never;
    const drawn = {
      tick: 7,
      entities: [
        { id: "player", tile: { x: 1, y: 2 }, dead: false, healthRatio: 0.5, overhead: "magic", enraged: false, immune: false },
        { id: "npc-1", tile: { x: 5, y: 5 }, dead: false, healthRatio: 0.5, overhead: null, enraged: true, immune: false },
      ],
      projectiles: ["proj-1"],
      hazards: [{ id: "hz-1", state: "warning" as "warning" | "burning" }],
    };
    expect(compareRenderToSnapshot(drawn, snapshot)).toEqual([]);
    const wrong = structuredClone(drawn);
    wrong.entities[0]!.tile = { x: 2, y: 2 };
    wrong.entities[1]!.enraged = false;
    wrong.projectiles = [];
    wrong.hazards = [{ id: "hz-1", state: "burning" }];
    expect(compareRenderToSnapshot(wrong, snapshot)).toEqual([
      "player: drawn at 2,2, simulation 1,2",
      "npc-1: enraged drawn false, simulation true",
      "projectile proj-1: in flight but not drawn",
      "hazard hz-1: drawn burning, simulation warning",
    ]);
  });
});

describe("BurstLayer", () => {
  it("spawns rings that expand and expire", async () => {
    const { BurstLayer } = await import("../src");
    const b = new BurstLayer();
    b.spawn(1, -1, "#ff0000", 2, 0.5);
    expect(b.count).toBe(1);
    b.update(0.25);
    expect(b.count).toBe(1);
    b.update(0.3);
    expect(b.count).toBe(0);
  });
});
