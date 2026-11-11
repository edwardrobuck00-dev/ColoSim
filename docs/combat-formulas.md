# Combat formulas

How the engine calculates combat, where each formula comes from, and where
the sources disagree or the mechanic is not known exactly.

All formulas live in `packages/engine/src/combat/`, one concern per file, and
are tested independently in `packages/engine/test/formulas/`.

## Sources

Retrieved 9 November 2026.

| Ref | Source |
|---|---|
| W-MMH | OSRS Wiki, [Maximum melee hit](https://oldschool.runescape.wiki/w/Maximum_melee_hit) |
| W-MRH | OSRS Wiki, [Maximum ranged hit](https://oldschool.runescape.wiki/w/Maximum_ranged_hit) |
| W-MGH | OSRS Wiki, [Maximum magic hit](https://oldschool.runescape.wiki/w/Maximum_magic_hit) |
| W-DPS | OSRS Wiki, [Damage per second/Melee](https://oldschool.runescape.wiki/w/Damage_per_second/Melee), [/Ranged](https://oldschool.runescape.wiki/w/Damage_per_second/Ranged), [/Magic](https://oldschool.runescape.wiki/w/Damage_per_second/Magic) |
| W-CO | OSRS Wiki, [Combat Options](https://oldschool.runescape.wiki/w/Combat_Options) |
| W-CAT | OSRS Wiki, [Weapons/Categories](https://oldschool.runescape.wiki/w/Weapons/Categories) (Module:CombatStyles) |
| W-AS | OSRS Wiki, [Attack speed](https://oldschool.runescape.wiki/w/Attack_speed) |
| W-PR | OSRS Wiki, [Prayer](https://oldschool.runescape.wiki/w/Prayer) |
| W-SA | OSRS Wiki, [Special attacks](https://oldschool.runescape.wiki/w/Special_attacks) |
| CALC | The OSRS Wiki DPS calculator, [weirdgloop/osrs-dps-calc](https://github.com/weirdgloop/osrs-dps-calc) (`PlayerVsNPCCalc.ts`, `NPCVsPlayerCalc.ts`, `BaseCalc.ts`, `enums/Prayer.ts`, `scaling/DefenceReduction.ts`). Used only to cross-check formulas and rounding order. It is GPL-3.0 licensed; no code was copied. |

Where W-DPS and CALC disagree, CALC wins: it is the wiki's maintained
implementation and is newer than some prose pages. Every such case is listed
under [Uncertainties](#uncertainties).

## Rounding

OSRS multiplies by integer fractions and truncates after every step.
Multipliers are stored as `[numerator, denominator]` (Piety-tier strength is
`[123, 100]`, not `1.23`), and `applyFactor(v, f) = trunc(v * num / den)`.
(`combat/factors.ts`)

## Effective levels (`combat/effective-level.ts`)

```
effective = floor( ( floor((level + boost) * prayer) + stance + base ) * setBonus )
```

- `base` is 8 for melee and ranged (accuracy and strength) and for Defence;
  9 for player magic accuracy (W-DPS Magic, CALC).
- `setBonus` is the void multiplier: x11/10 melee and ranged, x29/20 magic
  accuracy (CALC). No void items exist in this game's content yet.
- Potion boosts: `floor(level * percent / 100) + flat`, e.g. Strength
  potion 10% + 3 (W-MMH table). Helper: `percentBoost`.
- The 5% Strength prayer always adds at least 1 (W-MMH note; CALC applies it
  at levels <= 20). Prayer data: `minimumStrengthGain: 1`.

## Combat styles (`combat/stances.ts`, `combat/weapon-categories.ts`)

| Class | Stance | Invisible bonus |
|---|---|---|
| Melee | Accurate | +3 Attack |
| Melee | Aggressive | +3 Strength |
| Melee | Defensive | +3 Defence |
| Melee | Controlled | +1 Attack, Strength, Defence |
| Ranged | Accurate | +3 Ranged (accuracy and damage) |
| Ranged | Rapid | attack speed -1 tick |
| Ranged | Longrange | +3 Defence, range +2 (max 10) |
| Magic (powered staff) | Accurate | +2 Magic accuracy (U2) |
| Magic (powered staff) | Longrange | +3 Defence, range +2 |
| Magic (autocast) | any | none |

Weapon categories and their style lists (attack type + stance) follow W-CAT:
unarmed, slash sword, stab sword, 2h sword, blunt, bow, crossbow, staff,
powered staff.

## Accuracy (`combat/accuracy.ts`)

| Roll | Formula | Source |
|---|---|---|
| Player attack roll | `effective * (equipment bonus + 64)`, then gear factors | W-DPS step four |
| NPC defence roll | `(defence + 9) * (style defence bonus + 64)`; against magic, most NPCs use their Magic level | W-DPS step six, CALC |
| NPC attack roll | `(attacking level + 9) * (attack bonus + 64)` | CALC |
| Player defence roll | `(8 + effective defence + stance) * (bonus + 64)` | W-DPS step five, CALC |
| Player defence vs magic | effective level = `floor(magic * 7/10) + floor(defence * 3/10)` (each after its prayer) | CALC |

**Hit chance**: both sides roll uniformly in `[0, roll]`; the attack hits if
the attacker's roll is strictly greater (W-DPS "final remarks"). The engine
performs exactly these two rolls (`rollAccuracy`). In closed form:

```
A > D:  1 - (D + 2) / (2(A + 1))
else:   A / (2(D + 1))
```

The tests check the closed form against a brute-force count of all roll
pairs, and check `rollAccuracy` against both.

## Max hit (`combat/max-hit.ts`)

| | Formula | Source |
|---|---|---|
| Melee | `floor((effStr * (strength bonus + 64) + 320) / 640)` | W-MMH step two |
| Ranged | same, with ranged strength | W-MRH step two |
| Magic | `base + floor(base * damageBonus / 1000)` (bonus in tenths of %: equipment magic damage + prayer +1/+2/+3/+4%) | W-MGH, CALC |
| NPC (from stats) | `floor(((9 + level) * (bonus + 64) + 320) / 640)` | CALC |
| Special / gear bonus | each factor applied in order, truncating after each | W-MMH step three, CALC |
| Player damage cap | every player hit is capped at 200 | W-MMH |

Worked example from W-MMH, reproduced in the tests: the free-to-play max hit
is **31** (rune 2h sword +70, amulet of strength +10, decorative boots (gold)
+1, strength potion, Ultimate Strength, aggressive, 99 Strength):
`floor(111 * 1.15) = 127; +3 +8 = 138; floor((138 * 145 + 320) / 640) = 31`.

## Damage roll (`combat/damage.ts`)

Accurate attacks roll damage uniformly in `[min, max]` (min is 0 except for
special effects). Inaccurate attacks deal 0. See U1.

## Prayers (`combat/prayer.ts`, `player/prayers.ts`, content `prayers/`)

The prayer book uses the real OSRS prayer names, levels, requirements,
multipliers and drain effects, from W-PR and the individual prayer pages
(cross-checked against CALC's prayer data). Only the strongest multiplier of
each kind applies, except Defence (below). Protect Item, Retribution and Smite
are not included (no item loss, no PvP).

| Prayer (level) | Attack | Strength | Defence | Ranged acc/str | Magic acc / dmg | Drain |
|---|---|---|---|---|---|---|
| Thick Skin (1), Burst of Strength (4), Clarity of Thought (7) | 105 | 105 | 105 | | | 1 each |
| Rock Skin (10), Superhuman Strength (13), Improved Reflexes (16) | 110 | 110 | 110 | | | 6 each |
| Steel Skin (28), Ultimate Strength (31), Incredible Reflexes (34) | 115 | 115 | 115 | | | 12 each |
| Sharp Eye (8), Mystic Will (9) | | | | 105/105 | 105 | 1 |
| Hawk Eye (26), Mystic Lore (27) | | | | 110/110 | 110 / +1% | 6 |
| Eagle Eye (44), Mystic Might (45) | | | | 115/115 | 115 / +2% | 12 |
| Deadeye (62), Mystic Vigour (63) | | | 105 | 118/118 | 118 (+118 magic def) / +3% | 12 |
| Chivalry (60, 65 Defence) | 115 | 118 | 120 | | | 12 (reduced from 24 in a game update) |
| Piety (70, 70 Defence) | 120 | 123 | 125 | | | 24 |
| Rigour (74, 70 Defence) | | | 125 | 120/123 | | 24 |
| Augury (77, 70 Defence) | | | 125 | | 125 (+125 magic def) / +4% | 24 |
| Zeal (84, 75 Attack and 75 Strength) | 125 | 128 | 125 | | | 24 |
| Protect from Magic (37) / Missiles (40) / Melee (43) | block 100% of NPC damage of that style (40% vs players) | | | | | 12 each |

Burst of Strength always adds at least 1 Strength (`minimumStrengthGain`).
The tier rows for Deadeye and Mystic Vigour, and Zeal, are newer prayers;
their values were taken from their wiki pages and CALC.

**Conflicts** (W-PR conflict table, resolves U7): each prayer belongs to
groups and switching one on switches off every active prayer that shares a
group. Defence prayers: `defence`. Strength prayers: `strength`. Attack
prayers: `attack`. Ranged and magic prayers: `strength`, `attack`,
`ranged-magic`. Chivalry, Piety, Rigour, Augury, Zeal: all four. Overheads
(protection prayers and Redemption): `overhead`. Rapid Restore, Rapid Heal
and Preserve: none. So a strength and an attack prayer stack, a defence
prayer stacks with Deadeye, and Piety replaces all of them.

**Defence bonuses add.** Deadeye's and Mystic Vigour's +5% Defence adds to a
defence prayer (Steel Skin + Deadeye = +20%), per their wiki pages:
`combinedDefenceFactor` sums `(factor - 100%)` across active prayers.

**Requirements** are checked against base levels when a prayer is switched
on. Lowering Prayer or another required level switches off prayers that are
no longer allowed.

**Drain** (W-PR): each tick, add the active prayers' drain effects to a
counter; while the counter *exceeds* `60 + 2 x prayer bonus`, lose a point
and subtract that amount. At 0 points all prayers switch off. Example from
W-PR: +15 prayer bonus gives resistance 90. Because the test is "exceeds",
Piety for 100 ticks costs 39 points at +0 (2400 drain, resistance 60) and 19
at +30 (resistance 120), not exactly half.

**Switching on ticks.** A toggle is a command, applied at the start of the
next tick before attacks are rolled. A prayer switched on is used by the
attack made that tick; one switched off is not. Turning a prayer on and off in
the same tick costs no points (flicking), because drain is counted at the end
of the tick. Protection prayers are checked when a hit lands (U4).

**Utility prayers.**

| Prayer | Rule (OSRS Wiki page of that name) | Implementation |
|---|---|---|
| Rapid Restore (19) | Restores drained combat stats twice as fast. Its timer starts on activation. | A separate 100-tick timer from activation that restores drained (not boosted) levels by 1; the normal 100-tick restore still runs. |
| Rapid Heal (22) | Doubles hitpoint regeneration; toggling it resets the regeneration timer. | The player's hitpoint timer interval is halved (100 to 50); toggling resets the timer. |
| Preserve (55) | Boosted stats last 50% longer: after it has been active for 15 s, the next boost decay is postponed by 30 s. | If Preserve has been active for at least 25 ticks when a decay is due, the decay happens 50 ticks later. Prayers active from the setup count as active since tick 0. |
| Redemption (49) | When a hit leaves you below 10% of max Hitpoints, heals 25% of your Prayer level and drains all prayer points. | After a hit that leaves `hp * 10 < maxHp` (and hp above 0): heal `floor(Prayer level / 4)`, prayer points to 0, all prayers off. |

**Encounter prayer mechanics** (`mechanics/builtins/prayer-mechanics.ts`):
mechanics get a restricted prayer API (`drainPoints`, `deactivate`,
`lockOverheads`). Built in:

| Mechanic | Effect |
|---|---|
| `disable-protection-prayers` | Every N ticks, turns off overhead prayers and blocks them for M ticks. |
| `drain-prayer-on-hit` | Drains flat points plus a percentage of the damage when a hit lands (optionally only some styles, optionally even when the hit was blocked). |
| `scale-prayer-drain` | Multiplies the total drain effect through the `prayer.drainEffect` pipeline. |

These model the general shape of boss mechanics; they are not copies of any
specific boss. The Ashen Warden uses the first two as the Severed Faith and
Draining Embers modifiers.

## Attack speed and timing (`combat/timing.ts`)

- Weapon speed in ticks from the item; rapid -1 (W-CO). Spells take 5 ticks;
  powered staves 4 (W-AS).
- The cooldown is global: switching weapons does not reset it (W-AS); the
  engine keeps one `nextAttackTick` per entity.
- Hit delays: melee 0; ranged `1 + floor((3 + distance) / 6)`; magic
  `1 + floor((1 + distance) / 3)` (U8).

## Special attacks (`combat/special-attack.ts`, `defs/special-attack.ts`)

Energy 0 to 100%, regenerating 10% every 50 ticks (30 s) (W-SA). A special
is described by documented building blocks: energy cost, accuracy factor,
damage factors (applied in order), hit count, linked accuracy, defence style
and effects:

- `drain-defence-percent`: `level - trunc(level * p / 100)` on a damaging hit
  (CALC: dragon warhammer is `def - trunc(def * 3/10)`).
- `drain-levels-by-damage`: drain levels in order by the damage dealt; the
  remainder carries over only when a level reaches 0 (CALC: Bandos godsword).

Content specials (original weapons) use documented OSRS values:

| Content weapon | Special | Modelled on (W-SA, CALC) |
|---|---|---|
| Practice longsword | Rending Cut: 25%, damage x5/4 | Dragon longsword "Cleave" |
| Gilded dagger | Twin Strike: 25%, 2 hits, accuracy x23/20, damage x23/20 | Dragon dagger "Puncture" |
| Oaken maul | Shatter: 50%, damage x3/2, -30% Defence on hit | Dragon warhammer "Smash" |
| Runebreaker greatsword | Verdict: 50%, accuracy x2, damage x11/10 then x5/4 | Armadyl godsword "The Judgement" |

## Uncertainties

These are documented instead of guessed. Each names the choice made.

| # | Question | Sources | Choice |
|---|---|---|---|
| U1 | Can an accurate hit roll 0? | W-DPS's average-damage formula adds `1/(max+1)`, saying a 0 on an accurate hit becomes 1. W-MGH writes magic as `max(1, random(0, max))`. CALC models accurate hits as uniform `[0, max]` (no minimum). | Uniform `[0, max]`, following CALC. A minimum of 1 can be added per attack with `minHit` if verified. |
| U2 | Powered-staff "Accurate" bonus | W-CO says +3 Magic (and +1 on longrange). W-DPS Magic and CALC use +2 and no accuracy bonus on longrange. | +2, no longrange accuracy bonus (CALC, W-DPS). |
| U3 | Magic accuracy base constant | W-DPS Magic and CALC use +9; melee/ranged use +8. | +9 for player magic accuracy. |
| U4 | When is a protection prayer checked for NPC projectiles? | Not stated on the pages consulted. | Checked when the hit lands (allows switching while a projectile flies). Change in `applyDueHits` if verified otherwise. |
| U5 | NPC magic defence level | CALC uses Magic level, except a list of NPCs that use Defence. | Magic level for all NPCs. |
| U6 | Negative attack or defence rolls | Not covered by W-DPS. | CALC's handling (`hitChance`), with a probability roll instead of two uniform rolls. |
| U7 | Which prayers switch each other off | Resolved: W-PR's conflict table. | Encoded exactly as prayer groups (see Prayers). |
| U11 | Preserve timing details | W-Preserve gives the 15 s and 30 s figures but not how they interact with the global 100-tick restore. | Checked at each global decay tick; postponed decays happen once, 50 ticks later. |
| U12 | Redemption trigger order | The page says "when the player's Hitpoints fall below 10%"; the order relative to multiple hits in one tick is not stated. | Checked after each hit that does not kill. |
| U13 | Line of sight | The game clips projectiles with its own algorithm and has wall types that block movement but not projectiles. | Bresenham line between the nearest footprint tiles; any unwalkable tile blocks. Gives the expected safespots behind the pillars and solid walls the current arenas use; tile-for-tile agreement with the game's algorithm is not verified. |
| U14 | NPC stepping out from under the player | Documented in community guides; the exact direction rule is not on the pages consulted. | The cardinal step that uncovers the player soonest; random among ties. |
| U8 | Projectile hit delays | Widely used formulas; the wiki pages consulted do not state them. | As above. Per-attack overrides can be added for attacks known to differ. |
| U9 | Special attack energy timer | W-SA: 10% every 30 seconds; the timer resets on logout. | One continuous 50-tick timer per player, from the start of the fight. |
| U10 | NPC attack max hits | Many NPCs have fixed max hits (CALC notes this for magic). | Content attacks state `maxHit` explicitly; `npcMaxHit` is available for stat-based ones. |

## Consumables and levels

See `docs/item-database.md` for sources. In short: food heals up to max
(anglerfish and Saradomin brew can overheal by the amount healed); visible
boosts never exceed `base + amount` and do not stack; drains use the current
level; restores go up to base; boosted and drained levels move 1 toward base
every 100 ticks. Normal food has a 3-tick eat timer and adds 3 ticks to the
attack timer; karambwan-style combo food has its own timer and adds 2;
potions have a separate 3-tick timer and no attack delay. Formulas use
current levels, so potions and drains change accuracy and max hits.

## Not modelled yet

Void and other set effects, slayer and salve-style target bonuses, enchanted
bolt effects, weapon passives, elemental weaknesses, poison and venom, and
player-versus-player rules (beyond the 40% protection constant). Equipped
ammunition always adds its bonuses, even to a weapon that does not fire it;
this has no effect today because a ranged weapon refuses to attack with the
wrong ammunition and melee and magic ignore ranged bonuses.
