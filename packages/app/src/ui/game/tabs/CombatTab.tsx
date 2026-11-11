import type { WorldSnapshot } from "@sim/engine";
import { useSessionStore } from "../../../state/session-store";
import { useSettingsStore } from "../../../state/settings-store";
import styles from "../game.module.css";

/** Weapon, the four combat styles and the special attack bar. */
export function CombatTab({ snapshot }: { snapshot: WorldSnapshot }) {
  const send = useSessionStore((s) => s.send);
  const updateSettings = useSettingsStore((s) => s.update);
  const p = snapshot.player;
  const energy = p.specialEnergy;
  return (
    <>
      <h3 className={styles.weaponName}>{p.weapon.name}</h3>
      <p className={styles.weaponSub}>
        Category: {p.weapon.category} · {p.weapon.speedTicks}-tick
      </p>
      <div className={styles.styleGrid} role="group" aria-label="Combat style">
        {p.combatStyles.map((s, i) => (
          <button key={i} type="button" className={styles.styleButton} aria-pressed={p.combatStyleIndex === i} onClick={() => send({ type: "setCombatStyle", index: i })}>
            <span>{s.name}</span>
            <small>{s.attackType} · {s.stance}</small>
          </button>
        ))}
      </div>
      <button
        type="button"
        className={styles.styleButton}
        style={{ width: "100%", marginTop: "0.5rem" }}
        aria-pressed={p.autoRetaliate}
        onClick={() => {
          send({ type: "setAutoRetaliate", enabled: !p.autoRetaliate });
          updateSettings({ autoRetaliate: !p.autoRetaliate });
        }}
      >
        <span>Auto Retaliate</span>
        <small>{p.autoRetaliate ? "On" : "Off"}</small>
      </button>
      <button
        type="button"
        className={styles.specBar}
        aria-pressed={p.specialArmed}
        disabled={!p.weapon.hasSpecial}
        aria-label={p.weapon.hasSpecial ? `Special attack (${p.weapon.specialEnergy}%)` : "No special attack"}
        onClick={() => send({ type: "toggleSpecial" })}
      >
        <span className={styles.specFill} style={{ width: `${energy}%` }} />
        <span className={styles.specText}>{p.weapon.hasSpecial ? `Special Attack: ${energy}%` : "No special attack"}</span>
      </button>
    </>
  );
}
