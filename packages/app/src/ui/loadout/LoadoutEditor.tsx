import {
  EQUIPMENT_SLOTS,
  missingRequirements,
  totalBonuses,
  weaponFromItem,
  type ContentRegistry,
  type EquipmentSlot,
  type ItemDef,
  type PlayerSetup,
  type SetupItem,
} from "@sim/engine";
import { itemClass, searchItems, type ItemClass } from "@sim/content";
import { Fragment, useMemo, useState } from "react";
import { validateSetup } from "../../services/loadouts";
import { equippedItems, requirementText, setupItemId, setupQuantity, stackLabel } from "../../utils/equipment";
import { Button } from "../components/Button";
import { BonusTable } from "./BonusTable";
import { SectionLibrary } from "./SectionLibrary";
import styles from "./loadout.module.css";

const SKILL_KEYS = ["attack", "strength", "defence", "ranged", "magic", "prayer", "hitpoints"] as const;
const INVENTORY_SIZE = 28;

export interface LoadoutEditorProps {
  content: ContentRegistry;
  initialName: string;
  initialSetup: PlayerSetup;
  initialQuickPrayers?: string[];
  onSave: (name: string, setup: PlayerSetup, quickPrayers: string[]) => void;
  onCancel: () => void;
}

/**
 * Builds a loadout from the item database: levels, every equipment slot,
 * ammo quantity and 28 inventory slots. Bonuses and requirement problems
 * update as you change things; the engine validates the result before saving.
 */
