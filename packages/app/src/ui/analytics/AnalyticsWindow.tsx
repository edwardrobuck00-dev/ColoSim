import { useSessionStore } from "../../state/session-store";
import { useSettingsStore } from "../../state/settings-store";
import { useUiStore } from "../../state/ui-store";
import { keyLabel } from "../../utils/format";
import { EventLog } from "./EventLog";
import { StatsView } from "./StatsView";
import { TickInspector } from "./TickInspector";
import styles from "./analytics.module.css";

/** Live combat analytics over the game view: statistics and the detailed event log. */
export function AnalyticsWindow() {
  const open = useUiStore((s) => s.analyticsOpen);
  const tab = useUiStore((s) => s.analyticsTab);
  const setAnalytics = useUiStore((s) => s.setAnalytics);
  const stats = useSessionStore((s) => s.stats);
  useSessionStore((s) => s.statsTick); // re-render every tick: stats are folded in place
  const key = useSettingsStore((s) => keyLabel(s.settings.keybinds.toggleAnalytics));
  if (!open || !stats) return null;
  return (
    <section className={styles.window} role="dialog" aria-label="Combat analytics">
      <header className={styles.head}>
        <div role="tablist" className={styles.tabs}>
          <button type="button" role="tab" aria-selected={tab === "stats"} onClick={() => setAnalytics(true, "stats")}>Statistics</button>
          <button type="button" role="tab" aria-selected={tab === "log"} onClick={() => setAnalytics(true, "log", "all")}>Event log</button>
          <button type="button" role="tab" aria-selected={tab === "tick"} onClick={() => setAnalytics(true, "tick")}>Tick inspector</button>
        </div>
        <button type="button" className={styles.close} aria-label="Close analytics" title={`Close (${key})`} onClick={() => setAnalytics(false)}>×</button>
      </header>
      <div className={styles.body}>{tab === "stats" ? <StatsView stats={stats} /> : tab === "log" ? <EventLog /> : <TickInspector />}</div>
    </section>
  );
}
