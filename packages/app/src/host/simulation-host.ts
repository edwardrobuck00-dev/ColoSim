import {
  HistoryPlayer,
  SimulationRunner,
  rebuildReplay,
  type ContentRegistry,
  type FightHistory,
  type PlayerCommand,
  type PlayerSetup,
  type Replay,
  type ResetSeed,
  type RunnerState,
  type SimEvent,
  type TickRecord,
  type TickResult,
  type WorldSnapshot,
} from "@sim/engine";
import { FrameLoop, type FrameDeps } from "./frame-loop";

/** The part of the renderer the host needs. Lets tests run without WebGL. */
export interface HostRenderer {
  loadEncounter(snapshot: WorldSnapshot, initialEvents: SimEvent[]): void;
  applyTick(result: TickResult): void;
  /** Shows a snapshot as is (jumping to another tick). */
  showSnapshot(snapshot: WorldSnapshot): void;
  frame(alpha: number, nowMs: number): void;
}

/**
 * - live: the runner simulates; the player's inputs go to the engine.
 * - review: the live fight is paused and a cursor shows an earlier tick from its history.
 * - replay: a cursor plays a saved fight, rebuilt tick by tick from its seed and inputs.
 */
export type HostMode = "live" | "review" | "replay";

export interface SimulationHostOptions {
  content: ContentRegistry;
  encounterId: string;
  modifierIds: string[];
  player: PlayerSetup;
  /** Seed for the first fight. */
  seed: number;
  /** Fresh seeds for reset("new"). */
  seedSource: () => number;
  speed: number;
  renderer: HostRenderer | null;
  /** Play this saved fight instead of a live one. */
  replay?: Replay;
  /** After every (re)build, with the tick-0 snapshot, spawn events and seed. */
  onStart?: (snapshot: WorldSnapshot, initialEvents: SimEvent[], seed: number, history: FightHistory) => void;
  /** Each live tick. */
  onTick?: (result: TickResult) => void;
  /** The displayed tick changed outside live play (review, replay, rewind). */
  onView?: (record: TickRecord, history: FightHistory, mode: HostMode) => void;
  onEnd?: (result: TickResult, replay: Replay) => void;
  onStateChange?: (state: RunnerState) => void;
  onModeChange?: (mode: HostMode) => void;
  /** Extra per-frame work (camera input), run before rendering. */
  onFrame?: (elapsedMs: number, nowMs: number) => void;
  frameDeps?: Partial<FrameDeps>;
}

const asResult = (r: TickRecord): TickResult => ({
  tick: r.tick, snapshot: r.snapshot, events: r.events, outcome: r.snapshot.outcome, commands: r.commands, hash: r.hash,
});

/**
 * Connects the engine to the renderer and UI. The engine owns all simulation
 * and history (SimulationRunner, FightHistory, HistoryPlayer, rebuildReplay);
 * the host only routes time and output and decides which tick is on screen.
 */
export class SimulationHost {
  private runner_: SimulationRunner | null = null;
  private cursor: HistoryPlayer | null = null;
  private replayHistory: FightHistory | null = null;
  private _mode: HostMode;
  private speed: number;
  /** For replays: whether the rebuilt fight matched its recorded checkpoints. */
  readonly replayCheck: { ok: boolean; reason?: string } | null = null;
  private readonly loop: FrameLoop;

  constructor(private readonly opts: SimulationHostOptions) {
    this.speed = opts.speed;
    if (opts.replay) {
      const rebuilt = rebuildReplay(opts.replay, opts.content);
      this.replayHistory = rebuilt.history;
      this.replayCheck = { ok: rebuilt.ok, ...(rebuilt.reason ? { reason: rebuilt.reason } : {}) };
      this._mode = "replay";
    } else {
      this.attachRunner(new SimulationRunner({
        content: opts.content,
        config: { seed: opts.seed, encounterId: opts.encounterId, modifierIds: opts.modifierIds, player: opts.player },
        seedSource: opts.seedSource,
        speed: opts.speed,
      }));
      this._mode = "live";
    }
    this.loop = new FrameLoop((elapsed, now) => {
      if (this._mode === "live") this.runner_?.advance(elapsed);
      else this.cursor?.advance(elapsed);
      opts.onFrame?.(elapsed, now);
      opts.renderer?.frame(this._mode === "live" ? (this.runner_?.alpha ?? 1) : (this.cursor?.alpha ?? 1), now);
    }, opts.frameDeps);
  }

  // ---------- lifecycle ----------

  /** Builds the first fight (or the replay's tick 0), starts the clock and the frame loop. */
  start(): void {
    if (this.replayHistory) {
      const h = this.replayHistory;
      const first = h.at(0)!;
      this.opts.renderer?.loadEncounter(first.snapshot, first.events);
      this.opts.onStart?.(first.snapshot, first.events, first.snapshot.seed, h);
      this.useCursor(h, 0);
      this.cursor!.setSpeed(this.speed);
      this.cursor!.play();
    } else {
      this.runner_!.reset({ seed: "same" }); // announces tick 0 to the renderer and UI
      this.runner_!.start();
    }
    this.loop.start();
  }

  dispose(): void {
    this.loop.stop();
  }

  // ---------- state ----------

  get mode(): HostMode {
    return this._mode;
  }

  /** The live runner (null while watching a replay you have not taken over). */
  get runner(): SimulationRunner | null {
    return this.runner_;
  }

  get history(): FightHistory {
    return this.replayHistory ?? this.runner_!.history;
  }

  /** The tick on screen. */
  get viewTick(): number {
    return this._mode === "live" ? this.runner_!.tick : this.cursor!.tick;
  }

