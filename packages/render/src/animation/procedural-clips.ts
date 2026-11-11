import { keys, wave } from "./keyframes";

/** Named joints on a placeholder rig. Rigs may omit any of them. */
export type JointName = "root" | "body" | "head" | "armL" | "armR" | "legL" | "legR";

/** Offsets from a joint's rest transform: rotation in radians, position in tiles. */
export interface JointPose {
  rx?: number;
  ry?: number;
  rz?: number;
  px?: number;
  py?: number;
  pz?: number;
}
export type Pose = Partial<Record<JointName, JointPose>>;

export interface ProceduralClip {
  /** Seconds for one play (or one loop cycle). */
  duration: number;
  loop: boolean;
  /** Death-style clips hold their final frame. */
  hold?: boolean;
  sample(t: number): Pose;
}

// Conventions: characters face +Z. Arms hang along -Y from the shoulder, so
// rx = -PI/2 points an arm straight forward and rx = -PI points it up.

const idle: ProceduralClip = {
  duration: 2.4,
  loop: true,
  sample: (t) => ({
    body: { py: 0.015 * wave(t), rx: 0.02 * wave(t) },
    armL: { rz: 0.06 + 0.03 * wave(t) },
    armR: { rz: -0.06 - 0.03 * wave(t) },
    head: { ry: 0.06 * wave(t, 0.5) },
  }),
};

const stride = (amp: number, lean: number, bounce: number): ProceduralClip => ({
  // One cycle = two steps. At 1 tile per tick (walk) that is 1.2 s; running doubles cadence.
  duration: 1.2,
  loop: true,
  sample: (t) => ({
    legL: { rx: amp * wave(t) },
    legR: { rx: -amp * wave(t) },
    armL: { rx: -amp * 0.8 * wave(t), rz: 0.08 },
    armR: { rx: amp * 0.8 * wave(t), rz: -0.08 },
    body: { rx: lean, py: bounce * Math.abs(wave(t)) },
  }),
});

const walk = stride(0.55, 0.04, 0.03);
const run: ProceduralClip = { ...stride(0.9, 0.18, 0.06), duration: 0.6 };

const slash: ProceduralClip = {
  duration: 0.55,
  loop: false,
  sample: (t) => ({
    armR: { rx: keys([[0, 0], [0.35, -2.5], [0.6, -0.4], [1, 0]])(t), rz: keys([[0, 0], [0.35, -0.5], [0.6, 0.6], [1, 0]])(t) },
    body: { ry: keys([[0, 0], [0.35, 0.35], [0.6, -0.35], [1, 0]])(t) },
  }),
};

const stab: ProceduralClip = {
  duration: 0.45,
  loop: false,
  sample: (t) => ({
    armR: { rx: keys([[0, 0], [0.3, -0.9], [0.5, -1.6], [1, 0]])(t) },
    body: { pz: keys([[0, 0], [0.5, 0.12], [1, 0]])(t), ry: keys([[0, 0], [0.5, -0.2], [1, 0]])(t) },
  }),
};

const crush: ProceduralClip = {
  duration: 0.75,
  loop: false,
  sample: (t) => {
    const arms = keys([[0, 0], [0.4, -2.9], [0.62, -0.7], [1, 0]])(t);
    return {
      armL: { rx: arms },
      armR: { rx: arms },
      body: { rx: keys([[0, 0], [0.4, -0.15], [0.62, 0.35], [1, 0]])(t) },
      root: { py: keys([[0, 0], [0.4, 0.05], [0.62, -0.08], [1, 0]])(t) },
    };
  },
};

const shoot: ProceduralClip = {
  duration: 0.6,
  loop: false,
  sample: (t) => ({
    armL: { rx: keys([[0, 0], [0.25, -1.55], [0.8, -1.55], [1, 0]])(t) },
    armR: { rx: keys([[0, 0], [0.25, -1.4], [0.55, -1.4], [0.8, -1.0], [1, 0]])(t), ry: keys([[0, 0], [0.5, 0.5], [0.6, 0], [1, 0]])(t) },
    body: { ry: keys([[0, 0], [0.25, 0.3], [0.8, 0.3], [1, 0]])(t) },
  }),
};

