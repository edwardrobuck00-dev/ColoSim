import type { ContentRegistry, WorldSnapshot } from "@sim/engine";
import { TAB_ACTIONS, type TabId } from "../../input/keybinds";
import { useSettingsStore } from "../../state/settings-store";
import { useUiStore } from "../../state/ui-store";
import { keyLabel } from "../../utils/format";
import { TabIcon } from "./icons";
import { Minimap } from "./Minimap";
import { Orbs } from "./Orbs";
import { CombatTab } from "./tabs/CombatTab";
import { EquipmentTab } from "./tabs/EquipmentTab";
import { InfoTab } from "./tabs/InfoTab";
import { InventoryTab } from "./tabs/InventoryTab";
import { MagicTab } from "./tabs/MagicTab";
import { PrayerTab } from "./tabs/PrayerTab";
import { SimulationTab } from "./tabs/SimulationTab";
import { SkillsTab } from "./tabs/SkillsTab";
import styles from "./game.module.css";

const TOP: Array<{ id: TabId; label: string }> = [
  { id: "combat", label: "Combat" },
  { id: "skills", label: "Skills" },
  { id: "inventory", label: "Inventory" },
  { id: "equipment", label: "Equipment" },
];
const BOTTOM: Array<{ id: TabId; label: string }> = [
  { id: "prayer", label: "Prayer" },
  { id: "magic", label: "Magic" },
  { id: "info", label: "Info" },
  { id: "simulation", label: "Simulation" },
];

/**
 * The side interface: minimap with orbs, then a row of tabs above and below
 * the open panel. Every tab also opens with its F-key (remappable on the
 * Settings page).
 */
export function GameInterface({ snapshot, content }: { snapshot: WorldSnapshot; content: ContentRegistry }) {
  const tab = useUiStore((s) => s.tab);
  const setTab = useUiStore((s) => s.setTab);
  const keybinds = useSettingsStore((s) => s.settings.keybinds);

  const row = (tabs: typeof TOP) => (
    <div className={styles.tabRow} role="tablist" aria-label="Interface tabs">
      {tabs.map((t) => {
        const key = keyLabel(keybinds[TAB_ACTIONS[t.id]]);
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="game-panel"
            aria-label={t.label}
            title={`${t.label} (${key})`}
            className={styles.tab}
            onClick={() => setTab(t.id)}
          >
            <TabIcon tab={t.id} />
            <span className={styles.tabKey} aria-hidden>{key}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <aside className={styles.side} aria-label="Game interface">
      <div className={styles.mapArea}>
        <Orbs player={snapshot.player} />
        <div className={styles.compass} aria-hidden>N</div>
        <Minimap snapshot={snapshot} />
      </div>
      {row(TOP)}
      <div className={styles.panel} id="game-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "combat" && <CombatTab snapshot={snapshot} />}
        {tab === "skills" && <SkillsTab snapshot={snapshot} />}
        {tab === "inventory" && <InventoryTab snapshot={snapshot} content={content} />}
        {tab === "equipment" && <EquipmentTab snapshot={snapshot} content={content} />}
        {tab === "prayer" && <PrayerTab snapshot={snapshot} content={content} />}
        {tab === "magic" && <MagicTab snapshot={snapshot} content={content} />}
        {tab === "info" && <InfoTab snapshot={snapshot} content={content} />}
        {tab === "simulation" && <SimulationTab snapshot={snapshot} />}
      </div>
      {row(BOTTOM)}
    </aside>
  );
}
