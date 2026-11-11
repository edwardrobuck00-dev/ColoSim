# OSRS-Style Combat Simulator: Technical Architecture

Status: **approved; foundation stage implemented.** See section 15 for where the code differs from this plan.
Companion document: `scim-feature-spec.md` (research and feature spec).

---

## 1. Guiding principles

1. **The engine knows nothing about the screen.** The combat engine is a pure
   TypeScript library with no DOM, no WebGL, no React, no timers and no
   `Math.random`. It takes commands in and gives snapshots and events out.
2. **Deterministic.** Same seed, same content, same inputs gives the same fight,
   tick for tick. This is what makes replays, tests and bug reports work.
3. **Data says what and when; code says how.** Bosses, NPCs, items, attacks,
   prayers and encounters are data. Behaviour that data cannot express lives in
   small, registered mechanic modules that the data refers to by ID.
4. **Open for extension, closed for modification.** A new boss is a new folder
   of content plus, at most, a few new mechanic modules. No engine file changes.
5. **Gameplay data and visual data are separate.** An NPC's stats and its 3D
   model live in different files, linked by an ID.
6. **Original content.** OSRS-style mechanics (600 ms ticks, prayer switching,
   accuracy rolls), but original bosses, names and art. No Jagex cache assets.

---

## 2. Technology recommendations

| Area | Recommendation | Why | Alternatives considered |
|---|---|---|---|
| Language | **TypeScript** (strict) everywhere | Shared types between engine, content and UI; catches broken content references at compile time | JavaScript (loses the type safety that keeps data-driven content honest) |
| Repo layout | **pnpm workspaces monorepo** | Hard package boundaries enforce engine/UI separation | Single package with folders (boundaries only by convention) |
| Build tool | **Vite** | Fast dev server, native TS, Web Worker support, good library mode | Webpack (slower, more config) |
| Frontend framework | **React 19** for menus, panels and HUD | Large ecosystem, good for form-heavy screens (loadouts, stats, settings) | Svelte or Solid (lighter, but fewer libraries and contributors) |
| Routing | **React Router** | Per-boss and per-variant URLs like the reference (`/boss/:id/:variant`) | TanStack Router (fine too) |
| Styling | **CSS Modules + CSS variables** | Scoped styles, easy theming, no runtime cost | Tailwind |
| Rendering | **Three.js (WebGL2), driven imperatively** | 3D tile arena with orbit camera, instancing, glTF support, huge community | react-three-fiber (puts React in the render loop; harder to keep render separate and fast), Babylon.js (heavier), PixiJS 2D (simpler, but no 3D camera) |
| Validation | **Zod** | One schema gives runtime validation and TS types for all content | Hand-written validators |
| UI state | **Zustand** | Tiny, works outside React (the simulation host can write to it) | Redux Toolkit (more ceremony), Jotai |
| Local storage | **IndexedDB via Dexie**, plus `localStorage` for small settings | Replays and loadouts outgrow `localStorage`; Dexie gives versioned migrations | Raw IndexedDB API |
| Unit and integration tests | **Vitest** | Same config as Vite, fast, TS native | Jest |
| Property tests | **fast-check** | Random input sequences to prove determinism and invariants | None |
| Component tests | **Vitest + Testing Library** | Panel behaviour without a browser | |
| End-to-end tests | **Playwright** | Real browser, screenshots, already available here | Cypress |
| Lint and boundaries | **ESLint + dependency-cruiser** | Bans `Math.random`/`Date.now` in the engine; blocks forbidden imports | |
| Asset pipeline | **glTF/GLB models, KTX2 textures, gltf-transform** | Standard web 3D format, compressed textures | FBX/OBJ (poor web support) |
| Backend (later phase) | Deferred. Interfaces designed now. | Accounts and shared replays are not needed for version 1 | |

### Why Three.js imperatively, not react-three-fiber

The arena redraws at 60+ fps and interpolates between 600 ms ticks. Keeping that
loop in plain Three.js, owned by the `render` package, means React only re-renders
when panel data changes (at most once per tick). It also means the renderer can
be tested and swapped without touching UI code.

### Engine on the main thread or a Web Worker

Start on the **main thread** behind a `SimulationHost` interface. The engine only
does work once per 600 ms, so it will not cause frame drops. Because snapshots and
events are plain, cloneable objects, moving the engine into a Web Worker later is
a change to one file (`host/worker-host.ts`), not a redesign.

---

## 3. High-level architecture

```
 ┌──────────────────────────────── app (React) ────────────────────────────────┐
 │  Routes / Screens     Panels & HUD        Input (keybinds, clicks)           │
 │        │                   ▲                     │                           │
 │        │             Zustand stores              │ Commands                  │
 │        │                   ▲                     ▼                           │
 │        └──────────►  SimulationHost  ◄───────────┘                           │
 │                     (clock, wiring)                                          │
 └──────────┬──────────────┬─────────────────┬──────────────────┬───────────────┘
            │ tick()        │ TickResult       │ load/save        │ resolve assets
            ▼               ▼                  ▼                  ▼
     ┌────────────┐   ┌────────────┐    ┌────────────┐     ┌────────────┐
     │   engine   │   │   render   │    │  storage   │     │   assets   │
     │ (pure TS)  │   │ (Three.js) │    │  (Dexie)   │     │ (manifest) │
     └─────▲──────┘   └────────────┘    └────────────┘     └────────────┘
           │ definitions + mechanics
     ┌─────┴──────┐
     │  content   │
     └────────────┘
```

### Package dependency rules (enforced by tooling)

| Package | May import | Must never import |
|---|---|---|
| `engine` | `zod` only | DOM, `three`, `react`, any other package here |
| `content` | `engine` | `render`, `app`, `storage`, DOM |
| `render` | `engine` (types only), `assets`, `three` | `content` internals, `react`, `storage` |
| `storage` | `engine` (types only), `dexie` | `render`, `react` |
| `assets` | nothing (manifest + loaders) | `engine` |
| `app` | everything | |

Enforcement:
- `engine/tsconfig.json` sets `"lib": ["ES2022"]` with no `"DOM"`, so touching
  `window` or `document` fails to compile.
- dependency-cruiser fails CI on a forbidden import.
- ESLint `no-restricted-globals` bans `Math.random`, `Date.now`,
  `performance.now`, `setTimeout` and `setInterval` inside `engine` and
  `content`.

---

## 4. Combat engine architecture

### 4.1 Public API (the only surface other packages see)

