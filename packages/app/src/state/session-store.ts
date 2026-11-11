import { recordTick, startFightStats, type FightHistory, type FightStats, type PlayerCommand, type RunnerState, type SimEvent, type TickRecord, type TickResult, type WorldSnapshot } from "@sim/engine";
import type { HostMode } from "../host/simulation-host";
import { create } from "zustand";
import { describeEvent, type LogEntry } from "../utils/event-log";

const MAX_LOG = 300;
/** Event log entries kept per fight (a long fight produces a few thousand). */
const MAX_RECORDS = 50_000;

/** One engine event as it happened: the tick, its order within the fight, and the event itself. */
export interface EventRecord {
  seq: number;
  tick: number;
  event: SimEvent;
}

interface SessionState {
  /** Latest snapshot from the engine. The engine is the source of truth; this is a read-only copy for the HUD. */
  snapshot: WorldSnapshot | null;
  runState: RunnerState;
  seed: number | null;
  speed: number;
  log: LogEntry[];
  /** Every engine event of this fight, in order (the detailed event log). */
  records: EventRecord[];
  /** Fight statistics folded from engine events (mutated in place; `statsTick` changes when they do). */
  stats: FightStats | null;
  statsTick: number;
  /** live, review (looking at an earlier tick of the live fight) or replay. */
  mode: HostMode;
  /** Prayers the prayer orb toggles (from the loadout). */
  quickPrayers: string[];
  setQuickPrayers: (ids: string[]) => void;
  /** ID of the replay saved for the last finished fight. */
  lastReplayId: string | null;
  setLastReplayId: (id: string | null) => void;
  /** The fight's full history (engine-owned; grows while live). */
  history: FightHistory | null;
  /** Latest tick in the history (the tick on screen is snapshot.tick). */
  latestTick: number;
  /** Fight controls the UI may call (set by the arena while it is mounted). */
  controls: FightControls;
  setControls: (c: FightControls | null) => void;
  /** The tick on screen changed outside live play: rebuild every derived view up to it. */
  view: (record: TickRecord, history: FightHistory, mode: HostMode) => void;
  setMode: (mode: HostMode) => void;
  /** Sends a command to the running fight (set by the arena while it is mounted). */
  send: (command: PlayerCommand) => void;
  setSender: (send: ((command: PlayerCommand) => void) | null) => void;
  begin: (snapshot: WorldSnapshot, events: SimEvent[], seed: number, history?: FightHistory) => void;
  applyTick: (result: TickResult) => void;
  setRunState: (state: RunnerState) => void;
  setSpeed: (speed: number) => void;
  clear: () => void;
}

let nextId = 1;

/** Review and replay controls, available to any panel (e.g. "go to this tick" in the event log). */
export interface FightControls {
  seek(tick: number): void;
  stepBack(): void;
  goLive(resume?: boolean): void;
  continueFromHere(): void;
}
const NO_CONTROLS: FightControls = { seek: () => {}, stepBack: () => {}, goLive: () => {}, continueFromHere: () => {} };

let names: (id: string) => string = (id) => id;
let isProtection: (prayerId: string) => boolean = () => false;
/** Tells analytics which prayers are protection prayers (from content). */
export function setProtectionPrayers(fn: (prayerId: string) => boolean): void {
  isProtection = fn;
}
let seq = 0;
const toRecords = (events: SimEvent[], tick: number): EventRecord[] => events.map((event) => ({ seq: seq++, tick, event }));
/** Lets the log show content names (prayers, spells) without importing content here. */
export function setLogNames(fn: (id: string) => string): void {
  names = fn;
}

function toLog(events: SimEvent[], tick: number, snapshot: WorldSnapshot): LogEntry[] {
  const nameOf = (id: string) => (id === "player" ? "You" : (snapshot.npcs.find((n) => n.id === id)?.name ?? names(id)));
  return events.flatMap((e) => {
    const d = describeEvent(e, nameOf);
    return d ? [{ id: nextId++, tick, ...d }] : [];
  });
}

/** Per-fight UI state, updated once per tick by the simulation host. */
export const useSessionStore = create<SessionState>((set) => ({
  snapshot: null,
  runState: "ready",
  seed: null,
  speed: 1,
  log: [],
  records: [],
  stats: null,
  statsTick: -1,
  mode: "live",
  lastReplayId: null,
  quickPrayers: [],
  setQuickPrayers: (quickPrayers) => set({ quickPrayers }),
  setLastReplayId: (lastReplayId) => set({ lastReplayId }),
  history: null,
  latestTick: 0,
  controls: NO_CONTROLS,
  setControls: (c) => set({ controls: c ?? NO_CONTROLS }),
  setMode: (mode) => set({ mode }),
  view: (record, history, mode) => {
    // Everything derived from events is rebuilt from the history up to the tick on screen.
    const upTo = history.range(0, record.tick);
    const stats = startFightStats(upTo[0]!.snapshot);
    let log: LogEntry[] = [];
    const records: EventRecord[] = [];
    seq = 0;
    for (const r of upTo) {
      if (r.tick > 0) recordTick(stats, { tick: r.tick, events: r.events, snapshot: r.snapshot }, isProtection);
      records.push(...toRecords(r.events, r.tick));
      log = log.concat(toLog(r.events, r.tick, r.snapshot));
    }
    set({ snapshot: record.snapshot, stats, records, log: log.slice(-MAX_LOG), statsTick: record.tick, mode, history, latestTick: history.latestTick });
  },
  send: () => {},
  setSender: (send) => set({ send: send ?? (() => {}) }),
  begin: (snapshot, events, seed, history) => {
    seq = 0;
    set({ snapshot, seed, log: toLog(events, 0, snapshot), records: toRecords(events, 0), stats: startFightStats(snapshot), statsTick: 0, history: history ?? null, latestTick: 0 });
  },
  applyTick: (result) =>
    set((s) => {
      const { snapshot, events, tick } = result;
      const added = toLog(events, tick, snapshot);
      if (s.stats) recordTick(s.stats, result, isProtection);
      const records = events.length ? s.records.concat(toRecords(events, tick)) : s.records;
      return {
        snapshot,
        log: added.length ? [...s.log, ...added].slice(-MAX_LOG) : s.log,
        records: records.length > MAX_RECORDS ? records.slice(-MAX_RECORDS) : records,
        statsTick: tick,
        latestTick: tick,
      };
    }),
  setRunState: (runState) => set({ runState }),
  setSpeed: (speed) => set({ speed }),
  clear: () => set({ snapshot: null, log: [], records: [], stats: null, statsTick: -1, runState: "ready", seed: null, mode: "live", history: null, latestTick: 0, controls: NO_CONTROLS }),
}));