export function LoadoutEditor({ content, initialName, initialSetup, initialQuickPrayers = [], onSave, onCancel }: LoadoutEditorProps) {
  const [name, setName] = useState(initialName);
  const [setup, setSetup] = useState<PlayerSetup>(initialSetup);
  const [quick, setQuick] = useState<string[]>(initialQuickPrayers);
  const prayers = useMemo(() => [...content.prayers.values()].sort((a, b) => a.level - b.level), [content]);
  const toggleIn = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const [selected, setSelected] = useState<number | null>(null);
  const [filter, setFilter] = useState("");
  const [pickKind, setPickKind] = useState<"" | "supplies" | ItemClass>("");
  const [gearClass, setGearClass] = useState<"" | ItemClass>("");

  const items = useMemo(() => [...content.items.values()].sort((a, b) => a.name.localeCompare(b.name)), [content]);
  const worn = equippedItems(setup, content);
  const bonuses = totalBonuses(Object.values(worn));
  const weapon = weaponFromItem(worn.weapon);
  const error = validateSetup(setup);
  const twoHanded = !!worn.weapon?.weapon?.twoHanded;

  const setSlot = (slot: EquipmentSlot, itemId: string) => {
    const equipment = { ...setup.equipment };
    if (!itemId) delete equipment[slot];
    else {
      const def = content.items.get(itemId)!;
      equipment[slot] = def.stackable ? { itemId, quantity: 500 } : itemId;
      if (slot === "weapon" && def.weapon?.twoHanded) delete equipment.shield;
    }
    // Keep the style index valid for the new weapon.
    setSetup({ ...setup, equipment, combatStyle: slot === "weapon" ? 0 : setup.combatStyle, autocastSpellId: slot === "weapon" ? null : setup.autocastSpellId });
  };

  const setInventory = (index: number, entry: SetupItem | null) => {
    const inventory = Array.from({ length: INVENTORY_SIZE }, (_, i) => setup.inventory[i] ?? null);
    inventory[index] = entry;
    setSetup({ ...setup, inventory });
  };

  const filtered = searchItems(items, pickKind === "supplies" ? { text: filter, slot: "supplies" } : { text: filter, class: pickKind || undefined });
  /** Tooltip: requirements plus effects the simulator does not model. */
  const tip = (i: ItemDef) => [requirementText(i), ...i.notes].filter(Boolean).join("\n");

  return (
    <div className={styles.editor}>
      <section className={styles.column}>
        <label className={styles.field}>
          Loadout name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <h3>Levels</h3>
        <SectionLibrary kind="stats" label="Stats" data={() => setup.stats} apply={(stats) => setSetup({ ...setup, stats })} />
        <div className={styles.levels}>
          {SKILL_KEYS.map((k) => (
            <label key={k} className={styles.level}>
              <span>{k}</span>
              <input
                type="number"
                min={1}
                max={99}
                value={setup.stats[k]}
                aria-label={`${k} level`}
                onChange={(e) => setSetup({ ...setup, stats: { ...setup.stats, [k]: Math.max(1, Math.min(99, Number(e.target.value) || 1)) } })}
              />
            </label>
          ))}
        </div>
        <h3>Bonuses</h3>
        <p className={styles.note}>{weapon.name}: {weapon.speedTicks}-tick attacks, range {weapon.rangeTiles}.</p>
        <BonusTable bonuses={bonuses} />
      </section>

      <section className={styles.column}>
        <h3>Equipment</h3>
        <SectionLibrary
          kind="equipment"
          label="Equipment"
          data={() => ({ equipment: setup.equipment, combatStyle: setup.combatStyle, autocastSpellId: setup.autocastSpellId })}
          apply={(d) => setSetup({ ...setup, equipment: d.equipment, combatStyle: d.combatStyle, autocastSpellId: d.autocastSpellId })}
        />
        <label className={styles.filterRow}>
          Show gear for
          <select aria-label="Show gear for" value={gearClass} onChange={(e) => setGearClass(e.target.value as "" | ItemClass)}>
            <option value="">Any style</option>
            <option value="melee">Melee</option>
            <option value="ranged">Ranged</option>
            <option value="magic">Magic</option>
          </select>
        </label>
        <div className={styles.slotList}>
          {EQUIPMENT_SLOTS.map((slot) => {
            const entry = setup.equipment[slot];
            const def = worn[slot];
            const missing = def ? missingRequirements(setup.stats, def) : [];
            // Keep the worn item listed even when the class filter would hide it.
            const options = items.filter((i) => i.slot === slot && (!gearClass || i.id === def?.id || [gearClass, "neutral"].includes(itemClass(i))));
            return (
              <div key={slot} className={styles.slotRow}>
                <label className={styles.slotLabel} htmlFor={`slot-${slot}`}>{slot}</label>
                <select
                  id={`slot-${slot}`}
                  aria-label={`${slot} slot`}
                  value={entry ? setupItemId(entry) : ""}
                  disabled={slot === "shield" && twoHanded}
                  onChange={(e) => setSlot(slot, e.target.value)}
                >
                  <option value="">{slot === "shield" && twoHanded ? "(two-handed weapon)" : "Empty"}</option>
                  {options.map((o) => (
                    <option key={o.id} value={o.id} title={tip(o)}>{o.name}{missingRequirements(setup.stats, o).length ? " (requirements not met)" : ""}</option>
                  ))}
                </select>
                {def?.stackable && entry && (
                  <input
                    type="number"
                    min={1}
                    className={styles.qtyInput}
                    aria-label={`${slot} quantity`}
                    value={setupQuantity(entry, def)}
                    onChange={(e) => setSetup({ ...setup, equipment: { ...setup.equipment, [slot]: { itemId: def.id, quantity: Math.max(1, Number(e.target.value) || 1) } } })}
                  />
                )}
                {missing.length > 0 && <span className={styles.warn}>Needs {missing.join(", ")}</span>}
                {def && def.notes.length > 0 && <small className={styles.itemNotes} data-testid={`notes-${slot}`}>{def.notes.join(" ")}</small>}
              </div>
            );
          })}
        </div>
      </section>

      <section className={styles.column}>
        <h3>Inventory</h3>
        <SectionLibrary kind="inventory" label="Inventory" data={() => ({ inventory: setup.inventory })} apply={(d) => setSetup({ ...setup, inventory: d.inventory })} />
        <ol className={styles.invGrid} aria-label="Loadout inventory">
          {Array.from({ length: INVENTORY_SIZE }, (_, i) => {
            const entry = setup.inventory[i] ?? null;
            const def = entry ? content.items.get(setupItemId(entry)) : undefined;
            return (
              <li key={i}>
                <button type="button" aria-pressed={selected === i} onClick={() => setSelected(i)} className={styles.invCell} title={def?.name ?? "Empty slot"}>
                  {def ? stackLabel(def, setupQuantity(entry!, def)) : ""}
                </button>
              </li>
            );
          })}
        </ol>
        {selected !== null && (
          <div className={styles.picker}>
            <p className={styles.note}>Slot {selected + 1}: choose an item.</p>
            <div className={styles.searchRow}>
              <input placeholder="Search items or tags" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Search items" />
              <select aria-label="Item type" value={pickKind} onChange={(e) => setPickKind(e.target.value as "" | "supplies" | ItemClass)}>
                <option value="">All items</option>
                <option value="supplies">Food and potions</option>
                <option value="melee">Melee</option>
                <option value="ranged">Ranged</option>
                <option value="magic">Magic</option>
              </select>
            </div>
            <div className={styles.pickList}>
              <button type="button" onClick={() => setInventory(selected, null)}>Empty</button>
              {filtered.map((i: ItemDef) => (
                <button key={i.id} type="button" onClick={() => setInventory(selected, i.stackable ? { itemId: i.id, quantity: 100 } : i.id)} title={tip(i)}>
                  {stackLabel(i, i.consumable?.doses ?? 1)}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className={styles.column}>
        <h3>Prayers</h3>
        <SectionLibrary kind="prayers" label="Prayers" data={() => ({ start: setup.prayers, quick })} apply={(d) => { setSetup({ ...setup, prayers: d.start }); setQuick(d.quick); }} />
        <p className={styles.note}>"On at start" prayers are active when the fight begins. Quick prayers switch on and off together from the prayer orb.</p>
        <div className={styles.prayerPick} role="group" aria-label="Prayer setup">
          <span className={styles.head}>Prayer</span><span className={styles.head}>On at start</span><span className={styles.head}>Quick</span>
          {prayers.map((p) => (
            <Fragment key={p.id}>
              <span>{p.name} <small className={styles.note}>({p.level})</small></span>
              <input type="checkbox" aria-label={`${p.name} on at start`} checked={setup.prayers.includes(p.id)} onChange={() => setSetup({ ...setup, prayers: toggleIn(setup.prayers, p.id) })} />
              <input type="checkbox" aria-label={`${p.name} quick prayer`} checked={quick.includes(p.id)} onChange={() => setQuick(toggleIn(quick, p.id))} />
            </Fragment>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        {error ? <p className={styles.error} role="alert">{error}</p> : <p className={styles.ok}>Ready to fight.</p>}
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" disabled={!!error || !name.trim()} onClick={() => onSave(name.trim(), setup, quick)}>Save loadout</Button>
      </footer>
    </div>
  );
}
