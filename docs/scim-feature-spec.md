# OSRS-Style Combat Simulator: Research Findings and Feature Specification

Reference site: https://scim.gg/
Research date: 2026-11-09

## 0. Read this first: what could and could not be verified

**I was not able to load scim.gg itself.** After its host was added to the
environment's allowed list, the site's own server (nginx behind Cloudflare)
answered every request from this cloud machine with `403 Forbidden`. That
included a plain HTTP request and a real headless Chromium browser. This looks
like a block on datacenter traffic. I did not try to get around it, and fetching
archived copies was refused as a workaround.

So **nothing in this document comes from seeing the site's interface.** Every
claim about scim.gg comes from the text that search engines have indexed for
its pages:

| Indexed page | URL |
|---|---|
| Home ("OSRS Combat Simulator") | https://scim.gg/ |
| Yama simulator | https://scim.gg/yama/ |
| Contract: Bloodied Blows | https://scim.gg/yama/bloodied-blows/ |
| Contract: Divine Severance | https://scim.gg/yama/divine-severance/ |
| Contract: Forfeit Breath | https://scim.gg/yama/forfeit-breath/ |
| Contract: Sensory Clouding | https://scim.gg/yama/sensory-clouding/ |
| Contract: Glyphic Attenuation | https://scim.gg/yama/glyphic-attenuation/ |
| Privacy Notice | https://scim.gg/privacy/ |
| Terms of Use | https://scim.gg/terms/ |

Search summaries can paraphrase or err, so even "verified" items below should
be rechecked against the live site.

### Labels used in this document

- **[V]** Verified: stated in the site's indexed text.
- **[I]** Inferred: strongly implied by verified text, but not stated directly.
- **[?]** Not verified: no evidence either way. Listed so it gets checked, not
  because it exists.
- **[P]** Proposed: a requirement for *our* project, based on how OSRS combat
  works. Not a claim about scim.gg.

### Topics from your list that I could not observe at all

Overall layout, the combat arena's look, how the player and NPCs are drawn,
the equipment and inventory panel design, combat controls and keybind
defaults, information panel contents, and animations and visual effects. For
each of these, the spec gives proposed requirements and a list of open
questions, not a description of scim.gg.

### How to close the gap

Any of these would let me fill in the [?] items accurately:

1. Screenshots or a screen recording of the site from your own browser
   (main page, Yama fight, equipment screen, settings, replay viewer).
2. A HAR file or saved page (`Ctrl+S`, "Webpage, complete") from your browser.
3. Running this research again from an environment the site does not block.

---

## 1. What the reference site is (verified summary)

- [V] A free, browser-based Old School RuneScape combat simulator for
  practising the game's hardest boss fights "with accurate mechanics and
  instant resets."
- [V] The only live boss is **Yama**: the base fight plus five "sigil
  contracts" (harder variants).
- [V] Unofficial fan project, not affiliated with Jagex. Terms took effect
  1 September 2026. No uptime or support commitment; features can be removed.
- [V] The terms describe it as "a model" of game mechanics, not an
  authoritative source on the live game.
- [V] Accounts are optional. Most data lives in the browser.

---

## 2. Major systems required

These are the systems a project with the verified feature set would need.
Each one points to its section in the spec.

