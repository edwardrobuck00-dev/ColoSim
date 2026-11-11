import type { ReactNode } from "react";
import styles from "./components.module.css";

export function Panel({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className={styles.panel}>
      {(title || actions) && (
        <header className={styles.panelHeader}>
          {title && <h2>{title}</h2>}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