```ts
// packages/engine/src/api/simulation.ts  (signatures only, illustrative)
createSimulation(config: SimulationConfig, content: ContentRegistry): Simulation

interface SimulationConfig {
  engineVersion: string
  seed: number
  encounterId: string
  modifierIds: string[]          // contract-style variants
  player: PlayerSetup            // stats, equipment, inventory, prayers unlocked
}

interface Simulation {
  queueCommand(cmd: PlayerCommand): void   // applied at the start of the next tick
  tick(): TickResult                       // advance exactly one game tick
  getSnapshot(): WorldSnapshot             // read-only, cloneable
  getInputLog(): InputLog                  // for replays
  getStateHash(): string                   // for determinism checks
}

interface TickResult {
  tick: number
  snapshot: WorldSnapshot
  events: SimEvent[]             // everything that happened this tick
  outcome?: EncounterOutcome     // set when the fight ends
}
```

The engine never calls a clock. Whoever owns it (the app, a test, a replay
verifier, a CLI) decides when to call `tick()`. Tests can run 10,000 ticks in a
fraction of a second.

### 4.2 World model

A light entity model, not a full ECS. OSRS fights have tens of entities, not
thousands, so clarity beats raw throughput.

- `World`: tick counter, seeded RNG, grid map, entity table, scheduled-event
  queue, active encounter runtime, event buffer.
- `Entity` base: id, position (tile), size, hitpoints, stats, bonuses,
  timers, status effects.
  - `Player`: equipment, inventory, prayers, run energy, special energy,
    action queue.
  - `Npc`: definition ID, AI controller state, current phase, attack cooldown.
  - `Hazard`: tile effects (pools, falling objects, flare-type entities) with a
    lifetime and a behaviour.
  - `Projectile`: source, target, launch tick, land tick, payload.
- All engine numbers that affect outcomes are **integers**, matching OSRS's
  floor-based formulas, so results do not depend on floating-point quirks.

### 4.3 Tick pipeline

Every `tick()` runs the same ordered phases. The order is fixed and documented,
because tick order *is* the game in OSRS-style combat.

```
 1. Apply queued player commands (move, attack, eat, toggle prayer, equip ...)
 2. Run scheduled events due this tick (delayed hits land, projectiles arrive,
    hazards detonate, timers expire)
 3. Encounter runtime: phase checks, scripted spawns, mechanic onTick hooks
 4. NPC turns: AI chooses action, moves, starts attacks (in spawn order)
 5. Player turn: movement (1 tile walk / 2 tiles run), starts attack if able
 6. Hit resolution: accuracy roll, damage roll, protection, pipelines, apply
 7. Death and despawn checks
 8. Resource upkeep: prayer drain, run energy, regen, stat boosts decaying
 9. Win/loss checks (built-in and modifier-defined)
10. Emit events, record input log entry, build snapshot
```

Each phase is a **system**: a plain function `(world, ctx) => void` in
`engine/src/systems/`. The order lives in one file (`core/tick-pipeline.ts`).

### 4.4 Combat formulas

`engine/src/combat/` holds pure functions, one concern per file:

- `effective-levels.ts`: level + potion boost, times prayer multiplier, plus
  stance bonus and the constant offset.
- `accuracy.ts`: attack roll vs defence roll, hit chance.
- `max-hit.ts`: melee, ranged and magic max hit.
- `damage.ts`: roll damage from 0 to max hit.
- `attack-timing.ts`: weapon speed in ticks, hit delay by distance and style.

These are called *through* the modifier pipeline (below), never directly by
mechanics, so every bonus and penalty passes through one place.

### 4.5 Modifier pipelines (the main extension point for numbers)

Any value a mechanic might want to change is computed through a named pipeline:

```
pipeline("accuracy.attackRoll")      base → equipment → prayer → modifiers → final
pipeline("damage.maxHit")
pipeline("damage.incoming")          after protection prayer and penetration
pipeline("prayer.drainRate")
pipeline("runEnergy.drain")
pipeline("npc.attackRange")
pipeline("npc.defence.<style>")
```

A mechanic registers a step on a pipeline with a priority. For example, a
"weak to crush only" modifier adds a step to `npc.defence.*` that raises every
style except crush. A "prayer bonus drains faster" modifier adds a step to
`prayer.drainRate` that inverts the bonus. Neither touches the formula code.

### 4.6 Hooks (the main extension point for behaviour)

Lifecycle hooks that mechanics can subscribe to:

| Hook | Fires when |
|---|---|
| `onEncounterStart` / `onEncounterEnd` | Fight begins or ends |
| `onTick` | Every tick, during phase 3 |
| `onPhaseEnter` / `onPhaseExit` | Boss phase changes |
| `onAttackStart` | Any entity begins an attack |
| `onHitLanded` | Damage applied (after pipelines) |
| `onPrayerChanged` | Player toggles a prayer |
| `onEntitySpawn` / `onEntityDeath` | Entity appears or dies |
| `onPlayerMove` | Player changes tile |
| `checkLoss` / `checkWin` | Phase 9; returns an outcome or nothing |

Hooks receive a **restricted context** (`MechanicContext`): read world state, use
the seeded RNG, spawn entities, schedule events, apply damage, emit events. They
cannot reach into engine internals, which keeps mechanics from breaking each
other.

### 4.7 Mechanic registry

```ts
// illustrative shape
defineMechanic({
  id: "spawn-adds-on-hp-threshold",
  params: z.object({ npcId: z.string(), hpPercent: z.number(), count: z.number() }),
  create(params) {
    return {
      hooks: { onHitLanded(ctx, hit) { /* spawn when threshold crossed */ } },
      pipelines: { /* optional */ },
    }
  },
})
```

- Generic mechanics (spawn adds, tile hazards, enrage, drain resource,
  disable prayers, lose at resource zero, area attack, knockback) live in
  `engine/src/mechanics/builtins/`.
- Boss-specific mechanics live beside the boss in
  `content/encounters/<boss>/mechanics/` and register themselves the same way.
- Data refers to mechanics by `id` with validated `params`. Unknown IDs or bad
  params fail at load time, not mid-fight.

### 4.8 Conditions and actions (small data DSL)

For logic that is common but varies by boss (phase changes, attack choices),
definitions use small condition and action objects instead of code:

```ts
{ when: { type: "hpBelowPercent", value: 50 },
  do: [ { type: "setPhase", phase: "enraged" },
        { type: "spawn", npc: "ember-wisp", count: 2, at: "arenaCorners" } ] }
```

Condition and action types are themselves registries, so adding a new one is a
new file, not an edit to a switch statement.

### 4.9 NPC AI

`engine/src/ai/` provides:
- **Targeting**: who to attack (player, nearest, lowest HP, ally).
- **Movement**: chase, keep distance, stationary, patrol, with OSRS-style
  pathing (NPCs step toward the target and can get stuck behind obstacles).
- **Attack selection** from data:
  - `sequence`: fixed rotation (A, A, B, repeat)
  - `weighted`: random by weight, using the seeded RNG
  - `conditional`: first rule whose condition passes
  - `cycle-by-phase`: different rotation per phase
