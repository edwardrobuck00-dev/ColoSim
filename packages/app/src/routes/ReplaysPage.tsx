import { verifyReplay, type Replay } from "@sim/engine";
import type { ReplaySummary } from "@sim/storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { content } from "../services/content";
import { repositories } from "../services/storage";
import { formatTicks } from "../utils/format";
import { replayProblem } from "../utils/replays";
import styles from "./replays.module.css";

/** Loose shape check for imported files; full checks happen when the replay is rebuilt. */
export function parseReplay(text: string): Replay {
  const r = JSON.parse(text) as Partial<Replay>;
  if (r.format !== 1 || typeof r.engineVersion !== "string" || !r.config || !Array.isArray(r.inputLog) || !Array.isArray(r.checkpoints) || typeof r.durationTicks !== "number") {
    throw new Error("This file is not a combat simulator replay.");
  }
  return r as Replay;
}

/**
 * Saved fights (every finished fight is saved on this device). Watch one,
 * check that it still reproduces exactly, download it, import one, delete.
 */
export function ReplaysPage() {
  const [rows, setRows] = useState<ReplaySummary[] | null>(null);
  const [checks, setChecks] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = useCallback(() => void repositories.replays.list().then(setRows).catch(() => setRows([])), []);
  useEffect(refresh, [refresh]);

  const verify = async (id: string) => {
    const replay = await repositories.replays.get(id);
    if (!replay) return;
    const v = verifyReplay(replay, content);
    setChecks((c) => ({ ...c, [id]: v.ok ? "Reproduces exactly" : `Does not reproduce: ${v.reason}` }));
  };
  const download = async (row: ReplaySummary) => {
    const replay = await repositories.replays.get(row.id);
    if (!replay) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(replay)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `replay-${row.encounterId}-${new Date(row.createdAt).toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importFile = async (file: File) => {
    try {
      await repositories.replays.save(parseReplay(await file.text()));
      setError(null);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>Replays</h1>
        <button type="button" className={styles.button} onClick={() => fileRef.current?.click()}>Import replay</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden aria-label="Replay file" onChange={(e) => e.target.files?.[0] && void importFile(e.target.files[0])} />
      </header>
      <p className={styles.note}>
        A replay stores the seed, your setup and every input with the tick it was applied on. The engine rebuilds the fight from them,
        tick for tick, and checks it against the state hashes recorded during the fight.
      </p>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {rows === null ? <p>Loading...</p> : rows.length === 0 ? <p className={styles.note}>No replays yet. Finish a fight and it is saved here.</p> : (
        <table className={styles.table} aria-label="Saved replays">
          <thead><tr><th>Encounter</th><th>Result</th><th>Length</th><th>Recorded</th><th>Seed</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} data-testid={`replay-${r.id}`}>
                <td>{content.encounters.get(r.encounterId)?.name ?? r.encounterId}{r.modifierIds.length ? <small> + {r.modifierIds.join(", ")}</small> : null}</td>
                <td data-result={r.outcome?.result ?? "none"}>{r.outcome ? (r.outcome.result === "win" ? "Victory" : "Defeat") : "Unfinished"}</td>
                <td>{formatTicks(r.durationTicks)} <small>({r.durationTicks} ticks)</small></td>
                <td>{new Date(r.createdAt).toLocaleString()}</td>
                <td>{r.seed ?? "-"}</td>
                <td className={styles.actions}>
                  {replayProblem(r.engineVersion, r.contentHash) ? (
                    <span className={styles.check} title={replayProblem(r.engineVersion, r.contentHash)!}>Other version: can't be rebuilt</span>
                  ) : (
                    <>
                      <Link className={styles.button} to={`/replay/${r.id}`}>Watch</Link>
                      <button type="button" className={styles.button} onClick={() => void verify(r.id)}>Verify</button>
                    </>
                  )}
                  <button type="button" className={styles.button} onClick={() => void download(r)}>Download</button>
                  <button type="button" className={styles.button} onClick={() => void repositories.replays.delete(r.id).then(refresh)}>Delete</button>
                  {checks[r.id] && <span className={styles.check} role="status">{checks[r.id]}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
