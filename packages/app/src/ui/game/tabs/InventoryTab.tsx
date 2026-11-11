import type { ContentRegistry, WorldSnapshot } from "@sim/engine";
import { useState } from "react";
import { useSessionStore } from "../../../state/session-store";
import { useUiStore } from "../../../state/ui-store";
import { stackLabel } from "../../../utils/equipment";
import { ItemIcon } from "../icons";
import styles from "../game.module.css";

/**
 * The 28-slot inventory (4 x 7). Click to wield, wear, eat or drink; drag
 * onto another slot to move. Every action is an engine command applied on
 * the next tick.
 */
export function InventoryTab({ snapshot, content }: { snapshot: WorldSnapshot; content: ContentRegistry }) {
  const send = useSessionStore((s) => s.send);
  const setHover = useUiStore((s) => s.setHoverText);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const p = snapshot.player;

  const actionFor = (i: number): { label: string; run: () => void } | null => {
    const stack = p.inventory[i];
    const def = stack ? content.items.get(stack.itemId) : undefined;
    if (!def) return null;
    if (def.consumable) return { label: def.consumable.kind === "potion" ? "Drink" : "Eat", run: () => send({ type: "useItem", inventorySlot: i }) };
    if (def.slot) return { label: def.weapon ? "Wield" : "Wear", run: () => send({ type: "equipItem", inventorySlot: i }) };
    return null;
  };

  return (
    <ol className={styles.inventory} aria-label="Inventory">
      {p.inventory.map((stack, i) => {
        const def = stack ? content.items.get(stack.itemId) : undefined;
        const action = actionFor(i);
        const label = stack ? stackLabel(def, stack.quantity) : "";
        const text = action ? `${action.label} ${label}` : label;
        return (
          <li
            key={i}
            data-empty={!stack}
            data-testid={`inv-${i}`}
            draggable={!!stack}
            onDragStart={() => setDragFrom(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragFrom !== null && dragFrom !== i) send({ type: "moveItem", from: dragFrom, to: i });
              setDragFrom(null);
            }}
          >
            {stack && (
              <button
                type="button"
                className={styles.slotButton}
                onClick={action?.run}
                aria-label={text}
                onMouseEnter={() => setHover(text)}
                onMouseLeave={() => setHover(null)}
              >
                <ItemIcon itemId={stack.itemId} slot={def?.slot} quantity={stack.quantity} size={38} />
                {def?.stackable && <span className={styles.qty}>{stack.quantity}</span>}
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
