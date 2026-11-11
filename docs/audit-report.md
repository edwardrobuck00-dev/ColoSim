# Technical and functional audit (engine 0.9.0)

Date: 2026-11-11. Scope: every system built so far. Each finding was checked
by running code (probes, new tests or the browser), not by reading alone.

## How the audit was done

| Area | Method |
|---|---|
| Combat calculations, bonuses, stats | Ran all seven built-in loadouts against a dummy and recomputed every max hit, attack roll and attack interval by hand from the OSRS Wiki formulas (table below). |
| Special attacks | Compared every implemented special with the wiki; the two doubtful ones (Abyssal dagger, Elder maul) were re-read from the wiki pages through its API. |
| Prayers, consumables | Reviewed multipliers, stacking, drain and every consumable formula against `docs/combat-formulas.md` sources. |
| Tick progression, movement, attack and projectile timing, boss mechanics, inventory, damage tracking, replays | New invariant fuzz test (`packages/content/test/fuzz.test.ts`): random inputs (attack, move, prayers, eat, drink, equip, unequip, specials, styles, run, swap) for 600 ticks, 2 seeds, every encounter and every loadout (14 cases). Every tick checks hitpoints, prayer, energy, levels, positions, equipment slots, two-handed rules, hit caps, rolls within max hit and projectile timing. At the end, analytics totals must equal the raw engine events and the fight must replay to identical state hashes. |
| Engine and renderer independence | Searched the engine for DOM, clock, `Math.random` and package imports; dependency-cruiser rules; checked the renderer imports only engine types. |
| Adding equipment and bosses | New test: an extra pack with a new item and a new boss leaves every existing definition unchanged and an existing fight identical hash for hash, tick for tick. Scaffolded a boss with `pnpm new:boss`, validated and typechecked it, then removed it. |
| Saving and loading, UI | Unit tests plus all browser tests, and a new browser test that plants outdated and corrupt records in IndexedDB. |
| Performance | Benchmarked ticks and history memory over 3000 ticks; measured frame times, long tasks and heap in headless Chromium during a fight. |

Hand-checked numbers (training dummy, no boosts or prayers):

| Loadout | Max hit | Attack roll | Interval (ticks) |
|---|---|---|---|
| Whip, 99, Lash (controlled), +136 str | 34 | 21,924 | 4 |
| Dragon scimitar, 70, aggressive, +109 str | 22 | 13,884 | 4 |
| Armadyl godsword, 99, aggressive, +180 str | 42 | 24,503 | 6 |
| Magic shortbow, 70 Ranged, rapid, +49 ranged str | 14 | 16,848 | 3 |
| Armadyl crossbow, 99 Ranged, rapid, +130 ranged str | 32 | 29,746 | 5 |
| Trident of the seas, 75 Magic, +9.2% magic damage | 21 | 15,394 | 4 |
| Fire Wave, 75 Magic, +9.2% magic damage | 21 | 15,036 | 5 |

All matched the engine exactly.

## Problems found and fixed

