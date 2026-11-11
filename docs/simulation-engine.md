# Simulation engine

The engine (`packages/engine`) is a deterministic, tick-based simulation. It
has no clock, no timers, no DOM and no `Math.random`. Everything happens in
whole **game ticks** of 600 ms.

## Layers

| Layer | File | Job |
|---|---|---|
| `Simulation` | `src/api/simulation.ts` | The game state. `tick()` advances exactly one tick and returns `{ tick, snapshot, events, outcome }`. |
| `SimulationRunner` | `src/runtime/runner.ts` | Controls a simulation: start, pause, resume, reset, step, speed, replays. Turns elapsed real time into whole ticks. |
| Host (app) | `packages/app/src/host/` | Feeds the runner elapsed frame time and passes its output to the renderer and UI. |

## Controls

```ts
const runner = new SimulationRunner({ content, config: { seed: 42, encounterId: "ashen-warden" }, seedSource });

runner.start();              // ready -> running
runner.advance(elapsedMs);   // runs every whole tick that fits; returns their results
runner.pause();              // running -> paused
runner.step();               // exactly one tick (ready or paused only)
runner.resume();             // paused -> running
runner.setSpeed(2);          // 0.25x to 8x; 1x = 600 ms per tick
runner.reset();              // same seed: identical fight for identical inputs
runner.reset({ seed: "new" });
runner.reset({ seed: 1234 });
runner.queueCommand({ type: "attack", targetId: "npc-1" });  // applied at the start of the next tick
runner.runTicks(100);        // headless: no time involved
runner.loadReplay(replay);   // play back recorded inputs
```

States: `ready` -> `running` <-> `paused` -> `ended` (when the encounter has an
outcome; only `reset()` continues). `advance()` runs at most
`maxCatchUpTicks` (default 5) per call, so a stalled browser tab does not
fast-forward a fight.

`runner.alpha` (0..1) is how far real time is between the last two ticks. It
exists only so the renderer can interpolate movement. It never affects
results.

## Determinism

A fight is fully determined by:

1. the engine version (`ENGINE_VERSION`),
2. the content (`contentHash`),
3. the seed, and
4. which commands were applied on which tick.

Frame rate, speed, pausing, stepping and animation timing play no part. This
is tested by running the same command schedule with different frame sizes
(16 ms, irregular, 600 ms, and headless) and requiring identical event
streams and state hashes (`test/runner.test.ts`), and in the browser by
replaying a seed and comparing state hashes (`app/e2e/simulation.spec.ts`).

Randomness comes from seeded, independent streams (`combat`, `ai`,
`hazards`, `misc`), so a new random roll in one system does not shift
another's.

## One tick

See [tick-order.md](tick-order.md) for the exact phase order.

## Combat events

`src/systems/combat-events.ts`:

1. **Attack start** (attack tick): accuracy rolls, max hit and attack speed go
   through pipelines; accuracy and damage are rolled; `AttackStarted` (and
   `ProjectileLaunched` for ranged and magic) is emitted; the hit is
   scheduled; the cooldown is set; `onAttackStart` hooks run.
2. **Hit landing** (land tick): dropped if the target is no longer alive;
   `damage.incoming` pipeline; capped at remaining hitpoints; `HitLanded`;
   `onHitLanded` hooks; reaching 0 hitpoints starts the death sequence.

Hits still in flight appear in `snapshot.projectiles` until they land.

| Timing | Rule |
|---|---|
| Attack cooldown | Next attack no earlier than attack tick + weapon (or attack) speed |
| Melee hit | Lands on the attack tick |
| Ranged hit | `1 + floor((3 + distance) / 6)` ticks later |
| Magic hit | `1 + floor((1 + distance) / 3)` ticks later |
| Movement | Walk 1 tile per tick, run 2; NPCs chase 1 tile per tick |
| Hitpoint regeneration | +1 every 100 ticks for living, damaged entities |

## Life cycle (death and respawn)

`src/systems/lifecycle.ts`:

```
alive --(0 HP)--> dying --(deathTicks)--> dead --(respawnTicks)--> alive
```

- Only `alive` entities move, attack, or can be hit. Commands from a dead
  player are rejected; NPCs drop their target while the player is down.
- NPCs: `deathTicks` (default 3) and optional `respawnTicks` in `NpcDef`.
  Respawning NPCs come back at their spawn point with full hitpoints.
- Player: `playerDeath: "end"` (default) loses the encounter; `"respawn"`
  (practice areas such as the Training Yard) brings the player back after
  `playerRespawnTicks`.
- Events: `EntityDied` -> `EntityDespawned` -> `EntitySpawned { respawn: true }`.
