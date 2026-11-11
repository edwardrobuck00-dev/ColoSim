import { createSimulation } from "../api/simulation";
import { ENGINE_VERSION } from "../core/version";
import type { ContentRegistry } from "../defs/registry";
import { FightHistory } from "./history";
import type { Replay } from "./input-log";

export interface RebuiltReplay {
  history: FightHistory;
  /** False if a recorded checkpoint hash did not match (the replay does not reproduce). */
  ok: boolean;
  reason?: string;
}

/**
 * Re-simulates a replay from its seed, setup and inputs into a full
 * FightHistory (every tick's snapshot, events, inputs and hash), checking
 * each recorded checkpoint on the way. Same inputs + same seed + same engine
 * and content = the same fight, tick for tick.
 */
export function rebuildReplay(replay: Replay, content: ContentRegistry): RebuiltReplay {
  if (replay.engineVersion !== ENGINE_VERSION) {
    throw new Error(`This replay was recorded with engine ${replay.engineVersion}; this is ${ENGINE_VERSION}.`);
  }
  if (replay.contentHash !== content.contentHash) {
    throw new Error("This replay was recorded with different game content.");
  }
  const sim = createSimulation(replay.config, content);
  const history = new FightHistory({ snapshot: sim.getSnapshot(), events: sim.getInitialEvents(), hash: sim.getStateHash() });
  const inputs = new Map(replay.inputLog.map((e) => [e.tick, e.commands]));
  const checkpoints = new Map(replay.checkpoints.map((c) => [c.tick, c.hash]));
  for (let t = 1; t <= replay.durationTicks; t++) {
    for (const cmd of inputs.get(t) ?? []) sim.queueCommand(cmd);
    const r = sim.tick();
    history.record(r);
    const expected = checkpoints.get(t);
    if (expected && expected !== r.hash) return { history, ok: false, reason: `state differs from the recording at tick ${t}` };
  }
  return { history, ok: true };
}
