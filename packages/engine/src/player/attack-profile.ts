import { stanceBonus, effectiveRange, type CombatClass, type Stance, type StanceBonus } from "../combat/stances";
import { AUTOCAST_CATEGORIES, combatStyleAt, type CombatStyleOption } from "../combat/weapon-categories";
import type { ContentRegistry } from "../defs/registry";
import type { CombatStyle } from "../defs/common";
import type { SpellDef } from "../defs/spell";
import type { PlayerState } from "../entities/types";

/** How the player attacks right now: weapon + selected combat style (+ autocast spell). */
export interface AttackProfile {
  style: CombatStyleOption;
  cls: CombatClass;
  attackType: CombatStyle;
  stance: Stance;
  bonus: StanceBonus;
  speedTicks: number;
  rangeTiles: number;
  spell: SpellDef | null;
  projectileVisualId: string | null;
  animationCue: string;
}

/**
 * Resolves the active combat style. Staves in a spell style cast the
 * autocast spell; without one they fall back to their first (melee) style.
 */
export function attackProfile(p: PlayerState, content: ContentRegistry): AttackProfile {
  const w = p.weapon;
  let style = combatStyleAt(w.category, p.combatStyleIndex);
  let spell: SpellDef | null = null;
  if (AUTOCAST_CATEGORIES.has(w.category) && style.cls === "magic") {
    spell = p.autocastSpellId ? (content.spells.get(p.autocastSpellId) ?? null) : null;
    if (!spell) style = combatStyleAt(w.category, 0);
  }
  const bonus = stanceBonus(style.stance, style.cls);

  let speedTicks = w.speedTicks + bonus.speedDelta;
  let rangeTiles = style.cls === "melee" ? Math.min(w.rangeTiles, 2) : effectiveRange(w.rangeTiles, bonus);
  let projectileVisualId = style.cls === "melee" ? null : w.projectileVisualId;
  let animationCue = w.animationCue;
  if (spell) {
    speedTicks = spell.speedTicks;
    rangeTiles = spell.rangeTiles;
    projectileVisualId = spell.projectile?.visualId ?? null;
    animationCue = spell.animationCue;
  } else if (style.cls === "melee" && AUTOCAST_CATEGORIES.has(w.category)) {
    animationCue = "attack.crush";
  }

  return {
    style,
    cls: style.cls,
    attackType: style.attackType,
    stance: style.stance,
    bonus,
    speedTicks: Math.max(1, speedTicks),
    rangeTiles: Math.max(1, rangeTiles),
    spell,
    projectileVisualId,
    animationCue,
  };
}
