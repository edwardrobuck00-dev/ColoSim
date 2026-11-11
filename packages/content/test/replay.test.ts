import { describe, expect, it } from "vitest";
import {
  FightHistory, HistoryPlayer, SimulationRunner, clonePlain, rebuildReplay, type PlayerCommand, type TickRecord,
} from "@sim/engine";
import { STARTER_LOADOUTS, getContentRegistry } from "../src";

const content = getContentRegistry();
const setup = STARTER_LOADOUTS.find((l) => l.id === "melee-99")!.setup;

/** Scripted inputs: attack, pray, switch prayers, eat, drink, special, move. */
const SCRIPT: Record<number, PlayerCommand[]> = {
  1: [{ type: "attack", targetId: "npc-1" }, { type: "togglePrayer", prayerId: "piety" }, { type: "togglePrayer", prayerId: "protect-from-magic" }],
  12: [{ type: "togglePrayer", prayerId: "protect-from-missiles" }],
  20: [{ type: "useItem", inventorySlot: 1 }],
  25: [{ type: "equipItem", inventorySlot: 0 }, { type: "toggleSpecial" }],
  33: [{ type: "equipItem", inventorySlot: 0 }],
  40: [{ type: "useItem", inventorySlot: 6 }],
  45: [{ type: "move", to: { x: 3, y: 3 } }],
  50: [{ type: "attack", targetId: "npc-1" }, { type: "togglePrayer", prayerId: "protect-from-melee" }],
  70: [{ type: "togglePrayer", prayerId: "protect-from-magic" }],
};

function liveFight(ticks: number, script = SCRIPT) {
  const runner = new SimulationRunner({ content, config: { seed: 77, encounterId: "ashen-warden", player: setup } });
  for (let t = 1; t <= ticks && runner.state !== "ended"; t++) {
    for (const c of script[t] ?? []) runner.queueCommand(c);
    runner.runTicks(1);
  }
  return runner;
}

const strip = (r: TickRecord) => ({ tick: r.tick, hash: r.hash, commands: r.commands, events: r.events, snapshot: r.snapshot });

describe("history and replays reproduce a fight exactly", () => {
  it("the runner records every tick: snapshot, events, inputs and state hash", () => {
    const runner = liveFight(120);
    const h = runner.history;
    expect(h.latestTick).toBe(runner.tick);
    expect(h.at(0)!.events.some((e) => e.type === "EntitySpawned")).toBe(true);
    expect(h.at(1)!.commands).toEqual(SCRIPT[1]);
    expect(h.at(runner.tick)!.hash).toBe(runner.getStateHash());
    expect(h.inputsThrough(runner.tick)).toEqual(runner.toReplay().inputLog);
  });

  it("a saved replay rebuilds into the identical history, tick for tick", () => {
    const runner = liveFight(150);
    const rebuilt = rebuildReplay(runner.toReplay(), content);
    expect(rebuilt.ok).toBe(true);
    expect(rebuilt.history.latestTick).toBe(runner.history.latestTick);
    for (let t = 0; t <= runner.history.latestTick; t++) {
      expect(strip(rebuilt.history.at(t)!), `tick ${t}`).toEqual(strip(runner.history.at(t)!));
    }
  });

  it("a tampered replay is detected", () => {
    const replay = clonePlain(liveFight(120).toReplay());
    replay.inputLog = replay.inputLog.filter((e) => e.tick !== 12); // drop one prayer switch
    const rebuilt = rebuildReplay(replay, content);
    expect(rebuilt.ok).toBe(false);
    expect(rebuilt.reason).toMatch(/differs from the recording at tick \d+/);
  });

  it("rewinding re-simulates to the earlier tick; the same inputs then give the same future", () => {
    const original = liveFight(140);
    const before = original.history.range(0, 140).map(strip);
    const runner = liveFight(140);
    const rec = runner.rewindTo(60);
    expect(rec.tick).toBe(60);
    expect(runner.state).toBe("paused");
    expect(runner.history.latestTick).toBe(60);
    expect(runner.getStateHash()).toBe(before[60]!.hash);
    for (let t = 61; t <= 140 && runner.state !== "ended"; t++) {
      for (const c of SCRIPT[t] ?? []) runner.queueCommand(c);
      runner.runTicks(1);
    }
    expect(runner.history.range(0, 140).map(strip)).toEqual(before);
  });

  it("after a rewind, new inputs make a new (still reproducible) future", () => {
    const runner = liveFight(100);
    runner.rewindTo(30);
    runner.queueCommand({ type: "move", to: { x: 18, y: 2 } });
    runner.runTicks(40);
    const replay = runner.toReplay();
    expect(replay.inputLog.some((e) => e.tick === 31)).toBe(true);
    const rebuilt = rebuildReplay(replay, content);
    expect(rebuilt.ok).toBe(true);
    expect(rebuilt.history.at(70)!.hash).toBe(runner.history.at(70)!.hash);
  });

  it("a replay can be handed to the player mid-way", () => {
    const replay = liveFight(100).toReplay();
    const runner = new SimulationRunner({ content, config: replay.config });
    runner.loadReplay(replay);
    runner.runTicks(50);
    expect(runner.queueCommand({ type: "stop" })).toBe(false); // replays ignore input
    runner.takeControl();
    expect(runner.queueCommand({ type: "move", to: { x: 2, y: 2 } })).toBe(true);
    runner.runTicks(1);
    expect(runner.history.at(51)!.commands).toEqual([{ type: "move", to: { x: 2, y: 2 } }]);
  });
});

describe("HistoryPlayer: a playback cursor over a history", () => {
  const history = rebuildReplay(liveFight(60).toReplay(), content).history;

  it("plays in time, steps both ways, seeks, and stops at the end", () => {
    const player = new HistoryPlayer(history, { speed: 1 });
    const seen: string[] = [];
    player.on({ tick: (r) => seen.push(`tick ${r.tick}`), seek: (r) => seen.push(`seek ${r.tick}`), stateChange: (s) => seen.push(s) });
    player.play();
    player.advance(600 * 3);
    expect(player.tick).toBe(3);
    player.stepForward();
    expect(player.tick).toBe(4);
    player.stepBack();
    player.seek(40);
    player.seek(41);
    expect(seen).toEqual(["playing", "tick 1", "tick 2", "tick 3", "paused", "tick 4", "seek 3", "seek 40", "tick 41"]);
    expect(player.record.snapshot.tick).toBe(41);
    player.setSpeed(8);
    player.play();
    for (let i = 0; i < 20; i++) player.advance(1000);
    expect(player.tick).toBe(history.latestTick);
    expect(player.state).toBe("ended");
  });

  it("works on a live, growing history", () => {
    const runner = new SimulationRunner({ content, config: { seed: 3, encounterId: "ashen-warden", player: setup } });
    runner.runTicks(10);
    const p = new HistoryPlayer(runner.history, { tick: 5 });
    expect(p.atEnd).toBe(false);
    p.seek(99);
    expect(p.tick).toBe(10);
    runner.runTicks(5);
    expect(p.atEnd).toBe(false);
    expect(p.seek(15).tick).toBe(15);
  });

  it("FightHistory rejects out-of-order ticks", () => {
    const h = new FightHistory({ snapshot: history.at(0)!.snapshot, events: [], hash: "x" });
    expect(() => h.record({ ...history.at(2)! })).toThrow(/expected tick 1/);
  });
});
