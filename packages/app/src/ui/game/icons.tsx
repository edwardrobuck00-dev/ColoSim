import { itemAppearance, type ItemShape } from "@sim/assets";
import type { PrayerDef } from "@sim/engine";
import type { ReactNode } from "react";
import type { TabId } from "../../input/keybinds";

/*
 * Original icon set, drawn as small SVGs with dark outlines in the style of
 * classic game interface icons. Nothing here is traced from game art.
 */

const OUTLINE = "#140e08";

function Svg({ children, size = 32, label }: { children: ReactNode; size?: number; label?: string }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label}>
      <g stroke={OUTLINE} strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round">{children}</g>
    </svg>
  );
}

/* ---------- Tab icons ---------- */

export function TabIcon({ tab }: { tab: TabId }) {
  switch (tab) {
    case "combat":
      return (
        <Svg>
          <path d="M6 5 L22 21 L20 23 L4 7 Z" fill="#c3c8cf" />
          <path d="M26 5 L10 21 L12 23 L28 7 Z" fill="#c3c8cf" />
          <path d="M18 22 L24 28 M14 22 L8 28" stroke="#6b4a2a" strokeWidth={3} />
          <path d="M16 20 L22 26 M16 20 L10 26" stroke={OUTLINE} strokeWidth={0.8} fill="none" />
        </Svg>
      );
    case "skills":
      return (
        <Svg>
          <rect x="5" y="16" width="5" height="11" fill="#3fbf4a" />
          <rect x="13.5" y="9" width="5" height="18" fill="#e0c040" />
          <rect x="22" y="4" width="5" height="23" fill="#d9442f" />
        </Svg>
      );
    case "inventory":
      return (
        <Svg>
          <path d="M8 12 Q8 8 12 8 L20 8 Q24 8 24 12 L26 26 Q26 28 24 28 L8 28 Q6 28 6 26 Z" fill="#8a5a32" />
          <path d="M12 8 Q12 3 16 3 Q20 3 20 8" fill="none" stroke="#5a3a1e" strokeWidth={2.4} />
          <rect x="11" y="14" width="10" height="6" rx="1" fill="#a87442" />
        </Svg>
      );
    case "equipment":
      return (
        <Svg>
          <path d="M9 5 L23 5 L26 10 L26 18 Q26 26 16 29 Q6 26 6 18 L6 10 Z" fill="#9aa1aa" />
          <rect x="10" y="12" width="12" height="3" fill="#2a2a2a" />
          <path d="M16 5 L16 11" stroke="#c9a227" strokeWidth={2.4} />
        </Svg>
      );
    case "prayer":
      return (
        <Svg>
          <circle cx="16" cy="16" r="12" fill="#2f6fa8" />
          <path d="M16 6 L18.5 13.5 L26 16 L18.5 18.5 L16 26 L13.5 18.5 L6 16 L13.5 13.5 Z" fill="#f2f2ff" />
        </Svg>
      );
    case "magic":
      return (
        <Svg>
          <path d="M5 7 L15 5 L15 27 L5 28 Z" fill="#3a4f9a" />
          <path d="M27 7 L17 5 L17 27 L27 28 Z" fill="#2f4285" />
          <path d="M10 13 L11 15.5 L13.5 16 L11 16.5 L10 19 L9 16.5 L6.5 16 L9 15.5 Z" fill="#ffd84a" />
        </Svg>
      );
    case "info":
      return (
        <Svg>
          <path d="M7 4 L23 4 L25 7 L25 28 L9 28 L7 25 Z" fill="#e2d2a4" />
          <path d="M11 10 L21 10 M11 14 L21 14 M11 18 L21 18 M11 22 L17 22" stroke="#6b5a3a" strokeWidth={1.4} />
        </Svg>
      );
    case "simulation":
      return (
        <Svg>
          <path d="M9 4 L23 4 L23 7 L17.5 16 L23 25 L23 28 L9 28 L9 25 L14.5 16 L9 7 Z" fill="#d9c9a3" />
          <path d="M12 25 L20 25 L16 19 Z" fill="#c9a227" />
          <path d="M8 4 L24 4 M8 28 L24 28" stroke="#6b4a2a" strokeWidth={2.5} />
        </Svg>
      );
  }
}

/* ---------- Skill icons ---------- */

export type SkillId = "attack" | "strength" | "defence" | "ranged" | "magic" | "hitpoints" | "prayer";

