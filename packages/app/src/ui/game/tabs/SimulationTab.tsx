import type { WorldSnapshot } from "@sim/engine";
import { Link } from "react-router";
import { KEY_ACTION_LABELS, TAB_ACTIONS } from "../../../input/keybinds";
import { useSettingsStore } from "../../../state/settings-store";
import { keyLabel } from "../../../utils/format";
import styles from "../game.module.css";

/** Simulator options and a key reference. Full keybind editing is on the Settings page. */
export function SimulationTab({ snapshot }: { snapshot: WorldSnapshot }) {
  const { settings, update } = useSettingsStore();
  const kb = settings.keybinds;
  const toggle = (key: "followCamera" | "showHoverTile" | "showTickCounter" | "lockSeed", label: string) => (
    <label className={styles.check}>
      <input type="checkbox" checked={settings[key]} onChange={(e) => update({ [key]: e.target.checked })} /> {label}
    </label>
  );
  const keys: Array<[string, string]> = [
    ...(Object.values(TAB_ACTIONS).map((a) => [KEY_ACTION_LABELS[a].replace("Open ", ""), kb[a]]) as Array<[string, string]>),
    ["Protect from Melee / Missiles / Magic", `${keyLabel(kb.protectMelee)} ${keyLabel(kb.protectRanged)} ${keyLabel(kb.protectMagic)}`],
    ["Special attack", kb.toggleSpecial],
    ["Toggle run", kb.toggleRun],
    ["Pause / step", `${keyLabel(kb.pause)} ${keyLabel(kb.step)}`],
    ["Reset fight", kb.reset],
  ];
  return (
    <>
      <h3 className={styles.panelTitle}>Simulation</h3>
      {toggle("followCamera", "Camera follows player")}
      {toggle("showHoverTile", "Highlight hovered tile")}
      {toggle("showTickCounter", "Show tick counter")}
      {toggle("lockSeed", "Reset keeps the same seed")}
      <p className={`${styles.small} ${styles.dim}`}>Seed {snapshot.seed}, tick {snapshot.tick}.</p>
      <ul className={styles.keyList} aria-label="Keys">
        {keys.map(([label, code]) => (
          <li key={label}><span>{label}</span><kbd>{code.includes(" ") ? code : keyLabel(code)}</kbd></li>
        ))}
      </ul>
      <p className={styles.small}><Link className={styles.link} to="/settings">Change keybinds</Link></p>
    </>
  );
}
