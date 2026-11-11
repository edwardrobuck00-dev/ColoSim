import { useEffect, useRef, useState } from "react";
import { useSessionStore } from "../../state/session-store";
import type { LogCategory } from "../../utils/event-log";
import styles from "./hud.module.css";

const FILTERS: Array<{ id: string; label: string; show: ReadonlySet<LogCategory> }> = [
  { id: "all", label: "All", show: new Set(["system", "combat", "mechanic", "action", "warning"]) },
  { id: "game", label: "Game", show: new Set(["system", "action", "warning", "mechanic"]) },
  { id: "combat", label: "Combat", show: new Set(["combat"]) },
  { id: "boss", label: "Boss", show: new Set(["mechanic"]) },
];

/**
 * Game messages in a chatbox at the bottom-left of the game view, coloured
 * by kind: boss mechanics in red, refusals in dark red, actions in blue.
 */
export function Chatbox() {
  const log = useSessionStore((s) => s.log);
  const [filter, setFilter] = useState("all");
  const listRef = useRef<HTMLOListElement>(null);
  const show = FILTERS.find((f) => f.id === filter)!.show;
  const visible = log.filter((e) => show.has(e.category));

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [visible.length]);

  return (
    <section className={styles.chatbox} aria-label="Chat">
      <ol ref={listRef} className={styles.chatLines} aria-label="Combat log">
        {visible.map((e) => (
          <li key={e.id} data-category={e.category}>
            <span className={styles.chatTick}>[{e.tick}]</span> {e.text}
          </li>
        ))}
      </ol>
      <div className={styles.chatTabs} role="group" aria-label="Chat filter">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>
        ))}
      </div>
    </section>
  );
}
