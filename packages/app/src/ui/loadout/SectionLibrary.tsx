import type { ConfigData, ConfigKind, ConfigRecord } from "@sim/storage";
import { useEffect, useState } from "react";
import { configs } from "../../services/configs";
import styles from "./loadout.module.css";

/**
 * Save this part of a loadout to the library, or load a saved one into it.
 * Each section (stats, equipment, inventory, prayers) has one.
 */
export function SectionLibrary<K extends Exclude<ConfigKind, "loadout" | "encounter">>({ kind, label, data, apply }: {
  kind: K;
  label: string;
  data: () => unknown;
  apply: (data: ConfigData<K>) => void;
}) {
  const [saved, setSaved] = useState<Array<ConfigRecord<ConfigData<K>>>>([]);
  const [naming, setNaming] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const refresh = () => void configs.list(kind).then(setSaved).catch(() => setSaved([]));
  useEffect(refresh, [kind]);

  const save = async () => {
    try {
      const rec = await configs.create(kind, naming ?? label, data());
      setMessage(`Saved "${rec.name}".`);
      setNaming(null);
      refresh();
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  return (
    <div className={styles.sectionLib}>
      {naming === null ? (
        <button type="button" onClick={() => setNaming(`My ${label.toLowerCase()}`)}>Save {label.toLowerCase()}...</button>
      ) : (
        <span className={styles.nameRow}>
          <input aria-label={`Name for saved ${label.toLowerCase()}`} value={naming} onChange={(e) => setNaming(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void save()} autoFocus />
          <button type="button" onClick={() => void save()}>Save</button>
          <button type="button" onClick={() => setNaming(null)}>Cancel</button>
        </span>
      )}
      <select
        aria-label={`Load saved ${label.toLowerCase()}`}
        value=""
        disabled={saved.length === 0}
        onChange={(e) => {
          const rec = saved.find((r) => r.id === e.target.value);
          if (rec) {
            apply(rec.data);
            setMessage(`Loaded "${rec.name}".`);
          }
        }}
      >
        <option value="">{saved.length ? `Load ${label.toLowerCase()}...` : `No saved ${label.toLowerCase()}`}</option>
        {saved.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      {message && <span className={styles.libMsg} role="status">{message}</span>}
    </div>
  );
}
