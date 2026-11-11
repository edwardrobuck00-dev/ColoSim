import type { ContentRegistry, WorldSnapshot } from "@sim/engine";
import { useSessionStore } from "../../../state/session-store";
import styles from "../game.module.css";

/** Combat spells. With a staff equipped, a spell can be set to autocast. */
export function MagicTab({ snapshot, content }: { snapshot: WorldSnapshot; content: ContentRegistry }) {
  const send = useSessionStore((s) => s.send);
  const p = snapshot.player;
  const spells = [...content.spells.values()];
  const canAutocast = p.weapon.category === "staff";
  return (
    <>
      <h3 className={styles.panelTitle}>Spellbook</h3>
      <dl className={styles.list}>
        {spells.map((s) => (
          <div key={s.id}><dt>{s.name}</dt><dd>level {s.level}, max {s.baseMaxHit}</dd></div>
        ))}
      </dl>
      <p className={`${styles.small} ${styles.dim}`}>
        {canAutocast ? "Choose a spell to autocast:" : "Equip a staff to autocast a spell. Powered staves cast their own spell."}
      </p>
      {canAutocast && (
        <select className={styles.select} aria-label="Autocast spell" value={p.autocastSpellId ?? ""} onChange={(e) => send({ type: "setAutocast", spellId: e.target.value || null })}>
          <option value="">None (melee)</option>
          {spells.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      )}
    </>
  );
}
