import { describe, expect, it, vi } from "vitest";
import { MAX_SPEED, MIN_SPEED, RunnerError, SimulationRunner, TICK_MS, type PlayerCommand, type SimEvent, type TickResult } from "../src";
import { STATS_99, combatContent, ofType } from "./fixtures";

const content = combatContent();
const player = { stats: STATS_99, equipment: { weapon: "sword4" } };

function makeRunner(opts: Partial<ConstructorParameters<typeof SimulationRunner>[0]> = {}) {
  let next = 100;
  return new SimulationRunner({
    content,
    config: { seed: 42, encounterId: "vs-bruiser", player },
    seedSource: () => next++,
    ...opts,
  });
}

describe("runner state machine", () => {
  it("ready -> running -> paused -> running", () => {
    const r = makeRunner();
    const states: string[] = [];
    r.on({ stateChange: (s) => states.push(s) });
    expect(r.state).toBe("ready");
    r.start();
    r.pause();
    r.resume();
    expect(states).toEqual(["running", "paused", "running"]);
  });

  it("does not tick while ready or paused, whatever time passes", () => {
    const r = makeRunner();
    expect(r.advance(10_000)).toEqual([]);
    r.start();
    r.pause();
    expect(r.advance(10_000)).toEqual([]);
    expect(r.tick).toBe(0);
  });

  it("step() runs exactly one tick, only while ready or paused", () => {
    const r = makeRunner();
    expect(r.step()?.tick).toBe(1);
    expect(r.state).toBe("paused");
    expect(r.step()?.tick).toBe(2);
    r.resume();
    expect(r.step()).toBeNull();
    expect(r.tick).toBe(2);
  });

  it("enters 'ended' when the encounter ends, and ignores input after that", () => {
    const r = new SimulationRunner({ content, config: { seed: 1, encounterId: "duel", player } });
    r.queueCommand({ type: "attack", targetId: "npc-1" });
    r.runUntilEnd(500);
    expect(r.state).toBe("ended");
    expect(r.getSnapshot().outcome?.result).toBe("win");
    expect(r.queueCommand({ type: "stop" })).toBe(false);
    expect(r.step()).toBeNull();
    expect(r.runTicks(5)).toEqual([]);
  });

  it("notifies listeners of every tick", () => {
    const r = makeRunner();
    const onTick = vi.fn();
    r.on({ tick: onTick });
    r.start();
    r.advance(TICK_MS * 3);
    r.pause();
    r.step();
    expect(onTick).toHaveBeenCalledTimes(4);
  });
});

describe("timing and speed", () => {
  it("runs one tick per 600 ms at speed 1, keeping the remainder", () => {
    const r = makeRunner();
    r.start();
    expect(r.advance(599)).toHaveLength(0);
    expect(r.advance(1)).toHaveLength(1);
    expect(r.advance(900)).toHaveLength(1);
    expect(r.alpha).toBeCloseTo(0.5);
  });

  it("speed scales real time per tick", () => {
    const r = makeRunner({ speed: 2 });
    expect(r.tickMs).toBe(TICK_MS / 2);
    r.start();
    expect(r.advance(TICK_MS)).toHaveLength(2);
    r.setSpeed(0.5);
    expect(r.advance(TICK_MS)).toHaveLength(0);
    expect(r.advance(TICK_MS)).toHaveLength(1);
  });

  it("changing speed keeps the progress through the current tick", () => {
    const r = makeRunner();
    r.start();
    r.advance(TICK_MS * 0.25);
    r.setSpeed(4);
    expect(r.alpha).toBeCloseTo(0.25);
  });

  it("clamps speed to the supported range", () => {
    const r = makeRunner();
    r.setSpeed(1000);
    expect(r.speed).toBe(MAX_SPEED);
    r.setSpeed(0);
    expect(r.speed).toBe(MIN_SPEED);
  });

  it("caps catch-up after a stall instead of fast-forwarding the fight", () => {
    const r = makeRunner({ maxCatchUpTicks: 3 });
    r.start();
    expect(r.advance(60_000)).toHaveLength(3);
    expect(r.alpha).toBeLessThan(1);
  });

  it("after a step, alpha rises from 0 to 1 over one tick of real time", () => {
    const r = makeRunner();
    r.step();
    expect(r.alpha).toBe(0);
    r.advance(TICK_MS / 2);
    expect(r.alpha).toBeCloseTo(0.5);
    r.advance(TICK_MS);
    expect(r.alpha).toBe(1);
  });
});

