import { resolveVisual } from "@sim/assets";
import { describe, expect, it } from "vitest";
import { EntityView, angleDelta, tileToWorld } from "../src";

const view = () => new EntityView("player", "player", 1, resolveVisual("player"), { x: 2, y: 2 }, null);

describe("EntityView", () => {
  it("shows the overhead prayer badge above the bar and hides it when off or dead", () => {
    const v = view();
    expect(v.overhead.sprite.visible).toBe(false);
    v.setOverhead("melee");
    expect(v.overhead.sprite.visible).toBe(true);
    expect(v.overhead.current).toBe("melee");
    expect(v.overhead.sprite.position.y).toBeGreaterThan(v.bar.group.position.y);
    v.setOverhead(null);
    expect(v.overhead.sprite.visible).toBe(false);
    v.setOverhead("magic");
    v.die(0);
    expect(v.overhead.sprite.visible).toBe(false);
  });

  it("interpolates linearly between tiles", () => {
    const v = view();
    v.moveTo({ x: 4, y: 2 }, true);
    v.update(0.5, 0.016, null);
    expect(v.root.position.x).toBeCloseTo(tileToWorld({ x: 3, y: 2 }).x);
    v.update(1, 0.016, null);
    expect(v.root.position.x).toBeCloseTo(tileToWorld({ x: 4, y: 2 }).x);
  });

  it("uses the run animation while running and idles when stopped", () => {
    const v = view();
    v.moveTo({ x: 4, y: 2 }, true);
    v.update(0.3, 0.016, null);
    expect(v.isMoving).toBe(true);
  });

  it("turns toward its target over time", () => {
    const v = view();
    const east = { x: 10, y: 0, z: tileToWorld({ x: 2, y: 2 }).z };
    for (let i = 0; i < 30; i++) v.update(1, 0.016, east);
    expect(v.character.object.rotation.y).toBeCloseTo(Math.PI / 2, 2);
  });

  it("death keeps the body until despawn, then removal waits for the animation", () => {
    const v = view();
    v.die(1000);
    expect(v.isDead).toBe(true);
    expect(v.removeAfterMs).toBeNull();
    v.despawn(1100);
    expect(v.removeAfterMs).toBeGreaterThan(1100 + 500);
  });

  it("weapon props attach to the rig's hands", () => {
    const v = view();
    let meshes = 0;
    v.character.object.traverse(() => meshes++);
    v.setEquipment({}, "powered-staff");
    let after = 0;
    v.character.object.traverse(() => after++);
    expect(after).toBeGreaterThan(meshes);
  });

  it("dresses the humanoid in its worn gear", () => {
    const v = view();
    let before = 0;
    v.character.object.traverse(() => before++);
    v.setEquipment({ weapon: { itemId: "abyssal-whip" }, head: { itemId: "helm-of-neitiznot" }, cape: { itemId: "fire-cape" }, shield: { itemId: "dragon-defender" }, legs: { itemId: "bandos-tassets" } }, "whip");
    let after = 0;
    v.character.object.traverse(() => after++);
    expect(after).toBeGreaterThan(before + 8);
    // Taking everything off removes the worn pieces again.
    v.setEquipment({}, null);
    let bare = 0;
    v.character.object.traverse(() => bare++);
    expect(bare).toBe(before);
  });
});

describe("angleDelta", () => {
  it("takes the shortest way round", () => {
    expect(angleDelta(3, -3)).toBeCloseTo(2 * Math.PI - 6);
  });
});
