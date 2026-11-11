import styles from "../panels/panels.module.css";

const STYLES = ["stab", "slash", "crush", "ranged", "magic"] as const;

export interface BonusTableProps {
  bonuses: {
    attack: Record<(typeof STYLES)[number], number>;
    defence: Record<(typeof STYLES)[number], number>;
    meleeStrength: number;
    rangedStrength: number;
    magicDamagePercent: number;
    prayer: number;
  };
}

const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

/** Equipment bonuses, laid out like the in-game equipment stats screen. */
export function BonusTable({ bonuses: b }: BonusTableProps) {
  return (
    <table className={styles.bonusTable} aria-label="Equipment bonuses">
      <thead>
        <tr><th /><th>Attack</th><th>Defence</th></tr>
      </thead>
      <tbody>
        {STYLES.map((s) => (
          <tr key={s}><th>{s}</th><td>{sign(b.attack[s])}</td><td>{sign(b.defence[s])}</td></tr>
        ))}
        <tr><th>Melee strength</th><td colSpan={2}>{sign(b.meleeStrength)}</td></tr>
        <tr><th>Ranged strength</th><td colSpan={2}>{sign(b.rangedStrength)}</td></tr>
        <tr><th>Magic damage</th><td colSpan={2}>{sign(b.magicDamagePercent)}%</td></tr>
        <tr><th>Prayer</th><td colSpan={2}>{sign(b.prayer)}</td></tr>
      </tbody>
    </table>
  );
}