| # | System | Why it is needed | Evidence |
|---|---|---|---|
| 1 | Tick-based simulation engine | OSRS combat runs on 0.6 s ticks; replays record per-tick state | [V] replays store "per-tick player input, simulation state, events and engine actions" |
| 2 | Deterministic input recording and replay | Replays need to reproduce a fight exactly | [V] replays exist; [I] determinism |
| 3 | Combat formula engine (accuracy, max hit, damage types) | Contracts change weaknesses and prayer behaviour | [V] crush weakness, prayer penetration |
| 4 | Prayer system (protection, drain, prayer bonus) | Several contracts change prayer rules | [V] |
| 5 | Run energy system | Forfeit Breath drains it and ends the fight at 0 | [V] |
| 6 | Boss AI plus per-boss mechanic scripts | Yama and its "challenger", voidflares, pursuit | [V] |
| 7 | Modifier ("contract") system | Five contracts stack rule changes on the base fight | [V] |
| 8 | Player stats and equipment model | Entered player stats and saved equipment | [V] |
| 9 | Inventory system with tags | Inventory tags are a stored preference | [V] |
| 10 | 3D or 2.5D renderer, camera, tiles | Camera keybinds and tile markers are stored | [V] camera keybinds, tile markers; [I] a rotatable camera |
| 11 | Input and keybind system | Keybinds and camera keybinds are stored | [V] |
| 12 | Game-asset cache | A "game cache" is kept in IndexedDB | [V] |
| 13 | UI panels with filters | "Panel filters" are stored | [V] |
| 14 | Tutorial system | "Tutorial progress" is stored | [V] |
| 15 | Settings persistence (local) | "Settings blob" in local storage | [V] |
| 16 | Accounts and cloud sync | Optional sign-in syncs preferences | [V] |
| 17 | Replay upload and sharing service | Share codes, retention rules | [V] |
| 18 | Damage history / combat log | Replays store "the damage history" | [V] |

---

## 3. Feature specification

### 3.1 Core functionality

**Verified behaviour of the reference**

- [V] Runs entirely in the browser.
- [V] Instant resets: a fight can be restarted immediately.
- [V] Per-boss pages (`/yama/`) and per-variant pages (`/yama/<contract>/`).
  [I] Each variant has a direct, shareable URL.
- [V] Local persistence in browser storage for: settings blob, keybinds, camera
  keybinds, tile markers, panel filters, tutorial progress, entered player
  stats, saved equipment, NPC highlights, inventory tags "and similar
  preferences."
- [V] Game cache stored separately in IndexedDB.
- [V] Clearing browser storage removes all local data.

**Proposed requirements for our build**

- [P] Fixed 600 ms game tick. Rendering runs at display frame rate and
  interpolates between tick states. Game logic never runs off the tick.
- [P] Seeded random number generator so any fight can be reproduced from
  (seed, configuration, input log).
- [P] Fight lifecycle: setup, countdown, fighting, win or loss, results, reset.
  Reset returns to a fresh fight with the same setup in under a second.
- [P] Pause, and tick step while paused (for learning). [?] Whether scim.gg
  has pause or slow-motion is unknown.
- [P] Route per boss and per variant, matching the reference's URL pattern.
- [P] Versioned save format, so stored settings survive app updates.

### 3.2 Combat simulation

**Verified behaviour of the reference**

- [V] Damage types matter: in Glyphic Attenuation, "Yama is weak to crush and
  nothing else." [I] Normally Yama has other weaknesses and the engine models
  per-style defence.
- [V] Prayer bonus slows prayer drain, except in Glyphic Attenuation where it
  "drains prayer faster instead of slower." [I] The engine models
  prayer-bonus-based drain.
- [V] Prayer penetration exists as a concept (some hits get through
  protection prayers). Sensory Clouding increases it; Divine Severance has
  none.
- [V] Run energy is modelled. Forfeit Breath drains it passively and when
  hit, and the player loses at 0.
- [V] Attack range is modelled. Sensory Clouding gives "50% reduced attack
  range."
- [V] "Infinite pursuit" (Sensory Clouding). [I] Something normally stops
  chasing, and this modifier removes that limit.
- [V] Engine records events, engine actions and damage history per tick.

**Proposed requirements**

- [P] OSRS-style accuracy roll: attack roll vs defence roll per style (stab,
  slash, crush, magic, ranged), using effective levels, equipment bonuses,
  stance bonuses and prayer multipliers.
- [P] Max hit formulas for melee, ranged and magic.
- [P] Weapon attack speed in ticks, attack range in tiles, attack delay, and
  projectile travel time (hit lands a set number of ticks after the attack).
- [P] Protection prayers that reduce or block matching NPC attacks, with a
  per-attack penetration value.
- [P] Prayer point drain based on active prayers and prayer bonus.
- [P] Run energy: drains when running, recovers when walking or standing,
  affected by weight and agility (scope to decide).
- [P] Eating and potion timing on ticks, including combo eating rules (scope
  to decide).