| # | Problem | Fix | Test |
|---|---|---|---|
| 1 | **Standing under a boss made it harmless.** No attack can reach a target inside the attacker's footprint, and the chase step had no direction to move, so the Warden stood still forever. | A chasing NPC with the player under it steps out (the cardinal step that uncovers the player soonest). | `ashen-warden.test.ts` "steps out from over the player" (fails without the fix). |
| 2 | **No line of sight.** Ranged and magic attacks, the player's and the boss's, went through pillars and walls, so safespots and hiding did not exist. | `hasLineOfSight` (Bresenham between the nearest footprint tiles); used for all attacks beyond melee range, by player pathing and NPC chasing. | `line-of-sight.test.ts` (unit, a safespot against a caster, a ranged player stepping out to shoot). |
| 3 | Elder maul special had the wrong name ("Crushing Blow"; the wiki calls it "Pulverize"). Its numbers were already right. | Renamed. | Content tests. |
| 4 | Opening a replay recorded by another engine version crashed the replay page (only the content hash was checked). | Version checked too, with an explanation; the Replays list marks such replays instead of offering Watch. | `utils.test.ts` "replay compatibility". |
| 5 | A saved loadout using an item no longer in the game broke the fight page (the simulation threw during start-up). | The fight page explains what is wrong and links to the editor or the default loadout. | `robustness.spec.ts` (browser). |
| 6 | One unreadable saved loadout hid every saved loadout, and opening it left the fight page on "Loading loadout..." forever. | Records are read one at a time; an unreadable one is treated as missing. | `robustness.spec.ts`. |
| 7 | A corrupt saved record could crash the Setups page (its summary line read fields directly). | Summary says the data cannot be read; the row can still be deleted. | `robustness.spec.ts`. |
| 8 | Speeds outside the menu's options (presets and links allowed 0.25 to 8; the menu offers 0.25 to 4) were silently changed or left the speed menu blank. | One `snapSpeed` rule applied to settings, encounter presets and links. | `settings.test.ts` "speed values". |
| 9 | Timeline markers rescanned the whole fight history on every tick (work grew with fight length). | Incremental scan; starts over when a rewind replaces ticks. | `timeline-markers.test.ts`. |
| 10 | Every tick's snapshot copied the arena layout and the style list. | Shared, frozen copies. History memory for a 30-minute fight: 21.2 MB down to 16.5 MB. | Full suite (shared objects are frozen, so accidental mutation would throw). |
| 11 | The fight page re-validated the loadout (a whole simulation build) on every render, i.e. every tick, after fix 5. | Memoised per loadout. | Browser tests. |
| 12 | Stale documentation: the attack command still said damage was not implemented; the formula docs listed ammunition as not modelled. | Corrected. | n/a |

Fixes 1 and 2 change fight outcomes, so `ENGINE_VERSION` is now 0.9.0.
Replays recorded before this cannot be rebuilt; the app now says so (fix 4).

## 1. Completed functionality (implemented and tested)

- **Tick engine:** 600 ms ticks, a fixed pipeline order, seeded RNG streams, state hashes, determinism (same seed and inputs give the same hashes).
- **Combat:** accuracy, max hit and effective levels for melee, ranged and magic; stances; 17 weapon categories; NPC attack and defence rolls; hit delays; the 200 damage cap; 11 special attacks (whip, dragon scimitar, dagger, longsword, mace, warhammer, Armadyl and Bandos godswords, abyssal dagger, elder maul, Armadyl crossbow).
- **Prayers:** the full combat prayer book with conflicts, drain and resistance, protection prayers, Redemption, Preserve and Rapid Heal/Restore.
- **Player:** levels, boosts and drains with decay, hitpoint regeneration, run energy, special energy regeneration.
- **Equipment and inventory:** 160 wiki-verified items; equip, unequip, two-handed rules, ammunition types, tiers and use, Ava's devices; food, combo food and potions with their timers and attack delays.
- **Movement:** pathfinding, walking and running, chasing NPCs, line of sight (new), stepping out from under the player (new).
- **Boss framework:** phases, attack patterns, close-range attacks, specials (volleys, telegraphed tile attacks, lingering fire), enrage, invulnerability, modifiers and encounter rules; the three-phase Ashen Warden.
- **Analytics:** totals, DPS, accuracy, prayer, food, potions, specials, phases and deaths, all derived from engine events (now cross-checked by the fuzz test).
- **History and replays:** pause, step, step back, review, rewind and continue, replays that rebuild and verify, import and export.
- **Saved setups:** loadouts and their parts, encounter presets, duplicate, rename, delete, export and import, migrations, IndexedDB with a memory fallback.
- **Content system:** packs with provenance and clash detection, boss scaffolding, item tags, notes and search.
- **Interface:** OSRS-style side panel with remappable F-keys, orbs, chatbox, minimap, hover text and click crosses, boss selection, Setups page, loadout editor, replay pages, settings.

