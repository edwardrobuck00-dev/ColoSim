# Tick order

The engine advances in fixed 600 ms ticks. The host calls `simulation.tick()`;
the engine never reads a clock. Every tick runs these phases in this exact
order (`packages/engine/src/core/tick-pipeline.ts`):

| # | Phase | File | Status |
|---|---|---|---|
| 1 | Apply commands queued since the last tick | `systems/commands.ts` | Done: move, setRun, attack (move into range), stop |
| 2 | Hits scheduled on earlier ticks land (ranged, magic); delayed boss attacks (volleys) start; hazards detonate or burn | `systems/scheduled-events.ts` -> `combat-events.ts`, `npc/hazards.ts` | Done |
| 3 | Encounter scripting (mechanic `onTick` hooks) | `systems/encounter.ts` | Done |
| 4 | NPC turns: phase and enrage checks, target, then a special or a pattern attack if in range and off cooldown, else move | `systems/npc-turns.ts` -> `npc/turn.ts` | Done |
| 5 | Player turn: auto retaliate (idle and hit: target the attacker), path into weapon range (walk 1 / run 2), then attack if off cooldown | `systems/player-turn.ts` | Done |
| 6 | Hits made this tick land (melee) | `systems/hit-resolution.ts` -> `combat-events.ts` | Done |
| 7 | Life cycle: dying -> dead (despawn) -> respawn | `systems/lifecycle.ts` | Done |
| 8 | Upkeep: hitpoint regeneration, prayer drain, level restore, special energy, run energy | `systems/upkeep.ts` | Done (run energy rates are placeholders) |
| 9 | Win and loss checks | `systems/outcome.ts` | Done |

After phase 9 the engine records a checkpoint hash every 50 ticks and returns
`{ tick, snapshot, events, outcome }`.

## Attacks

- Accuracy and damage are rolled **when the attack starts**, using the
  `combat` RNG stream. The hit is scheduled for its landing tick.
- Hit delay: melee 0 ticks; ranged `1 + floor((3 + distance) / 6)`; magic
  `1 + floor((1 + distance) / 3)`.
- Melee needs orthogonal adjacency to the target's footprint (diagonal does
  not count). Longer ranges use Chebyshev distance and need line of sight:
  a straight line between the nearest tiles of the two footprints, blocked
  by any unwalkable tile in between (`hasLineOfSight`). Players path to a
  tile with sight; NPCs without sight keep chasing, so pillars make
  safespots. (Engine 0.9.0.)
- NPCs either attack or move on a tick, never both. Chasing NPCs take a
  direct step (diagonal, then horizontal, then vertical), so obstacles can
  trap them.
- Players can walk under NPCs (NPCs do not block players). Nothing can attack
  a target inside its own footprint, so a chasing NPC with the player under
  it steps out first: each tick it takes the cardinal step that uncovers the
  player soonest (ties broken with the `ai` RNG stream). (Engine 0.9.0.)

## Bosses

- A boss checks its phase and enrage at the start of its own turn (phase 4).
  Ranged and magic hits land in phase 2, so a threshold they cross changes the
  phase on the same tick; melee hits land in phase 6, so the change happens on
  the next tick.
- Hazards placed on tick T with delay D detonate in phase 2 of tick T + D,
  using the player's position at that point (after the previous tick's move).
  A player who reacts on tick T + 1 has D - 1 moves (walking 1 tile, running 2
  per tick) to get clear. Burning tiles hurt once per tick, never more,
  however many overlap.
- Volley attacks are scheduled as delayed attack starts; their hits then land
  with the normal hit delay. Protection prayers are checked when each hit lands.

## Rules

- Commands queued at any time during a tick take effect at the **start of the
  next tick**. This matches how player input works in tick-based games.
- Changing the order, or anything that changes results for the same inputs,
  requires bumping `ENGINE_VERSION` in `core/version.ts`. Old replays then
  report a clear version mismatch instead of playing back wrong.
- Same seed + same content + same commands = same result, always. This is
  tested with random command sequences in `engine/test/determinism.test.ts`.
