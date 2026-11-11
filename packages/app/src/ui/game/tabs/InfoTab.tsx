import type { ContentRegistry, WorldSnapshot } from "@sim/engine";
import styles from "../game.module.css";

/**
 * Live combat numbers from the engine's formulas (current levels, prayers,
 * stance and gear), plus timers. Encounter modifiers can still adjust these.
 */
export function InfoTab({ snapshot, content }: { snapshot: WorldSnapshot; content: ContentRegistry }) {
  const p = snapshot.player;
  const o = p.offence;
  const target = o ? snapshot.npcs.find((n) => n.id === o.npcId)?.name : undefined;
  const d = p.defenceRolls;
  const encounter = content.encounters.get(snapshot.encounterId);
  const mods = snapshot.modifierIds.map((id) => content.modifiers.get(id)?.name ?? id);
  return (
    <>
      <h3 className={styles.panelTitle}>{encounter?.name ?? "Encounter"}</h3>
      <dl className={styles.list} aria-label="Combat calculations">
        <div><dt>Max hit</dt><dd data-testid="calc-max-hit">{o ? o.maxHit : "-"}</dd></div>
        <div><dt>Attack roll ({o?.style ?? "-"})</dt><dd data-testid="calc-attack-roll">{o ? o.attackRoll.toLocaleString() : "-"}</dd></div>
        <div><dt>Hit chance{target ? ` vs ${target}` : ""}</dt><dd data-testid="calc-hit-chance">{o ? `${(o.hitChance * 100).toFixed(2)}%` : "-"}</dd></div>
        <div className={styles.wide}>
          <dt>Defence rolls (stab / slash / crush / ranged / magic)</dt>
          <dd data-testid="calc-defence">{[d.stab, d.slash, d.crush, d.ranged, d.magic].map((n) => n.toLocaleString()).join(" / ")}</dd>
        </div>
        <div><dt>Attack ready in</dt><dd>{p.life === "alive" ? `${p.attackReadyIn} ticks` : "-"}</dd></div>
        <div><dt>Hitpoint change in</dt><dd>{p.life === "alive" ? `${p.hpRegenIn} ticks` : "-"}</dd></div>
        <div><dt>Eat / drink ready in</dt><dd>{p.eatReadyIn} / {p.drinkReadyIn}</dd></div>
        <div><dt>Position</dt><dd>{p.pos.x}, {p.pos.y}</dd></div>
        <div><dt>Modifiers</dt><dd>{mods.length ? mods.join(", ") : "None"}</dd></div>
        <div><dt>Seed</dt><dd data-testid="stats-seed">{snapshot.seed}</dd></div>
      </dl>
    </>
  );
}
