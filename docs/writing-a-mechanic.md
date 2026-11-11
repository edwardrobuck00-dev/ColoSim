# Writing a mechanic

Data describes **what** happens and **when**. Mechanic modules describe
**how**. Data refers to a mechanic by ID and passes parameters; the registry
validates the parameters against the mechanic's Zod schema when content loads.

## Shape

```ts
import { defineMechanic } from "@sim/engine";
import { z } from "zod";

export const exampleMechanic = defineMechanic({
  id: "my-boss.example",              // namespaced if boss-specific
  description: "What it does, in one sentence.",
  params: z.object({ everyTicks: z.number().int().min(1) }),
  create: ({ everyTicks }) => ({
    hooks: {
      onTick: (ctx) => {
        if (ctx.tick % everyTicks === 0) ctx.message("Something happens.");
      },
    },
    pipelines: [
      // Optional: change a computed value.
      { name: "runEnergy.drainPerTick", priority: 100, apply: (v) => v * 2 },
    ],
  }),
});
```

Use it from data:

```ts
mechanics: [{ id: "my-boss.example", params: { everyTicks: 10 } }]
```

## Where to put it

- Generic, reusable mechanics: `packages/engine/src/mechanics/builtins/`, and
  add them to `BUILTIN_MECHANICS`.
- Boss-specific mechanics: `packages/content/src/encounters/<boss>/mechanics/`,
  and list them in the boss's `EncounterBundle.mechanics`.

## Hooks available now

| Hook | When |
|---|---|
| `onEncounterStart(ctx)` | Before tick 1 |
| `onTick(ctx)` | Every tick, phase 3 |
| `onAttackStart(ctx, attack)` | After an attack is rolled and its hit scheduled |
| `onHitLanded(ctx, hit)` | After a hit is applied |
| `onEntityDeath(ctx, death)` | When an entity reaches 0 hitpoints |
| `onEntityRespawn(ctx, entityId)` | When a dead entity comes back |
| `checkLoss(ctx)` | Phase 9; return a reason string to end the fight as a loss |
| `checkWin(ctx)` | Phase 9; return a reason string to end the fight as a win |

Prayer and boss-phase hooks arrive with those systems.

## Pipelines available now

| Name | Base value |
|---|---|
| `runEnergy.drainPerTick` | Run energy drained on a tick the player ran |
| `runEnergy.regenPerTick` | Run energy regained on other ticks |
| `accuracy.attackRoll` | Attacker's accuracy roll |
| `accuracy.defenceRoll` | Defender's defence roll |
| `damage.maxHit` | An attack's max hit |
| `damage.incoming` | Damage as a hit lands (before the hitpoint cap) |
| `attack.speedTicks` | Cooldown after an attack |
| `hitpoints.regenIntervalTicks` | Ticks between natural regeneration |

Combat pipelines also receive `info` (`attackerId`, `targetId`, `style`,
`attackId`), so a step can apply only to, say, magic attacks on the player:

```ts
{ name: "damage.incoming", apply: (v, ctx, info) => (info.targetId === "player" && info.style === "magic" ? v / 2 : v) }
```

## Rules

- Use `ctx.rng("combat" | "ai" | "hazards" | "misc")` for randomness. Never
  `Math.random`, `Date.now` or timers; lint rejects them.
- Read state through `ctx`; do not import engine internals.
