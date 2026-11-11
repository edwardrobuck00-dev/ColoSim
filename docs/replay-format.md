# Replays, history and review

A replay stores the inputs, not the frames. Playback re-runs the simulation.

```ts
interface Replay {
  format: 1;
  engineVersion: string;     // must match ENGINE_VERSION to play back
  contentHash: string;       // must match the current content registry
  config: SimulationConfig;  // seed, encounter, modifiers, player setup
  inputLog: { tick: number; commands: PlayerCommand[] }[];
  checkpoints: { tick: number; hash: string }[];  // every 50 ticks + final
  durationTicks: number;
  outcome: EncounterOutcome | null;
}
```

- Created with `simulation.toReplay()` (`packages/engine/src/api/simulation.ts`).
- Verified with `verifyReplay(replay, content)`
  (`packages/engine/src/replay/run-replay.ts`), which re-simulates and
  compares every checkpoint hash.
- Saved locally by the app when a fight ends, through `LocalReplayRepository`
  (`packages/storage/src/repositories/replays.ts`). A remote repository with
  share codes can implement the same `ReplayRepository` interface later.

## History, review and replay

All of this lives in the engine (`packages/engine/src/replay/`, `runtime/`)
and has no UI code; the app's host only routes time and decides which tick is
on screen.

| Piece | What it does |
|---|---|
| `TickResult.commands`, `TickResult.hash` | Every tick reports the inputs applied at its start and the state hash after it |
| `FightHistory` | Every tick of a fight: snapshot, events, inputs and hash (tick 0 = start). `at(tick)`, `range`, `inputsThrough`, `ticksWhere`, `truncateAfter` |
| `SimulationRunner.history` | The live fight's history, recorded as it runs |
| `SimulationRunner.rewindTo(tick)` | Rebuilds the fight and re-applies the recorded inputs up to `tick`, checking every tick's hash; later ticks are dropped. Continuing with the same inputs reproduces the original exactly; new inputs make a new (still reproducible) future |
| `SimulationRunner.takeControl()` | In replay mode: stop following the recording and accept the player's inputs from the current tick |
| `rebuildReplay(replay, content)` | Re-simulates a saved replay into a full `FightHistory`, checking each recorded checkpoint (`ok`, or the first tick that differs) |
| `HistoryPlayer` | A playback cursor over a history: play, pause, step forward and back, seek, speed. Time is fed with `advance(ms)`, like the runner |

Reproducibility is tested in `packages/content/test/replay.test.ts` against
the real Ashen Warden: a rebuilt replay equals the live fight snapshot for
snapshot, event for event and hash for hash; a rewound fight replayed with the
same inputs equals the original; a replay with one input removed is detected.

## In the app

- **Timeline** (bottom right of the fight): drag to any tick; markers for
  phase changes and enrage (orange), boss specials (yellow), your special
  attacks (green) and deaths (red). Buttons: go to start, back one tick
  (`,`), pause / resume or play, forward one tick (`.`), Live (`End`),
  Play from here, Reset, Stats, speed.
- **Review**: stepping back or dragging the timeline during a live fight
  pauses it and shows the earlier tick everywhere: the arena (exactly the
  recorded snapshot, projectiles in flight included), the side panel, the
  boss bar, statistics and the event log as of that tick. Inputs are paused.
  *Live* returns to the latest tick; *Play from here* rewinds the fight to
  the tick on screen and continues from there.
- **Tick inspector** (analytics window, `L`): the inputs applied that tick,
  your state and the boss's, the combat calculations in force (max hit,
  rolls, hit chance, defence rolls), every event with its reasons, marked
  tiles, and the state hash. The event log's *Go to tick* jumps here.
- **Replays page**: every finished fight, with Watch, Verify ("Reproduces
  exactly"), Download (JSON), Import and Delete. Watching uses the same
  timeline and inspection tools; *Play from here* takes over a replay at any
  tick. The results screen links to the fight's replay and to reviewing its
  last ticks.