Test totals: 349 unit and integration tests (47 files) and 28 browser tests, all passing; typecheck, lint and dependency rules clean.

## 2. Outstanding functionality

- **Special attacks not modelled** for Dragon claws, Dragon halberd, Dragon battleaxe, Dragon spear, Zamorakian hasta, Abyssal bludgeon, Saradomin sword, Abyssal tentacle, Dragon crossbow, Magic shortbow (each says so in the editor).
- **Set effects and passives:** Void, Torva, Masori, Virtus, Justiciar, Inquisitor's, Crystal, Karil's, Amulet of blood fury, Dragon hunter crossbow, Twisted buckler, spirit shields, charges and degradation.
- **Poison, venom, enchanted bolts, elemental weaknesses, NPC prayers.**
- **Encounters:** one boss and a training yard. The Colosseum-style wave gauntlet named as the goal is not started.
- **Cloud storage:** designed (`docs/content-system.md`), not built.
- **Art:** all models are original placeholders built from primitives.

## 3. Known inaccuracies

Full list with sources: `docs/combat-formulas.md` (U1 to U14) and `docs/item-database.md` (I1 to I10). The ones most likely to matter:

- U1: an accurate hit can roll 0 (sources disagree on a minimum of 1).
- U2: powered-staff accurate stance gives +2 Magic (sources disagree: +2 or +3).
- U4: protection prayers are checked when an NPC hit lands. That is what lets you switch prayers while a projectile flies; not confirmed by the pages consulted.
- U8: projectile hit-delay formulas are the widely used ones, not quoted from the wiki.
- U13: line of sight is a Bresenham approximation; the game's projectile clipping and wall types are not reproduced.
- U14: the NPC step-out direction rule is an approximation.
- Quest and non-combat requirements are not modelled.

## 4. Remaining bugs

No reproducible bugs remain from this audit. Two observations:

- Early in development, one run of the visual-consistency browser test failed once and could not be reproduced (it has passed in every run since: more than 18 earlier runs plus both full runs in this audit).
- Fight history grows without a limit (about 16.5 MB per 30 minutes of fighting). That is fine for boss fights, but a multi-hour session would keep growing. See next steps.

## 5. Performance

| Measure | Result |
|---|---|
| Engine tick (training yard / Ashen Warden) | 0.11 / 0.22 ms per tick (budget 600 ms) |
| Snapshot | about 3.4 KB as JSON |
| History memory, 3000 ticks | 21.2 MB before, 16.5 MB after fix 10 |
| Browser frame time (headless software GL, 4x speed) | median 33 ms, 95th percentile 50 ms, no long tasks, heap +1.9 MB over 20 s, no console errors |
| Timeline markers | from a full-history scan per tick to only the new ticks |

## 6. Recommended next steps

1. **The Colosseum-style wave gauntlet** on the existing framework: several waves of original NPCs with handicap choices between waves. This is the main goal not yet started; the pack system and scaffold make it mostly content work.
2. **Multi-NPC fights:** several attackers at once, NPC-to-NPC collision and hit-priority rules. Waves need these.
3. **Model the popular unmodelled specials and set effects** (Dragon claws, Masori, Torva, blood fury), each with a wiki-checked test like the existing ones.
4. **Bound the history:** keep full snapshots every N ticks and events in between, rebuilding a viewed tick from the nearest snapshot (the replay rebuild already does this). That would cut memory roughly by N.
5. **Settle the uncertainties U1, U2, U4 and U8** with in-game measurements or wiki edits, and add the answers as tests.
6. **Cloud storage:** implement `RemoteConfigStore` and a sync store behind the existing `ConfigStore` interface.
7. **Add an in-browser performance budget test** (frame time and heap over a long fight) to the browser suite, so regressions are caught.
