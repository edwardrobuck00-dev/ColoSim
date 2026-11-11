# Content system and saved setups

This guide covers two things that let the project grow without architectural
changes: **content packs** (how bosses, items and arenas are added) and the
**configuration library** (how players' saved setups are stored, and how a
cloud backend can be added later).

## Content packs

All game content is a list of packs, merged and validated at startup.

```
packages/content/src/
  packs/
    types.ts        ContentPack: id, name, version, requires, items, prayers,
                    spells, arenas, encounters, loadouts
    merge.ts        mergePacks(): combines packs, records provenance, finds clashes
    osrs-base.ts    The OSRS item database, prayers, spells, built-in loadouts
    index.ts        CONTENT_PACKS: the list the game loads
  encounters/
    training-grounds/   one pack: arena, dummy NPC, modifier, encounter
    ashen-warden/       one pack: arena, boss NPC, attacks, modifiers, mechanic
  search.ts         searchItems() and itemClass() for pickers and filters
```

| Function | Purpose |
|---|---|
| `getContentRegistry()` | The validated registry the engine and app use (cached) |
| `getContentPacks()` | Per-pack summaries and provenance (`"item:abyssal-whip"` maps to `"osrs-base"`) |
| `buildFromPacks(packs)` | Merge and validate any list of packs; used by tests and tools |
| `mergePacks(packs)` | The merge step on its own, returning issues rather than throwing |

What the merge checks, on top of every per-definition check in
`registry.ts` (schemas, cross references, phase order, spawns):

- An ID defined by two packs (reports both pack names).
- A pack listed twice, or a pack ID that is not kebab-case.
- A pack that `requires` a pack that is not loaded.

All problems are collected and reported together by `pnpm validate-content`,
which also prints what each pack contributes:

```
osrs-base@1.0.0  OSRS items, prayers and spells: 160 items, 29 prayers, 4 spells, 7 loadouts
training-grounds@1.0.0  Training grounds: 1 arena, 1 encounter, 1 npc, 1 modifier
ashen-warden@1.0.0  The Ashen Warden: 1 arena, 1 encounter, 1 npc, 3 attacks, 3 modifiers, 1 mechanic
```

### Adding a boss

```bash
pnpm new:boss frost-sentinel "Frost Sentinel"
```

This creates `packages/content/src/encounters/frost-sentinel/` with a working
two-phase boss (arena, NPC with behaviour, a melee and a magic attack, a
telegraphed special, a modifier, the encounter and its pack) and adds the pack
to `CONTENT_PACKS`. It is playable immediately and appears on the boss
selection screen. The template reuses existing visuals; add your own in
`packages/assets/src/manifest.ts`. Then follow
[adding-a-boss.md](adding-a-boss.md) to design the fight. Nothing outside the
new folder, the pack list and (optionally) the asset manifest changes. The
engine, renderer and app have no boss-specific code.

### Adding items

Items come from the OSRS Wiki (see [item-database.md](item-database.md)):
add the wiki name to `tools/items/item-names.ts`, run `pnpm items:fetch`, and
add a curated entry to the right file under `items/osrs/catalogue/`
(`melee-weapons.ts`, `ranged-weapons.ts`, `magic-weapons.ts`, `armour.ts`,
`capes-jewellery.ts`, `ammunition.ts`, `food.ts`, `potions.ts`). Then add the
item's shape and colours to `packages/assets/src/appearance.ts`; a test fails
if any item is missing one.

Every item gets tags automatically (`slot:head`, `category:claw`, `melee`,
`food`, `ammo:bolt`, `tier:dragon`) plus any curated ones (`set:torva`). Items
also carry `notes`: effects the simulator does not model, such as set bonuses
or unmodelled specials. The loadout editor shows notes under the worn item and
in item tooltips, and its search matches tags (type `set:torva`).

A separate item pack (for example a future "raids gear" pack) works the same
way: export a `ContentPack` with `items` and list it.

### Scale

