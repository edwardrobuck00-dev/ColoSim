import { useUiStore } from "../../state/ui-store";
import styles from "./hud.module.css";

/** "Attack The Ashen Warden", "Walk here", "Wield Dragon dagger": what a left click will do. */
export function MouseText() {
  const text = useUiStore((s) => s.hoverText);
  if (!text) return null;
  const space = text.indexOf(" ");
  const verb = space < 0 ? text : text.slice(0, space);
  const rest = space < 0 ? "" : text.slice(space + 1);
  return (
    <div className={styles.mouseText} data-testid="mouse-text">
      {verb} {rest && <span className={rest === "here" ? undefined : styles.mouseTarget}>{rest}</span>}
    </div>
  );
}
