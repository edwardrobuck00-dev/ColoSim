# Adding a boss

A boss is data: an encounter, an NPC with behaviour (phases, attack patterns,
specials, enrage), its attacks, and optionally modifiers and encounter rules.
The engine runs all of it generically, so a new boss never needs engine
changes. The Ashen Warden (`packages/content/src/encounters/ashen-warden/`)
is the complete example.

## 1. Create the folder

The quickest start is `pnpm new:boss <boss-id> "Name"`, which writes a
working two-phase template and lists its pack (see
[content-system.md](content-system.md)). By hand:

```
packages/content/src/encounters/<boss-id>/
  attacks.ts     defineAttack(...) for each attack
  npcs.ts        defineNpc(...) with stats, specials and behaviour
  encounter.ts   defineEncounter(...)
  modifiers.ts   optional difficulty modifiers
  mechanics/     optional encounter rules (defineMechanic)
  arena.ts       defineArena(...): floor size, blocked tiles, named spawns
  index.ts       exports the EncounterBundle and the boss's ContentPack
```

## 2. Attacks

Each attack has a style (`stab`, `slash`, `crush`, `ranged`, `magic`), max
hit, speed in ticks, range in tiles, accuracy bonus, an optional projectile
visual and an animation cue. Accuracy uses the NPC's level and this bonus:
`(level + 9) * (bonus + 64)` against the player's real defence roll. Pick
projectile colours from the colour language in `docs/visual-style.md`
(magic blue-violet, ranged green).

## 3. Behaviour

```ts
behaviour: {
  phases: [
    {
      id: "one", name: "Phase name", movement: "chase",            // or "stationary"
      pattern: { type: "switch", attacks: ["bolt", "rock"], every: 4 },
      closeRange: { attack: "slam", chance: 0.5 },                 // when the player is in its range
      specials: { every: 6, ids: ["rain"] },                       // every 6th attack is a special
    },
    {
      id: "two", atHpPercent: 50, pattern: { type: "random", attacks: [{ attack: "bolt", weight: 2 }, { attack: "rock" }] },
      attackSpeedTicks: 4,                                         // overrides attack speeds
      defence: { stab: 20, slash: 20, crush: 0, ranged: 40, magic: 10 },
      onEnter: { say: "Enough!", invulnerableTicks: 4, pauseTicks: 3, moveTo: "centre", healPercent: 0, special: "volley" },
    },
  ],
  enrage: { atHpPercent: 10, afterTicks: 500, attackSpeedDelta: -1, maxHitMultiplier: [5, 4], say: "RAAH" },
}
```

| Field | Meaning |
|---|---|
| `pattern.type: "rotation"` | Fixed cycle of attacks (skips ones out of range) |
| `pattern.type: "random"` | Weighted random pick each attack (`ai` RNG stream) |
| `pattern.type: "switch"` | One attack `every` times, then the next (or a random other) |
| `closeRange` | Used instead of the pattern when the player is within that attack's range, with a chance |
| `specials` | Every N-th attack is a special, in turn (`order: "rotation"`) or at random |
| `atHpPercent` | The phase starts when hitpoints fall to this percentage (phases only move forward) |
| `onEnter` | Overhead text, chatbox message, invulnerability, pause, teleport to an arena spawn, heal, opening special |
| `enrage` | Once, below a hitpoint threshold or after a time limit: faster attacks, bigger max hits, better accuracy |

NPCs without `behaviour` keep working: their `attacks` list and `ai` field
become a single phase.

## 4. Special attacks

Specials are named uses of a *special kind*:

```ts
specials: [
  { id: "rain", name: "Ember Rain", kind: "tile-aoe", say: "Burn!",
    params: { area: { shape: "around-target", radius: 1 }, delayTicks: 4, damage: [25, 40], lingerTicks: 0, lingerDamage: 0 } },
  { id: "volley", name: "Cinder Volley", kind: "volley", cooldownTicks: 7,
    params: { attacks: [{ attack: "bolt", delayTicks: 0 }, { attack: "rock", delayTicks: 2 }] } },
]
```

Built-in kinds (`packages/engine/src/npc/specials.ts`):

| Kind | What it does |
|---|---|
| `tile-aoe` | Marks tiles (`around-target`, `ring-around-self`, `cross-on-target`, `random-tiles`); after `delayTicks` a player on them takes `damage` (not reduced by prayer); optionally the tiles burn for `lingerTicks` |
| `volley` | Several of the boss's attacks at tick offsets, for prayer switching practice |

A new kind is a `defineSpecialKind({ id, description, params, attackRefs?, perform })`
added to the bundle's `specialKinds`. It acts only through `SpecialContext`:
`attack(id, delay)`, `hazard(spec)`, `say(text)`, the target's and NPC's
state, the arena, and the `ai` RNG stream. See the `test.taunt` kind in
`packages/engine/test/boss-framework.test.ts`.

## 5. Encounter rules

Anything unique goes in a mechanic (`defineMechanic`) attached to the NPC or
encounter: hooks (`onTick`, `onAttackStart`, `onHitLanded`, `onEntityDeath`,
`checkWin`, `checkLoss`...), pipelines (accuracy, max hit, incoming damage,
attack speed, prayer drain...), and a restricted context
(`message`, `npc.heal`, `npc.say`, `prayer.drainPoints`, `prayer.lockOverheads`...).
The Warden's Kindling rule (`mechanics/kindling.ts`) heals it from fire
damage the player takes.

## 6. Arena, registration and visuals

- The arena lives in the boss's folder (`arena.ts`) and is part of its pack.
  Spawn points named in `onEnter.moveTo` must exist there.
- Add the pack to `CONTENT_PACKS` in `packages/content/src/packs/index.ts`.
- Add the NPC and projectile visuals in `packages/assets/src/manifest.ts`.

## 7. Validate and test

```bash
pnpm validate-content
```

Validation reports every problem at once: unknown attacks or specials in a
phase, unknown special kinds or bad special params, phase thresholds out of
order, `moveTo` spawns the arena lacks. Then write a test like
`packages/content/test/ashen-warden.test.ts`, which plays the fight with a
scripted good player and a passive one (`test/warden-bot.ts`).

The boss appears on the boss selection screen automatically: stats, attacks,
phases, specials, enrage and rules are all read from the definitions
(`packages/app/src/utils/boss-info.ts`).