- [P] Tile-based movement and pathfinding; walk is 1 tile per tick, run is 2.
- [P] Line of sight and attack range checks.
- [P] Hitsplats and the damage log both driven by the same event stream.
- [P] Special attack energy and special attacks (scope to decide).
  [?] Unknown whether scim.gg models special attacks.

### 3.3 Player configuration

**Verified behaviour of the reference**

- [V] Player stats are entered by the user and saved.
- [V] Equipment is saved.
- [V] Inventory tags exist and are saved. [I] There is an inventory, and
  items can be labelled or colour-tagged.
- [V] Keybinds and camera keybinds are user-configurable and saved.

**Not verified**

- [?] How equipment is chosen (search box, item list, preset loadouts,
  import from a gear calculator or RuneLite).
- [?] Which items and slots are supported.
- [?] Whether stats can be looked up from the hiscores.
- [?] Inventory contents: food, potions, gear switches.
- [?] Whether loadouts can be saved under names or shared.

**Proposed requirements**

- [P] Stats editor: Attack, Strength, Defence, Ranged, Magic, Prayer,
  Hitpoints (plus boosted values from potions).
- [P] Equipment panel with the 11 OSRS slots, showing combined bonuses
  (attack, defence, strength, ranged strength, magic damage, prayer).
- [P] Item database: name, slot, bonuses, attack speed, range, weight,
  two-handed flag, special attack.
- [P] 28-slot inventory with drag-to-reorder, and colour tags.
- [P] Named loadout presets, saved locally.
- [P] Gear switching from the inventory during the fight, costing the
  correct ticks.

### 3.4 Boss and NPC systems

**Verified behaviour of the reference**

- [V] One boss today: Yama.
- [V] A second combatant called "the challenger" appears in the fight
  (Bloodied Blows: "both Yama and the challenger gain Wretched Strength").
