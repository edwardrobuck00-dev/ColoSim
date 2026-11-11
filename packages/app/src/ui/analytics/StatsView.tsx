import { summarize, type FightStats } from "@sim/engine";
import { content } from "../../services/content";
import { useUiStore, type LogPreset } from "../../state/ui-store";
import { formatTicks } from "../../utils/format";
import styles from "./analytics.module.css";

const n0 = (x: number) => x.toLocaleString();
const n1 = (x: number) => x.toFixed(1);
const n2 = (x: number) => x.toFixed(2);
const pc = (x: number) => `${(x * 100).toFixed(1)}%`;
const item = (id: string) => content.items.get(id)?.name ?? id;
const prayer = (id: string) => content.prayers.get(id)?.name ?? id;

/** A statistic row; with `preset`, clicking it opens the event log filtered to the events behind it. */
function Row({ label, value, preset, testId }: { label: string; value: string; preset?: LogPreset; testId?: string }) {
  const open = useUiStore((s) => s.setAnalytics);
  return (
    <div className={styles.row}>
      <dt>{preset ? <button type="button" className={styles.link} onClick={() => open(true, "log", preset)} title="Show these events">{label}</button> : label}</dt>
      <dd data-testid={testId}>{value}</dd>
    </div>
  );
}

/** Live fight statistics. Every value is folded from engine events (see engine/src/analytics). */
export function StatsView({ stats }: { stats: FightStats }) {
  const s = summarize(stats);
  const d = stats.dealt;
  const r = stats.received;
  const byCount = (rec: Record<string, number>, name: (id: string) => string) =>
    Object.entries(rec).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${name(k)} x${v}`).join(", ") || "None";
  return (
    <div className={styles.statsGrid}>
      <section>
        <h4>Overview</h4>
        <dl>
          <Row label="Fight time" value={`${formatTicks(s.durationTicks)} (${s.durationTicks} ticks)`} />
          <Row label="Time in combat" value={`${formatTicks(stats.combatTicks)} (${stats.combatTicks} ticks)`} testId="stat-combat-ticks" />
          <Row label="DPS (in combat)" value={n2(s.dps)} testId="stat-dps" />
          <Row label="DPS (whole fight)" value={n2(s.dpsOverall)} />
          <Row label="Damage taken per second" value={n2(s.incomingDps)} />
          <Row label="Deaths" value={String(stats.deaths.length)} preset="deaths" testId="stat-deaths" />
        </dl>
      </section>
      <section>
        <h4>Damage dealt</h4>
        <dl>
          <Row label="Total damage dealt" value={n0(d.damage)} preset="player-hits" testId="stat-dealt" />
          <Row label="Attacks started" value={n0(stats.attacksStarted)} />
          <Row label="Successful (accurate)" value={`${n0(d.successful)} (${pc(s.accuracy)})`} preset="player-hits" testId="stat-successful" />
          <Row label="Missed" value={n0(d.missed)} preset="misses" testId="stat-missed" />
          <Row label="Average hit" value={n1(s.averageHit)} testId="stat-average" />
          <Row label="Average accurate hit" value={n1(s.averageSuccessfulHit)} />
          <Row label="Maximum hit" value={n0(d.maxHit)} testId="stat-max" />
          <Row label="Overkill (wasted)" value={n0(d.overkill)} />
          <Row label="Hits on an immune boss" value={n0(d.immuneHits)} />
        </dl>
      </section>
      <section>
        <h4>Special attacks</h4>
        <dl>
          <Row label="Used" value={n0(d.special.used)} preset="specials" testId="stat-specials" />
          <Row label="Energy spent" value={`${d.special.energySpent}%`} />
          <Row label="Damage from specials" value={`${n0(d.special.damage)} in ${d.special.hits} hits`} />
        </dl>
      </section>
      <section>
        <h4>Damage received</h4>
        <dl>
          <Row label="Total damage received" value={n0(r.damage)} preset="taken" testId="stat-received" />
          <Row label="Hits taken" value={`${n0(r.hits)} (${n0(r.successful)} accurate, ${n0(r.missed)} missed)`} preset="taken" />
          <Row label="Maximum hit taken" value={n0(r.maxHit)} />
          <Row label="Blocked by prayer" value={`${n0(r.blockedByPrayer)} hits, ${n0(r.preventedByPrayer)} damage prevented`} preset="blocked" testId="stat-blocked" />
          <Row label="Fire (telegraphed tiles)" value={`${n0(r.hazard.damage)} in ${r.hazard.hits} hits`} preset="fire" />
          {Object.entries(r.byStyle).map(([style, v]) => <Row key={style} label={`  ${style}`} value={`${n0(v!.damage)} in ${v!.hits}`} />)}
        </dl>
      </section>
      <section>
        <h4>Prayer</h4>
        <dl>
          <Row label="Protection prayer uptime" value={pc(s.protectionUptime)} />
          <Row label="Points drained" value={`${n0(stats.prayer.pointsDrained)}${stats.prayer.pointsDrainedByMechanics ? ` (${stats.prayer.pointsDrainedByMechanics} by mechanics)` : ""}`} preset="prayer" testId="stat-prayer-drained" />
          <Row label="Points restored" value={n0(stats.prayer.pointsRestored)} />
          <Row label="Activations" value={byCount(stats.prayer.activations, prayer)} preset="prayer" />
          <Row label="Ticks active" value={byCount(stats.prayer.ticksActive, prayer).replace(/ x/g, " ")} />
          <Row label="Switched off by" value={byCount(stats.prayer.switchedOffBy, (c) => c)} />
        </dl>
      </section>
      <section>
        <h4>Supplies</h4>
        <dl>
          <Row label="Food eaten" value={`${s.foodEaten}: ${byCount(stats.food.eaten, item)}`} preset="consumables" testId="stat-food" />
          <Row label="Healed by food" value={n0(stats.food.healed)} />
          <Row label="Potion doses" value={`${s.potionDoses}: ${byCount(stats.potions.doses, item)}`} preset="consumables" testId="stat-potions" />
          <Row label="Healed by potions" value={n0(stats.potions.healed)} />
        </dl>
      </section>
      <section className={styles.wide}>
        <h4>Boss</h4>
        <dl>
          <Row label="Attacks at you" value={n0(stats.boss.attacks)} />
          <Row label="Specials" value={byCount(stats.boss.specials, (k) => k)} preset="boss" />
          <Row label="Healed (mechanics)" value={n0(stats.boss.healed)} />
          <Row label="Regenerated" value={n0(stats.boss.regenerated)} />
          <Row label="Enraged" value={stats.boss.enrages.length ? stats.boss.enrages.map((e) => `tick ${e.tick} (${e.cause})`).join(", ") : "No"} preset="boss" />
          <Row label="Phase transitions" value={stats.boss.phases.length ? stats.boss.phases.map((p) => `tick ${p.tick}: ${p.name ?? `phase ${p.index + 1}`} at ${Math.round((p.hitpoints * 100) / p.maxHitpoints)}%`).join("; ") : "None yet"} preset="boss" testId="stat-phases" />
          <Row label="Kills" value={stats.kills.length ? stats.kills.map((k) => `tick ${k.tick}`).join(", ") : "None"} preset="deaths" />
        </dl>
      </section>
      <p className={styles.note}>
        Every number is folded from engine events (the Event log). Accuracy uses the engine's own accuracy roll, so an accurate 0 counts
        as successful. Time in combat counts ticks within 10 ticks of an attack or hit involving you.
      </p>
    </div>
  );
}
