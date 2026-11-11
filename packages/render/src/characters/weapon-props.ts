import { itemAppearance, isWeaponShape, type WeaponShape } from "@sim/assets";
import type { CombatStyle } from "@sim/engine";
import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, IcosahedronGeometry, Mesh, TorusGeometry } from "three";
import { flat, shade } from "./materials";

export type WeaponProp = WeaponShape | "none";

/** Prop shape for a weapon category, used when the item itself has no appearance. */
export function propForCategory(category: string | null): WeaponProp {
  switch (category) {
    case "slash-sword": return "scimitar";
    case "stab-sword": return "longsword";
    case "two-handed-sword": return "greatsword";
    case "whip": return "whip";
    case "blunt": return "warhammer";
    case "axe": return "axe";
    case "spear": return "spear";
    case "polearm": return "halberd";
    case "claw": return "claws";
    case "bludgeon": return "maul";
    case "spiked": return "mace";
    case "bow": return "shortbow";
    case "crossbow": return "crossbow";
    case "staff":
    case "bladed-staff": return "staff";
    case "powered-staff": return "trident";
    default: return "none";
  }
}

export function propForStyle(style: CombatStyle | null): WeaponProp {
  switch (style) {
    case "slash": return "scimitar";
    case "stab": return "dagger";
    case "crush": return "warhammer";
    case "ranged": return "shortbow";
    case "magic": return "staff";
    default: return "none";
  }
}

/** The prop for a wielded item: its own shape if known, else one for its category. */
export function propForItem(itemId: string | null, category: string | null): { kind: WeaponProp; color: string; accent: string } {
  const app = itemId ? itemAppearance(itemId, "weapon") : null;
  if (app && isWeaponShape(app.shape) && itemId) return { kind: app.shape, color: app.color, accent: app.accent };
  return { kind: propForCategory(category), color: "#c3c8cf", accent: "#6b4a2a" };
}

const mesh = (g: ConstructorParameters<typeof Mesh>[0], m: ConstructorParameters<typeof Mesh>[1], x = 0, y = 0, z = 0) => {
  const out = new Mesh(g, m);
  out.position.set(x, y, z);
  return out;
};

/**
 * Held weapons built from primitives. Melee weapons point forward along the
 * forearm; bows go in the left hand. Shapes are deliberately chunky so the
 * weapon type reads from a distance.
 */
