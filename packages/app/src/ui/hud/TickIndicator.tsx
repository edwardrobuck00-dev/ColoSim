import type { RunnerState } from "@sim/engine";
import { formatTicks } from "../../utils/format";
import styles from "../game/hud.module.css";

export function TickIndicator({ tick, state, speed }: { tick: number; state: RunnerState; speed: number }) {
  return (
    <div className={styles.tick} aria-live="off">
      <span data-testid="tick-count">Tick {tick}</span>
      <span className={styles.dim}>{formatTicks(tick)}</span>
      <span className={styles.pulse} data-on={tick % 2 === 0} aria-hidden />
      {speed !== 1 && <span className={styles.dim}>{speed}x</span>}
      {(state === "paused" || state === "ready") && <span className={styles.pausedTag} data-testid="paused">Paused</span>}
    </div>
  );
}