  get state(): RunnerState {
    if (this._mode === "live") return this.runner_!.state;
    const s = this.cursor!.state;
    return s === "playing" ? "running" : s;
  }

  /** The snapshot on screen. */
  getSnapshot(): WorldSnapshot {
    return this._mode === "live" ? this.runner_!.getSnapshot() : this.cursor!.record.snapshot;
  }

  // ---------- controls ----------

  /** Player inputs reach the engine only while live. */
  queueCommand(cmd: PlayerCommand): void {
    if (this._mode === "live") this.runner_?.queueCommand(cmd);
  }

  togglePause(): void {
    if (this._mode === "live") return this.runner_!.togglePause();
    const c = this.cursor!;
    if (c.state === "playing") c.pause();
    else if (c.atEnd && this._mode === "review") this.goLive(true);
    else {
      if (c.atEnd) c.seek(0);
      c.play();
    }
    this.emitState();
  }

  /** One tick forward: simulate (live, paused) or advance the cursor. Reviewing past the latest tick returns to live. */
  step(): void {
    if (this._mode === "live") return void this.runner_!.step();
    const c = this.cursor!;
    if (c.atEnd && this._mode === "review") {
      this.goLive(false);
      this.runner_!.step();
      return;
    }
    c.stepForward();
    this.emitState();
  }

  /** One tick back: always shows the history (a live fight pauses and switches to review). */
  stepBack(): void {
    this.seek(this.viewTick - 1);
  }

  /** Shows any tick from the history. From live, this pauses the fight and starts reviewing. */
  seek(tick: number): void {
    if (this._mode === "live") {
      const runner = this.runner_!;
      if (tick >= runner.tick) return;
      runner.pause();
      this.useCursor(runner.history, runner.tick);
      this.setMode("review");
    }
    this.cursor!.seek(tick);
    this.emitState();
  }

  /** Leaves review at the latest tick. The fight stays paused unless `resume`. */
  goLive(resume = false): void {
    if (this._mode !== "review") return;
    const runner = this.runner_!;
    this.cursor = null;
    this.setMode("live");
    const latest = runner.history.at(runner.history.latestTick)!;
    this.opts.renderer?.showSnapshot(latest.snapshot);
    this.opts.onView?.(latest, runner.history, "live");
    if (resume) runner.resume();
    this.emitState();
  }

  /**
   * Continue playing from the tick on screen. Review: rewinds the live fight
   * (later ticks are discarded). Replay: rebuilds the fight to this tick and
   * hands it to the player. The fight is paused afterwards.
   */
  continueFromHere(): void {
    const tick = this.viewTick;
    if (this._mode === "review") {
      this.cursor = null;
      this.setMode("live");
      this.runner_!.rewindTo(tick);
      this.emitState();
      return;
    }
    if (this._mode === "replay" && this.opts.replay) {
      const runner = new SimulationRunner({ content: this.opts.content, config: this.opts.replay.config, seedSource: this.opts.seedSource, speed: this.speed });
      runner.loadReplay(this.opts.replay);
      runner.runTicks(tick);
      runner.takeControl();
      this.replayHistory = null;
      this.cursor = null;
      this.attachRunner(runner);
      this.setMode("live");
      const rec = runner.history.at(tick)!;
      this.opts.renderer?.showSnapshot(rec.snapshot);
      this.opts.onView?.(rec, runner.history, "live");
      this.emitState();
    }
  }

  setSpeed(multiplier: number): void {
    this.speed = multiplier;
    this.runner_?.setSpeed(multiplier);
    this.cursor?.setSpeed(multiplier);
  }

  /** Live: a new fight that starts at once. Replay: back to tick 0 and play. */
  reset(seed: ResetSeed): void {
    if (this._mode === "replay") {
      this.cursor!.seek(0);
      this.cursor!.play();
      this.emitState();
      return;
    }
    this.cursor = null;
    this.setMode("live");
    this.runner_!.reset({ seed });
    this.runner_!.start();
  }

  // ---------- internals ----------

  private attachRunner(runner: SimulationRunner): void {
    this.runner_ = runner;
    const o = this.opts;
    runner.on({
      reset: (snapshot, events, s) => {
        o.renderer?.loadEncounter(snapshot, events);
        o.onStart?.(snapshot, events, s, runner.history);
      },
      tick: (result) => {
        o.renderer?.applyTick(result);
        o.onTick?.(result);
        if (result.events.some((e) => e.type === "EncounterEnded")) o.onEnd?.(result, runner.toReplay());
      },
      rewound: (record) => {
        o.renderer?.showSnapshot(record.snapshot);
        o.onView?.(record, runner.history, "live");
      },
      stateChange: (state) => {
        if (this._mode === "live") o.onStateChange?.(state);
      },
    });
  }

  private useCursor(history: FightHistory, tick: number): void {
    const c = new HistoryPlayer(history, { tick, speed: this.speed });
    c.on({
      tick: (rec) => {
        this.opts.renderer?.applyTick(asResult(rec));
        this.opts.onView?.(rec, history, this._mode);
      },
      seek: (rec) => {
        this.opts.renderer?.showSnapshot(rec.snapshot);
        this.opts.onView?.(rec, history, this._mode);
      },
      stateChange: () => this.emitState(),
    });
    this.cursor = c;
  }

  private setMode(mode: HostMode): void {
    if (mode === this._mode) return;
    this._mode = mode;
    this.opts.onModeChange?.(mode);
  }

  private emitState(): void {
    this.opts.onStateChange?.(this.state);
  }
}
