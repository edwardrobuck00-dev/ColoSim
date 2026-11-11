import { percent } from "../../utils/format";
import styles from "./components.module.css";

export function Meter({ label, value, max, text, color }: { label: string; value: number; max: number; text: string; color: string }) {
  return (
    <div className={styles.meter} role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <span className={styles.meterLabel}>{label}</span>
      <div className={styles.meterTrack}>
        <div className={styles.meterFill} style={{ width: `${percent(value, max)}%`, background: color }} />
        <span className={styles.meterText}>{text}</span>
      </div>
    </div>
  );
}
