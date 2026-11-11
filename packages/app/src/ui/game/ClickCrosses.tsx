import styles from "./hud.module.css";

export interface ClickCross {
  id: number;
  x: number;
  y: number;
  kind: "walk" | "attack";
}

/** Shrinking crosses where the player clicked: yellow to walk, red to attack. */
export function ClickCrosses({ crosses }: { crosses: ClickCross[] }) {
  return (
    <>
      {crosses.map((c) => (
        <svg key={c.id} className={styles.cross} data-kind={c.kind} style={{ left: c.x, top: c.y }} viewBox="0 0 20 20" aria-hidden>
          <path d="M3 3 L17 17 M17 3 L3 17" stroke="#000" strokeWidth={5} strokeLinecap="round" />
          <path d="M3 3 L17 17 M17 3 L3 17" strokeWidth={2.6} strokeLinecap="round" />
        </svg>
      ))}
    </>
  );
}