- **Attack definitions**: style, max hit, speed in ticks, range, hit delay,
  projectile, penetration through protection prayers, area pattern,
  telegraph duration, and optional on-hit mechanic IDs.

### 4.10 Randomness and determinism

- One seeded PRNG (sfc32 or xoshiro128**) owned by the world. Mechanics get
  it through the context only.
- Separate named RNG streams (`combat`, `ai`, `hazards`) so adding a new
  hazard roll does not shift every later damage roll.
- `getStateHash()` hashes a canonical serialisation of the world. Replays
  store hashes every N ticks to detect desyncs.
- Every replay and save stamps `engineVersion` and a hash of the content
  registry. A mismatch is reported clearly instead of playing back wrong.

### 4.11 Events (engine to outside world)

A typed discriminated union. The engine describes *what happened*, never *how
it looks*:

```
EntitySpawned, EntityDespawned, EntityMoved,
AttackStarted { attackerId, attackId, style, animationCue },
ProjectileLaunched { id, from, to, landTick, visualCue },
HitLanded { targetId, amount, kind: "damage" | "block" | "heal" | "poison" },
PrayerToggled, PrayerDrained, ResourceChanged,
HazardTelegraphed { tiles, detonateTick, visualCue },
PhaseChanged, StatusApplied, StatusExpired,
ItemConsumed, EquipmentChanged,
EncounterEnded { outcome, reason }
```

`animationCue` and `visualCue` are semantic strings like `"attack.slam"` or
`"hazard.ember-pool"`. The renderer maps them to actual animations and effects.

---

## 5. Data-driven content

### 5.1 Definition types

All defined as Zod schemas in `engine/src/defs/`, so the engine owns the shape of
the data it consumes.

| Definition | Key fields |
|---|---|
| `ItemDef` | id, name, slot, weight, bonuses, stackable, visualId |
| `WeaponDef` (extends item) | attackSpeed, range, styles (stance list), twoHanded, specialAttack?, projectile? |
| `ConsumableDef` (extends item) | heal, boosts, delay ticks, combo rules |
| `PrayerDef` | id, drain rate, multipliers, protects style, conflicts |
| `NpcDef` | id, name, size, stats, defence bonuses, weaknesses, attacks, ai, phases, visualId |
| `AttackDef` | id, style, maxHit, speed, range, hitDelay, penetration, area, telegraph, onHit mechanics, animationCue |
| `EncounterDef` | id, arena, player spawn, npc spawns, phases, mechanics, win/loss rules, base modifiers |
| `ModifierDef` | id, name, description, mechanics with params, stat overrides, tags |
| `ArenaDef` | grid size, blocked tiles, spawn points, named regions, visualId |
| `VisualDef` (render side) | model, scale, animation clip map by cue, effects, sounds |

### 5.2 Example (original boss, illustrative only)

```ts
// content/encounters/ashen-warden/npcs.ts
export const ashenWarden = defineNpc({
  id: "ashen-warden",
  name: "The Ashen Warden",
  size: 3,
  stats: { hitpoints: 900, attack: 250, strength: 250, defence: 200, magic: 220, ranged: 1 },
  defence: { stab: 60, slash: 60, crush: 20, magic: 80, ranged: 120 },
  attacks: ["warden-slam", "warden-cinder-bolt", "warden-ash-rain"],
  ai: { targeting: "player", movement: "chase",
        selection: { type: "sequence", order: ["warden-cinder-bolt", "warden-cinder-bolt", "warden-slam"] } },
  phases: [
    { id: "enraged", when: { type: "hpBelowPercent", value: 40 },
      do: [{ type: "replaceRotation", order: ["warden-ash-rain", "warden-slam"] }] },
  ],
  visualId: "npc.ashen-warden",
})

// content/encounters/ashen-warden/modifiers.ts
export const smotheringAsh = defineModifier({
  id: "smothering-ash",
  name: "Smothering Ash",
  description: "Run energy drains while you take damage. You lose at 0 run energy.",
  mechanics: [
    { id: "drain-run-energy-on-hit", params: { perDamage: 50 } },
    { id: "lose-at-resource-zero", params: { resource: "runEnergy" } },
  ],
})
```

### 5.3 Content registry and validation

`content/src/registry.ts` collects every definition into one `ContentRegistry`
and validates it at startup and in CI:

- Every definition passes its Zod schema.
- Every reference resolves (attack IDs, NPC IDs, mechanic IDs, item IDs).
- Every mechanic's params pass that mechanic's own schema.
- Every `visualId` exists in the asset manifest, or a placeholder is used and
  a warning is listed.

Content is written in **TypeScript, not JSON**, for autocomplete, comments and
compile-time reference checks. A build script can export it to JSON if a future
editor tool or server needs that.

### 5.4 Adding a new boss (the whole checklist)

1. Create `content/encounters/<boss>/` with `encounter.ts`, `npcs.ts`,
   `attacks.ts`, `modifiers.ts`, and optionally `mechanics/`.
2. Write any mechanic the built-ins cannot express, as a registered module.
3. Add the boss to `content/encounters/index.ts`.
4. Add visual definitions and assets (or rely on placeholders).
5. Add scenario tests and one golden replay.

No file in `engine`, `render`, `storage` or `app` changes. The boss-select screen
lists encounters from the registry automatically.

---

## 6. Rendering architecture

### 6.1 Responsibilities

The `render` package turns a stream of `TickResult`s into a 3D scene. It never
changes simulation state.

```ts
// illustrative
createRenderer(canvas, assets: AssetLoader, visuals: VisualRegistry): Renderer
interface Renderer {
  loadEncounter(arena: ArenaView, initial: WorldSnapshot): Promise<void>
  applyTick(result: TickResult): void          // once per tick
  frame(alpha: number): void                   // every animation frame, 0..1 between ticks
  pickTile(screenX, screenY): Tile | null      // for click-to-move
  pickEntity(screenX, screenY): EntityId | null
  setOverlays(o: OverlaySettings): void        // tile markers, highlights, true tile
  dispose(): void
}
```

### 6.2 Internals

- `scene/`: arena builder (tile grid mesh, walls, lighting).
- `camera/`: orbit camera with keyboard and mouse controls, zoom limits.
- `entities/`: one `EntityView` per engine entity, created and destroyed from
  spawn and despawn events. Positions interpolate between the previous and
  current snapshot using `alpha`.
- `effects/`: hitsplats, health bars, overhead prayer icons, projectiles
  (travel timed to `landTick`), hazard telegraphs, death effects.
- `overlays/`: tile hover, destination marker, user tile markers, NPC
  highlight outlines, true-tile indicators.
- `visuals/`: maps `visualId` and cues to models, clips and effects.
- Placeholder primitives (coloured boxes and capsules sized by tile size) so
  every boss is playable before it has art.

### 6.3 HUD: DOM, not WebGL

