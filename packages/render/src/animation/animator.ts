/** Movement state, chosen by the renderer from how an entity moved this tick. */
export type Locomotion = "idle" | "walk" | "run";

/**
 * Plays animations for one character. Two implementations exist:
 * ProceduralAnimator (placeholder rigs) and GltfAnimator (real models).
 * Callers only ever speak in engine cues ("attack.slash", "hit", "death").
 */
export interface Animator {
  setLocomotion(state: Locomotion): void;
  /** Plays a one-shot action. Returns its duration in seconds (0 if nothing could be played). */
  play(cue: string): number;
  update(dtSeconds: number): void;
  /** The action currently playing, if any. */
  readonly currentAction: string | null;
  /** True once a death animation has started; the character then holds its final pose. */
  readonly dead: boolean;
  dispose(): void;
}
