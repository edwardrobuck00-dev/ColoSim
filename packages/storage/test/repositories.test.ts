import "fake-indexeddb/auto";
import { ENGINE_VERSION, type Replay } from "@sim/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { AttemptRepository, LocalReplayRepository, SimDatabase } from "../src";

let db: SimDatabase;
let n = 0;
beforeEach(() => {
  db = new SimDatabase(`test-${n++}`);
});

const replay: Replay = {
  format: 1,
  engineVersion: ENGINE_VERSION,
  contentHash: "abcd1234",
  config: { seed: 1, encounterId: "training-grounds", modifierIds: [], player: { stats: { hitpoints: 10, attack: 1, strength: 1, defence: 1, ranged: 1, magic: 1, prayer: 1 }, equipment: {}, inventory: [], combatStyle: 0, prayers: [], autocastSpellId: null, autoRetaliate: false } },
  inputLog: [],
  checkpoints: [],
  durationTicks: 10,
  outcome: null,
};

describe("repositories", () => {
  it("stores replays and lists summaries without the payload", async () => {
    const repo = new LocalReplayRepository(db, () => "r1");
    const id = await repo.save(replay);
    expect(await repo.get(id)).toEqual(replay);
    const [summary] = await repo.list();
    expect(summary).toMatchObject({ id: "r1", encounterId: "training-grounds" });
    expect(summary).not.toHaveProperty("replay");
  });

  it("tracks personal bests per variant", async () => {
    const repo = new AttemptRepository(db);
    await repo.record({ encounterId: "x", modifierIds: ["b", "a"], result: "win", durationTicks: 120 });
    await repo.record({ encounterId: "x", modifierIds: ["a", "b"], result: "win", durationTicks: 100 });
    await repo.record({ encounterId: "x", modifierIds: [], result: "win", durationTicks: 50 });
    expect(await repo.personalBest("x", ["a", "b"])).toBe(100);
  });
});
