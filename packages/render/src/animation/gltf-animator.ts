import { AnimationMixer, LoopOnce, LoopRepeat, type AnimationAction, type AnimationClip, type Object3D } from "three";
import type { Animator, Locomotion } from "./animator";
import { resolveCue } from "./cues";

const FADE = 0.15;

/**
 * Plays a real model's animation clips. `cueMap` (from the visual definition)
 * maps engine cues to clip names; unmapped cues use the cue itself as the clip
 * name, then fall back along the cue chain ("attack.slash" -> "attack").
 */
export class GltfAnimator implements Animator {
  private readonly mixer: AnimationMixer;
  private readonly clips = new Map<string, AnimationClip>();
  private loco: AnimationAction | null = null;
  private locoState: Locomotion | null = null;
  private action: { cue: string; action: AnimationAction; remaining: number } | null = null;
  private _dead = false;

  constructor(root: Object3D, clips: readonly AnimationClip[], private readonly cueMap: Readonly<Record<string, string>> = {}) {
    this.mixer = new AnimationMixer(root);
    for (const c of clips) this.clips.set(c.name, c);
    this.setLocomotion("idle");
  }

  get currentAction(): string | null {
    return this.action?.cue ?? null;
  }

  get dead(): boolean {
    return this._dead;
  }

  /** Finds the clip for a cue, honouring the cue map and the fallback chain. */
  clipFor(cue: string): AnimationClip | null {
    const name = resolveCue(cue, (n) => this.clips.has(this.cueMap[n] ?? n));
    return name ? this.clips.get(this.cueMap[name] ?? name)! : null;
  }

  setLocomotion(state: Locomotion): void {
    if (this._dead || state === this.locoState) return;
    const clip = this.clipFor(state) ?? this.clipFor("idle");
    this.locoState = state;
    if (!clip) return;
    const next = this.mixer.clipAction(clip).setLoop(LoopRepeat, Infinity);
    if (next !== this.loco) {
      next.reset().fadeIn(FADE).play();
      this.loco?.fadeOut(FADE);
      this.loco = next;
    }
  }

  play(cue: string): number {
    if (this._dead) return 0;
    const clip = this.clipFor(cue);
    if (!clip) return 0;
    const isDeath = cue === "death";
    if (cue === "hit" && this.action) return 0;
    this.action?.action.fadeOut(FADE);
    const action = this.mixer.clipAction(clip).setLoop(LoopOnce, 1);
    action.clampWhenFinished = isDeath;
    action.reset().fadeIn(FADE).play();
    this.action = { cue, action, remaining: clip.duration };
    if (isDeath) {
      this._dead = true;
      this.loco?.fadeOut(FADE);
    }
    return clip.duration;
  }

  update(dt: number): void {
    this.mixer.update(dt);
    if (this.action && !this._dead) {
      this.action.remaining -= dt;
      if (this.action.remaining <= 0) {
        this.action.action.fadeOut(FADE);
        this.action = null;
      }
    }
  }

  dispose(): void {
    this.mixer.stopAllAction();
  }
}
