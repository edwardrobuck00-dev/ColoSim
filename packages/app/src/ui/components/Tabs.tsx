import styles from "./components.module.css";

export interface TabDef<T extends string> {
  id: T;
  label: string;
}

export function Tabs<T extends string>({ tabs, active, onChange }: { tabs: TabDef<T>[]; active: T; onChange: (id: T) => void }) {
  return (
    <div role="tablist" className={styles.tabs}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={t.id === active}
          className={t.id === active ? styles.tabActive : styles.tab}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
