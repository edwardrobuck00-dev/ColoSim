import type { WorldSnapshot } from "@sim/engine";
import { useState } from "react";
import { useSessionStore } from "../../../state/session-store";
import { SkillIcon, type SkillId } from "../icons";
import styles from "../game.module.css";

type CombatSkill = "attack" | "strength" | "defence" | "ranged" | "magic";
const LABEL: Record<SkillId, string> = {
  attack: "Attack", strength: "Strength", defence: "Defence", ranged: "Ranged", magic: "Magic", hitpoints: "Hitpoints", prayer: "Prayer",
};

const change = (cur: number, base: number) => (cur > base ? "up" : cur < base ? "down" : "same");

/**
 * Skills: current / base for each combat skill. Both numbers are editable;
 * each edit is an engine command applied on the next tick, and refusals
 * (such as going below a worn item's requirement) appear in the chatbox.
 */
export function SkillsTab({ snapshot }: { snapshot: WorldSnapshot }) {
  const send = useSessionStore((s) => s.send);
  const p = snapshot.player;
  const b = p.baseLevels;
  const combat = (skill: CombatSkill) => (
    <Skill key={skill} skill={skill}
      current={{ label: `Current ${LABEL[skill]}`, value: p.levels[skill], min: 0, max: 255, commit: (level) => send({ type: "setCurrentLevel", skill, level }) }}
      base={{ label: `Base ${LABEL[skill]}`, value: b[skill], commit: (level) => send({ type: "setBaseLevel", skill, level }) }} />
  );
  return (
    <>
      <div className={styles.skillGrid} aria-label="Skills">
        {(["attack", "strength", "defence", "ranged", "magic"] as const).map(combat)}
        <Skill skill="hitpoints"
          current={{ label: "Current Hitpoints", value: p.hitpoints, min: 1, max: b.hitpoints, commit: (value) => send({ type: "setHitpoints", value }) }}
          base={{ label: "Base Hitpoints", value: b.hitpoints, commit: (level) => send({ type: "setBaseLevel", skill: "hitpoints", level }) }} />
        <Skill skill="prayer"
          current={{ label: "Prayer points", value: p.prayerPoints, min: 0, max: b.prayer, commit: (value) => send({ type: "setPrayerPoints", value }) }}
          base={{ label: "Base Prayer", value: b.prayer, commit: (level) => send({ type: "setBaseLevel", skill: "prayer", level }) }} />
      </div>
      <p className={`${styles.small} ${styles.dim}`}>
        Click a number to change it. Changes apply on the next tick. Boosts and drains return to base by 1 every 100 ticks.
      </p>
    </>
  );
}

interface Field { label: string; value: number; min?: number; max?: number; commit: (v: number) => void }

function Skill({ skill, current, base }: { skill: SkillId; current: Field; base: Field }) {
  return (
    <div className={styles.skill}>
      <SkillIcon skill={skill} />
      <span className={styles.skillName}>{LABEL[skill]}</span>
      <span className={styles.levels}>
        <LevelInput {...current} min={current.min ?? 0} max={current.max ?? 255} change={change(current.value, base.value)} />
        /
        <LevelInput {...base} min={1} max={99} change="same" />
      </span>
    </div>
  );
}

/** Number field with a local draft while typing; sends one command on Enter or blur. */
function LevelInput({ label, value, min, max, commit, change }: Field & { min: number; max: number; change: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const done = () => {
    if (draft === null) return;
    const n = Math.trunc(Number(draft));
    setDraft(null);
    if (Number.isFinite(n) && n !== value) commit(Math.min(max, Math.max(min, n)));
  };
  return (
    <input
      type="number"
      className={styles.levelInput}
      data-change={change}
      aria-label={label}
      min={min}
      max={max}
      value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={done}
      onKeyDown={(e) => {
        if (e.key === "Enter") done();
        if (e.key === "Escape") setDraft(null);
      }}
    />
  );
}
