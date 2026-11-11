import { createSimulation } from "../api/simulation";
import { ENGINE_VERSION } from "../core/version";
import type { ContentRegistry } from "../defs/registry";
import type { Replay } from "./input-log";

export interface ReplayVerification {
  ok: boolean;
  reason?: string;
  finalHash: string;
}

/** Re-simulates a replay from its inputs and checks every recorded checkpoint. */
export function verifyReplay(replay: Replay, content: ContentRegistry): ReplayVerification {
  if (replay.engineVersion !== ENGINE_VERSION) {
    return { ok: false, reason: `engine version ${replay.engineVersion} != ${ENGINE_VERSION}`, finalHash: "" };
  }
  if (replay.contentHash !== content.contentHash) {
    return { ok: false, reason: "content has changed since this replay was recorded", finalHash: "" };
  }
  const sim = createSimulation(replay.config, content);
  const byTick = new Map(replay.inputLog.map((e) => [e.tick, e.commands]));
  const checkpoints = new Map(replay.checkpoints.map((c) => [c.tick, c.hash]));

  for (let t = 1; t <= replay.durationTicks; t++) {
    for (const cmd of byTick.get(t) ?? []) sim.queueCommand(cmd);
    sim.tick();
    const expected = checkpoints.get(t);
    if (expected && expected !== sim.getStateHash()) {
      return { ok: false, reason: `desync at tick ${t}`, finalHash: sim.getStateHash() };
    }
  }
  return { ok: true, finalHash: sim.getStateHash() };
}
