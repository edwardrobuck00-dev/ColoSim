import { FightHistory, type TickRecord } from "../replay/history";
import type { PlayerCommand } from "../api/commands";
import type { SimulationConfigInput } from "../api/config";
import type { SimEvent } from "../api/events";
import { createSimulation, type Simulation, type TickResult } from "../api/simulation";
import type { WorldSnapshot } from "../api/snapshot";
import { ENGINE_VERSION, TICK_MS } from "../core/version";
import type { ContentRegistry } from "../defs/registry";
import type { Replay } from "../replay/input-log";

/**
 * ready   - built, tick 0, waiting for start()
 * running - ticks advance as time is fed to advance()
 * paused  - no ticks except through step()
 * ended   - the encounter has an outcome; only reset() continues
 */
export type RunnerState = "ready" | "running" | "paused" | "ended";

export const MIN_SPEED = 0.25;
export const MAX_SPEED = 8;

export interface RunnerOptions {
  content: ContentRegistry;
  /** Encounter, modifiers, player setup and the initial seed. */
  config: SimulationConfigInput;
  /** Source of fresh seeds for reset({ seed: "new" }). Randomness lives with the caller, not the engine. */
  seedSource?: () => number;
  /** Speed multiplier: 1 = real time (600 ms per tick), 2 = twice as fast. */
  speed?: number;
  /** Most ticks one advance() call may run, so a stalled host does not fast-forward a fight. */
  maxCatchUpTicks?: number;
}

export interface RunnerListener {
  /** After every tick, whether from time, step() or a headless helper. */
  tick?(result: TickResult): void;
  /** After a (re)build: tick 0 snapshot, spawn events and the seed in use. */
  reset?(snapshot: WorldSnapshot, initialEvents: SimEvent[], seed: number): void;
  stateChange?(state: RunnerState): void;
  /** After rewindTo(): the fight now stands at this (earlier) tick; later ticks were discarded. */
  rewound?(record: TickRecord): void;
}

export type ResetSeed = "same" | "new" | number;

export class RunnerError extends Error {
  override name = "RunnerError";
}

/**
 * Drives a Simulation: start, pause, resume, reset, single-tick stepping and
 * speed. It contains no timers. The host reports elapsed real time through
 * advance(); the runner turns that into whole ticks. Real time only decides
 * *when* ticks happen, never *what* happens in them, so results depend only
 * on the seed, the content and the commands applied on each tick.
 */
export class SimulationRunner {
  private sim!: Simulation;
  private _history!: FightHistory;
  private config: SimulationConfigInput;
  private _state: RunnerState = "ready";
  private _speed: number;
  private accumulatorMs = 0;
  /** While not running: ms since the last tick, so the renderer can finish interpolating it. */
  private sinceLastTickMs: number | null = null;
  private replayInputs: Map<number, PlayerCommand[]> | null = null;
  private replaySource: Replay | null = null;
  private readonly listeners = new Set<RunnerListener>();
  private readonly maxCatchUp: number;

  constructor(private readonly opts: RunnerOptions) {
    this.config = { ...opts.config };
    this._speed = clampSpeed(opts.speed ?? 1);
    this.maxCatchUp = Math.max(1, opts.maxCatchUpTicks ?? 5);
    this.build();
  }

  // ---------- state ----------

  get state(): RunnerState {
    return this._state;
  }

  get speed(): number {
    return this._speed;
  }

  /** Real milliseconds per tick at the current speed. */
  get tickMs(): number {
    return TICK_MS / this._speed;
  }

  get seed(): number {
    return this.sim.config.seed;
  }

  get tick(): number {
    return this.sim.getSnapshot().tick;
  }

  get isReplay(): boolean {
    return this.replayInputs !== null;
  }

  /**
   * Progress (0..1) from the previous tick to the current one, for rendering
   * interpolation only. Never affects simulation results.
   */
  get alpha(): number {
    if (this._state === "running") return Math.min(1, this.accumulatorMs / this.tickMs);
    return this.sinceLastTickMs === null ? 1 : Math.min(1, this.sinceLastTickMs / this.tickMs);
  }

