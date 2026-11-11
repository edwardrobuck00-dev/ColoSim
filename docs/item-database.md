# Item database

All items are real Old School RuneScape items with **verified data**. No
equipment stat in this project is typed by hand.

## Where the data comes from

| Data | Source | How |
|---|---|---|
| Attack/defence bonuses, strength, ranged strength, magic damage, prayer, slot, attack speed, attack range, combat style (weapon category), weight, item IDs | OSRS Wiki structured data (`infobox_bonuses`, `infobox_item` Bucket tables) | `pnpm items:fetch` (tools/items/fetch-osrs-items.ts) |
| Page revision for every item | OSRS Wiki API | stored per item in `wiki-data.generated.ts` |
| Spell levels and base max hits | Spell pages (`Fire Bolt` ... `Fire Surge`) | same script |
| Equip requirements | The item page's own text (quoted below) or the wiki's "Ammunition" table | curated in `catalogue/`, reviewed by hand |
| Special attacks | OSRS Wiki "Special attacks" + wiki DPS calculator (exact fractions) | curated in `catalogue/` |
| Food heals, potion effects, eat/drink timers | Item pages, "Food" (fast foods table), "Potions", "Temporary skill boost", "Saradomin brew", "Super restore", "Prayer potion", "Anglerfish" | curated in `catalogue/` as formula data |
| Ammo recovery | "Ava's accumulator" (72%), "Ava's assembler" (80%) | curated |
| Ammo limits | Weapon pages ("can fire arrows up to amethyst", "up to and including runite bolts", "... dragon bolts") | curated |

Wiki content is licensed CC BY-NC-SA 3.0. Each item keeps its wiki page and
revision in `source`, so every number can be traced. No images or models
from the game or the wiki are used.

## Files

| File | Role |
|---|---|
| `tools/items/item-names.ts` | Which items to fetch (exact wiki names) |
| `tools/items/fetch-osrs-items.ts` | Downloads data from the wiki API (uses curl, so proxies work) |
| `packages/content/src/items/osrs/wiki-data.generated.ts` | Generated, never edited by hand |
| `packages/content/src/items/osrs/catalogue/` | Curated fields per category (`melee-weapons.ts`, `ranged-weapons.ts`, `magic-weapons.ts`, `armour.ts`, `capes-jewellery.ts`, `ammunition.ts`, `food.ts`, `potions.ts`): requirements, specials, ammo rules, consumables, tags, notes |
| `packages/assets/src/appearance.ts` | Shape and colours of each item (3D model and icons); a test fails if an item has none |
| `packages/content/src/items/osrs/build.ts` | Merges the two into engine `ItemDef`s; fails loudly on missing data |

## Adding an item

1. Add the exact wiki item name to `tools/items/item-names.ts`.
2. Run `pnpm items:fetch`. The script prints `.` per item and lists problems.
3. Add an entry to the right file in `catalogue/`. Add `requirements` only from the item's wiki
   page text; list effects the simulator does not model in `notes`; the script's `requirementText` field shows candidate sentences.
4. Add its appearance in `packages/assets/src/appearance.ts`.
5. Run `pnpm test`. The content tests check every catalogue entry has wiki
   data and a revision, every item passes the engine schema, and every preset
   loadout meets its requirements.

The engine never needs changing: weapon categories, specials, ammo rules and
consumables are all data. A new weapon category (wiki combat style) needs an
entry in `engine/src/combat/weapon-categories.ts` and the mapping in `build.ts`.

## Requirements used (quoted from the wiki)

| Item | Requirement | Wiki text |
|---|---|---|
| Abyssal whip | 70 Attack | "requires an Attack level of 70 to wield" |
| Rune scimitar | 40 Attack | "requiring level 40 Attack to wield" |
| Dragon scimitar | 60 Attack | "wielded by players who have 60 Attack" |
| Dragon dagger | 60 Attack | "wielded by players with at least 60 Attack" |
| Dragon longsword | 60 Attack | "players who have at least 60 Attack" |
| Dragon mace | 60 Attack | "an Attack level of at least 60" |
| Dragon warhammer | 60 Strength | "requires 60 Strength to wield" |
| Armadyl / Bandos godsword | 75 Attack | "it requires level 75 Attack to wield" |
| Abyssal dagger | 70 Attack | "requires 70 Attack to wield" |
| Elder maul | 75 Attack, 75 Strength | "requires Attack and Strength levels of 75" |
| Ghrazi rapier | 80 Attack | "It requires level 80 Attack to wield" |
| Rune 2h sword | 40 Attack | "It requires 40 Attack to wield" |
| Magic shortbow | 50 Ranged | "requires level 50 Ranged in order to use" |
| Rune crossbow | 61 Ranged | "requires a Ranged level of 61" |
| Armadyl crossbow | 70 Ranged | "requires a Ranged level of 70" |
| Trident of the Seas | 75 Magic | "requiring 75 Magic to wield" |
| Staff of the dead | 75 Magic, 75 Attack | "requires 75 Magic and 75 Attack" |
| Ancient staff | 50 Attack, 50 Magic | "requires 50 Attack and 50 Magic" |
| Kodai wand | 80 Magic | "Requiring 80 Magic to wield" |
| Helm of neitiznot | 55 Defence | "requires a Defence level of 55" |
| Rune armour (helm, body, legs, kiteshield) | 40 Defence | "requires 40 Defence" |
| Archer / Farseer helm | 45 Defence | "Defence level of at least 45" |
| Armadyl armour | 70 Defence, 70 Ranged | "requires 70 Defence and Ranged" |
| Ancestral robes | 75 Magic, 65 Defence | "requires level 75 in Magic and 65 Defence" |
| Fighter torso | 40 Defence | "requires 40 Defence to equip" |
| Bandos chestplate, tassets | 65 Defence | "requires 65 Defence" |
| Black d'hide body | 70 Ranged, 40 Defence | "requires at least level 70 Ranged and 40 Defence" |
| Black d'hide chaps | 70 Ranged | "require level 70 Ranged" |
| Mystic robes | 40 Magic, 20 Defence | "require 40 Magic and 20 Defence" |
| Ahrim's robes | 70 Defence, 70 Magic | "a player must have 70 Defence and 70 Magic" |
| Dragon platelegs, defender, boots | 60 Defence | "requires level 60 Defence" |
| Spirit shield | 45 Defence, 55 Prayer | "requires 45 Defence and 55 Prayer" |
| Mage's book | 60 Magic | "requiring 60 Magic to wield" |
| Pegasian boots | 75 Ranged, 75 Defence | "require level 75 Ranged and Defence" |
| Primordial boots | 75 Strength, 75 Defence | "require level 75 Strength and Defence" |
| Infinity boots | 50 Magic, 25 Defence | "require 50 Magic and 25 Defence" |
| Ava's assembler | 70 Ranged | "requires level 70 Ranged to equip" |
| Amulet of torture, necklace of anguish | 75 Hitpoints | "requiring level 75 Hitpoints" |
| Occult necklace | 70 Magic | "requires 70 Magic to wear" |
| Arrows (adamant, rune, amethyst, dragon) | 30 / 40 / 50 / 60 Ranged | "Ammunition" table |
| Runite / dragon bolts | 61 / 64 Ranged | "They require a Ranged level of 61"; "require a Ranged level of 64" |

