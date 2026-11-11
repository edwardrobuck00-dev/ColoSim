# Combat analytics

Every statistic and log line comes from engine events and snapshots. Nothing
is estimated: totals can be reconciled exactly against the simulation
(see "Guarantees").

Open it in a fight with **L** (remappable) or the **Stats** button; after a
fight, **Full analytics** on the results screen. It has two tabs.

## Statistics

Built by `recordTick` in `packages/engine/src/analytics/stats.ts`, one tick at a time.

| Statistic | Source |
|---|---|
| Damage dealt / received, maximum hit | `HitLanded.amount` from or to the player |
| Successful / missed attacks, accuracy | `HitLanded.detail.accurate`: the engine's own accuracy roll. An accurate hit that rolls 0 counts as successful |
| Average hit | Damage dealt / hits landed (misses included); also the average of accurate hits |
| DPS | Damage dealt / seconds in combat (and over the whole fight) |
| Time in combat | Ticks within 10 ticks (6 s) of an attack started or a hit involving the player, while alive. This is the simulator's definition |
| Overkill | `detail.overkill`: damage beyond the target's remaining hitpoints |
| Blocked by prayer, damage prevented | `HitLanded.blockedByPrayer`; prevented = rolled - after prayer |
| Fire damage | Hits with `detail.hazard` (telegraphed tiles, burning ground) |
| Prayer activations, ticks active, uptime | `PrayerToggled` (with its cause) and the active prayers in each snapshot |
| Prayer points drained / restored | `PrayerDrained` (cause: prayers or a mechanic) and potion `ItemConsumed.changes` |
| Food and potions | `ItemConsumed` (kind, item, every level change, hitpoints healed) |
| Special attacks | `SpecialUsed`; energy spent from the snapshot; damage from hits with `detail.special` |
| Boss phases, enrage, specials, healing | `BossPhaseChanged`, `BossEnraged`, `BossSpecialUsed`, `NpcHealed`, `Regenerated` |
| Deaths and kills | `EntityDied` |

Most rows are links: clicking one opens the event log filtered to the events
behind it (your misses, hits on you, blocked hits, fire, prayer...).

## Event log

Every engine event of the fight, timestamped by tick (and game time), in
order. Filter by kind or preset, search by text, and select an event to see:

- **Why**: the engine's reasons. For a hit: which attack and why it was
  chosen (combat style and weapon, or the boss's pattern step, close-range
  rule, special), when it started and landed, attack roll vs defence roll and
  the hit chance, whether the accuracy roll succeeded, the damage rolled,
  what a protection prayer did, encounter modifiers, overkill. For a prayer
  switching off: you, a conflicting prayer, no points, a mechanic, death,
  Redemption or requirements. For a phase change: the hitpoints and the
  threshold. For a boss special: "every 6th attack in the Smouldering phase
  (attack 12)" or "opening attack of the Kindled phase".
- **Facts**: the numbers on the event.
- **Engine event**: the raw event.

Explanations come from `explainEvent` (`packages/engine/src/analytics/explain.ts`),
which only reads data carried on the event.

## Events added for analytics

- `HitLanded.detail`: attack ID, start tick, special flag, reason, attack and
  defence rolls, hit chance, accuracy result, rolled damage, protection
  prayer, damage after prayer and after modifiers, overkill, target hitpoints
  before, and for hazards the special's name and stage.
- `AttackStarted.reason`, `BossSpecialUsed.reason`, `PrayerToggled.cause`
  (+ `replacedBy`), `ItemConsumed.changes` and `attackDelayTicks`,
  `BossPhaseChanged` and `BossEnraged` hitpoints and thresholds.
- New: `PrayerDrained` and `Regenerated` (natural hitpoint regeneration and
  overheal decay), so every change to hitpoints and prayer points has an event.

These only add information; game state, RNG use and replays are unchanged.

## Guarantees (tested)

`packages/content/test/analytics.test.ts` plays full Ashen Warden fights (a
win and a loss) and checks:

- damage totals equal the sum of `HitLanded` amounts; misses always deal 0;
- boss hitpoints: start - damage dealt + mechanic healing + regeneration = end;
- player hitpoints: start - damage taken + food + potions + regeneration + Redemption = end;
- prayer points: start - drained + restored = end;
- the win records both phase transitions, the enrage and the kill; the loss records the death;
- every event has an explanation, and hit explanations include their rolls.

Writing this test found that NPC and player regeneration changed hitpoints
without an event; `Regenerated` now covers it.