describe("reset and reproducibility", () => {
  const script: Array<[number, PlayerCommand]> = [
    [0, { type: "attack", targetId: "npc-1" }],
    [9, { type: "move", to: { x: 0, y: 11 } }],
    [15, { type: "attack", targetId: "npc-1" }],
  ];

  /** Plays the script by tick number, feeding time in uneven frame sizes. */
  function play(r: SimulationRunner, frames: number[], ticks: number): SimEvent[] {
    const events: SimEvent[] = [];
    r.start();
    let f = 0;
    const queueFor = (tick: number) => {
      for (const [at, cmd] of script) if (at === tick) r.queueCommand(cmd);
    };
    queueFor(0);
    while (r.tick < ticks && r.state === "running") {
      for (const res of r.advance(frames[f++ % frames.length]!)) {
        events.push(...res.events);
        queueFor(res.tick);
      }
    }
    return events;
  }

  it("the same seed and inputs give identical results regardless of frame timing", () => {
    const smooth = play(makeRunner(), [16.7], 60);
    const choppy = play(makeRunner(), [33, 5, 120, 61, 2], 60);
    const giant = play(makeRunner(), [TICK_MS], 60);
    expect(ofType(smooth, "HitLanded").length).toBeGreaterThan(3);
    expect(choppy).toEqual(smooth);
    expect(giant).toEqual(smooth);
  });

  it("headless runs match timed runs", () => {
    const timed = makeRunner();
    play(timed, [16.7], 60);
    const headless = makeRunner();
    for (let t = 0; t < 60; t++) {
      for (const [at, cmd] of script) if (at === t) headless.queueCommand(cmd);
      headless.runTicks(1);
    }
    expect(headless.getStateHash()).toBe(timed.getStateHash());
  });

  it("reset() with the same seed repeats the fight exactly", () => {
    const r = makeRunner();
    const first = play(r, [16.7], 50);
    r.reset();
    expect(r.state).toBe("ready");
    expect(r.tick).toBe(0);
    expect(r.seed).toBe(42);
    expect(play(r, [16.7], 50)).toEqual(first);
  });

  it("reset({ seed: 'new' }) uses the seed source, and a number sets the seed", () => {
    const r = makeRunner();
    const onReset = vi.fn();
    r.on({ reset: onReset });
    r.reset({ seed: "new" });
    expect(r.seed).toBe(100);
    r.reset({ seed: 7 });
    expect(r.seed).toBe(7);
    expect(onReset).toHaveBeenLastCalledWith(expect.objectContaining({ tick: 0 }), expect.any(Array), 7);
  });

  it("reset({ seed: 'new' }) without a seed source is an error", () => {
    const r = new SimulationRunner({ content, config: { seed: 1, encounterId: "vs-dummy" } });
    expect(() => r.reset({ seed: "new" })).toThrow(RunnerError);
  });
});

describe("replays", () => {
  function recordFight() {
    const r = makeRunner();
    r.queueCommand({ type: "attack", targetId: "npc-1" });
    r.runTicks(10);
    r.queueCommand({ type: "move", to: { x: 0, y: 11 } });
    r.runTicks(6);
    r.queueCommand({ type: "attack", targetId: "npc-1" });
    const results: TickResult[] = r.runTicks(40);
    return { replay: r.toReplay(), hash: r.getStateHash(), last: results.at(-1)! };
  }

  it("a loaded replay reproduces the recorded fight", () => {
    const rec = recordFight();
    const r = makeRunner();
    r.loadReplay(rec.replay);
    expect(r.isReplay).toBe(true);
    r.runTicks(rec.replay.durationTicks);
    expect(r.getStateHash()).toBe(rec.hash);
    expect(r.getSnapshot()).toEqual(rec.last.snapshot);
  });

  it("ignores player input during playback, and reset restarts the replay", () => {
    const rec = recordFight();
    const r = makeRunner();
    r.loadReplay(rec.replay);
    expect(r.queueCommand({ type: "stop" })).toBe(false);
    r.runTicks(20);
    r.reset({ seed: 999 });
    expect(r.tick).toBe(0);
    expect(r.seed).toBe(rec.replay.config.seed);
    r.runTicks(rec.replay.durationTicks);
    expect(r.getStateHash()).toBe(rec.hash);
  });

  it("refuses replays from another engine version or different content", () => {
    const rec = recordFight();
    const r = makeRunner();
    expect(() => r.loadReplay({ ...rec.replay, engineVersion: "0.0.1" })).toThrow(RunnerError);
    expect(() => r.loadReplay({ ...rec.replay, contentHash: "deadbeef" })).toThrow(RunnerError);
  });
});
