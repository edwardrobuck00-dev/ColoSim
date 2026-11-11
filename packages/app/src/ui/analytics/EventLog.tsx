import { explainEvent, type EventCategory, type SimEvent } from "@sim/engine";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSessionStore, type EventRecord } from "../../state/session-store";
import { useUiStore, type LogPreset } from "../../state/ui-store";
import { formatTicks } from "../../utils/format";
import { nameLookup } from "./names";
import styles from "./analytics.module.css";

const CATEGORIES: Array<{ id: EventCategory; label: string }> = [
  { id: "damage-dealt", label: "Hits dealt" },
  { id: "damage-taken", label: "Hits taken" },
  { id: "attack", label: "Attacks" },
  { id: "special", label: "Specials" },
  { id: "prayer", label: "Prayer" },
  { id: "consumable", label: "Food & potions" },
  { id: "boss", label: "Boss" },
  { id: "equipment", label: "Equipment" },
  { id: "movement", label: "Movement" },
  { id: "system", label: "System" },
  { id: "warning", label: "Refused" },
];
const DEFAULT_HIDDEN: EventCategory[] = ["movement"];

/** Preset filters used when a statistic links here. */
const PRESETS: Record<LogPreset, (e: SimEvent) => boolean> = {
  all: () => true,
  "player-hits": (e) => e.type === "HitLanded" && e.sourceId === "player",
  misses: (e) => e.type === "HitLanded" && e.sourceId === "player" && !e.detail.accurate,
  taken: (e) => e.type === "HitLanded" && e.targetId === "player",
  blocked: (e) => e.type === "HitLanded" && !!e.blockedByPrayer,
  fire: (e) => e.type === "HitLanded" && !!e.detail.hazard,
  prayer: (e) => e.type === "PrayerToggled" || e.type === "PrayerDrained",
  consumables: (e) => e.type === "ItemConsumed",
  specials: (e) => e.type === "SpecialUsed" || (e.type === "HitLanded" && e.sourceId === "player" && e.detail.special),
  boss: (e) => ["BossPhaseChanged", "BossEnraged", "BossSpecialUsed", "HazardPlaced", "NpcHealed", "OverheadsLocked"].includes(e.type),
  deaths: (e) => e.type === "EntityDied",
};
const PRESET_LABEL: Record<LogPreset, string> = {
  all: "All events", "player-hits": "Your hits", misses: "Your misses", taken: "Hits on you", blocked: "Blocked by prayer",
  fire: "Fire damage", prayer: "Prayer", consumables: "Food & potions", specials: "Special attacks", boss: "Boss mechanics", deaths: "Deaths and kills",
};

const PAGE = 400;

/**
 * Every engine event of the fight, timestamped by tick. Filter by kind or
 * text, and select an event to see why it happened (from the engine's data).
 */
export function EventLog() {
  const records = useSessionStore((s) => s.records);
  const snapshot = useSessionStore((s) => s.snapshot);
  const preset = useUiStore((s) => s.logPreset);
  const setAnalytics = useUiStore((s) => s.setAnalytics);
  const controls = useSessionStore((s) => s.controls);
  const [hidden, setHidden] = useState<Set<EventCategory>>(new Set(DEFAULT_HIDDEN));
  const [query, setQuery] = useState("");
  const [follow, setFollow] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const listRef = useRef<HTMLOListElement>(null);
  const names = useMemo(() => nameLookup(snapshot), [snapshot]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const keep = PRESETS[preset];
    const out: Array<{ rec: EventRecord; x: ReturnType<typeof explainEvent> }> = [];
    for (const rec of records) {
      if (!keep(rec.event)) continue;
      const x = explainEvent(rec.event, rec.tick, names);
      if (preset === "all" && hidden.has(x.category)) continue;
      if (q && !`${x.title} ${x.actor} ${rec.event.type}`.toLowerCase().includes(q)) continue;
      out.push({ rec, x });
    }
    return out;
  }, [records, names, hidden, query, preset]);
  const shown = rows.slice(-limit);

  useEffect(() => {
    if (follow) listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [follow, shown.length, records.length]);

  const sel = selected === null ? undefined : rows.find((r) => r.rec.seq === selected);
  const toggle = (c: EventCategory) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  return (
    <div className={styles.log}>
      <div className={styles.filters}>
        <label className={styles.preset}>
          Show
          <select aria-label="Event filter" value={preset} onChange={(e) => setAnalytics(true, "log", e.target.value as LogPreset)}>
            {Object.entries(PRESET_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <input type="search" aria-label="Search events" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
        <label className={styles.check}><input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> Follow</label>
        <span className={styles.count} data-testid="log-count">{rows.length} events</span>
      </div>
      {preset === "all" && (
        <div className={styles.cats} role="group" aria-label="Event kinds">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" aria-pressed={!hidden.has(c.id)} data-cat={c.id} onClick={() => toggle(c.id)}>{c.label}</button>
          ))}
        </div>
      )}
      <div className={styles.split}>
        <ol ref={listRef} className={styles.rows} aria-label="Event log" onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollHeight - el.scrollTop - el.clientHeight > 40) setFollow(false);
        }}>
          {rows.length > shown.length && (
            <li><button type="button" className={styles.more} onClick={() => setLimit((l) => l + PAGE)}>Show {Math.min(PAGE, rows.length - shown.length)} earlier events</button></li>
          )}
          {shown.map(({ rec, x }) => (
            <li key={rec.seq}>
              <button type="button" className={styles.rowButton} data-cat={x.category} aria-pressed={rec.seq === selected} onClick={() => setSelected(rec.seq)}>
                <span className={styles.tick}>{rec.tick}</span>
                <span className={styles.time}>{formatTicks(rec.tick)}</span>
                <span className={styles.title}>{x.title}</span>
              </button>
            </li>
          ))}
          {rows.length === 0 && <li className={styles.empty}>No events match.</li>}
        </ol>
        <aside className={styles.detail} aria-label="Event details" data-testid="event-detail">
          {sel ? (
            <>
              <h5>{sel.x.title}</h5>
              <p className={styles.meta}>Tick {sel.rec.tick} ({formatTicks(sel.rec.tick)}) · {sel.x.actor} · {sel.rec.event.type}</p>
              <button type="button" className={styles.goto} onClick={() => { controls.seek(sel.rec.tick); setAnalytics(true, "tick"); }}>
                Go to tick {sel.rec.tick}
              </button>
              {sel.x.why.length > 0 && (
                <>
                  <h6>Why</h6>
                  <ol className={styles.why}>{sel.x.why.map((w, i) => <li key={i}>{w}</li>)}</ol>
                </>
              )}
              {sel.x.facts.length > 0 && (
                <dl className={styles.facts}>{sel.x.facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
              )}
              <details>
                <summary>Engine event</summary>
                <pre>{JSON.stringify(sel.rec.event, null, 2)}</pre>
              </details>
            </>
          ) : (
            <p className={styles.empty}>Select an event to see why it happened.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