Orbs (HP, prayer, run, special), boss health bar, tick indicator and the combat
log are React components layered over the canvas. They read Zustand stores
updated once per tick. Text and layout stay crisp and accessible, and the render
package stays focused on the scene.

---

## 7. State management

There are three kinds of state, each with exactly one owner.

| State | Owner | Lifetime | Examples |
|---|---|---|---|
| Simulation state | `engine` | One fight | HP, positions, cooldowns, prayers, RNG |
| Session and UI state | Zustand stores in `app` | Page session | Selected encounter, open panel, paused, playback speed, latest snapshot for HUD |
| Persistent user data | `storage` | Across visits | Settings, keybinds, loadouts, tile markers, replays, personal bests |

Rules:
- React never holds a second copy of simulation state. The `session` store
  holds the *latest snapshot* that the engine produced, replaced each tick.
- Stores that persist (`settings`, `loadouts`) load from and write through to
  `storage` repositories, debounced.
- The renderer does not use Zustand. It receives ticks directly from the host,
  so UI churn can never stall rendering.

Planned stores: `settingsStore`, `keybindStore`, `loadoutStore`, `sessionStore`,
`uiStore`, `replayStore`.

---

## 8. Data storage

### 8.1 Local (version 1)

| Data | Store | Notes |
|---|---|---|
| Settings, keybinds, overlay prefs | `localStorage` (one versioned JSON blob) | Small, read at boot synchronously |
| Saved setups (loadouts, equipment, stats, inventory, prayers, encounter presets) | IndexedDB `configs` (the v1 `loadouts` table is migrated into it) | See section 26 and docs/content-system.md |
| Tile markers, NPC highlights | IndexedDB `markers` | Keyed by arena ID |
| Replays | IndexedDB `replays` | Input log + config + hashes, a few KB each |
| Personal bests and attempt history | IndexedDB `attempts` | Per encounter + modifier set |
| Cached assets | Cache Storage (service worker) | Managed by `assets`, not `storage` |

- Dexie schema versions with explicit migration functions.
- Every stored record carries a `schemaVersion`.
- Export and import of all user data as one JSON file.

### 8.2 Repository interfaces (backend-ready)

```ts
interface ReplayRepository {
  save(replay: Replay): Promise<ReplayId>
  get(id: ReplayId): Promise<Replay | null>
  list(filter?: ReplayFilter): Promise<ReplaySummary[]>
  delete(id: ReplayId): Promise<void>
}
```

Version 1 ships `LocalReplayRepository`. A later `RemoteReplayRepository` (share
codes, accounts, retention rules) implements the same interface, so the app does
not change. Backend technology is deliberately left open until that phase.

### 8.3 Replay format

```
{ format: 1, engineVersion, contentHash, seed, encounterId, modifierIds,
  playerSetup, inputLog: [{ tick, commands[] }], checkpoints: [{ tick, hash }],
  outcome, durationTicks, createdAt }
```

Playback re-simulates from the input log. For fast seeking, the player keeps
in-memory state snapshots every 50 ticks during the first playthrough.

---

## 9. Asset management

- **Source of truth:** `assets/manifest.json` maps logical IDs
  (`npc.ashen-warden`, `item.bronze-mace.icon`, `fx.hitsplat`) to files, with
  file hashes for cache busting.
- **Formats:** GLB models (with animation clips named to match cues), KTX2
  compressed textures, PNG/WebP sprite atlases for item and prayer icons,
  Opus/OGG audio.
- **Pipeline (`tools/assets/`):** source files in `assets/src/` are optimised
  with gltf-transform (mesh compression, texture compression) into
  `assets/dist/`, and the manifest is regenerated.
- **Loading:** per encounter. Boss select preloads icons only; entering a fight
  loads that arena's and NPCs' assets with a progress bar.
- **Caching:** service worker caches hashed asset files indefinitely.
- **Missing assets:** placeholder plus a console warning, never a crash.
- **Licensing:** only original or properly licensed assets. A `LICENSES.md` in
  `assets/` records the source of every non-original file.

---

## 10. How the systems communicate

### 10.1 One tick, end to end

```
 Player clicks a tile
   → app/input: renderer.pickTile(x, y) returns tile (3, 7)
   → command-mapper: { type: "move", to: (3, 7) }
   → SimulationHost.queueCommand(cmd)
   → engine.queueCommand(cmd)             (held until the next tick)

 600 ms clock fires (in SimulationHost)
   → result = engine.tick()
   → renderer.applyTick(result)           (spawn views, start animations, queue hitsplats)
   → sessionStore.set(result.snapshot)    (HUD and panels re-render once)
   → combatLog.append(result.events)
   → if result.outcome: storage.attempts.save(...), show results screen

 Every animation frame
   → renderer.frame(alpha)                (interpolated movement, effects)
```

### 10.2 The SimulationHost

`app/src/host/simulation-host.ts` is the only place that knows about all the
pieces. It:

- Builds the engine from content and the chosen loadout.
- Owns the clock (`requestAnimationFrame` with an accumulator, so a tick fires
  every 600 ms even if frames are uneven; caps catch-up after a tab sleep).
- Supports modes: **live**, **paused**, **step** (one tick per key press),
  **slow** (e.g. 1200 ms ticks for learning), and **playback** (commands come
  from a replay instead of input).
- Fans out `TickResult`s to the renderer and stores.
- Records the replay on fight end.

Instant reset is just: dispose simulation, create a new one with the same config
and a new seed, call `renderer.loadEncounter` with assets already cached.

### 10.3 Contracts between packages

| From → To | Contract | Shape |
|---|---|---|
| content → engine | `ContentRegistry` | Validated definitions + mechanic modules |
| app → engine | `PlayerCommand` | Plain objects |
| engine → app/render | `TickResult` | Snapshot + events, structured-cloneable |
| render → app | Picking results | Tile or entity ID |
| app ↔ storage | Repository interfaces | Promises of plain records |
| render → assets | `AssetLoader` | Logical ID in, loaded resource out |

Because every cross-package message is a plain, cloneable object, the engine can
later move into a Web Worker, a test runner, or a server-side replay verifier
without changing its API.

---

## 11. Testing strategy

| Layer | Tool | What it proves |
|---|---|---|
| Formula unit tests | Vitest | Accuracy, max hit, drain and timing match hand-computed reference values |
| System tests | Vitest | Movement, pathing, prayer, consumables behave per the tick order |
| Mechanic scenario tests | Vitest + test harness | "Given this fight state, after N ticks, these events happened" |
| Determinism | fast-check | Random command sequences with the same seed always give the same hash |
| Golden replays | Vitest | Stored replays still produce the same checkpoints. Intentional changes bump `engineVersion` and regenerate |
| Content integrity | Vitest | All definitions validate, all references resolve, all visuals exist |
| Component tests | Vitest + Testing Library | Panels, loadout editor, keybind editor |
| End to end | Playwright | Boot app, pick boss, start fight, click to move, finish fight, save replay, play it back |
| Boundaries | dependency-cruiser, ESLint | Engine stays pure |