export function buildWeaponProp(kind: WeaponProp, color = "#c3c8cf", accent = "#6b4a2a"): { object: Group; hand: "left" | "right" } | null {
  const g = new Group();
  const main = flat(color);
  const trim = flat(accent);
  const grip = flat("#4a3424");
  const blade = (len: number, width: number, thick = 0.025) => mesh(new BoxGeometry(width, len, thick), main, 0, -0.1 - len / 2);
  const hilt = (guard: number) => {
    g.add(mesh(new BoxGeometry(0.05, 0.12, 0.05), grip, 0, -0.02));
    g.add(mesh(new BoxGeometry(guard, 0.045, 0.07), trim, 0, -0.09));
  };
  const forward = () => {
    g.rotation.x = Math.PI / 2;
    return { object: g, hand: "right" as const };
  };
  switch (kind) {
    case "scimitar": {
      hilt(0.16);
      // Curved blade: two segments, the outer one angled back.
      g.add(blade(0.38, 0.08));
      const tip = mesh(new BoxGeometry(0.08, 0.26, 0.025), main, 0.035, -0.6);
      tip.rotation.z = 0.35;
      g.add(tip);
      return forward();
    }
    case "dagger":
      hilt(0.14);
      g.add(blade(0.3, 0.06));
      g.add(mesh(new ConeGeometry(0.035, 0.08, 4), main, 0, -0.44).rotateX(Math.PI));
      return forward();
    case "longsword":
      hilt(0.22);
      g.add(blade(0.72, 0.065));
      return forward();
    case "rapier":
      hilt(0.12);
      g.add(mesh(new TorusGeometry(0.06, 0.012, 4, 8), trim, 0, -0.1));
      g.add(blade(0.78, 0.025, 0.025));
      return forward();
    case "greatsword":
      g.add(mesh(new BoxGeometry(0.06, 0.26, 0.06), grip, 0, 0.05));
      g.add(mesh(new BoxGeometry(0.34, 0.08, 0.1), trim, 0, -0.1));
      g.add(blade(1.15, 0.14, 0.04));
      return forward();
    case "whip": {
      // Handle plus a drooping, segmented lash.
      g.add(mesh(new BoxGeometry(0.05, 0.2, 0.05), main, 0, -0.04));
      let y = -0.14;
      for (let i = 0; i < 6; i++) {
        const seg = mesh(new BoxGeometry(0.03, 0.16, 0.03), i === 5 ? trim : main, i * 0.025, y - 0.08);
        seg.rotation.z = i * 0.12;
        g.add(seg);
        y -= 0.15;
      }
      return forward();
    }
    case "mace":
      g.add(mesh(new CylinderGeometry(0.03, 0.03, 0.55, 6), grip, 0, -0.2));
      g.add(mesh(new IcosahedronGeometry(0.11, 0), main, 0, -0.5));
      g.add(mesh(new BoxGeometry(0.3, 0.05, 0.05), trim, 0, -0.5)); // flanges
      g.add(mesh(new BoxGeometry(0.05, 0.05, 0.3), trim, 0, -0.5));
      return forward();
    case "warhammer":
      g.add(mesh(new CylinderGeometry(0.03, 0.03, 0.75, 6), grip, 0, -0.28));
      g.add(mesh(new BoxGeometry(0.3, 0.15, 0.15), main, 0, -0.66));
      g.add(mesh(new BoxGeometry(0.06, 0.17, 0.17), trim, -0.17, -0.66));
      return forward();
    case "maul":
      g.add(mesh(new CylinderGeometry(0.035, 0.035, 1.0, 6), grip, 0, -0.35));
      g.add(mesh(new BoxGeometry(0.38, 0.24, 0.24), main, 0, -0.9));
      g.add(mesh(new BoxGeometry(0.4, 0.06, 0.26), trim, 0, -0.9));
      return forward();
    case "shortbow": {
      const arc = mesh(new TorusGeometry(0.42, 0.028, 4, 12, Math.PI), main);
      arc.rotation.z = Math.PI / 2;
      g.add(arc);
      g.add(mesh(new BoxGeometry(0.008, 0.84, 0.008), flat(shade(accent, 0.4))));
      return { object: g, hand: "left" };
    }
    case "crossbow": {
      g.add(mesh(new BoxGeometry(0.07, 0.07, 0.6), grip, 0, 0, 0.15));
      const limbs = mesh(new BoxGeometry(0.62, 0.05, 0.06), main, 0, 0, 0.42);
      g.add(limbs);
      g.add(mesh(new BoxGeometry(0.1, 0.08, 0.1), trim, 0, 0.02, 0.42));
      return { object: g, hand: "right" };
    }
    case "staff":
      g.add(mesh(new CylinderGeometry(0.03, 0.035, 1.5, 6), main, 0, 0.2));
      g.add(mesh(new IcosahedronGeometry(0.09, 0), flat("#000000", { emissive: accent, emissiveIntensity: 1.6 }), 0, 0.98));
      g.add(mesh(new ConeGeometry(0.06, 0.12, 5), trim, 0, 0.9));
      return { object: g, hand: "right" };
    case "wand":
      g.add(mesh(new CylinderGeometry(0.02, 0.03, 0.5, 6), main, 0, 0.1));
      g.add(mesh(new IcosahedronGeometry(0.05, 0), flat("#000000", { emissive: accent, emissiveIntensity: 1.6 }), 0, 0.38));
      return { object: g, hand: "right" };
    case "trident":
      g.add(mesh(new CylinderGeometry(0.03, 0.03, 1.5, 6), main, 0, 0.2));
      for (const x of [-0.08, 0, 0.08]) g.add(mesh(new ConeGeometry(0.025, 0.22, 4), trim, x, 1.04 + (x ? -0.04 : 0)));
      g.add(mesh(new BoxGeometry(0.2, 0.04, 0.04), trim, 0, 0.93));
      return { object: g, hand: "right" };
    case "axe":
      g.add(mesh(new CylinderGeometry(0.03, 0.03, 0.7, 6), grip, 0, -0.25));
      g.add(mesh(new BoxGeometry(0.28, 0.2, 0.03), main, 0.12, -0.55));
      g.add(mesh(new BoxGeometry(0.05, 0.22, 0.04), trim, 0, -0.55));
      return forward();
    case "spear":
      g.add(mesh(new CylinderGeometry(0.025, 0.025, 1.4, 6), grip, 0, -0.5));
      g.add(mesh(new ConeGeometry(0.05, 0.28, 4), main, 0, -1.32).rotateX(Math.PI));
      g.add(mesh(new BoxGeometry(0.1, 0.04, 0.04), trim, 0, -1.15));
      return forward();
    case "halberd":
      g.add(mesh(new CylinderGeometry(0.025, 0.025, 1.6, 6), grip, 0, -0.6));
      g.add(mesh(new BoxGeometry(0.26, 0.24, 0.025), main, 0.1, -1.25));
      g.add(mesh(new ConeGeometry(0.04, 0.22, 4), main, 0, -1.5).rotateX(Math.PI));
      return forward();
    case "claws":
      for (const x of [-0.05, 0, 0.05]) {
        const c = mesh(new ConeGeometry(0.02, 0.26, 4), main, x, -0.2);
        c.rotation.x = Math.PI;
        g.add(c);
      }
      g.add(mesh(new BoxGeometry(0.14, 0.06, 0.08), trim, 0, -0.06));
      return forward();
    case "none":
      return null;
  }
}