Items with no requirement stated on their page (Barrows gloves, regen
bracelet, mithril gloves, climbing boots, fire/infernal/obsidian capes, Ava's
accumulator, imbued Saradomin cape, amulets of glory/fury/strength/power,
the four rings) have none here. **Quest requirements are not modelled.**

## Expanded set (160 items)

The second batch added 70 items, each with requirements read from its
current wiki page (beta-page values were replaced: Inquisitor's mace needs
80 Attack, Nightmare staff 72 Magic and 50 Hitpoints) and `notes` for what is
not modelled:

| Group | Items |
|---|---|
| Melee weapons | Dragon spear, Zamorakian hasta, Dragon halberd, Dragon battleaxe, Leaf-bladed battleaxe, Dragon claws, Abyssal bludgeon, Saradomin sword, Rune longsword, Abyssal tentacle, Inquisitor's mace |
| Ranged weapons | Dragon crossbow, Magic longbow, Yew shortbow, Dragon hunter crossbow |
| Magic weapons | Master wand, Nightmare staff, Mystic fire staff |
| Armour sets | Torva, Masori, Virtus, Justiciar, Crystal, Karil's, Inquisitor's |
| Other armour | Neitiznot faceguard, Dragon full helm, Berserker helm, Dragon platebody |
| Shields | Avernic defender, Dragonfire shield, Crystal shield, Arcane / Elysian spirit shield, Twisted buckler |
| Hands, feet | Ferocious gloves, Zaryte vambraces, Tormented bracelet, Combat bracelet, Guardian / Eternal / Bandos boots |
| Capes, jewellery | Mythical cape, Saradomin cape, Amulet of blood fury, Amulet of rancour, Ultor / Venator / Magus / Bellator rings |
| Ammunition | Adamant bolts |
| Food, potions | Dark crab, Sea turtle, Tuna potato, Super attack / strength / defence, Bastion, Battlemage |

New weapon categories (wiki Template:CombatStyles): `axe`, `spear`, `claw`,
`polearm`, `bludgeon`.

**Not modelled** (listed in each item's notes and shown in the editor): the
specials of the new weapons, set effects (Torva, Masori, Virtus, Justiciar,
Inquisitor's, Crystal with the bowfa, Karil's), passive effects (Amulet of
blood fury, Dragon hunter crossbow, Leaf-bladed battleaxe, Twisted buckler,
Elysian / Arcane spirit shield), charges, and non-combat requirements
(Slayer levels, quests). The items' bonuses are always exact.

## Uncertainties and simplifications

| # | Topic | Choice |
|---|---|---|
| I1 | Eating while the attack timer is running: is the delay added, or does it set a minimum? | Added: `nextAttack = max(nextAttack, now) + delay`. The wiki says food "will delay your next attack by 3 ticks". |
| I2 | Ava's accumulator: 8% of ammo drops to the floor | Treated as lost (no picking up). |
| I3 | Empty potions | Removed from the inventory (the game leaves a vial unless configured otherwise). |
| I4 | Ava's accumulator / imbued Saradomin cape requirements | Their pages describe how to obtain them, not an equip requirement, so none is applied. |
| I5 | Bandos godsword drain order | The wiki order is Defence, Strength, Prayer, Attack, Magic, Ranged; NPCs here have no Prayer level, so it is skipped. |
| I6 | Magic shortbow special | Not included: it rolls against magic defence and ignores prayers, which the special attack model cannot express yet. |
| I7 | Armadyl crossbow special | Double accuracy only; enchanted bolt effects are not modelled. |
| I8 | Charges and degradation (trident, Ahrim's, glory) | Not modelled; items behave as fully charged and undamaged. |
| I9 | Level decay timer | One fixed 100-tick cycle from the start of the fight for combat levels (the game runs a background cycle; its phase at fight start is unknown). |
| I10 | Weapon style memory | On a weapon switch the style index is kept if the new weapon has it; the game remembers styles per weapon category. |
