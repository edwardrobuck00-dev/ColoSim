import { resolveVisual } from "@sim/assets";
import { AnimationClip, Group, NumberKeyframeTrack, Object3D } from "three";
import { describe, expect, it } from "vitest";
import { GltfAnimator, PROCEDURAL_CLIPS, ProceduralAnimator, buildRig, cueFallbacks, keys, resolveCue } from "../src";

describe("cues", () => {
  it("falls back from specific to general", () => {
    expect(cueFallbacks("attack.slash.heavy")).toEqual(["attack.slash.heavy", "attack.slash", "attack"]);
    expect(resolveCue("attack.weird", (n) => n === "attack")).toBe("attack");
    expect(resolveCue("dance", () => false)).toBeNull();
  });
});

describe("keyframes", () => {
  it("passes through its keys and holds the ends", () => {
    const f = keys([[0, 0], [0.5, 2], [1, 0]]);
    expect(f(0)).toBe(0);
    expect(f(0.5)).toBe(2);
    expect(f(1)).toBe(0);
    expect(f(2)).toBe(0);
  });
});

describe("procedural clips", () => {
  it("one-shot actions start and end at the rest pose", () => {
    for (const [name, clip] of Object.entries(PROCEDURAL_CLIPS)) {
      if (clip.loop || clip.hold) continue;
      for (const t of [0, 1]) {
        for (const jp of Object.values(clip.sample(t))) {
          for (const v of Object.values(jp ?? {})) expect(Math.abs(v as number), `${name} at t=${t}`).toBeLessThan(1e-9);
        }
      }
    }
  });

  it("every sample is finite", () => {
    for (const clip of Object.values(PROCEDURAL_CLIPS)) {
      for (let t = 0; t <= 1; t += 0.05) {
        for (const jp of Object.values(clip.sample(t))) for (const v of Object.values(jp ?? {})) expect(Number.isFinite(v)).toBe(true);
      }
    }
  });
});

describe("ProceduralAnimator", () => {
  const rig = () => buildRig(resolveVisual("player"), 1);

  it("plays an attack, moves the arm, and returns to rest", () => {
    const r = rig();
    const anim = new ProceduralAnimator(r.joints);
    const rest = r.joints.armR!.rotation.x;
    expect(anim.play("attack.slash")).toBeGreaterThan(0);
    anim.update(0.2);
    expect(r.joints.armR!.rotation.x).not.toBeCloseTo(rest, 2);
    expect(anim.currentAction).toBe("attack.slash");
    anim.update(1);
    expect(anim.currentAction).toBeNull();
  });

  it("a hit does not interrupt an attack, and death holds its pose", () => {
    const r = rig();
    const anim = new ProceduralAnimator(r.joints);
    anim.play("attack.crush");
    expect(anim.play("hit")).toBe(0);
    anim.play("death");
    anim.update(5);
    expect(anim.dead).toBe(true);
    expect(anim.currentAction).toBe("death");
    expect(r.joints.root!.rotation.z).toBeGreaterThan(1);
  });

  it("works on rigs without arms (the dummy)", () => {
    const r = buildRig(resolveVisual("npc.training-dummy"), 1);
    const anim = new ProceduralAnimator(r.joints);
    anim.play("attack.slash");
    anim.play("hit");
    expect(() => anim.update(0.1)).not.toThrow();
  });
});

describe("GltfAnimator", () => {
  function model() {
    const root = new Group();
    const arm = new Object3D();
    arm.name = "arm";
    root.add(arm);
    const clip = (name: string, d: number) => new AnimationClip(name, d, [new NumberKeyframeTrack("arm.position[y]", [0, d], [0, 1])]);
    return { root, arm, clips: [clip("Idle", 1), clip("Walk", 1), clip("Swing", 0.5), clip("Die", 1)] };
  }

  it("maps cues to clips through the visual's animation map with fallbacks", () => {
    const { root, clips } = model();
    const anim = new GltfAnimator(root, clips, { idle: "Idle", walk: "Walk", attack: "Swing", death: "Die" });
    expect(anim.clipFor("attack.slash")?.name).toBe("Swing");
    expect(anim.clipFor("run")).toBeNull();
    expect(anim.play("attack.slash")).toBe(0.5);
    expect(anim.currentAction).toBe("attack.slash");
    anim.update(0.6);
    expect(anim.currentAction).toBeNull();
  });

  it("drives the model's nodes and holds death", () => {
    const { root, arm, clips } = model();
    const anim = new GltfAnimator(root, clips, { idle: "Idle", death: "Die" });
    anim.play("death");
    anim.update(2);
    expect(anim.dead).toBe(true);
    expect(arm.position.y).toBeGreaterThan(0.5);
  });
});