The **scenario harness** (`engine/test/harness.ts`) is the key tool for content
authors:

```ts
const sim = scenario("ashen-warden").withPlayer(meleeLoadout).seed(42).build()
sim.runTicks(10)
expect(sim.events).toContainEvent({ type: "AttackStarted", attackId: "warden-slam" })
```

---

## 12. Folder and file structure

```
osrs-combat-sim/
├── package.json                    # workspace scripts: dev, build, test, lint, e2e
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── vitest.workspace.ts
├── eslint.config.js
├── .dependency-cruiser.cjs         # package boundary rules
├── docs/
│   ├── architecture.md
│   ├── tick-order.md
│   ├── adding-a-boss.md
│   ├── writing-a-mechanic.md
│   └── replay-format.md
│
├── packages/
│   ├── engine/                     # pure TS, no DOM
│   │   ├── package.json
│   │   ├── tsconfig.json           # lib: ES2022 only
│   │   ├── src/
│   │   │   ├── index.ts            # public exports only
│   │   │   ├── api/
│   │   │   │   ├── simulation.ts   # createSimulation, Simulation
│   │   │   │   ├── commands.ts     # PlayerCommand union
│   │   │   │   ├── events.ts       # SimEvent union
│   │   │   │   └── snapshot.ts     # WorldSnapshot types + builder
│   │   │   ├── core/
│   │   │   │   ├── world.ts
│   │   │   │   ├── tick-pipeline.ts
│   │   │   │   ├── rng.ts
│   │   │   │   ├── scheduler.ts    # delayed events queue
│   │   │   │   ├── state-hash.ts
│   │   │   │   └── version.ts
│   │   │   ├── defs/               # Zod schemas + types for all content
│   │   │   │   ├── item.ts
│   │   │   │   ├── weapon.ts
│   │   │   │   ├── consumable.ts
│   │   │   │   ├── prayer.ts
│   │   │   │   ├── npc.ts
│   │   │   │   ├── attack.ts
│   │   │   │   ├── arena.ts
│   │   │   │   ├── encounter.ts
│   │   │   │   ├── modifier.ts
│   │   │   │   └── define.ts       # defineNpc, defineItem, ... helpers
│   │   │   ├── entities/
│   │   │   │   ├── entity.ts
│   │   │   │   ├── player.ts
│   │   │   │   ├── npc.ts
│   │   │   │   ├── hazard.ts
│   │   │   │   └── projectile.ts
│   │   │   ├── map/
│   │   │   │   ├── grid.ts
│   │   │   │   ├── pathfinding.ts
│   │   │   │   └── line-of-sight.ts
│   │   │   ├── combat/
│   │   │   │   ├── effective-levels.ts
│   │   │   │   ├── accuracy.ts
│   │   │   │   ├── max-hit.ts
│   │   │   │   ├── damage.ts
│   │   │   │   └── attack-timing.ts
│   │   │   ├── systems/            # one file per tick phase
│   │   │   │   ├── commands.ts
│   │   │   │   ├── scheduled-events.ts
│   │   │   │   ├── encounter.ts
│   │   │   │   ├── npc-turns.ts
│   │   │   │   ├── player-turn.ts
│   │   │   │   ├── hit-resolution.ts
│   │   │   │   ├── death.ts
│   │   │   │   ├── upkeep.ts       # prayer drain, run energy, regen, boosts
│   │   │   │   └── outcome.ts
│   │   │   ├── player/
│   │   │   │   ├── equipment.ts
│   │   │   │   ├── inventory.ts
│   │   │   │   ├── prayers.ts
│   │   │   │   └── consumables.ts
│   │   │   ├── ai/
│   │   │   │   ├── controller.ts
│   │   │   │   ├── targeting.ts
│   │   │   │   ├── movement.ts
│   │   │   │   └── attack-selection.ts
│   │   │   ├── mechanics/
│   │   │   │   ├── registry.ts
│   │   │   │   ├── context.ts      # MechanicContext (restricted API)
│   │   │   │   ├── hooks.ts
│   │   │   │   ├── pipelines.ts
│   │   │   │   ├── conditions/     # registry + built-in conditions
│   │   │   │   ├── actions/        # registry + built-in actions
│   │   │   │   └── builtins/       # spawn-adds, tile-hazard, enrage, drain-resource,
│   │   │   │                       # disable-protection, lose-at-zero, area-attack ...
│   │   │   ├── encounter/
│   │   │   │   ├── runtime.ts
│   │   │   │   └── phases.ts
│   │   │   └── replay/
│   │   │       ├── input-log.ts
│   │   │       └── recorder.ts
│   │   └── test/
│   │       ├── harness.ts
│   │       ├── combat/
│   │       ├── systems/
│   │       ├── mechanics/
│   │       └── determinism.test.ts
│   │
│   ├── content/                    # all game data, original content
│   │   ├── src/
│   │   │   ├── index.ts            # exports buildContentRegistry()
│   │   │   ├── registry.ts         # collect + validate + resolve references
│   │   │   ├── items/
│   │   │   │   ├── weapons/        # melee.ts, ranged.ts, magic.ts
│   │   │   │   ├── armour/
│   │   │   │   └── consumables/
│   │   │   ├── prayers/
│   │   │   ├── arenas/
│   │   │   ├── loadouts/           # starter presets
│   │   │   └── encounters/
│   │   │       ├── index.ts
│   │   │       └── ashen-warden/   # example original boss
│   │   │           ├── encounter.ts
│   │   │           ├── npcs.ts
│   │   │           ├── attacks.ts
│   │   │           ├── modifiers.ts
│   │   │           └── mechanics/
│   │   └── test/
│   │       ├── integrity.test.ts
│   │       ├── encounters/         # scenario tests per boss
│   │       └── golden-replays/     # stored replay fixtures
│   │
│   ├── render/                     # Three.js, no React
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── renderer.ts
│   │   │   ├── interpolation.ts
│   │   │   ├── picking.ts
│   │   │   ├── scene/
│   │   │   ├── camera/
│   │   │   ├── entities/
│   │   │   ├── effects/            # hitsplats, projectiles, telegraphs, overheads
│   │   │   ├── overlays/           # tile markers, highlights, true tile
│   │   │   ├── visuals/            # VisualDef schema + registry
│   │   │   └── placeholders/
│   │   └── test/
│   │
│   ├── assets/                     # asset manifest + loaders
│   │   ├── src/
│   │   │   ├── manifest.ts
│   │   │   ├── loader.ts
│   │   │   └── cache.ts
│   │   ├── visuals/                # VisualDefs per NPC/item/effect
│   │   ├── src-art/                # source files (Blender, PSD), not shipped
│   │   ├── dist/                   # optimised GLB, KTX2, atlases (generated)
│   │   ├── manifest.json           # generated
│   │   └── LICENSES.md
│   │
│   ├── storage/
│   │   ├── src/
│   │   │   ├── db.ts               # Dexie schema + migrations
│   │   │   ├── settings.ts         # localStorage blob, versioned
│   │   │   ├── repositories/
│   │   │   │   ├── loadouts.ts
│   │   │   │   ├── markers.ts
│   │   │   │   ├── replays.ts
│   │   │   │   └── attempts.ts
│   │   │   └── export-import.ts
│   │   └── test/
│   │
│   └── app/                        # React application
│       ├── index.html
│       ├── vite.config.ts
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── routes/
│       │   │   ├── home.tsx
│       │   │   ├── boss-select.tsx
│       │   │   ├── encounter.tsx   # /boss/:encounterId/:variant?
│       │   │   ├── replay.tsx      # /replay/:id
│       │   │   └── settings.tsx
│       │   ├── host/
│       │   │   ├── simulation-host.ts
│       │   │   ├── clock.ts
│       │   │   └── worker-host.ts  # later
│       │   ├── state/              # Zustand stores
│       │   ├── input/
│       │   │   ├── keybinds.ts
│       │   │   └── command-mapper.ts
│       │   ├── ui/
│       │   │   ├── hud/            # orbs, boss bar, tick indicator, timer
│       │   │   ├── panels/         # inventory, equipment, prayer, stats, combat log
│       │   │   ├── setup/          # loadout editor, stat editor, modifier picker
│       │   │   ├── results/
│       │   │   ├── replay/         # playback controls
│       │   │   └── components/     # shared buttons, tooltips, modals
│       │   └── styles/
│       └── e2e/                    # Playwright specs
│
└── tools/
    ├── assets/                     # optimise + generate manifest
    ├── validate-content.ts         # CLI: run registry validation
    └── verify-replay.ts            # CLI: re-simulate a replay, compare hashes
```

