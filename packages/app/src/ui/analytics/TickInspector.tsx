import { explainEvent, type PlayerCommand } from "@sim/engine";
import { useMemo, useState } from "react";
import { content } from "../../services/content";
import { useSessionStore } from "../../state/session-store";
import { formatTicks } from "../../utils/format";
import { nameLookup } from "./names";
import styles from "./analytics.module.css";

function describeCommand(c: PlayerCommand): string {
  const item = (slot: number) => `inventory slot ${slot + 1}`;
  switch (c.type) {
    case "move": return `Move to ${c.to.x},${c.to.y}`;
    case "attack": return `Attack ${c.targetId}`;
    case "togglePrayer": return `Toggle ${content.prayers.get(c.prayerId)?.name ?? c.prayerId}`;
    case "useItem": return `Use ${item(c.inventorySlot)}`;
    case "equipItem": return `Equip ${item(c.inventorySlot)}`;
    case "unequipItem": return `Remove ${c.slot}`;
    case "setCombatStyle": return `Combat style ${c.index + 1}`;
    default: return c.type.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  }
}

/**
 * Everything about the tick on screen: the player's inputs, both sides'
 * state, the combat calculations in force, and each event with its reasons.
 * Pairs with the timeline: step back and forward to walk through a fight.
 */
export function TickInspector() {
  const snapshot = useSessionStore((s) => s.snapshot);
  const history = useSessionStore((s) => s.history);
  const latest = useSessionStore((s) => s.latestTick);
  const controls = useSessionStore((s) => s.controls);
  const [open, setOpen] = useState<number | null>(null);
  const tick = snapshot?.tick ?? 0;
  const record = history?.at(tick);
  const names = useMemo(() => nameLookup(snapshot), [snapshot]);
  if (!snapshot || !record) return <p className={styles.empty}>No tick to inspect yet.</p>;
  const p = snapshot.player;
  const o = p.offence;
  const lv = (k: "attack" | "strength" | "defence" | "ranged" | "magic") => `${p.levels[k]}/${p.baseLevels[k]}`;
  const events = record.events.filter((e) => e.type !== "EntityMoved" || e.teleport);

  return (
    <div className={styles.inspector}>
      <div className={styles.inspectorHead}>
        <button type="button" onClick={() => controls.seek(tick - 1)} disabled={tick === 0} aria-label="Previous tick">&lt;</button>
        <h5 data-testid="inspect-tick">Tick {tick} <span className={styles.meta}>({formatTicks(tick)}) of {latest}</span></h5>
        <button type="button" onClick={() => controls.seek(tick + 1)} disabled={tick >= latest} aria-label="Next tick">&gt;</button>
        <span className={styles.hash} title="Hash of the full simulation state after this tick">state {record.hash}</span>
      </div>

      <section>
        <h4>Your inputs this tick</h4>
        {record.commands.length ? (
          <ul className={styles.plain} data-testid="inspect-inputs">{record.commands.map((c, i) => <li key={i}>{describeCommand(c)}</li>)}</ul>
        ) : <p className={styles.empty}>None (inputs queued during a tick apply at the start of the next).</p>}
      </section>

      <div className={styles.twoCol}>
        <section>
          <h4>You</h4>
          <dl className={styles.facts}>
            <div><dt>Position</dt><dd>{p.pos.x},{p.pos.y}{p.destination ? ` -> ${p.destination.x},${p.destination.y}` : ""}</dd></div>
            <div><dt>Hitpoints</dt><dd>{p.hitpoints}/{p.maxHitpoints}</dd></div>
            <div><dt>Prayer</dt><dd>{p.prayerPoints}/{p.maxPrayerPoints}</dd></div>
            <div><dt>Prayers</dt><dd>{p.activePrayers.map((id) => content.prayers.get(id)?.name ?? id).join(", ") || "-"}</dd></div>
            <div><dt>Atk / Str / Def</dt><dd>{lv("attack")} {lv("strength")} {lv("defence")}</dd></div>
            <div><dt>Weapon</dt><dd>{p.weapon.name} ({p.combatStyles[p.combatStyleIndex]?.name})</dd></div>
            <div><dt>Target</dt><dd>{p.targetId ? names.entity(p.targetId) : "-"}</dd></div>
            <div><dt>Attack ready in</dt><dd>{p.attackReadyIn} tick{p.attackReadyIn === 1 ? "" : "s"}</dd></div>
            <div><dt>Special</dt><dd>{p.specialEnergy}%{p.specialArmed ? " (armed)" : ""}</dd></div>
          </dl>
        </section>
        {snapshot.npcs.map((n) => (
          <section key={n.id}>
            <h4>{n.name}</h4>
            <dl className={styles.facts}>
              <div><dt>Position</dt><dd>{n.pos.x},{n.pos.y}</dd></div>
              <div><dt>Hitpoints</dt><dd>{n.hitpoints}/{n.maxHitpoints} ({n.life})</dd></div>
              <div><dt>Phase</dt><dd>{n.phase.index + 1}/{n.phase.count}{n.phase.name ? ` ${n.phase.name}` : ""}</dd></div>
              <div><dt>Status</dt><dd>{[n.enraged && "enraged", n.invulnerable && "immune"].filter(Boolean).join(", ") || "-"}</dd></div>
              <div><dt>Next attack in</dt><dd>{n.attackReadyIn} tick{n.attackReadyIn === 1 ? "" : "s"}</dd></div>
              <div><dt>Defence level</dt><dd>{n.levels.defence}</dd></div>
            </dl>
          </section>
        ))}
      </div>

      <section>
        <h4>Combat calculations in force</h4>
        <dl className={styles.facts} data-testid="inspect-calcs">
          <div><dt>Your max hit</dt><dd>{o ? o.maxHit : "-"}</dd></div>
          <div><dt>Your attack roll ({o?.style ?? "-"})</dt><dd>{o?.attackRoll ?? "-"}</dd></div>
          <div><dt>Target defence roll</dt><dd>{o?.defenceRoll ?? "-"}</dd></div>
          <div><dt>Your hit chance</dt><dd>{o ? `${(o.hitChance * 100).toFixed(2)}%` : "-"}</dd></div>
          <div><dt>Your defence rolls (stab/slash/crush/ranged/magic)</dt><dd>{[p.defenceRolls.stab, p.defenceRolls.slash, p.defenceRolls.crush, p.defenceRolls.ranged, p.defenceRolls.magic].join(" / ")}</dd></div>
        </dl>
      </section>

      <section>
        <h4>What happened ({events.length} events)</h4>
        <ol className={styles.tickEvents} data-testid="inspect-events">
          {events.map((e, i) => {
            const x = explainEvent(e, tick, names);
            return (
              <li key={i} data-cat={x.category}>
                <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>{x.title}</button>
                {open === i && (
                  <div className={styles.tickWhy}>
                    {x.why.length > 0 && <ol>{x.why.map((w, j) => <li key={j}>{w}</li>)}</ol>}
                    {x.facts.length > 0 && <p className={styles.meta}>{x.facts.map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>}
                  </div>
                )}
              </li>
            );
          })}
          {events.length === 0 && <li className={styles.empty}>Nothing this tick.</li>}
        </ol>
      </section>
      {snapshot.hazards.length > 0 && (
        <section>
          <h4>Marked tiles</h4>
          <ul className={styles.plain}>{snapshot.hazards.map((h) => <li key={h.id}>{h.name}: {h.tiles.length} tiles, {h.state === "warning" ? `bursts on tick ${h.detonateTick}` : `burning until tick ${h.endTick}`}</li>)}</ul>
        </section>
      )}
    </div>
  );
}