- [V] Voidflares exist as a hazard or NPC type. They can explode ("lethal
  flare explosions" in Sensory Clouding).
- [V] NPC highlights are a user setting. [I] NPCs can be outlined or coloured
  for visibility.
- [V] Five contracts, each a set of modifiers, each tied to a sigil reward
  position:

| Contract | Modifiers (as indexed) | Sigil |
|---|---|---|
| Bloodied Blows | More and tougher voidflares; Yama and the challenger gain Wretched Strength | Middle |
| Divine Severance | Protection prayers deactivated on sight; no prayer penetration; continuous lethal voidflares | Right |
| Forfeit Breath | Run energy drained passively and on damage; lose at 0 run energy | Top (purifying) |
| Sensory Clouding | Increased prayer penetration; infinite pursuit; lethal flare explosions; 50% reduced attack range | Left |
| Glyphic Attenuation | Weak to crush only; prayer bonus drains prayer faster | Bottom |

**Not verified**

- [?] How the boss is picked (menu, landing page cards, or URLs only).
- [?] Whether contracts can be combined, or only one at a time.
- [?] Yama's phases, attack list, and timings as modelled.
- [?] Difficulty or speed settings beyond the contracts.

**Proposed requirements**

- [P] Data-driven boss definitions: stats, defence bonuses, size in tiles,
  attack list (style, max hit, speed, range, penetration), phase triggers.
- [P] Scripted mechanics per boss, run on ticks (spawns, area attacks, tile
  hazards, movement rules).
- [P] Modifier system: each contract is a list of rule overrides applied on
  top of the base fight (stat multipliers, prayer rule changes, extra
  spawns, loss conditions). Built so new modifiers need no engine changes.
- [P] Multiple NPCs in one fight (boss, ally or "challenger", adds).
- [P] Boss select screen listing bosses and their variants.

### 3.5 Visual interface

**Verified behaviour of the reference**

- [V] A camera that the user can control with keybinds. [I] A 3D or 2.5D
  scene with a movable camera.
- [V] Tile markers. [I] The arena is a tile grid and users can mark tiles.
- [V] Panels with filters. [I] At least one list-style panel (likely a log or
  event list) has filterable content.
- [V] A tutorial with tracked progress.
- [V] An in-browser game cache. [I] Uses real or derived game assets for
  models and textures.

**Not verified (could not see the site)**

- [?] Page layout and where panels sit.
- [?] Arena look, scale and lighting.
- [?] How the player and NPCs are drawn (3D models, sprites, shapes).
- [?] Hitsplats, health bars, overhead prayer icons, projectiles.
- [?] Tick indicator, timers, attack cooldown display.
- [?] Equipment, inventory, prayer and stats panel design.
- [?] Animations and visual effects.
- [?] Results screen after a fight.

**Proposed requirements**

- [P] Main view: arena canvas filling most of the screen.
- [P] Side panel with tabs: Combat, Stats, Inventory, Equipment, Prayer,
  Settings (familiar to OSRS players without copying its art).
- [P] Overlays: player HP, prayer, run energy, special attack orbs; boss
  health bar; tick counter and fight timer.
- [P] Entity feedback: hitsplats, health bars over heads, overhead prayer
  icon, projectiles with travel time, telegraphed hazard tiles.
- [P] Tile hover highlight, destination marker, and user tile markers.
- [P] Combat log panel with filters (damage dealt, taken, prayer, events).
- [P] Results summary: time, damage dealt and taken, prayer used, cause of
  death.

### 3.6 Advanced functionality

**Verified behaviour of the reference**

- [V] **Replays.** Store per-tick player input, simulation state, events and
  engine actions, and the damage history.
- [V] **Replay sharing.** Uploading returns a share code; anyone with the
  code can fetch the replay.
- [V] **Replay retention.** Anonymous replays are deleted after 30 days. Any
  replay unopened for 180 days is deleted. Deleting removes it from the
  database at once, though a cache may hold it for up to an hour.
- [V] **Optional accounts.** Sign-in syncs a defined set of preferences to
  the server for use on other devices. Passwords stored only as bcrypt
  hashes.
- [V] **Account deletion** removes the account record, cloud profile, sign-in
  sessions and the account's replays.

**Not verified**

- [?] Replay viewer controls (scrub, speed, step by tick).
- [?] Leaderboards, personal bests, or kill-time tracking.
- [?] Statistics across many attempts.
- [?] Mobile or touch support.
- [?] Sound.

**Proposed requirements**

- [P] Replays stored as (engine version, seed, configuration, input log), and
  re-simulated on playback. State snapshots every N ticks for fast seeking.
- [P] Replay viewer: play, pause, step one tick, speed control, seek.
- [P] Engine version stamped on every replay so old replays fail clearly
  instead of playing back wrong.
- [P] Backend (later phase): accounts, preference sync, replay upload with
  share codes and the retention rules above.
- [P] Personal bests per boss and variant, stored locally.

---

## 4. Points to decide before development

1. **Assets and game content.** The reference appears to load real game
   assets into IndexedDB and simulates a real OSRS boss. Shipping Jagex's
   models, textures, item names, or a faithful copy of the Yama encounter
   carries real legal and licensing risk, and it is also not something I
   will build as a straight recreation. My recommendation: build an
   original engine that uses OSRS-*style* mechanics (600 ms ticks, prayer
   switching, accuracy rolls) with original bosses, art and names. The
   systems in this spec all still apply.
2. **Scope of version 1.** Suggested: tick engine, one original boss with 2
   or 3 modifiers, stats and equipment, prayers, inventory with food,
   local saves, local replays. Accounts and cloud replays later.
3. **Rendering approach.** Three.js 3D with a rotating camera (closest to
   the inferred reference) vs a 2D top-down canvas (much faster to build).
4. **Accuracy target.** Which OSRS formulas to model exactly and which to
   simplify.
5. **Getting the missing observations.** Screenshots or a recording from
   your browser would let me fill in every [?] item above.

---

## Sources

- https://scim.gg/ (indexed text only)
- https://scim.gg/yama/
- https://scim.gg/yama/bloodied-blows/
- https://scim.gg/yama/divine-severance/
- https://scim.gg/yama/forfeit-breath/
- https://scim.gg/yama/sensory-clouding/
- https://scim.gg/yama/glyphic-attenuation/
- https://scim.gg/privacy/
- https://scim.gg/terms/