---

## 13. Suggested build order (after approval)

1. **Foundation:** monorepo, lint and boundary rules, CI with tests.
2. **Engine core:** world, RNG, tick pipeline, grid, movement, commands,
   snapshot, events, state hash, determinism test.
3. **Combat:** formulas, player attacks, one dummy NPC, hit resolution, prayers.
4. **Minimal render + host:** placeholder arena and entities, click to move,
   interpolation, hitsplats. First playable fight.
5. **Content system:** schemas, registry, mechanics registry, conditions and
   actions, first original boss with phases.
6. **Player setup UI:** stats, equipment, inventory, loadout presets, storage.
7. **Modifiers:** two or three contract-style variants on the first boss.
8. **Replays:** recording, local save, playback with step and seek.
9. **Polish:** keybinds, tile markers, NPC highlights, combat log filters,
   tutorial, results screen, real art.
10. **Later:** Web Worker host, accounts, shared replays.

---

## 14. Decisions I need from you

1. **3D with Three.js** (recommended) or a simpler **2D top-down** renderer.
2. **Original bosses and art** with OSRS-style mechanics (recommended, and
   the only route I will build) versus anything closer to the real game.
3. **Version 1 scope:** local-only (recommended) or include accounts and
   shared replays from the start.
4. **Formula fidelity:** exact OSRS-style formulas everywhere, or simplified
   where it does not change practice value.

---

## 15. Implementation notes (foundation stage)

Decisions taken with the recommended defaults: Three.js 3D, original content,
local-only storage. Formula fidelity is decided in the combat stage.

Where the code differs from the plan above, and why:

| Plan | Implemented | Reason |
|---|---|---|
| `VisualDef` in `render/visuals/` | In `packages/assets/src/` (`visual-def.ts`, `manifest.ts`); `render` resolves them | Keeps visual data in one data-only package; the renderer stays code |
| Asset loader with GLB, KTX2 and service-worker caching | Placeholder primitives only; `model` field reserved | No art exists yet; the loader lands with the first model |
| `render` knows visual IDs from definitions | The app passes a `VisualLookup` function to the renderer | `render` must not import `content` |
| Content validated by `define*` helpers | `define*` helpers are typed identity functions; all validation happens once in `buildRegistry` | Reports every problem at once with clear messages |
| Full hook list | `onEncounterStart`, `onTick`, `checkLoss`, `checkWin` | Others need combat; added with it |
| Pipelines for combat values | `runEnergy.drainPerTick`, `runEnergy.regenPerTick` | Combat pipelines added with formulas |
| `/replay/:id` route | Replays are saved on fight end; no viewer yet | Replay viewer is its own stage |
| `structuredClone` for snapshots | `clonePlain` (JSON copy) in `engine/src/util/clone.ts` | `structuredClone` is not part of plain ES2022 |
| `engine/src/combat`, `ai`, `player`, `encounter` | Folders exist with a README describing what goes there | Placeholders keep the structure visible |

## 16. Implementation notes (combat arena stage)

- **Basic combat in the engine:** weapon-driven player attacks, NPC attacks
  from `AttackDef`s, OSRS-style accuracy and max-hit formulas (no stances or
  prayers yet), hit delays, projectile events, deaths. `ENGINE_VERSION` is
  0.2.0.
- **NPC AI:** `ai.movement` ("stationary" | "chase") and `ai.selection`
  ("sequence" | "random") on `NpcDef`. Implemented in `engine/src/ai/`.
- **Rendering timeline:** the renderer shows fractional tick
  `N - 1 + alpha`. Projectiles fly over `[launchTick - 1, landTick - 1]`, so
  they arrive exactly when `HitLanded` is applied (`effects/timing.ts`).
- **Animation framework:** one `Animator` interface with a procedural
  implementation (placeholder rigs with named joints) and a glTF
  implementation (`AnimationMixer`). Cues fall back along their dotted name.
- **Characters:** `Character` shows a placeholder rig at once and swaps to a
  GLB model when one is configured and loaded (`docs/adding-art.md`).
- **Shader warm-up:** `SceneRenderer` compiles every effect's shaders when an
  encounter loads, so the first projectile or splat never stalls a frame.
- **Lighting budget:** at most two point lights per arena; each adds cost to
  every lit pixel.
- **Debug hook:** `window.__simDebug` (renderer stats, snapshot, entity screen
  positions, picking) is set while a fight is on screen; the browser tests use it.
- **Balance:** the Ashen Warden is tuned so level-99 melee almost always wins
  and level-70 loadouts sometimes do (15 to 60%), pending prayers and food.

## 17. Implementation notes (core engine stage)