  getSnapshot(): WorldSnapshot {
    return this.sim.getSnapshot();
  }

  getStateHash(): string {
    return this.sim.getStateHash();
  }

  toReplay(): Replay {
    return this.sim.toReplay();
  }

  /** Every tick of the current fight so far (snapshots, events, inputs, hashes). */
  get history(): FightHistory {
    return this._history;
  }

  on(listener: RunnerListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ---------- controls ----------

  start(): void {
    if (this._state === "ready") this.setState("running");
  }

  pause(): void {
    if (this._state !== "running") return;
    this.sinceLastTickMs = this.accumulatorMs;
    this.accumulatorMs = 0;
    this.setState("paused");
  }

  resume(): void {
    if (this._state !== "paused" && this._state !== "ready") return;
    // Continue from where the interpolation was, so resuming does not jump.
    this.accumulatorMs = this.sinceLastTickMs === null ? 0 : Math.min(this.sinceLastTickMs, this.tickMs * 0.999);
    this.sinceLastTickMs = null;
    this.setState("running");
  }

  togglePause(): void {
    if (this._state === "running") this.pause();
    else this.resume();
  }

  /** Runs exactly one tick. Only while ready or paused; a ready runner becomes paused. */
  step(): TickResult | null {
    if (this._state !== "paused" && this._state !== "ready") return null;
    if (this._state === "ready") this.setState("paused");
    const result = this.doTick();
    this.sinceLastTickMs = 0;
    return result;
  }

  /** Speed multiplier, clamped to [MIN_SPEED, MAX_SPEED]. Keeps the current progress through the tick. */
  setSpeed(multiplier: number): void {
    const alpha = this.alpha;
    this._speed = clampSpeed(multiplier);
    if (this._state === "running") this.accumulatorMs = alpha * this.tickMs;
    else if (this.sinceLastTickMs !== null) this.sinceLastTickMs = alpha * this.tickMs;
  }

  /**
   * Rebuilds the encounter at tick 0 and returns to "ready".
   * seed: "same" (default) repeats the fight exactly given the same inputs;
   * "new" asks seedSource for a fresh seed; a number uses that seed.
   * In replay mode, reset restarts the replay.
   */
  reset(options: { seed?: ResetSeed } = {}): void {
    if (this.replaySource) {
      this.config = { ...this.replaySource.config };
    } else {
      const choice = options.seed ?? "same";
      const seed = choice === "same" ? this.sim.config.seed : choice === "new" ? this.newSeed() : choice;
      this.config = { ...this.config, seed };
    }
    this.build();
  }

  /** Queues a player command for the next tick. Ignored during replays and after the end. */
  queueCommand(command: PlayerCommand): boolean {
    if (this.isReplay || this._state === "ended") return false;
    this.sim.queueCommand(command);
    return true;
  }

  // ---------- time ----------

  /**
   * Feeds elapsed real time. While running, runs as many whole ticks as fit
   * (at most maxCatchUpTicks; any further backlog is dropped). Returns the
   * results of the ticks that ran.
   */
  advance(elapsedMs: number): TickResult[] {
    const dt = Math.max(0, elapsedMs);
    if (this._state !== "running") {
      if (this.sinceLastTickMs !== null) this.sinceLastTickMs += dt;
      return [];
    }
    this.accumulatorMs += dt;
    const results: TickResult[] = [];
    while (this.accumulatorMs >= this.tickMs && results.length < this.maxCatchUp && this._state === "running") {
      this.accumulatorMs -= this.tickMs;
      results.push(this.doTick());
    }
    if (this.accumulatorMs >= this.tickMs) this.accumulatorMs %= this.tickMs; // drop the backlog after a stall
    return results;
  }

  // ---------- headless helpers (tests, tools, server-side verification) ----------

  /** Runs `count` ticks immediately, regardless of state (except ended). */
  runTicks(count: number): TickResult[] {
    const out: TickResult[] = [];
    for (let i = 0; i < count && this._state !== "ended"; i++) out.push(this.doTick());
    return out;
  }

  /** Runs until the encounter ends or `maxTicks` have passed. */
  runUntilEnd(maxTicks = 100_000): TickResult[] {
    return this.runTicks(maxTicks);
  }

  // ---------- replays ----------

  /** Switches to playing back a replay. Player commands are ignored until stopReplay(). */
  loadReplay(replay: Replay): void {
    if (replay.engineVersion !== ENGINE_VERSION) {
      throw new RunnerError(`Replay was recorded with engine ${replay.engineVersion}; this is ${ENGINE_VERSION}`);
    }
    if (replay.contentHash !== this.opts.content.contentHash) {
      throw new RunnerError("Replay was recorded with different game content");
    }
    this.replaySource = replay;
    this.replayInputs = new Map(replay.inputLog.map((e) => [e.tick, e.commands]));
    this.config = { ...replay.config };
    this.build();
  }

  /**
   * Hands a replay to the player at the current tick: the fight continues
   * live from here with the player's own inputs (the rest of the recording
   * is dropped). Useful to retry a fight from any moment.
   */
  takeControl(): void {
    if (!this.replayInputs) return;
    this.replayInputs = null;
    this.replaySource = null;
    if (this._state === "running") this.pause();
  }

  /**
   * Goes back to an earlier tick by rebuilding the fight and re-applying the
   * recorded inputs (the engine is deterministic). Every re-simulated tick's
   * state hash is checked against the history; a mismatch throws. Later ticks
   * are discarded and the runner is paused, ready to continue from there.
   */
  rewindTo(tick: number): TickRecord {
    const target = Math.floor(tick);
    if (target < 0 || target > this._history.latestTick) throw new RunnerError(`Cannot rewind to tick ${tick}`);
    const sim = createSimulation(this.config, this.opts.content);
    for (let t = 1; t <= target; t++) {
      const rec = this._history.at(t)!;
      for (const cmd of rec.commands) sim.queueCommand(cmd);
      const r = sim.tick();
      if (r.hash !== rec.hash) throw new RunnerError(`Rewind desynced at tick ${t}`);
    }
    this.sim = sim;
    this._history.truncateAfter(target);
    this.accumulatorMs = 0;
    this.sinceLastTickMs = null;
    this.setState(sim.getSnapshot().outcome ? "ended" : "paused", true);
    const record = this._history.at(target)!;
    for (const l of this.listeners) l.rewound?.(record);
    return record;
  }

  /** Leaves replay mode and rebuilds a live fight with the replay's setup and seed. */
  stopReplay(): void {
    this.replaySource = null;
    this.replayInputs = null;
    this.build();
  }

  // ---------- internals ----------

  private doTick(): TickResult {
    if (this.replayInputs) {
      for (const cmd of this.replayInputs.get(this.tick + 1) ?? []) this.sim.queueCommand(cmd);
    }
    const result = this.sim.tick();
    this._history.record(result);
    for (const l of this.listeners) l.tick?.(result);
    if (result.outcome && this._state !== "ended") {
      this.sinceLastTickMs = this._state === "running" ? this.accumulatorMs : 0;
      this.accumulatorMs = 0;
      this.setState("ended");
    }
    return result;
  }

  private build(): void {
    this.sim = createSimulation(this.config, this.opts.content);
    this.accumulatorMs = 0;
    this.sinceLastTickMs = null;
    this.setState("ready", true);
    const snapshot = this.sim.getSnapshot();
    const events = this.sim.getInitialEvents();
    this._history = new FightHistory({ snapshot, events, hash: this.sim.getStateHash() });
    for (const l of this.listeners) l.reset?.(snapshot, events, this.sim.config.seed);
  }

  private newSeed(): number {
    if (!this.opts.seedSource) throw new RunnerError('reset({ seed: "new" }) needs a seedSource');
    return this.opts.seedSource();
  }

  private setState(state: RunnerState, force = false): void {
    if (this._state === state && !force) return;
    this._state = state;
    for (const l of this.listeners) l.stateChange?.(state);
  }
}

function clampSpeed(x: number): number {
  return Number.isFinite(x) ? Math.min(MAX_SPEED, Math.max(MIN_SPEED, x)) : 1;
}
