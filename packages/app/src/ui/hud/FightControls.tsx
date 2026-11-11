import type { RunnerState, SimEvent } from "@sim/engine";
import { SPEED_OPTIONS } from "@sim/storage";
import { useMemo } from "react";
import type { FightHistory } from "@sim/engine";
import { useSessionStore } from "../../state/session-store";
import { useSettingsStore } from "../../state/settings-store";
import { useUiStore } from "../../state/ui-store";
import { formatTicks, keyLabel } from "../../utils/format";
import styles from "../game/hud.module.css";

export interface FightControlActions {
  togglePause: () => void;
  step: () => void;
  stepBack: () => void;
  seek: (tick: number) => void;
  goLive: () => void;
  continueFromHere: () => void;
  /** Reset with the configured seed policy (new seed, or same seed when locked). */
  reset: () => void;
  /** Reset with exactly the same seed. */
  resetSameSeed: () => void;
  toggleRun: () => void;
  setSpeed: (speed: number) => void;
}

/** Timeline markers: notable ticks, from the engine's events. */
const MARKERS: Array<{ kind: string; label: string; match: (e: SimEvent) => boolean }> = [
  { kind: "phase", label: "Phase change", match: (e) => e.type === "BossPhaseChanged" || e.type === "BossEnraged" },
  { kind: "special", label: "Boss special", match: (e) => e.type === "BossSpecialUsed" },
  { kind: "spec", label: "Your special attack", match: (e) => e.type === "SpecialUsed" },
  { kind: "death", label: "Death", match: (e) => e.type === "EntityDied" },
];

type Marker = (typeof MARKERS)[number] & { tick: number };
const markerIndex = new WeakMap<FightHistory, { scannedTo: number; last: unknown; markers: Marker[] }>();

/**
 * Timeline markers, found incrementally: only ticks added since the last call
 * are scanned, so long fights stay cheap. If the last scanned tick was
 * replaced (a rewind discarded it), the scan starts over.
 */
export function markersFor(history: FightHistory, latest: number): Marker[] {
  let idx = markerIndex.get(history);
  if (!idx || (idx.scannedTo >= 0 && history.at(idx.scannedTo) !== idx.last)) {
    idx = { scannedTo: -1, last: undefined, markers: [] };
    markerIndex.set(history, idx);
  }
  if (latest > idx.scannedTo) {
    const from = idx.scannedTo + 1;
    const found = MARKERS.flatMap((m) => history.ticksWhere(m.match, from).map((tick) => ({ ...m, tick })));
    idx.markers = [...idx.markers, ...found];
    idx.scannedTo = latest;
    idx.last = history.at(latest);
  }
  return idx.markers;
}

/**
 * Simulation and replay transport: a timeline of every tick so far (drag to
 * review any of them), back / pause / step, return to live, continue from
 * the tick on screen, speed, restart. Works the same for live fights and replays.
 */
export function FightControls({ state, speed, actions }: { state: RunnerState; speed: number; actions: FightControlActions }) {
  const kb = useSettingsStore((s) => s.settings.keybinds);
  const analyticsOpen = useUiStore((s) => s.analyticsOpen);
  const setAnalytics = useUiStore((s) => s.setAnalytics);
  const mode = useSessionStore((s) => s.mode);
  const latest = useSessionStore((s) => s.latestTick);
  const history = useSessionStore((s) => s.history);
  const viewTick = useSessionStore((s) => s.snapshot?.tick ?? 0);

  const markers = useMemo(() => (history ? markersFor(history, latest) : []), [history, latest]);

  const ended = state === "ended";
  const paused = state === "paused" || state === "ready";
  const live = mode === "live";
  const max = Math.max(1, latest);
  return (
    <div className={styles.controls} data-mode={mode}>
      {!live && (
        <p className={styles.reviewNote} role="status">
          {mode === "review"
            ? "Reviewing the fight: your inputs are paused. Live returns to the latest tick; Play from here rewinds the fight to this tick and continues."
            : "Watching a replay. Play from here takes over the fight at this tick."}
        </p>
      )}
      <div className={styles.timeline}>
        <span className={styles.modeTag} data-testid="mode">{mode === "live" ? "Live" : mode === "review" ? "Reviewing" : "Replay"}</span>
        <div className={styles.track}>
          <input
            type="range"
            aria-label="Timeline"
            min={0}
            max={max}
            value={viewTick}
            onChange={(e) => actions.seek(Number(e.target.value))}
          />
          {markers.map((m) => (
            <button
              key={`${m.kind}-${m.tick}`}
              type="button"
              className={styles.marker}
              data-kind={m.kind}
              style={{ left: `${(m.tick / max) * 100}%` }}
              title={`${m.label}, tick ${m.tick}`}
              aria-label={`${m.label} at tick ${m.tick}`}
              onClick={() => actions.seek(m.tick)}
            />
          ))}
        </div>
        <span className={styles.tickLabel} data-testid="view-tick">
          {viewTick} / {latest} <span className={styles.dim}>({formatTicks(viewTick)})</span>
        </span>
      </div>
      <div className={styles.buttons}>
        <button type="button" onClick={() => actions.seek(0)} disabled={viewTick === 0} title="Go to the start of the fight" aria-label="Go to start">|&lt;</button>
        <button type="button" onClick={actions.stepBack} disabled={viewTick === 0} title={`One tick back (${keyLabel(kb.stepBack)})`} aria-label="Back one tick">&lt;</button>
        <button type="button" onClick={actions.togglePause} disabled={live && ended} title={`Pause / resume (${keyLabel(kb.pause)})`}>
          {paused || ended ? (live ? "Resume" : "Play") : "Pause"}
        </button>
        <button type="button" onClick={actions.step} disabled={(live && (!paused || ended)) || (!live && mode === "replay" && viewTick >= latest)} title={`One tick forward (${keyLabel(kb.step)})`}>
          Step
        </button>
        {mode === "review" && (
          <button type="button" onClick={actions.goLive} title={`Back to the live fight (${keyLabel(kb.goLive)})`}>Live</button>
        )}
        {!live && (
          <button type="button" onClick={actions.continueFromHere} title={mode === "review" ? "Rewind the fight to this tick and play on from here (later ticks are discarded)" : "Take over this replay and play on from this tick"}>
            Play from here
          </button>
        )}
        {live && (
          <button type="button" onClick={actions.toggleRun} disabled={ended} title={`Toggle run (${keyLabel(kb.toggleRun)})`}>
            Run
          </button>
        )}
        <button type="button" onClick={actions.reset} title={mode === "replay" ? "Restart the replay" : `Restart the fight (${keyLabel(kb.reset)})`}>
          Reset
        </button>
        <button type="button" aria-pressed={analyticsOpen} onClick={() => setAnalytics(!analyticsOpen)} title={`Combat analytics (${keyLabel(kb.toggleAnalytics)})`}>
          Stats
        </button>
        <label className={styles.speed}>
          Speed
          <select aria-label="Simulation speed" value={speed} onChange={(e) => actions.setSpeed(Number(e.target.value))}>
            {SPEED_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}x</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