- **SimulationRunner moved into the engine** (`engine/src/runtime/runner.ts`).
  It owns start, pause, resume, reset (same, new or explicit seed), step,
  speed (0.25x to 8x), replay playback and headless helpers, with no timers.
  The app's old `TickClock` is replaced by a `FrameLoop` that only measures
  elapsed time; `SimulationHost` is now a thin adapter.
- **Life cycle states** replace the `alive` flag: `alive` -> `dying` -> `dead`
  -> respawn. `NpcDef.deathTicks`/`respawnTicks`,
  `EncounterDef.playerDeath`/`playerRespawnTicks`. Snapshots keep `alive` as a
  shorthand.
- **Combat event pipeline** (`systems/combat-events.ts`) with new pipelines
  (`accuracy.*`, `damage.maxHit`, `damage.incoming`, `attack.speedTicks`,
  `hitpoints.regenIntervalTicks`) that receive attacker/target/style info,
  and new hooks (`onAttackStart`, `onHitLanded`, `onEntityDeath`,
  `onEntityRespawn`).
- Damage is capped at remaining hitpoints; hits on targets that are no longer
  alive are dropped; hitpoints regenerate 1 per 100 ticks.
- `snapshot.projectiles` lists hits in flight; `snapshot.seed` and
  `attackReadyIn` were added.
- Settings v2: `speed` and `lockSeed` replace `tickMs` (migrated automatically).
- `ENGINE_VERSION` is now 0.3.0: damage capping, regeneration and life
  states change results for the same inputs, so 0.2.0 replays are refused
  rather than played back wrongly.

## 18. Implementation notes (combat calculation stage)

- `engine/src/combat/` is split into independent modules: `factors`,
  `stances`, `weapon-categories`, `effective-level`, `accuracy`, `max-hit`,
  `damage`, `prayer`, `special-attack`, `timing`, `range`. Formulas and
  sources: `docs/combat-formulas.md`.
- Weapons declare a `category` (OSRS weapon categories) instead of a fixed
  style; players pick a style index. Optional `special` attacks are data.
- New definitions: `PrayerDef`, `SpellDef`, `SpecialAttackDef`; registry gains
  `prayers` and `spells`. `AttackDef.prayerPenetration` lets attacks pierce
  protection prayers.
- Accuracy is rolled as two uniform rolls (attacker > defender), like the game.
- Commands: `setCombatStyle`, `togglePrayer`, `toggleSpecial`, `setAutocast`.
  Upkeep drains prayer and regenerates special energy.
- `ENGINE_VERSION` 0.4.0: results differ from 0.3.0 for the same inputs.

## 19. Implementation notes (equipment and inventory stage)

- Items are real OSRS items. Bonuses, speeds, ranges, styles and weights are
  generated from the OSRS Wiki's structured data (`pnpm items:fetch`), with the
  page revision stored per item; requirements, specials, ammo rules and
  consumables are curated in a catalogue. See `docs/item-database.md`.
- `ItemDef` gained `requirements`, `ammo`, `ammoSavePercent`, `consumable`
  (effects built from `LevelAmount` formula data: heal, boost, drain, restore),
  `weapon.ammo`, `weapon.poweredStaff` (formula) and `source`.
- The player now has a live `equipment` map and 28 `inventory` slots, current
  `levels` (boosted/drained), and food, combo-food and potion timers.
  Commands: `equipItem`, `unequipItem`, `moveItem`, `useItem`. Bonuses and the
  weapon are recomputed on every change; formulas use current levels.
- Ranged attacks check ammunition (kind and tier) and spend it, with Ava's
  recovery rolled on the `misc` RNG stream so results stay deterministic.
- New weapon categories: whip, spiked, bladed staff.
- The app has a loadout editor (custom loadouts saved in IndexedDB) and
  interactive inventory and equipment panels.
- `ENGINE_VERSION` 0.5.0.

## 20. Implementation notes (player configuration and prayer stage)

- The prayer book uses real OSRS names and values, with exact conflict groups
  from the wiki table (resolves U7), level requirements beyond Prayer
  (Chivalry, Piety, Rigour, Augury, Zeal), additive Defence from Deadeye and
  Mystic Vigour, and the utility prayers Rapid Restore, Rapid Heal, Preserve
  and Redemption. See `docs/combat-formulas.md`.
- New commands: `setBaseLevel`, `setCurrentLevel`, `setHitpoints`,
  `setPrayerPoints`. They go through the same command queue as every other
  input, so configuration changes are recorded in replays and apply on a
  tick boundary. Base level changes keep boosts relative, refuse to go below a
  worn item's requirement, and switch off prayers that are no longer allowed.
- Upkeep now runs per-player timers: hitpoint regeneration (halved by Rapid
  Heal), the Rapid Restore timer, and Preserve's postponed boost decay.
- Mechanics get a restricted prayer API (`drainPoints`, `deactivate`,
  `lockOverheads`) and a `prayer.drainEffect` pipeline. Three built-in
  mechanics use it; the Ashen Warden gains the Severed Faith and Draining
  Embers modifiers.
- The snapshot exposes the active overhead, the overhead lock, the next
  hitpoint change, the player's current offence (max hit, attack roll, hit
  chance against the target) and defence rolls for each style. The UI shows
  them in the Prayer and Player tabs, and the renderer draws an original
  overhead badge above the player.
- Mechanic context builders moved from `core/world.ts` to
  `mechanics/runtime.ts` to avoid an import cycle with the prayer rules.
- `ENGINE_VERSION` 0.6.0.

## 21. Implementation notes (visual overhaul)

- Goal: feel familiar to players of classic tick-based MMO boss fights, using
  original assets and a consistent colour language. See `docs/visual-style.md`.
- Renderer: Lambert (matte) materials, no shadow maps or filmic tone mapping,
  blob shadows, a vertex-coloured terrain floor, tiered stone stands or a
  fence, broken column stumps that never hide the player, a player-centred
  camera, classic hitsplats, overhead text for boss announcements, and
  projectile colours by attack style.
- Characters wear their gear: `@sim/assets` has an appearance table (shape and
  colours per item), the humanoid rig's `wear(outfit)` rebuilds worn pieces,
  and weapon props have a shape per weapon type.
- App: the fight screen is a game view plus a classic side interface
  (`ui/game/`): minimap and orbs, two rows of icon tabs opened with
  remappable F-keys (new `tab*` keybinds; stored settings without them get
  the defaults), a chatbox, mouseover text, click crosses and a boss bar.
  The old `ui/panels/` side panel was removed.
- No engine changes in this stage; `ENGINE_VERSION` stays 0.6.0.

## 22. Implementation notes (boss framework)

- `defs/behaviour.ts`: NPC behaviour as data: phases (hitpoint thresholds,
  movement, attack patterns `rotation` / `random` / `switch`, close-range
  attacks, attack speed and defence overrides, specials every N attacks,
  entry effects), enrage (hitpoints or time), and boss special attacks.
