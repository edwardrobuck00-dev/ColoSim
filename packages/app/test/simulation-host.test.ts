import { PRESETS } from "../src/services/loadouts";
import { describe, expect, it, vi } from "vitest";
import { SimulationHost, type HostRenderer, type SimulationHostOptions } from "../src/host/simulation-host";
import { content } from "../src/services/content";

function makeHost(overrides: Partial<SimulationHostOptions> = {}) {
  let frame: ((t: number) => void) | null = null;
  const renderer: HostRenderer = { loadEncounter: vi.fn(), applyTick: vi.fn(), showSnapshot: vi.fn(), frame: vi.fn() };
  let seeds = 1000;
  const host = new SimulationHost({
    content,
    encounterId: "training-grounds",
    modifierIds: [],
    player: PRESETS[0]!.setup,
    renderer,
    seed: 42,
    seedSource: () => seeds++,
    speed: 1,
    frameDeps: { requestFrame: (cb) => ((frame = cb), 1), cancelFrame: () => {} },
    ...overrides,
  });
  /** Simulates `ms` of real time in 50 ms frames. */
  const runFor = (ms: number, from = 0) => {
    for (let t = from; t <= from + ms; t += 50) frame?.(t);
  };
  return { host, renderer, runFor };
}

describe("SimulationHost", () => {
  it("loads the encounter, then fans ticks out to the renderer and listeners", () => {
    const onTick = vi.fn();
    const onStart = vi.fn();
    const { host, renderer, runFor } = makeHost({ onTick, onStart });
    host.start();
    expect(renderer.loadEncounter).toHaveBeenCalledOnce();
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ tick: 0 }), expect.any(Array), 42, expect.anything());
    runFor(1250);
    expect(onTick).toHaveBeenCalledTimes(2);
    expect(renderer.applyTick).toHaveBeenCalledTimes(2);
    expect(renderer.frame).toHaveBeenCalled();
  });

  it("passes player commands to the engine", () => {
    const { host, runFor } = makeHost();
    host.start();
    host.queueCommand({ type: "move", to: { x: 7, y: 6 } });
    runFor(700);
    expect(host.getSnapshot().player.pos).not.toEqual({ x: 7, y: 2 });
  });

  it("pause stops ticks, step runs one, and speed changes the rate", () => {
    const { host, runFor } = makeHost();
    host.start();
    host.togglePause();
    runFor(3000);
    expect(host.getSnapshot().tick).toBe(0);
    host.step();
    expect(host.getSnapshot().tick).toBe(1);
    host.togglePause();
    host.setSpeed(4);
    runFor(1200, 3050); // continue the frame timeline: 1250 ms at 150 ms per tick
    expect(host.getSnapshot().tick).toBe(1 + 8);
  });

  it("reset keeps or replaces the seed and restarts at tick 0", () => {
    const onStart = vi.fn();
    const { host, runFor } = makeHost({ onStart });
    host.start();
    runFor(1900);
    host.reset("same");
    expect(host.getSnapshot().tick).toBe(0);
    expect(onStart).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), 42, expect.anything());
    host.reset("new");
    expect(onStart).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), 1000, expect.anything());
    expect(host.state).toBe("running");
  });

  it("reports the replay when the encounter ends", () => {
    const onEnd = vi.fn();
    const { host } = makeHost({ encounterId: "ashen-warden", modifierIds: ["smothering-ash"], onEnd });
    host.start();
    host.togglePause();
    for (let i = 0; i < 400 && host.state !== "ended"; i++) {
      if (i % 6 === 0) host.queueCommand({ type: "move", to: i % 12 ? { x: 1, y: 1 } : { x: 20, y: 1 } });
      host.step();
    }
    expect(onEnd).toHaveBeenCalledOnce();
    expect(onEnd.mock.calls[0]![1].outcome).toBeTruthy();
    expect(host.state).toBe("ended");
  });
});

describe("SimulationHost review and replay", () => {
  it("stepping back pauses the live fight and shows the history; inputs are ignored until live again", () => {
    const onView = vi.fn();
    const { host, renderer, runFor } = makeHost({ onView });
    host.start();
    runFor(600 * 10);
    const latest = host.history.latestTick;
    host.stepBack();
    expect(host.mode).toBe("review");
    expect(host.viewTick).toBe(latest - 1);
    expect(host.getSnapshot().tick).toBe(latest - 1);
    expect(renderer.showSnapshot).toHaveBeenLastCalledWith(expect.objectContaining({ tick: latest - 1 }));
    expect(onView).toHaveBeenLastCalledWith(expect.objectContaining({ tick: latest - 1 }), host.history, "review");
    host.queueCommand({ type: "move", to: { x: 1, y: 1 } });
    runFor(600 * 5, 10_000);
    expect(host.history.latestTick).toBe(latest); // the fight did not advance while reviewing
    host.seek(2);
    expect(host.viewTick).toBe(2);
    host.step();
    expect(host.viewTick).toBe(3);
    expect(renderer.applyTick).toHaveBeenLastCalledWith(expect.objectContaining({ tick: 3 }));
    host.goLive();
    expect(host.mode).toBe("live");
    expect(host.viewTick).toBe(latest);
  });

  it("continue from here rewinds the live fight to the tick on screen", () => {
    const { host, runFor } = makeHost();
    host.start();
    runFor(600 * 12);
    const hashAt5 = host.history.at(5)!.hash;
    host.seek(5);
    host.continueFromHere();
    expect(host.mode).toBe("live");
    expect(host.history.latestTick).toBe(5);
    expect(host.runner!.getStateHash()).toBe(hashAt5);
    expect(host.state).toBe("paused");
  });

  it("plays a saved replay from a rebuilt history, and can hand it to the player", () => {
    const live = makeHost();
    live.host.start();
    live.runFor(600 * 20);
    const replay = live.host.runner!.toReplay();

    const { host, renderer, runFor } = makeHost({ replay });
    host.start();
    expect(host.mode).toBe("replay");
    expect(host.replayCheck).toEqual({ ok: true });
    expect(host.history.latestTick).toBe(replay.durationTicks);
    runFor(600 * 5);
    expect(host.viewTick).toBeGreaterThanOrEqual(4);
    expect(renderer.applyTick).toHaveBeenCalled();
    host.seek(15);
    expect(host.getSnapshot().tick).toBe(15);
    expect(host.history.at(15)!.hash).toBe(live.host.history.at(15)!.hash);
    host.continueFromHere();
    expect(host.mode).toBe("live");
    expect(host.runner!.tick).toBe(15);
    expect(host.runner!.getStateHash()).toBe(live.host.history.at(15)!.hash);
  });
});

