import type { Factor } from "./factors";

/** The combat effects of one prayer. Multipliers are integer fractions over 100. */
export interface PrayerEffects {
  meleeAccuracy?: Factor;
  meleeStrength?: Factor;
  rangedAccuracy?: Factor;
  rangedStrength?: Factor;
  magicAccuracy?: Factor;
  /** Magic damage bonus in tenths of a percent (Augury-tier: 40 = +4%). */
  magicDamageTenths?: number;
  defence?: Factor;
  /** Multiplier on Magic when defending against magic. */
  magicDefence?: Factor;
  /** Strength prayers at the lowest tier always add at least this much. */
  minimumStrengthGain?: number;
}

/** The single strongest multiplier of a kind among active prayers (the game prevents stacking). */
export function bestFactor(effects: readonly PrayerEffects[], key: keyof Omit<PrayerEffects, "magicDamageTenths" | "minimumStrengthGain">): Factor | null {
  let best: Factor | null = null;
  for (const e of effects) {
    const f = e[key];
    if (f && (!best || f[0] / f[1] > best[0] / best[1])) best = f;
  }
  return best;
}

/**
 * Defence multipliers from several active prayers add together: Steel Skin
 * (+15%) with Deadeye (+5%) gives +20% (OSRS Wiki "Deadeye"; wiki DPS
 * calculator sums the bonuses). Factors must be over 100.
 */
export function combinedDefenceFactor(effects: readonly PrayerEffects[], key: "defence" | "magicDefence" = "defence"): Factor | null {
  const parts = effects.flatMap((e) => (e[key] ? [e[key]!] : []));
  if (parts.length === 0) return null;
  return [100 + parts.reduce((s, f) => s + (f[0] * 100) / f[1] - 100, 0), 100];
}

export function totalMagicDamageTenths(effects: readonly PrayerEffects[]): number {
  return effects.reduce((s, e) => s + (e.magicDamageTenths ?? 0), 0);
}

/**
 * Prayer drain: each tick the active prayers' drain effects are added to a
 * counter. While the counter exceeds the drain resistance (60 + 2 x prayer
 * bonus), one point is lost and the resistance is subtracted.
 * Source: OSRS Wiki "Prayer", prayer drain mechanics.
 */
export function prayerDrainResistance(prayerBonus: number): number {
  return 60 + 2 * prayerBonus;
}

export function drainPrayerTick(counter: number, drainEffectTotal: number, prayerBonus: number): { counter: number; pointsLost: number } {
  const resistance = prayerDrainResistance(prayerBonus);
  let c = counter + drainEffectTotal;
  let lost = 0;
  while (c > resistance) {
    c -= resistance;
    lost++;
  }
  return { counter: c, pointsLost: lost };
}

/** Protection prayers block all damage from NPCs of the protected style, 40% from players. */
export const NPC_PROTECTION_DAMAGE: Factor = [0, 100];
export const PLAYER_PROTECTION_DAMAGE: Factor = [60, 100];
