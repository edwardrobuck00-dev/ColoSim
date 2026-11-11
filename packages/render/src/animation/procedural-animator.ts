import type { Object3D } from "three";
import type { Animator, Locomotion } from "./animator";
import { resolveCue } from "./cues";
import { PROCEDURAL_CLIPS, type JointName, type JointPose, type Pose, type ProceduralClip } from "./procedural-clips";

interface Rest {
  rx: number; ry: number; rz: number; px: number; py: number; pz: number;
}

const CHANNELS = ["rx", "ry", "rz", "px", "py", "pz"] as const;

/**
 * Animates a placeholder rig by offsetting named joints from their rest pose.
 * A looping locomotion layer runs underneath; one-shot actions override the
 * channels they touch, then hand control back.
 */
export class ProceduralAnimator implements Animator {
  private readonly rest = new Map<JointName, Rest>();
  private locomotion: Locomotion = "idle";
  private locoTime = 0;
  private action: { cue: string; clip: ProceduralClip; time: number } | null = null;
  private _dead = false;

  constructor(
    private readonly joints: Partial<Record<JointName, Object3D>>,
    private readonly clips: Readonly<Record<string, ProceduralClip>> = PROCEDURAL_CLIPS,
  ) {
    for (const [name, j] of Object.entries(joints) as Array<[JointName, Object3D]>) {
      this.rest.set(name, { rx: j.rotation.x, ry: j.rotation.y, rz: j.rotation.z, px: j.position.x, py: j.position.y, pz: j.position.z });
    }
  }

  get currentAction(): string | null {
    return this.action?.cue ?? null;
  }

  get dead(): boolean {
    return this._dead;
  }

  setLocomotion(state: Locomotion): void {
    this.locomotion = state;
  }

  play(cue: string): number {
    if (this._dead) return 0;
    const name = resolveCue(cue, (n) => n in this.clips);
    if (!name) return 0;
    const clip = this.clips[name]!;
    // A hit flinch never interrupts an attack in progress.
    if (name === "hit" && this.action && this.action.cue !== "hit") return 0;
    this.action = { cue: name, clip, time: 0 };
    if (name === "death") this._dead = true;
    return clip.duration;
  }

  update(dt: number): void {
    this.locoTime += dt;
    const pose: Pose = {};
    if (!this._dead) {
      const loco = this.clips[this.locomotion] ?? this.clips.idle;
      if (loco) merge(pose, loco.sample((this.locoTime / loco.duration) % 1));
    }
    if (this.action) {
      this.action.time += dt;
      const { clip, time } = this.action;
      const t = Math.min(1, time / clip.duration);
      merge(pose, clip.sample(t));
      if (t >= 1 && !clip.hold) this.action = null;
    }
    this.apply(pose);
  }

  dispose(): void {
    this.apply({});
  }

  private apply(pose: Pose): void {
    for (const [name, joint] of Object.entries(this.joints) as Array<[JointName, Object3D]>) {
      const r = this.rest.get(name)!;
      const p: JointPose = pose[name] ?? {};
      joint.rotation.set(r.rx + (p.rx ?? 0), r.ry + (p.ry ?? 0), r.rz + (p.rz ?? 0));
      joint.position.set(r.px + (p.px ?? 0), r.py + (p.py ?? 0), r.pz + (p.pz ?? 0));
    }
  }
}

/** Action channels replace locomotion channels joint by joint. */
function merge(into: Pose, from: Pose): void {
  for (const [name, jp] of Object.entries(from) as Array<[JointName, JointPose]>) {
    const target = (into[name] ??= {});
    for (const c of CHANNELS) if (jp[c] !== undefined) target[c] = jp[c];
  }
}
