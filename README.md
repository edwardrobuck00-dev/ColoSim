# Combat Simulator

A browser-based, tick-based boss fight simulator for practising OSRS-style
mechanics: 600 ms game ticks, tile movement, line of sight, prayers, real
item stats and accuracy rolls, against original bosses with original art.

**Play it online: https://edwardrobuck00-dev.github.io/ColoSim/** (no
installation; your saved setups and replays stay in your browser). The site
is rebuilt automatically on every push to `main`
(`.github/workflows/pages.yml`).

**Status:** the engine, the Ashen Warden boss, 160 wiki-verified items,
analytics, review and replays, and saved setups are complete and tested.
See [docs/audit-report.md](docs/audit-report.md) for what is done, what is
not modelled yet and the recommended next steps.

## Requirements

- Node.js 20 or newer
- pnpm 10 (`corepack enable` installs it from `packageManager` in `package.json`)

## Getting started

Install dependencies:

```bash
pnpm install
```

Start the development server, then open http://localhost:5173:

```bash
pnpm dev
```

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Development server with hot reload (http://localhost:5173) |
| `pnpm build` | Typecheck the app and build it to `packages/app/dist` |
| `pnpm preview` | Serve the production build (http://localhost:4173) |
| `pnpm test` | Run every unit, integration and component test (Vitest) |
| `pnpm test:watch` | Tests in watch mode |
| `pnpm e2e` | Browser tests (Playwright). First time on a new machine: `pnpm --filter @sim/app exec playwright install chromium` |
| `pnpm typecheck` | TypeScript check of every package |
| `pnpm lint` | ESLint plus package boundary checks (dependency-cruiser) |
| `pnpm validate-content` | Validate all game data and print a summary per content pack |
| `pnpm new:boss <id> "Name"` | Scaffold a new boss as its own content pack (see docs/content-system.md) |
| `pnpm items:fetch` | Re-download verified item data from the OSRS Wiki (see docs/item-database.md) |
| `pnpm check` | typecheck + lint + test, as CI would run them |

## Reproducing a fight

Every fight has a seed (shown in the Stats tab and on the results screen).
The same seed with the same inputs gives exactly the same fight. Add
`?seed=123` to a fight URL, use **Same seed** on the results screen, or turn
on "Reset repeats the same seed" in Settings.

## Saving setups

The **Setups** page saves complete loadouts and their parts (equipment,
stats, inventory, prayers), plus encounter presets (boss, modifiers, loadout,
seed, speed). Each part can be saved from its section of the loadout editor
and loaded into any other loadout. Rename, duplicate, delete, export (one,
selected or all) and import are on each row and the toolbar. Quick prayers
set in a loadout are toggled by clicking the prayer orb in a fight. Saved on
this device in IndexedDB; export to move setups between browsers. See
[docs/content-system.md](docs/content-system.md).

## Controls

| Input | Action |
|---|---|
| Left-click a tile | Walk or run there (yellow cross) |
| Left-click an NPC | Move into weapon range and attack it (red cross) |
| Mouse wheel | Zoom |
| Arrow keys or middle-drag | Rotate and tilt the camera |
| F1 to F8 | Open the Combat, Skills, Inventory, Equipment, Prayer, Magic, Info and Simulation tabs |
| 1 / 2 / 3 | Protect from Melee / Missiles / Magic |
| E | Arm the weapon's special attack (or click the special orb) |
| R | Toggle run (or click the run orb) |
| Space | Pause / resume |
| . (period) | Step one tick forward (while paused or reviewing) |
| , (comma) | Step one tick back: review the fight's history |
| End | Return to the live fight after reviewing |
| Timeline (bottom right) | Drag to any earlier tick; Play from here continues the fight from it |
| Backspace | Reset the fight |
| C | Reset the camera |
| L or the Stats button | Combat analytics: live statistics and the detailed event log |
| Speed menu (bottom right) | 0.25x to 4x; never changes fight results |

Every key can be changed on the Settings page.

| Tab | What it does |
|---|---|
| Combat | Combat styles, Auto Retaliate (on by default) and the special attack bar |
| Skills | Current and base levels, hitpoints and prayer points; click a number to change it |
| Inventory | 28 slots: click to wield, wear, eat or drink; drag to move |
| Equipment | Worn items (click to remove) and live equipment bonuses |
| Prayer | The prayer book; hover for details, locked prayers show missing requirements |
| Magic | Spells and autocast (with a staff) |
| Info | Live max hit, attack roll, hit chance and defence rolls, timers, seed |
| Simulation | Camera and seed options, key reference |

The look and the colour language (blue-violet magic, green ranged, red and
blue hitsplats) are described in [docs/visual-style.md](docs/visual-style.md).

## Where everything lives

```
packages/
  engine/    Combat engine. Pure TypeScript: no DOM, clock or Math.random.
  content/   Game data: items, arenas, NPCs, encounters, modifiers, boss mechanics.
  render/    Three.js renderer. Reads engine output; never changes it.
  assets/    Visual manifest: maps visual IDs to models or placeholder shapes.
  storage/   Settings (localStorage); saved setups, replays, attempts (IndexedDB).
  app/       React app: pages, HUD, panels, input, and the simulation host.
tools/       Command-line scripts (content validation).
docs/        Architecture, research and how-to guides.
```

| System | Location |
|---|---|
| Application entry point | `packages/app/src/main.tsx`, routes in `packages/app/src/App.tsx` |
| Pages | `packages/app/src/routes/` |
| UI components | `packages/app/src/ui/` (`game/` for the in-fight interface, `components/`, `hud/`, `setup/`, `results/`, `arena/`, `loadout/`) |
| In-fight interface (side panel, tabs, orbs, minimap, chatbox, icons) | `packages/app/src/ui/game/` |
| Item appearance (shape and colours per item) | `packages/assets/src/appearance.ts` |
| Simulation runner (start, pause, step, reset, speed, replays) | `packages/engine/src/runtime/runner.ts` |
| Simulation host (connects runner, renderer and UI) | `packages/app/src/host/simulation-host.ts`, frame timing in `host/frame-loop.ts` |
| UI state (Zustand) | `packages/app/src/state/` |
| Input (keybinds, click to command) | `packages/app/src/input/` |
| App utility functions | `packages/app/src/utils/` |
| Combat engine | `packages/engine/src/` |
| Engine public API | `packages/engine/src/api/` (`createSimulation`, commands, events, snapshots) |
| Tick order | `packages/engine/src/core/tick-pipeline.ts`, systems in `packages/engine/src/systems/` |
| Data schemas | `packages/engine/src/defs/` |
| Mechanics, hooks, pipelines | `packages/engine/src/mechanics/` |
| Engine utility functions | `packages/engine/src/util/` |
| Game data | `packages/content/src/` (`items/`, `loadouts/`, `prayers/`, `spells/`) |
| Content packs (what the game loads, provenance, clash checks) | `packages/content/src/packs/`, item search in `packages/content/src/search.ts` |
| Encounters (one folder and pack per boss, including its arena) | `packages/content/src/encounters/`, scaffold in `tools/new-boss.ts` |
| Rendering system | `packages/render/src/renderer.ts` (event handling and frame loop) |
| Arena scene | `packages/render/src/scene/arena-builder.ts` |
| Characters (placeholder rigs, model loading) | `packages/render/src/characters/` |
| Animation framework | `packages/render/src/animation/` |
| Damage splats, health bars, projectiles | `packages/render/src/effects/` |
| Camera | `packages/render/src/camera/orbit-camera.ts` |
| Combat formulas (accuracy, max hit, styles, prayers, specials), one module each | `packages/engine/src/combat/` |
| Prayer rules (toggling, conflicts, requirements, drain, utility prayers) | `packages/engine/src/player/prayers.ts`, upkeep in `packages/engine/src/systems/upkeep.ts` |
| Player configuration commands (levels, hitpoints, prayer points) | `packages/engine/src/player/configure.ts`, UI in `packages/app/src/ui/game/tabs/SkillsTab.tsx` |
| Encounter prayer mechanics | `packages/engine/src/mechanics/builtins/prayer-mechanics.ts` |
| Prayers and spells (content) | `packages/content/src/prayers/`, `packages/content/src/spells/` |
| Item database (OSRS items, generated + curated) | `packages/content/src/items/osrs/`, fetch script in `tools/items/` |
| Inventory and equipment rules (equip, unequip, eat, drink, ammo) | `packages/engine/src/player/inventory.ts`, effects in `packages/engine/src/combat/consumables.ts` |
| Setups page and loadout editor | `packages/app/src/routes/LoadoutsPage.tsx`, `packages/app/src/ui/loadout/` |
| Saved setups (kinds, schemas, migrations, export and import, store interface) | `packages/storage/src/configs/`, content checks in `packages/app/src/services/configs.ts` |
| Boss framework (phases, patterns, specials, enrage, hazards) | `packages/engine/src/npc/`, schema in `packages/engine/src/defs/behaviour.ts` |
| NPC movement (chasing) | `packages/engine/src/ai/` |
| Combat analytics (statistics, event explanations) | `packages/engine/src/analytics/`, UI in `packages/app/src/ui/analytics/` |
| Boss selection screen | `packages/app/src/routes/EncountersPage.tsx`, facts from `packages/app/src/utils/boss-info.ts` |
| Combat event processing (attacks, hits, damage) | `packages/engine/src/systems/combat-events.ts` |
| Death and respawn, hitpoint regeneration | `packages/engine/src/systems/lifecycle.ts` |
| Visual definitions | `packages/assets/src/manifest.ts` |
| Persistence | `packages/storage/src/` |
| Fight history, replay rebuild, playback cursor | `packages/engine/src/replay/`, rewind in `packages/engine/src/runtime/runner.ts` |
| Replays page and viewer | `packages/app/src/routes/ReplaysPage.tsx`, `ReplayPage.tsx`; host modes in `packages/app/src/host/simulation-host.ts` |
| Tests | `packages/*/test/`, browser tests in `packages/app/e2e/` |

## Documentation

- [docs/architecture.md](docs/architecture.md): the full design, and how the systems communicate.
- [docs/simulation-engine.md](docs/simulation-engine.md): ticks, the runner, determinism, combat events, death and respawn.
- [docs/combat-formulas.md](docs/combat-formulas.md): every combat formula, its source, and documented uncertainties.
- [docs/content-system.md](docs/content-system.md): content packs, adding bosses and items, saved setups and the cloud storage plan.
- [docs/audit-report.md](docs/audit-report.md): the latest technical and functional audit: what was tested, fixed, and what remains.
- [docs/item-database.md](docs/item-database.md): verified OSRS item data, where it comes from, and how to add items.
- [docs/tick-order.md](docs/tick-order.md): what happens, in order, on every game tick.
- [docs/adding-a-boss.md](docs/adding-a-boss.md): the boss framework, and a step-by-step guide for new bosses.
- [docs/writing-a-mechanic.md](docs/writing-a-mechanic.md): hooks, pipelines and the mechanic registry.
- [docs/replay-format.md](docs/replay-format.md): replays, the fight history, review mode, rewinding and the replay viewer.
- [docs/visual-style.md](docs/visual-style.md): the colour language, the 3D look and the interface.
- [docs/analytics.md](docs/analytics.md): combat statistics and the event log, and how each number is derived.
- [docs/adding-art.md](docs/adding-art.md): replacing placeholders with real models and animations.
- [docs/scim-feature-spec.md](docs/scim-feature-spec.md): research on the reference site.

## Content policy

All bosses, names and art are original. Do not add assets, models, names or
data from the Old School RuneScape game client. Record the source of any
third-party asset in `packages/assets/LICENSES.md`.