- `npc/`: the generic runner. `turn.ts` (one NPC turn), `behaviour.ts`
  (phases, enrage, patterns, special context), `specials.ts` (the special kind
  registry with built-in `tile-aoe` and `volley`), `hazards.ts` (telegraphed
  and burning tiles). `ContentRegistry.specialKinds` holds the kinds; content
  bundles can register more.
- One damage path (`dealDamage`) for hits and hazards; new `typeless` hit
  style that prayers never reduce; invulnerable NPCs take 0.
- New events: BossPhaseChanged, BossEnraged, BossSpecialUsed, NpcSaid,
  NpcHealed, HazardPlaced; EntityMoved can be a teleport; HitLanded can be
  immune. Snapshots carry each NPC's phase, enrage and invulnerability, and
  the world's hazards. World state (and the hash) includes hazards.
- Mechanics gained `npc.heal` and `npc.say`.
- Content validation checks every behaviour reference.
- The Ashen Warden is the complete example: three phases, four specials,
  enrage, and the Kindling rule. A scripted good player wins every test seed;
  a passive one loses every one.
- App: the encounters page is a boss selection screen generated from data;
  the boss bar shows phase, enrage and immunity; the renderer draws hazards,
  overhead speech and teleports.
- `ENGINE_VERSION` 0.7.0.

## 23. Implementation notes (player and boss interaction)

- Every player action is a command applied at the start of the next tick:
  attack, move, combat style, prayers, eat, drink, special attack, equip and
  unequip, and the new `setAutoRetaliate`. Auto retaliate (a setup option and
  a command; the app turns it on by default, as in the classic game) makes an
  idle player target the NPC whose hit just landed; walking is never
  interrupted.
- Bosses act only through the framework (phases, patterns, cooldowns,
  specials) and the same combat engine as the player.
- New visuals, each driven by an engine event or snapshot field: eat and
  drink animations (ItemConsumed now carries `kind`), a special-attack strike,
  bursts for detonations, phase changes, enrage, specials and Redemption,
  green heal splats, an enraged tint and an immune shimmer on bosses.
- Visual/simulation consistency: `SceneRenderer.renderState()` plus
  `compareRenderToSnapshot()` (`render/src/debug/consistency.ts`), exposed to
  browser tests. It found one real bug: a projectile with a one-tick flight
  vanished while paused before its hit landed. Projectiles are now removed
  exactly when the tick that applies their hit has been applied.
- Content test `content/test/interaction.test.ts` runs one Warden fight using
  every player action and checks the boss's cooldowns, specials and phases.
- `ENGINE_VERSION` 0.8.0 (player state gained auto retaliate fields).

## 24. Implementation notes (combat analytics)

- `engine/src/analytics/`: `recordTick` folds tick results into `FightStats`
  (`summarize` derives DPS, averages, accuracy, uptime); `explainEvent` turns
  any event into a title, facts and reasons. Pure and deterministic, usable
  live, on replays and in tests.
- Engine events gained explanatory data (HitLanded `detail`, reasons and
  causes) and two new events (`PrayerDrained`, `Regenerated`). State, RNG and
  replays are unchanged, so `ENGINE_VERSION` stays 0.8.0.
- App: the session store keeps every event record and the fight stats; the
  analytics window (L, or the Stats button) shows live statistics linked to
  filtered views of the event log, with an explanation pane. The results
  screen shows a summary.
- See `docs/analytics.md`.

## 25. Implementation notes (simulation controls, history and replays)

- Engine: every `TickResult` carries the applied inputs and the state hash.
  `FightHistory` records every tick; `SimulationRunner` keeps one and can
  `rewindTo(tick)` (re-simulate with hash checks) and `takeControl()` of a
  replay. `rebuildReplay` turns a saved replay into a full history;
  `HistoryPlayer` is a UI-free playback cursor over any history.
- App host modes: live (the runner simulates), review (a cursor over the live
  history; the fight is paused and inputs are ignored) and replay (a cursor
  over a rebuilt replay). The renderer gained `showSnapshot` to draw any
  recorded tick exactly (the consistency check covers review and replay too).
  The session store rebuilds statistics, the event log and the chatbox from
  the history up to the tick on screen.
- UI: timeline with event markers and transport buttons, review banner, Tick
  inspector tab, Go to tick from the event log, Replays page (watch, verify,
  download, import, delete), replay viewer route, results-screen links.
- Keyboard shortcuts now keep working while a slider or checkbox has focus.
- Events and state are unchanged by this stage; `ENGINE_VERSION` stays 0.8.0.

## 26. Implementation notes (saved setups and content packs)

- **Configuration library** (`storage/src/configs/`): six kinds (loadout,
  equipment, stats, inventory, prayers, encounter), each with a zod schema, a
  schema version and migrations. `ConfigLibrary` does create, update (bumps
  `revision`), duplicate, delete, list, and portable export / import bundles
  (`osrs-combat-sim/configs` v1) with a per-entry skip report. It depends only
  on the `ConfigStore` interface; `IndexedDbConfigStore` and
  `MemoryConfigStore` implement it today, a remote store can later. The app
  adds a content validator (unknown items, prayers, bosses; loadouts must
  start a simulation).
- **Dexie version 2** adds the `configs` table and migrates v1 loadouts.
  Replays now store their seed.
- **App**: the Setups page (kind tabs, rename, duplicate, delete, export,
  import), save and load per editor section, a Prayers section with start and
  quick prayers, the clickable prayer orb, and encounter presets on the boss
  screen (`?seed`, `?speed`, `?retaliate` in fight URLs).
- **Content packs** (`content/src/packs/`): the registry is the merge of
  `CONTENT_PACKS`. Provenance records which pack defined each ID; IDs that two
  packs define, duplicate packs and missing `requires` are reported with all
  other validation issues. Each boss folder now holds its arena and exports a
  pack. `pnpm new:boss` scaffolds one; `pnpm validate-content` prints counts
  per pack. The restructure left the content hash unchanged.
- **Items**: catalogue split per category; `tags` (automatic and curated)
  and `notes` (unmodelled effects) on `ItemDef`; 70 more wiki-verified items
  (160 total); five new weapon categories (axe, spear, claw, polearm,
  bludgeon) with props and icons; `searchItems` / `itemClass` drive the
  editor's style filter and tag search. Every item has an appearance (tested).


## 27. Audit (engine 0.9.0)

A full technical and functional audit is in `docs/audit-report.md`. Rule
changes: line of sight for attacks beyond melee range (`combat/range.ts`),
and chasing NPCs step out from under the player (`ai/movement.ts`,
`npc/turn.ts`). New safety nets: an invariant fuzz test across every
encounter and loadout (`content/test/fuzz.test.ts`), a test that extra
content leaves existing fights identical, and browser tests for outdated or
corrupt saved data.
