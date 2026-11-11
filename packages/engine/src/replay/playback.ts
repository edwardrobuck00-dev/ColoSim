import { TICK_MS } from "../core/version";
import type { FightHistory, TickRecord } from "./history";

export type PlaybackState = "playing" | "paused" | "ended";

export interface PlaybackListener {
  /** The cursor moved forward by exactly one tick (animate this record). */
  tick?(record: TickRecord): void;
  /** The cursor jumped (back, or forward by more than one tick): show this record as is. */
  seek?(record: TickRecord): void;
  stateChange?(state: PlaybackState): void;
}

/**
 * A playback cursor over a FightHistory: play, pause, step forward and back,
 * seek to any tick, change speed. Like SimulationRunner it has no timers; the
 * host feeds elapsed time to advance(). It never simulates anything, so it
 * can only show what the history holds (a replay rebuilt in full, or a live
 * fight up to its latest tick).
 */
export class HistoryPlayer {
  private _tick: number;
  private _state: PlaybackState = "paused";
  private _speed: number;
  private accumulatorMs = 0;
  private sinceStepMs: number | null = null;
  private readonly listeners = new Set<PlaybackListener>();

  constructor(private readonly history: FightHistory, opts: { tick?: number; speed?: number } = {}) {
    this._tick = clamp(opts.tick ?? 0, 0, history.latestTick);
    this._speed = opts.speed ?? 1;
  }

  get tick(): number {
    return this._tick;
  }

  get state(): PlaybackState {
    return this._state;
  }

  get speed(): number {
    return this._speed;
  }

  get record(): TickRecord {
    return this.history.at(this._tick)!;
  }

  get atEnd(): boolean {
    return this._tick >= this.history.latestTick;
  }

  /** Interpolation progress (0..1) toward the current tick, for rendering only. */
  get alpha(): number {
    const ms = TICK_MS / this._speed;
    if (this._state === "playing") return Math.min(1, this.accumulatorMs / ms);
    return this.sinceStepMs === null ? 1 : Math.min(1, this.sinceStepMs / ms);
  }

  on(l: PlaybackListener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  play(): void {
    if (this.atEnd) return this.setState("ended");
    this.sinceStepMs = null;
    this.setState("playing");
  }

  pause(): void {
    if (this._state === "playing") this.setState("paused");
  }

  setSpeed(x: number): void {
    this._speed = Math.min(8, Math.max(0.25, x));
  }

  /** One tick forward (animated). */
  stepForward(): TickRecord | null {
    if (this.atEnd) return null;
    if (this._state === "playing") this.setState("paused");
    this._tick++;
    this.sinceStepMs = 0;
    const rec = this.record;
    for (const l of this.listeners) l.tick?.(rec);
    return rec;
  }

  /** One tick back (shown as a jump). */
  stepBack(): TickRecord | null {
    if (this._tick === 0) return null;
    return this.seek(this._tick - 1);
  }

  /** Jumps to a tick (clamped to the history). Moving forward by one is animated like a step. */
  seek(tick: number): TickRecord {
    const target = clamp(Math.round(tick), 0, this.history.latestTick);
    if (this._state === "playing") this.setState("paused");
    if (target === this._tick + 1) return this.stepForward()!;
    this._tick = target;
    this.sinceStepMs = null;
    this.accumulatorMs = 0;
    const rec = this.record;
    for (const l of this.listeners) l.seek?.(rec);
    if (this._state === "ended" && !this.atEnd) this.setState("paused");
    return rec;
  }

  /** Feeds elapsed real time while playing; emits each tick reached. */
  advance(elapsedMs: number): TickRecord[] {
    if (this._state !== "playing") {
      if (this.sinceStepMs !== null) this.sinceStepMs += elapsedMs;
      return [];
    }
    const ms = TICK_MS / this._speed;
    this.accumulatorMs += Math.max(0, elapsedMs);
    const out: TickRecord[] = [];
    while (this.accumulatorMs >= ms && out.length < 5 && !this.atEnd) {
      this.accumulatorMs -= ms;
      this._tick++;
      const rec = this.record;
      out.push(rec);
      for (const l of this.listeners) l.tick?.(rec);
    }
    if (this.accumulatorMs >= ms) this.accumulatorMs %= ms;
    if (this.atEnd) {
      this.sinceStepMs = this.accumulatorMs;
      this.accumulatorMs = 0;
      this.setState("ended");
    }
    return out;
  }

  private setState(s: PlaybackState): void {
    if (s === this._state) return;
    this._state = s;
    for (const l of this.listeners) l.stateChange?.(s);
  }
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
