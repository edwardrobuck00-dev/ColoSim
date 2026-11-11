import type { WorldSnapshot } from "@sim/engine";
import styles from "./hud.module.css";

/** Health bar of the player's target (or the first living NPC), green over red, at the top of the view. */
export function BossBar({ snapshot }: { snapshot: WorldSnapshot }) {
  const npc = snapshot.npcs.find((n) => n.id === snapshot.player.targetId) ?? snapshot.npcs.find((n) => n.alive);
  if (!npc) return null;
  const pct = Math.max(0, Math.min(100, (npc.hitpoints / Math.max(1, npc.maxHitpoints)) * 100));
  return (
    <div className={styles.bossBar} role="meter" aria-label={`${npc.name} hitpoints`} aria-valuenow={npc.hitpoints} aria-valuemin={0} aria-valuemax={npc.maxHitpoints}>
      <div className={styles.bossName}>
        {npc.name}
        {npc.phase.count > 1 && (
          <span className={styles.bossPhase} data-testid="boss-phase">
            {" "}· Phase {npc.phase.index + 1}/{npc.phase.count}{npc.phase.name ? `: ${npc.phase.name}` : ""}
          </span>
        )}
        {npc.enraged && <span className={styles.bossEnraged} data-testid="boss-enraged"> · Enraged</span>}
      </div>
      <div className={styles.bossTrack} data-immune={npc.invulnerable}>
        <div className={styles.bossFill} style={{ width: `${pct}%` }} />
        <span className={styles.bossText}>{npc.invulnerable ? "Immune" : `${npc.hitpoints} / ${npc.maxHitpoints}`}</span>
      </div>
    </div>
  );
}