export function SkillIcon({ skill, size = 22 }: { skill: SkillId; size?: number }) {
  switch (skill) {
    case "attack":
      return (
        <Svg size={size}>
          <path d="M24 4 L27 4 L27 7 L12 22 L9 20 Z" fill="#c3c8cf" />
          <path d="M8 18 L14 24 M7 25 L10 22" stroke="#6b4a2a" strokeWidth={3} />
        </Svg>
      );
    case "strength":
      return (
        <Svg size={size}>
          <path d="M7 12 Q7 8 11 8 L21 8 Q25 8 25 12 L25 22 Q25 27 20 27 L12 27 Q7 27 7 22 Z" fill="#3fa84a" />
          <path d="M11 8 L11 15 M16 8 L16 15 M21 8 L21 15" stroke={OUTLINE} strokeWidth={1} />
        </Svg>
      );
    case "defence":
      return (
        <Svg size={size}>
          <path d="M16 3 L27 7 Q27 22 16 29 Q5 22 5 7 Z" fill="#7a8fb0" />
          <path d="M16 7 L16 25 M9 12 L23 12" stroke="#c9a227" strokeWidth={2} />
        </Svg>
      );
    case "ranged":
      return (
        <Svg size={size}>
          <path d="M8 4 Q26 16 8 28" fill="none" stroke="#6b4a2a" strokeWidth={3} />
          <path d="M8 4 L8 28" stroke="#d9d2b0" strokeWidth={0.8} />
          <path d="M5 16 L27 16 M27 16 L23 13 M27 16 L23 19" stroke="#3a7a3a" strokeWidth={1.8} fill="none" />
        </Svg>
      );
    case "magic":
      return (
        <Svg size={size}>
          <path d="M16 3 L24 24 L8 24 Z" fill="#3a4f9a" />
          <path d="M5 24 L27 24 L27 27 L5 27 Z" fill="#2f4285" />
          <path d="M16 11 L17 14 L20 14.5 L17 15.5 L16 18.5 L15 15.5 L12 14.5 L15 14 Z" fill="#ffd84a" />
        </Svg>
      );
    case "hitpoints":
      return (
        <Svg size={size}>
          <path d="M16 28 L5 16 Q2 11 6 7 Q11 3 16 9 Q21 3 26 7 Q30 11 27 16 Z" fill="#d42a1f" />
        </Svg>
      );
    case "prayer":
      return (
        <Svg size={size}>
          <path d="M16 3 L19 13 L29 16 L19 19 L16 29 L13 19 L3 16 L13 13 Z" fill="#f2f2ff" />
        </Svg>
      );
  }
}

/* ---------- Prayer icons ---------- */

const TIER_COLORS = ["#b07a3a", "#c3c8cf", "#f0c94a"];

function tierOf(p: PrayerDef): number {
  const factors = Object.values(p.effects).filter(Array.isArray) as Array<[number, number]>;
  const best = Math.max(100, ...factors.map(([n, d]) => (n * 100) / d));
  return best >= 115 ? 2 : best >= 110 ? 1 : 0;
}

