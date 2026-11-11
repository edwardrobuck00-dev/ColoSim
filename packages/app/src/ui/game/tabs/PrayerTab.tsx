import { isOverhead, missingPrayerRequirements, type ContentRegistry, type PrayerDef, type WorldSnapshot } from "@sim/engine";
import { useSessionStore } from "../../../state/session-store";
import { useUiStore } from "../../../state/ui-store";
import { PrayerIcon } from "../icons";
import styles from "../game.module.css";

const UTILITY_TEXT: Record<NonNullable<PrayerDef["utility"]>, string> = {
  "rapid-restore": "Restores drained stats on its own timer",
  "rapid-heal": "Doubles hitpoint regeneration",
  preserve: "Boosts last 30 s longer",
  redemption: "Heals when under 10% HP",
};

export function describePrayer(pr: PrayerDef): string {
  if (pr.protects) return `Protects from ${pr.protects}`;
  if (pr.utility) return UTILITY_TEXT[pr.utility];
  const pct = (f: readonly [number, number] | undefined) => (f ? `+${Math.round((f[0] * 100) / f[1]) - 100}%` : "");
  const e = pr.effects;
  const parts: string[] = [];
  if (e.meleeAccuracy) parts.push(`${pct(e.meleeAccuracy)} Attack`);
  if (e.meleeStrength) parts.push(`${pct(e.meleeStrength)} Strength`);
  if (e.rangedAccuracy) parts.push(`${pct(e.rangedAccuracy)} Ranged`);
  if (e.magicAccuracy) parts.push(`${pct(e.magicAccuracy)} Magic`);
  if (e.magicDamageTenths) parts.push(`+${e.magicDamageTenths / 10}% Magic damage`);
  if (e.defence) parts.push(`${pct(e.defence)} Defence`);
  return parts.join(", ");
}

/**
 * The prayer book as a 5-column icon grid in level order. Active prayers glow.
 * A click queues a toggle for the start of the next tick.
 */
export function PrayerTab({ snapshot, content }: { snapshot: WorldSnapshot; content: ContentRegistry }) {
  const send = useSessionStore((s) => s.send);
  const setHover = useUiStore((s) => s.setHoverText);
  const p = snapshot.player;
  const prayers = [...content.prayers.values()].sort((a, b) => a.level - b.level);
  const drain = p.activePrayers.reduce((sum, id) => sum + (content.prayers.get(id)?.drainEffect ?? 0), 0);
  return (
    <>
      <div className={styles.prayerHead}>
        <span>Prayer: <span className={styles.white} data-testid="prayer-points">{p.prayerPoints}</span> / {p.maxPrayerPoints}</span>
        <span title={`Drain resistance ${60 + 2 * p.bonuses.prayer} (prayer bonus ${p.bonuses.prayer})`}>
          Drain <span className={styles.white} data-testid="prayer-drain">{drain}</span>
        </span>
      </div>
      {p.overheadsLockedFor > 0 && (
        <p className={styles.lockNote} role="status" data-testid="overheads-locked">
          Overheads disabled: {p.overheadsLockedFor} ticks
        </p>
      )}
      <div className={styles.prayerGrid} role="group" aria-label="Prayers">
        {prayers.map((pr) => {
          const missing = missingPrayerRequirements(p.baseLevels, pr);
          const overheadLocked = isOverhead(pr) && p.overheadsLockedFor > 0;
          const on = p.activePrayers.includes(pr.id);
          const reason = missing.length ? `Requires ${missing.join(", ")}` : overheadLocked ? "Disabled" : null;
          const detail = reason ?? describePrayer(pr);
          return (
            <button
              key={pr.id}
              type="button"
              className={styles.prayer}
              aria-pressed={on}
              disabled={!on && (reason !== null || p.prayerPoints === 0)}
              title={`${pr.name} (level ${pr.level}): ${detail}. Drain ${pr.drainEffect}.`}
              onClick={() => send({ type: "togglePrayer", prayerId: pr.id })}
              onMouseEnter={() => setHover(`${on ? "Deactivate" : "Activate"} ${pr.name}`)}
              onMouseLeave={() => setHover(null)}
            >
              <PrayerIcon prayer={pr} />
              <span className={styles.srOnly}>{pr.name} {detail}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
