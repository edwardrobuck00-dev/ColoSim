import { SPEED_OPTIONS } from "@sim/storage";
import { useEffect, useState } from "react";
import { KEY_ACTION_LABELS, type KeyAction } from "../input/keybinds";
import { useSettingsStore } from "../state/settings-store";
import { Button } from "../ui/components/Button";
import { Panel } from "../ui/components/Panel";
import { keyLabel } from "../utils/format";
import styles from "./pages.module.css";

const speedLabel = (s: number) => (s === 1 ? "1x (real time, 600 ms per tick)" : `${s}x (${Math.round(600 / s)} ms per tick)`);

export function SettingsPage() {
  const { settings, update, setKeybind, resetAll } = useSettingsStore();
  const [listening, setListening] = useState<KeyAction | null>(null);

  useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.code !== "Escape") setKeybind(listening, e.code);
      setListening(null);
    };
    window.addEventListener("keydown", onKey, { once: true });
    return () => window.removeEventListener("keydown", onKey);
  }, [listening, setKeybind]);

  return (
    <div className={styles.page}>
      <h1>Settings</h1>
      <div className={styles.settingsGrid}>
        <Panel title="Simulation">
          <label className={styles.field}>
            Simulation speed
            <select value={settings.speed} onChange={(e) => update({ speed: Number(e.target.value) })}>
              {SPEED_OPTIONS.map((s) => <option key={s} value={s}>{speedLabel(s)}</option>)}
            </select>
          </label>
          <p className={styles.note}>Speed only changes how fast ticks play. Fight results depend only on the seed and your inputs.</p>
          <label className={styles.check}>
            <input type="checkbox" checked={settings.lockSeed} onChange={(e) => update({ lockSeed: e.target.checked })} />
            Reset repeats the same seed (identical fights for identical inputs)
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={settings.followCamera} onChange={(e) => update({ followCamera: e.target.checked })} />
            Camera follows the player
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={settings.showTickCounter} onChange={(e) => update({ showTickCounter: e.target.checked })} />
            Show tick counter
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={settings.showHoverTile} onChange={(e) => update({ showHoverTile: e.target.checked })} />
            Highlight the tile under the cursor
          </label>
        </Panel>

        <Panel title="Keybinds" actions={<Button variant="ghost" onClick={resetAll}>Reset all settings</Button>}>
          <table className={styles.keys}>
            <tbody>
              {(Object.keys(KEY_ACTION_LABELS) as KeyAction[]).map((action) => (
                <tr key={action}>
                  <td>{KEY_ACTION_LABELS[action]}</td>
                  <td>
                    <Button onClick={() => setListening(action)} aria-label={`Rebind ${KEY_ACTION_LABELS[action]}`}>
                      {listening === action ? "Press a key…" : keyLabel(settings.keybinds[action])}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={styles.note}>Click a key, then press the new key. Escape cancels.</p>
        </Panel>
      </div>
    </div>
  );
}