/** An original glyph for each prayer, coloured by strength tier. */
export function PrayerIcon({ prayer }: { prayer: PrayerDef }) {
  const e = prayer.effects;
  const tier = TIER_COLORS[tierOf(prayer)]!;
  if (prayer.protects) {
    const glyph =
      prayer.protects === "melee" ? <path d="M16 6 L16 22 M11 19 L21 19 M16 22 L16 26" stroke="#f4d9a0" strokeWidth={2.6} fill="none" />
      : prayer.protects === "ranged" ? <><path d="M9 23 L21 11" stroke="#e2f0c0" strokeWidth={2.4} /><path d="M23 9 L17 11 L21 15 Z" fill="#e2f0c0" /></>
      : <path d="M16 7 L18 14 L25 16 L18 18 L16 25 L14 18 L7 16 L14 14 Z" fill="#cfe0ff" />;
    const fill = prayer.protects === "melee" ? "#7a2a22" : prayer.protects === "ranged" ? "#2f5a2a" : "#283f78";
    return <Svg><path d="M16 3 L27 9 L27 23 L16 29 L5 23 L5 9 Z" fill={fill} />{glyph}</Svg>;
  }
  switch (prayer.utility) {
    case "rapid-restore":
      return <Svg><path d="M10 26 L10 14 L5 14 L12 5 L19 14 L14 14 L14 26 Z" fill="#c9a227" /><path d="M20 26 L20 18 L16 18 L22 11 L28 18 L24 18 L24 26 Z" fill="#c9a227" /></Svg>;
    case "rapid-heal":
      return <Svg><path d="M16 27 L6 16 Q3 11 7 8 Q12 4 16 10 Q20 4 25 8 Q29 11 26 16 Z" fill="#d42a1f" /><path d="M16 12 L16 21 M11.5 16.5 L20.5 16.5" stroke="#ffffff" strokeWidth={2.4} /></Svg>;
    case "preserve":
      return <Svg><path d="M9 4 L23 4 L23 7 L17.5 16 L23 25 L23 28 L9 28 L9 25 L14.5 16 L9 7 Z" fill="#7fd0ff" /></Svg>;
    case "redemption":
      return <Svg><path d="M13 4 L19 4 L19 12 L27 12 L27 18 L19 18 L19 28 L13 28 L13 18 L5 18 L5 12 L13 12 Z" fill="#f0f0f0" /></Svg>;
    default:
      break;
  }
  const melee = !!(e.meleeAccuracy || e.meleeStrength);
  const def = !!e.defence;
  if (melee && def) {
    // Chivalry, Piety, Zeal: sword over a shield.
    const halo = prayer.level >= 70;
    return (
      <Svg>
        {halo && <circle cx="16" cy="16" r="13" fill="none" stroke="#f0c94a" strokeWidth={1.6} />}
        <path d="M16 6 L25 9 Q25 21 16 27 Q7 21 7 9 Z" fill="#7a8fb0" />
        <path d="M16 4 L16 24 M11 20 L21 20" stroke="#f0f0f0" strokeWidth={2.4} />
      </Svg>
    );
  }
  if (e.rangedAccuracy) {
    if (prayer.level >= 74) return <Svg><path d="M8 4 Q26 16 8 28" fill="none" stroke={tier} strokeWidth={3} /><path d="M4 16 L26 16 L22 13 M26 16 L22 19" stroke="#5fbf3a" strokeWidth={2} fill="none" /></Svg>;
    return <Svg><path d="M3 16 Q16 4 29 16 Q16 28 3 16 Z" fill="#f2efe0" /><circle cx="16" cy="16" r="5" fill="#3a7a3a" /><circle cx="16" cy="16" r="2" fill="#111" />{tier !== TIER_COLORS[0] && <path d="M16 3 L16 7 M7 6 L9 9 M25 6 L23 9" stroke={tier} strokeWidth={1.6} />}</Svg>;
  }
  if (e.magicAccuracy) {
    if (prayer.level >= 77) return <Svg><path d="M3 16 Q16 4 29 16 Q16 28 3 16 Z" fill="#e8e0ff" /><circle cx="16" cy="16" r="5" fill="#4a3aa8" /><path d="M16 1 L16 6 M5 4 L8 8 M27 4 L24 8 M1 16 L4 16 M31 16 L28 16" stroke="#f0c94a" strokeWidth={1.6} /></Svg>;
    return <Svg><path d="M16 4 L19 13 L28 16 L19 19 L16 28 L13 19 L4 16 L13 13 Z" fill="#6a7ad8" /><circle cx="16" cy="16" r="3" fill={tier} /></Svg>;
  }
  if (e.meleeStrength) return <Svg><path d="M7 12 Q7 8 11 8 L21 8 Q25 8 25 12 L25 22 Q25 27 20 27 L12 27 Q7 27 7 22 Z" fill={tier} /><path d="M11 8 L11 15 M16 8 L16 15 M21 8 L21 15" stroke={OUTLINE} strokeWidth={1} /></Svg>;
  if (e.meleeAccuracy) return <Svg><path d="M22 4 L27 4 L27 9 L12 24 L8 20 Z" fill={tier} /><path d="M7 17 L15 25 M5 27 L9 23" stroke="#6b4a2a" strokeWidth={3} /></Svg>;
  if (def) return <Svg><path d="M16 3 L27 7 Q27 22 16 29 Q5 22 5 7 Z" fill={tier} /><path d="M16 7 L16 25" stroke="#6b4a2a" strokeWidth={1.4} /></Svg>;
  return <Svg><circle cx="16" cy="16" r="10" fill={tier} /></Svg>;
}

/* ---------- Item icons ---------- */

