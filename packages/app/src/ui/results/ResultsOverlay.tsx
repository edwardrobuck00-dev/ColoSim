import { summarize, type EncounterOutcome } from "@sim/engine";
import { useSessionStore } from "../../state/session-store";
import { useUiStore } from "../../state/ui-store";
import { useNavigate } from "react-router";
import { formatTicks } from "../../utils/format";
import { Button } from "../components/Button";
import styles from "./results.module.css";

export interface ResultsOverlayProps {
  outcome: EncounterOutcome;
  seed: number | null;
  onRestart: () => void;
  onRestartSameSeed: () => void;
  onChangeSetup: () => void;
}

export function ResultsOverlay({ outcome, seed, onRestart, onRestartSameSeed, onChangeSetup }: ResultsOverlayProps) {
  const stats = useSessionStore((s) => s.stats);
  const setAnalytics = useUiStore((s) => s.setAnalytics);
  const replayId = useSessionStore((s) => s.lastReplayId);
  const mode = useSessionStore((s) => s.mode);
  const controls = useSessionStore((s) => s.controls);
  const navigate = useNavigate();
  const sum = stats ? summarize(stats) : null;
  return (
    <div className={styles.backdrop} role="dialog" aria-labelledby="results-title">
      <div className={styles.card}>
        <h2 id="results-title" data-result={outcome.result}>{outcome.result === "win" ? "Victory" : "Defeat"}</h2>
        <p className={styles.reason}>{outcome.reason}</p>
        <dl>
          <div><dt>Time</dt><dd>{formatTicks(outcome.tick)}</dd></div>
          <div><dt>Ticks</dt><dd>{outcome.tick}</dd></div>
          {seed !== null && <div><dt>Seed</dt><dd data-testid="seed">{seed}</dd></div>}
        </dl>
        {stats && sum && (
          <dl className={styles.summary} aria-label="Fight summary">
            <div><dt>Damage dealt</dt><dd>{stats.dealt.damage}</dd></div>
            <div><dt>DPS</dt><dd>{sum.dps.toFixed(2)}</dd></div>
            <div><dt>Accuracy</dt><dd>{(sum.accuracy * 100).toFixed(1)}%</dd></div>
            <div><dt>Max hit</dt><dd>{stats.dealt.maxHit}</dd></div>
            <div><dt>Damage taken</dt><dd>{stats.received.damage}</dd></div>
            <div><dt>Prevented by prayer</dt><dd>{stats.received.preventedByPrayer}</dd></div>
            <div><dt>Food / potions</dt><dd>{sum.foodEaten} / {sum.potionDoses}</dd></div>
            <div><dt>Specials</dt><dd>{stats.dealt.special.used}</dd></div>
          </dl>
        )}
        <p className={styles.saved}>Replay saved on this device.</p>
        <div className={styles.actions}>
          <Button variant="primary" onClick={onRestart} autoFocus>Try again</Button>
          <Button onClick={onRestartSameSeed} title="Same seed: identical inputs give an identical fight">Same seed</Button>
          <Button onClick={onChangeSetup}>Change setup</Button>
          <Button onClick={() => setAnalytics(true, "stats")}>Full analytics</Button>
          <Button onClick={() => controls.seek(Math.max(0, outcome.tick - 10))} title="Look back through the last ticks of the fight">Review the end</Button>
          {replayId && mode !== "replay" && <Button onClick={() => navigate(`/replay/${replayId}`)}>Watch replay</Button>}
        </div>
      </div>
    </div>
  );
}