The design keeps cost flat as content grows:

- **Data, not code.** Bosses, attacks, specials, phases, modifiers, items,
  consumables and weapon categories are schema-validated data. The engine
  only grows when a genuinely new kind of rule is needed (a new mechanic or
  special kind), and those register through registries in a pack.
- **Global IDs, checked once.** Clashes are caught at startup with the names
  of both packs, so packs can be written independently.
- **Startup cost.** Validation is linear in the amount of content and takes
  milliseconds for the current set; it runs once and is cached. If packs grow
  into thousands of items, `CONTENT_PACKS` can be split so only the base pack
  loads up front and boss packs are imported on demand; packs are already
  self-contained, so that change is local to `packs/index.ts` and the loader.
- **Content hash.** The registry hash covers every definition, so replays and
  saved setups can tell when content changed under them.

## Configuration library (saved setups)

Players save complete loadouts and the parts they are made of, plus encounter
presets. Everything is in `packages/storage/src/configs/`.

| Kind | Data | Saved from |
|---|---|---|
| `loadout` | Stats, equipment, inventory, style, spell, start prayers, quick prayers | Loadout editor |
| `equipment` | Worn items, combat style, autocast spell | "Save equipment..." in the editor |
| `stats` | The seven combat levels | "Save stats..." |
| `inventory` | 28 inventory slots | "Save inventory..." |
| `prayers` | Prayers on at the start, quick prayers | "Save prayers..." |
| `encounter` | Boss, modifiers, loadout, seed (random or fixed), speed, auto retaliate | "Save as preset" on the boss screen |

The **Setups** page (`/loadouts`) lists each kind on its own tab, with load
(Try, Start, Edit), rename, duplicate, delete, export (one, selected or all)
and import. In the editor, each section's "Load saved ..." menu mixes a saved
part into the loadout being edited.

### Records

```ts
interface ConfigRecord {
  id: string; kind: ConfigKind; name: string; notes: string;
  data: unknown;            // validated by the kind's zod schema
  schemaVersion: number;    // per kind; older data is migrated on read and import
  createdAt: number; updatedAt: number;
  revision: number;         // bumped on every update
  origin: "local" | "cloud";
}
```

Each kind has a schema, a current schema version and a migrations map
(`kinds.ts`). Data from an older version is migrated forward when it is read
or imported; data from a newer version is refused with a clear reason, never
guessed at.

Saved data is also checked against the current content (`app/src/services/configs.ts`):
unknown items, prayers, spells, bosses or modifiers are rejected, and
loadouts must start a valid simulation.

### Export format

```json
{ "format": "osrs-combat-sim/configs", "version": 1, "exportedAt": "...",
  "configs": [{ "kind": "stats", "name": "Maxed", "notes": "", "schemaVersion": 1, "data": { } }] }
```

Import validates every entry on its own. Valid entries are imported (names
that clash get " (imported)"), and the report lists each skipped entry with
its reason. IDs are not exported, so importing never overwrites anything.

### Local storage now, cloud later

`ConfigLibrary` talks to a `ConfigStore` interface (`list`, `get`, `put`,
`delete`). Today the app uses `IndexedDbConfigStore` (Dexie, database version
2, which migrated the old `loadouts` table into `configs`), with
`MemoryConfigStore` as a fallback when IndexedDB is unavailable and for tests.

A cloud backend is one more implementation of that interface:

1. `RemoteConfigStore` calls an HTTP API with the same four operations, and
   marks records `origin: "cloud"`.
2. A `SyncedConfigStore` wraps the local and remote stores: reads come from
   IndexedDB (works offline), writes go to both, and a background sync
   compares `revision` and `updatedAt` to resolve conflicts (newest revision
   wins; on a true conflict keep both, renaming one).
3. The server validates with the same zod schemas from `@sim/storage`, so
   client and server agree on what a valid setup is, and uses the same
   migrations for old clients' data.

The app, editor and Setups page do not change: they only use `ConfigLibrary`.
