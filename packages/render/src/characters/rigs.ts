import type { ItemAppearance, VisualDef } from "@sim/assets";
import {
  BoxGeometry, ConeGeometry, CylinderGeometry, DodecahedronGeometry, Group, IcosahedronGeometry, Mesh,
  type BufferGeometry, type Material, type Object3D,
} from "three";
import type { JointName } from "../animation/procedural-clips";
import { flat, shade } from "./materials";

/** A placeholder character: a root at the feet and named joints for procedural animation. */
export interface Rig {
  root: Group;
  joints: Partial<Record<JointName, Object3D>>;
  /** Where weapon props attach (the right hand), if the rig has hands. */
  handR: Object3D | null;
  handL: Object3D | null;
  height: number;
  /** Dress the character in its equipment (humanoid rigs only). */
  wear?: (outfit: Outfit) => void;
}

function part(geo: BufferGeometry, mat: Material, x = 0, y = 0, z = 0): Mesh {
  const m = new Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function pivot(parent: Object3D, x: number, y: number, z = 0): Group {
  const g = new Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

/** Worn items by equipment slot (appearance only). */
export type Outfit = Partial<Record<"head" | "cape" | "neck" | "body" | "legs" | "shield" | "hands" | "feet", ItemAppearance | null>>;

/**
 * Player-style humanoid: legs, torso, head, two arms with hands. `wear`
 * recolours the body parts and rebuilds the worn pieces (helmet, cape,
 * shield, amulet, skirt) from an outfit, so the character looks like its gear.
 */
function humanoid(v: VisualDef["placeholder"]): Rig {
  const h = v.height;
  const legLen = h * 0.46;
  const torso = h * 0.3;
  const armLen = h * 0.34;
  const root = new Group();
  const defaults = { shirt: v.color, trousers: shade(v.color, -0.45), boots: "#4a3424" };
  const torsoMat = flat(defaults.shirt);
  const sleeveMat = flat(defaults.shirt);
  const legMat = flat(defaults.trousers);
  const bootMat = flat(defaults.boots);
  const skin = flat(v.accentColor);
  const handMat = flat(v.accentColor);
  const hair = flat("#4a3020");
  const belt = flat("#5a3d26");

  const body = pivot(root, 0, legLen);
  body.add(part(new BoxGeometry(0.38, torso, 0.22), torsoMat, 0, torso / 2));
  body.add(part(new BoxGeometry(0.4, 0.07, 0.24), belt, 0, 0.04));
  const head = pivot(body, 0, torso);
  head.add(part(new BoxGeometry(0.22, 0.24, 0.22), skin, 0, 0.14));
  const hairMesh = part(new BoxGeometry(0.24, 0.08, 0.24), hair, 0, 0.27);
  head.add(hairMesh);

  const legs = ([-1, 1] as const).map((s) => {
    const leg = pivot(root, s * 0.1, legLen);
    leg.add(part(new BoxGeometry(0.14, legLen, 0.16), legMat, 0, -legLen / 2));
    leg.add(part(new BoxGeometry(0.15, 0.09, 0.24), bootMat, 0, -legLen + 0.045, 0.03));
    return leg;
  });
  const arms = ([-1, 1] as const).map((s) => {
    const arm = pivot(body, s * 0.25, torso * 0.92);
    arm.add(part(new BoxGeometry(0.11, armLen, 0.12), sleeveMat, 0, -armLen / 2));
    arm.add(part(new BoxGeometry(0.11, 0.11, 0.11), handMat, 0, -armLen - 0.02));
    return arm;
  });
  const handL = pivot(arms[1]!, 0, -armLen - 0.04);
  const handR = pivot(arms[0]!, 0, -armLen - 0.04);

  // Slots for worn pieces; rebuilt on every outfit change.
  const helmSlot = pivot(head, 0, 0);
  const capeSlot = pivot(body, 0, torso * 0.95, -0.12);
  const neckSlot = pivot(body, 0, torso * 0.82, 0.115);
  const skirtSlot = pivot(body, 0, 0);
  const shieldSlot = pivot(arms[1]!, 0.08, -armLen * 0.7);

  const clear = (g: Group) => {
    for (const c of [...g.children]) {
      c.removeFromParent();
      c.traverse((o) => (o as Mesh).isMesh && (o as Mesh).geometry.dispose());
    }
  };

  const wear = (o: Outfit) => {
    torsoMat.color.set(o.body?.color ?? defaults.shirt);
    sleeveMat.color.set(o.body ? (o.body.shape === "body" ? shade(o.body.color, -0.1) : o.body.color) : defaults.shirt);
    legMat.color.set(o.legs?.color ?? defaults.trousers);
    bootMat.color.set(o.feet?.color ?? defaults.boots);
    handMat.color.set(o.hands && o.hands.shape === "gloves" ? o.hands.color : v.accentColor);
    belt.color.set(o.body ? shade(o.body.accent, -0.2) : "#5a3d26");
    for (const g of [helmSlot, capeSlot, neckSlot, skirtSlot, shieldSlot]) clear(g);

    hairMesh.visible = !o.head;
    if (o.head) {
      const m = flat(o.head.color);
      const t = flat(o.head.accent);
      if (o.head.shape === "hat") {
        helmSlot.add(part(new CylinderGeometry(0.2, 0.2, 0.03, 8), m, 0, 0.27));
        helmSlot.add(part(new ConeGeometry(0.13, 0.26, 6), m, 0, 0.4));
        helmSlot.add(part(new CylinderGeometry(0.14, 0.14, 0.035, 8), t, 0, 0.3));
      } else if (o.head.shape === "hood") {
        helmSlot.add(part(new BoxGeometry(0.26, 0.28, 0.25), m, 0, 0.16, -0.015));
        helmSlot.add(part(new BoxGeometry(0.16, 0.08, 0.02), flat("#1a1a1a"), 0, 0.15, 0.115));
        helmSlot.add(part(new BoxGeometry(0.27, 0.04, 0.26), t, 0, 0.28, -0.01));
      } else {
        helmSlot.add(part(new BoxGeometry(0.26, 0.29, 0.26), m, 0, 0.16));
        helmSlot.add(part(new BoxGeometry(0.17, 0.035, 0.02), flat("#141414"), 0, 0.16, 0.13)); // visor slit
        helmSlot.add(part(new BoxGeometry(0.04, 0.1, 0.2), t, 0, 0.34)); // crest
      }
    }
    if (o.cape) {
      const m = flat(o.cape.color);
      const len = o.cape.shape === "quiver-cape" ? torso * 0.9 : torso + legLen * 0.7;
      const cape = part(new BoxGeometry(0.4, len, 0.035), m, 0, -len / 2);
      cape.rotation.x = 0.08;
      capeSlot.add(cape);
      capeSlot.add(part(new BoxGeometry(0.4, 0.05, 0.04), flat(o.cape.accent), 0, -len + 0.03, 0.005));
      if (o.cape.shape === "quiver-cape") capeSlot.add(part(new CylinderGeometry(0.05, 0.05, 0.35, 6), flat(o.cape.accent), 0.12, -0.15, -0.04));
    }
    if (o.neck) {
      neckSlot.add(part(new BoxGeometry(0.06, 0.07, 0.02), flat(o.neck.color), 0, -0.02));
      neckSlot.add(part(new BoxGeometry(0.03, 0.03, 0.02), flat(o.neck.accent), 0, -0.02, 0.01));
    }
    if (o.legs?.shape === "skirt") {
      const m = flat(o.legs.color);
      skirtSlot.add(part(new CylinderGeometry(0.2, 0.27, legLen * 0.62, 6), m, 0, -legLen * 0.31));
      skirtSlot.add(part(new CylinderGeometry(0.21, 0.21, 0.05, 6), flat(o.legs.accent), 0, -0.02));
    }
    if (o.shield) {
      const m = flat(o.shield.color);
      const t = flat(o.shield.accent);
      if (o.shield.shape === "kiteshield") {
        shieldSlot.add(part(new BoxGeometry(0.04, 0.42, 0.32), m, 0.03, 0.02));
        shieldSlot.add(part(new ConeGeometry(0.16, 0.2, 4), m, 0.03, -0.29).rotateX(Math.PI).rotateY(Math.PI / 4));
        shieldSlot.add(part(new BoxGeometry(0.05, 0.06, 0.06), t, 0.05, 0.05));
      } else if (o.shield.shape === "book") {
        shieldSlot.add(part(new BoxGeometry(0.06, 0.22, 0.16), m, 0.02, -0.08));
        shieldSlot.add(part(new BoxGeometry(0.065, 0.04, 0.165), t, 0.02, -0.08));
      } else {
        shieldSlot.add(part(new BoxGeometry(0.05, 0.24, 0.2), m, 0.03, -0.02));
        shieldSlot.add(part(new ConeGeometry(0.03, 0.14, 4), t, 0.03, 0.16));
      }
    }
  };

  return {
    root,
    joints: { root, body, head, legL: legs[1]!, legR: legs[0]!, armL: arms[1]!, armR: arms[0]! },
    handR,
    handL,
    height: h,
    wear,
  };
}

/** Hulking boss-style figure: robed lower body, broad shoulders, horns and glowing details. */
function brute(v: VisualDef["placeholder"], size: number): Rig {
  const h = v.height;
  const w = Math.max(1, size) * 0.42;
  const root = new Group();
  const hide = flat(v.color, { roughness: 0.9 });
  const plate = flat(v.accentColor, { metalness: 0.3, roughness: 0.6 });
  const glow = v.glowColor ? flat("#000000", { emissive: v.glowColor, emissiveIntensity: 2.2 }) : flat("#ffffff");
  const horn = flat("#d8cfc0", { roughness: 0.5 });

  const hips = h * 0.36;
  const torso = h * 0.36;
  const armLen = h * 0.38;

  // Robe covers the legs; the legs still exist so walking reads as a sway.
  const legs = ([-1, 1] as const).map((s) => {
    const leg = pivot(root, s * w * 0.35, hips);
    leg.add(part(new BoxGeometry(w * 0.4, hips, w * 0.45), hide, 0, -hips / 2));
    return leg;
  });
  const body = pivot(root, 0, hips);
  body.add(part(new CylinderGeometry(w * 0.8, w * 1.05, hips * 0.95, 8), hide, 0, -hips * 0.45)); // robe
  body.add(part(new BoxGeometry(w * 1.5, torso, w * 0.9), hide, 0, torso / 2));
  // Glowing cracks across the chest.
  for (const [x, y, len, rot] of [[-0.12, 0.55, 0.5, 0.5], [0.1, 0.42, 0.45, -0.7], [0.02, 0.3, 0.35, 0.2]] as const) {
    const crack = part(new BoxGeometry(w * 0.07, torso * len, 0.04), glow, x * w, torso * y, w * 0.46);
    crack.rotation.z = rot;
    body.add(crack);
  }
  for (const s of [-1, 1]) body.add(part(new DodecahedronGeometry(w * 0.38, 0), plate, s * w * 0.8, torso * 0.9)); // pauldrons

  const head = pivot(body, 0, torso);
  head.add(part(new BoxGeometry(w * 0.6, w * 0.6, w * 0.6), plate, 0, w * 0.3));
  for (const s of [-1, 1]) {
    head.add(part(new BoxGeometry(w * 0.12, w * 0.06, 0.04), glow, s * w * 0.14, w * 0.34, w * 0.31)); // eyes
    const hornMesh = part(new ConeGeometry(w * 0.12, w * 0.7, 6), horn, s * w * 0.32, w * 0.75);
    hornMesh.rotation.z = -s * 0.5;
    head.add(hornMesh);
  }

  const arms = ([-1, 1] as const).map((s) => {
    const arm = pivot(body, s * w * 0.95, torso * 0.85);
    arm.add(part(new BoxGeometry(w * 0.38, armLen, w * 0.4), hide, 0, -armLen / 2));
    arm.add(part(new DodecahedronGeometry(w * 0.28, 0), plate, 0, -armLen - w * 0.1)); // fist
    return arm;
  });

  return {
    root,
    joints: { root, body, head, legL: legs[1]!, legR: legs[0]!, armL: arms[1]!, armR: arms[0]! },
    handR: pivot(arms[0]!, 0, -armLen - w * 0.1),
    handL: pivot(arms[1]!, 0, -armLen - w * 0.1),
    height: h + w * 0.6,
  };
}

/** Training dummy: a straw-stuffed sack on a post. The body pivots at its base so hits make it wobble. */
function dummy(v: VisualDef["placeholder"]): Rig {
  const h = v.height;
  const root = new Group();
  const wood = flat("#6e4a2c");
  const sack = flat(v.color, { roughness: 1 });
  const straw = flat(v.accentColor, { roughness: 1 });
  root.add(part(new CylinderGeometry(0.28, 0.32, 0.12, 8), wood, 0, 0.06)); // base
  const body = pivot(root, 0, 0.12);
  body.add(part(new CylinderGeometry(0.05, 0.05, h * 0.55, 6), wood, 0, h * 0.27));
  body.add(part(new CylinderGeometry(0.22, 0.26, h * 0.38, 8), sack, 0, h * 0.62));
  body.add(part(new BoxGeometry(0.9, 0.07, 0.07), wood, 0, h * 0.7)); // crossbar
  for (const s of [-1, 1]) body.add(part(new ConeGeometry(0.06, 0.18, 5), straw, s * 0.5, h * 0.7));
  const head = pivot(body, 0, h * 0.82);
  head.add(part(new IcosahedronGeometry(0.16, 0), sack, 0, 0.12));
  return { root, joints: { root, body, head }, handR: null, handL: null, height: h };
}

function shape(v: VisualDef["placeholder"], size: number): Rig {
  const root = new Group();
  const body = pivot(root, 0, 0);
  body.add(part(new BoxGeometry(size * 0.8, v.height, size * 0.8), flat(v.color), 0, v.height / 2));
  return { root, joints: { root, body }, handR: null, handL: null, height: v.height };
}

export function buildRig(visual: VisualDef, size: number): Rig {
  const p = visual.placeholder;
  switch (p.rig) {
    case "humanoid":
      return humanoid(p);
    case "brute":
      return brute(p, size);
    case "dummy":
      return dummy(p);
    case "shape":
      return shape(p, size);
  }
}