function itemShape(shape: ItemShape, c: string, a: string, doses: number): ReactNode {
  switch (shape) {
    case "scimitar":
      return <><path d="M10 24 Q8 12 20 4 Q14 14 13 25 Z" fill={c} /><path d="M7 23 L16 26" stroke={a} strokeWidth={2.4} /><path d="M11 25 L8 30" stroke="#4a3424" strokeWidth={2.4} /></>;
    case "dagger":
      return <><path d="M22 5 L24 8 L13 20 L11 18 Z" fill={c} /><path d="M9 16 L15 22" stroke={a} strokeWidth={2.2} /><path d="M11 21 L7 25" stroke="#4a3424" strokeWidth={2.6} /></>;
    case "longsword":
      return <><path d="M25 3 L28 4 L29 7 L13 21 L10 18 Z" fill={c} /><path d="M7 16 L15 24" stroke={a} strokeWidth={2.4} /><path d="M10 22 L5 27" stroke="#4a3424" strokeWidth={2.6} /></>;
    case "rapier":
      return <><path d="M27 3 L29 4 L13 21 L12 19 Z" fill={c} /><circle cx="11" cy="21" r="3.4" fill="none" stroke={a} strokeWidth={1.6} /><path d="M10 23 L5 28" stroke="#4a3424" strokeWidth={2.6} /></>;
    case "greatsword":
      return <><path d="M24 2 L30 2 L30 8 L13 24 L8 19 Z" fill={c} /><path d="M5 16 L16 27" stroke={a} strokeWidth={3.4} /><path d="M9 24 L4 29" stroke="#4a3424" strokeWidth={3} /></>;
    case "whip":
      return <><path d="M6 27 L10 21" stroke={c} strokeWidth={3.4} /><path d="M10 21 Q20 22 22 14 Q24 5 14 6 Q8 7 10 12" fill="none" stroke={c} strokeWidth={2} /><path d="M10 12 L11 14" stroke={a} strokeWidth={2.4} /></>;
    case "mace":
      return <><path d="M8 27 L18 13" stroke="#4a3424" strokeWidth={2.6} /><circle cx="21" cy="10" r="6" fill={c} /><path d="M21 2 L21 4 M27 10 L29 10 M21 16 L21 18 M13 10 L15 10" stroke={a} strokeWidth={2} /></>;
    case "warhammer":
      return <><path d="M8 28 L19 13" stroke="#4a3424" strokeWidth={2.6} /><path d="M13 9 L22 4 L28 12 L19 17 Z" fill={c} /><path d="M12 9 L18 18" stroke={a} strokeWidth={2} /></>;
    case "maul":
      return <><path d="M7 28 L17 14" stroke="#4a3424" strokeWidth={3} /><path d="M10 10 L20 3 L28 13 L18 20 Z" fill={c} /><path d="M14 7 L24 17" stroke={a} strokeWidth={1.8} /></>;
    case "shortbow":
      return <><path d="M8 4 Q30 16 8 28" fill="none" stroke={c} strokeWidth={3} /><path d="M8 4 L8 28" stroke={a} strokeWidth={0.8} /></>;
    case "crossbow":
      return <><path d="M6 26 L22 10" stroke="#5a3a1e" strokeWidth={3.4} /><path d="M12 6 Q22 6 26 16" fill="none" stroke={c} strokeWidth={2.6} /><path d="M12 6 L26 16" stroke={a} strokeWidth={0.8} /></>;
    case "staff":
      return <><path d="M7 28 L23 8" stroke={c} strokeWidth={2.8} /><circle cx="24.5" cy="6.5" r="3.6" fill={a} /></>;
    case "wand":
      return <><path d="M9 25 L21 11" stroke={c} strokeWidth={2.8} /><circle cx="22.5" cy="9.5" r="2.8" fill={a} /></>;
    case "trident":
      return <><path d="M7 28 L22 9" stroke={c} strokeWidth={2.6} /><path d="M17 8 L24 15 M20 5 L26 3 L28 6 L27 11 M17 8 L19 3 M24 15 L29 13" stroke={a} strokeWidth={2} fill="none" /></>;
    case "axe":
      return <><path d="M8 28 L20 10" stroke="#4a3424" strokeWidth={2.6} /><path d="M17 6 Q27 4 28 13 L20 15 Z" fill={c} /><path d="M17 6 L20 15" stroke={a} strokeWidth={1.4} /></>;
    case "spear":
      return <><path d="M6 28 L24 8" stroke="#4a3424" strokeWidth={2.2} /><path d="M24 8 L29 3 L27 10 Z" fill={c} /><path d="M21 9 L24 12" stroke={a} strokeWidth={2} /></>;
    case "halberd":
      return <><path d="M5 29 L23 9" stroke="#4a3424" strokeWidth={2.2} /><path d="M19 7 Q27 5 27 14 L22 13 Z" fill={c} /><path d="M24 7 L29 2" stroke={c} strokeWidth={2.4} /></>;
    case "claws":
      return <><path d="M8 26 L12 18 L22 6 M12 26 L16 18 L25 9 M16 26 L19 20 L28 12" stroke={c} strokeWidth={2.2} fill="none" /><rect x="5" y="23" width="13" height="6" rx="1" fill={a} /></>;
    case "helm":
      return <><path d="M7 20 Q7 6 16 6 Q25 6 25 20 L25 26 L7 26 Z" fill={c} /><rect x="11" y="15" width="10" height="3" fill="#1a1a1a" /><path d="M16 3 L16 8" stroke={a} strokeWidth={3} /></>;
    case "hood":
      return <><path d="M6 27 Q6 5 16 5 Q26 5 26 27 Z" fill={c} /><path d="M11 13 L21 13 L19 24 L13 24 Z" fill="#1a1a1a" /><path d="M16 5 L16 12" stroke={a} strokeWidth={2.4} /></>;
    case "hat":
      return <><path d="M16 3 L23 20 L9 20 Z" fill={c} /><path d="M4 22 Q16 17 28 22 Q16 27 4 22 Z" fill={c} /><path d="M10 19 L22 19" stroke={a} strokeWidth={2} /></>;
    case "body":
      return <><path d="M10 5 L22 5 L28 10 L26 16 L23 14 L23 28 L9 28 L9 14 L6 16 L4 10 Z" fill={c} /><path d="M16 6 L16 27" stroke={a} strokeWidth={1.6} /></>;
    case "robe-top":
      return <><path d="M11 4 L21 4 L28 12 L25 15 L22 12 L24 28 L8 28 L10 12 L7 15 L4 12 Z" fill={c} /><path d="M14 4 L16 9 L18 4" stroke={a} strokeWidth={1.6} fill="none" /></>;
    case "legs":
      return <><path d="M8 4 L24 4 L25 28 L18 28 L16 13 L14 28 L7 28 Z" fill={c} /><path d="M8 7 L24 7" stroke={a} strokeWidth={1.6} /></>;
    case "skirt":
      return <><path d="M10 4 L22 4 L28 28 L4 28 Z" fill={c} /><path d="M10 7 L22 7 M16 9 L16 27" stroke={a} strokeWidth={1.6} /></>;
    case "defender":
      return <><path d="M8 6 L22 6 L22 22 Q15 28 8 22 Z" fill={c} /><path d="M22 10 L29 6 L25 13 Z" fill={a} /><path d="M12 10 L18 10" stroke={a} strokeWidth={1.6} /></>;
    case "kiteshield":
      return <><path d="M6 5 L26 5 L26 14 Q26 23 16 30 Q6 23 6 14 Z" fill={c} /><path d="M16 8 L16 25 M10 13 L22 13" stroke={a} strokeWidth={1.8} /></>;
    case "book":
      return <><rect x="7" y="5" width="18" height="22" rx="1.5" fill={c} /><path d="M10 5 L10 27" stroke={a} strokeWidth={1.6} /><circle cx="18" cy="15" r="3" fill={a} /></>;
    case "gloves":
      return <><path d="M9 28 L9 15 L8 8 L11 7 L12 13 L13 5 L16 5 L16 12 L17 5 L20 6 L20 13 L22 9 L25 11 L22 20 L22 28 Z" fill={c} /><path d="M9 24 L22 24" stroke={a} strokeWidth={1.6} /></>;
    case "bracelet":
      return <><ellipse cx="16" cy="16" rx="11" ry="7" fill="none" stroke={c} strokeWidth={3.4} /><circle cx="16" cy="9.5" r="2.6" fill={a} /></>;
    case "boots":
      return <><path d="M9 4 L17 4 L17 18 L27 22 L27 28 L7 28 L9 18 Z" fill={c} /><path d="M7 25 L27 25" stroke={a} strokeWidth={1.6} /></>;
    case "cape":
      return <><path d="M10 4 L22 4 L27 29 L5 29 Z" fill={c} /><path d="M10 4 L22 4 L21 8 L11 8 Z" fill={a} /><path d="M12 14 Q16 18 20 14" stroke={a} strokeWidth={1.4} fill="none" /></>;
    case "quiver-cape":
      return <><path d="M10 6 L22 6 L25 26 L7 26 Z" fill={c} /><rect x="17" y="3" width="6" height="18" rx="2" fill={a} /><path d="M18 3 L18 0 M21 3 L21 0" stroke="#d9c9a3" strokeWidth={1} /></>;
    case "amulet":
      return <><path d="M8 4 Q16 22 24 4" fill="none" stroke={c} strokeWidth={1.8} /><circle cx="16" cy="21" r="5.5" fill={c} /><circle cx="16" cy="21" r="2.6" fill={a} /></>;
    case "ring":
      return <><circle cx="16" cy="18" r="7.5" fill="none" stroke={c} strokeWidth={3} /><circle cx="16" cy="9.5" r="3.2" fill={a} /></>;
    case "arrows":
      return <>{[0, 4, 8].map((d) => <g key={d}><path d={`M${5 + d} ${27} L${21 + d} ${9}`} stroke={a} strokeWidth={1.6} /><path d={`M${21 + d} 9 L${24 + d} 5 L${19 + d} 7 Z`} fill={c} /></g>)}</>;
    case "bolts":
      return <>{[0, 5].map((d) => <g key={d}><path d={`M${6 + d} 26 L${20 + d} 12`} stroke="#5a5a5a" strokeWidth={2} /><path d={`M${20 + d} 12 L${24 + d} 7 L${18 + d} 10 Z`} fill={c} /></g>)}</>;
    case "fish":
      return <><path d="M4 16 Q12 7 22 13 L28 8 L27 16 L28 24 L22 19 Q12 25 4 16 Z" fill={c} /><circle cx="9" cy="15" r="1.4" fill="#111" /><path d="M13 12 Q15 16 13 20" stroke={a} strokeWidth={1.2} fill="none" /></>;
    case "ray":
      return <><path d="M16 6 L29 15 L16 20 L3 15 Z" fill={c} /><path d="M16 20 L17 29" stroke={c} strokeWidth={1.6} /><path d="M12 13 L20 13" stroke={a} strokeWidth={1.2} /></>;
    case "lobster":
      return <><ellipse cx="16" cy="18" rx="5" ry="9" fill={c} /><path d="M12 10 Q6 6 7 2 Q11 4 12 8 M20 10 Q26 6 25 2 Q21 4 20 8" fill={c} /><path d="M13 20 L19 20 M13 23 L19 23" stroke={a} strokeWidth={1} /></>;
    case "karambwan":
      return <><path d="M4 18 Q14 6 26 14 L29 11 L28 18 L29 25 L26 21 Q14 28 4 18 Z" fill={c} /><path d="M10 15 L22 15" stroke={a} strokeWidth={1.4} /></>;
    case "potion": {
      const level = Math.max(0, Math.min(4, doses));
      const top = 27 - level * 3.6;
      return (
        <>
          <path d="M12 3 L20 3 L20 6 L19 6 L19 11 Q26 14 25 21 Q24 29 16 29 Q8 29 7 21 Q6 14 13 11 L13 6 L12 6 Z" fill="#cfe3ea" fillOpacity={0.55} />
          {level > 0 && <path d={`M8.2 ${Math.max(13.5, top)} L23.8 ${Math.max(13.5, top)} Q24.5 21 24 22 Q23 28.5 16 28.5 Q9 28.5 8 22 Q7.5 21 8.2 ${Math.max(13.5, top)} Z`} fill={c} stroke="none" />}
          <rect x="12.5" y="1.5" width="7" height="3" fill="#8a5a32" />
        </>
      );
    }
    case "unknown":
      return <circle cx="16" cy="16" r="9" fill={c} />;
  }
}

/** An item's inventory icon. `quantity` is the dose count for potions. */
export function ItemIcon({ itemId, slot, quantity = 1, size = 32 }: { itemId: string; slot?: string | null; quantity?: number; size?: number }) {
  const app = itemAppearance(itemId, slot);
  return <Svg size={size}>{itemShape(app.shape, app.color, app.accent, app.shape === "potion" ? quantity : 0)}</Svg>;
}
