import type { PlayerSnapshot } from "@sim/engine";
import { useSessionStore } from "../../state/session-store";
import { SkillIcon } from "./icons";
import styles from "./game.module.css";

const level = (value: number, max: number) => (value / Math.max(1, max) > 0.5 ? "high" : value / Math.max(1, max) > 0.25 ? "mid" : "low");

function Orb(props: { label: string; value: number; max: number; text: string; fill: string; icon: React.ReactNode; active?: boolean; onClick?: () => void; testId: string }) {
  const pct = Math.max(0, Math.min(100, (props.value / Math.max(1, props.max)) * 100));
  const content = (
    <>
      <span className={styles.orbValue} data-level={level(props.value, props.max)}>{props.text}</span>
      <span className={styles.orbBall}>
        <span className={styles.orbFill} style={{ height: `${pct}%`, background: props.fill }} />
        {props.icon}
      </span>
    </>
  );
  return props.onClick ? (
    <button type="button" className={styles.orb} data-active={props.active} aria-pressed={props.active} aria-label={`${props.label}: ${props.text}`} title={props.label} onClick={props.onClick} data-testid={props.testId}>
      {content}
    </button>
  ) : (
    <div className={styles.orb} role="meter" aria-label={props.label} aria-valuenow={props.value} aria-valuemin={0} aria-valuemax={props.max} title={props.label} data-testid={props.testId}>
      {content}
    </div>
  );
}

const RunIcon = () => (
  <svg viewBox="0 0 32 32" width={16} height={16} aria-hidden><path d="M9 6 L17 6 L17 18 L25 21 L25 26 L7 26 L9 18 Z" fill="#c9a06a" stroke="#140e08" strokeWidth={1.4} /></svg>
);
const SpecIcon = () => (
  <svg viewBox="0 0 32 32" width={16} height={16} aria-hidden><path d="M8 26 L24 6 M24 6 L18 7 M24 6 L23 12" stroke="#e8e8e8" strokeWidth={3} fill="none" /></svg>
);

/** Hitpoints, Prayer, Run energy and Special attack orbs. Run and Special can be clicked. */
export function Orbs({ player }: { player: PlayerSnapshot }) {
  const send = useSessionStore((s) => s.send);
  const quick = useSessionStore((s) => s.quickPrayers);
  const run = Math.floor(player.runEnergy / 100);
  const quickOn = quick.length > 0 && quick.every((id) => player.activePrayers.includes(id));
  /** Quick prayers: all on if any are off, otherwise all off (one toggle each, applied next tick). */
  const toggleQuick = () => {
    const targets = quickOn ? quick : quick.filter((id) => !player.activePrayers.includes(id));
    for (const id of targets) send({ type: "togglePrayer", prayerId: id });
  };
  return (
    <div className={styles.orbs}>
      <Orb testId="orb-hp" label="Hitpoints" value={player.hitpoints} max={player.maxHitpoints} text={`${player.hitpoints}`} fill="linear-gradient(#e0301f, #8a1008)" icon={<SkillIcon skill="hitpoints" size={15} />} />
      <Orb testId="orb-prayer" label={quick.length ? `Quick prayers (${quickOn ? "on" : "off"})` : "Prayer (no quick prayers set)"} value={player.prayerPoints} max={player.maxPrayerPoints} text={`${player.prayerPoints}`} fill="linear-gradient(#5ad0f0, #1a6a9a)" icon={<SkillIcon skill="prayer" size={15} />} active={quickOn} onClick={quick.length ? toggleQuick : undefined} />
      <Orb testId="orb-run" label={player.running ? "Run (on)" : "Run (off)"} value={run} max={100} text={`${run}`} fill="linear-gradient(#f0d04a, #9a7a10)" icon={<RunIcon />} active={player.running} onClick={() => send({ type: "setRun", running: !player.running })} />
      <Orb testId="orb-spec" label={player.specialArmed ? "Special attack (armed)" : "Special attack"} value={player.specialEnergy} max={100} text={`${player.specialEnergy}`} fill="linear-gradient(#5adf6a, #1a7a2a)" icon={<SpecIcon />} active={player.specialArmed} onClick={() => send({ type: "toggleSpecial" })} />
    </div>
  );
}