const cast: ProceduralClip = {
  duration: 0.6,
  loop: false,
  sample: (t) => {
    const arms = keys([[0, 0], [0.3, -1.1], [0.55, -1.8], [1, 0]])(t);
    const spread = keys([[0, 0], [0.3, 0.2], [0.75, 0.2], [1, 0]])(t);
    return {
      armL: { rx: arms, rz: spread },
      armR: { rx: arms, rz: -spread },
      body: { py: keys([[0, 0], [0.55, 0.05], [1, 0]])(t), rx: keys([[0, 0], [0.55, -0.1], [1, 0]])(t) },
    };
  },
};

const thrown: ProceduralClip = {
  duration: 0.65,
  loop: false,
  sample: (t) => ({
    armR: { rx: keys([[0, 0], [0.4, -2.8], [0.6, -1.0], [1, 0]])(t) },
    body: { rx: keys([[0, 0], [0.4, -0.12], [0.6, 0.2], [1, 0]])(t), ry: keys([[0, 0], [0.4, 0.3], [0.6, -0.2], [1, 0]])(t) },
  }),
};

/** Hand to mouth (eating) or a raised flask with the head tipped back (drinking). */
const consume = (headTip: number): ProceduralClip => ({
  duration: 0.6,
  loop: false,
  sample: (t) => ({
    armR: { rx: keys([[0, 0], [0.35, -2.3], [0.7, -2.3], [1, 0]])(t), rz: keys([[0, 0], [0.35, 0.45], [0.7, 0.45], [1, 0]])(t) },
    head: { rx: keys([[0, 0], [0.4, headTip], [0.7, headTip], [1, 0]])(t) },
  }),
});
const eat = consume(0.1);
const drink = consume(-0.35);

/** Special attack wind-up: both arms high, then a heavy forward strike. */
const specialStrike: ProceduralClip = {
  duration: 0.75,
  loop: false,
  sample: (t) => ({
    armR: { rx: keys([[0, 0], [0.45, -3.0], [0.65, -0.6], [1, 0]])(t) },
    armL: { rx: keys([[0, 0], [0.45, -2.6], [0.65, -0.8], [1, 0]])(t) },
    body: { rx: keys([[0, 0], [0.45, -0.2], [0.65, 0.3], [1, 0]])(t), py: keys([[0, 0], [0.45, 0.08], [0.65, 0], [1, 0]])(t) },
  }),
};

const hit: ProceduralClip = {
  duration: 0.3,
  loop: false,
  sample: (t) => ({
    body: { rx: keys([[0, 0], [0.3, -0.25], [1, 0]])(t) },
    head: { rx: keys([[0, 0], [0.3, -0.2], [1, 0]])(t) },
  }),
};

const death: ProceduralClip = {
  duration: 1.3,
  loop: false,
  hold: true,
  sample: (t) => ({
    root: { rz: keys([[0, 0], [0.2, -0.1], [1, 1.5]])(t), py: keys([[0, 0], [1, 0.05]])(t) },
    armL: { rz: keys([[0, 0], [1, 0.8]])(t) },
    armR: { rz: keys([[0, 0], [1, -0.8]])(t) },
  }),
};

/** The procedural clip library, keyed by cue. Fallbacks follow `cueFallbacks`. */
export const PROCEDURAL_CLIPS: Readonly<Record<string, ProceduralClip>> = {
  idle,
  walk,
  run,
  attack: stab,
  "attack.stab": stab,
  "attack.punch": stab,
  "attack.slash": slash,
  "attack.crush": crush,
  "attack.slam": crush,
  "attack.shoot": shoot,
  "attack.cast": cast,
  "attack.throw": thrown,
  "attack.special": specialStrike,
  eat,
  drink,
  hit,
  death,
};
