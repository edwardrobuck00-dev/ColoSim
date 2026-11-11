import { EQUIPMENT_SLOTS, type ContentRegistry, type WorldSnapshot } from "@sim/engine";
import { useSessionStore } from "../../../state/session-store";
import { useUiStore } from "../../../state/ui-store";
import { ItemIcon } from "../icons";
import styles from "../game.module.css";

/** Placeholder items whose faded silhouettes mark empty slots. */
const SILHOUETTE: Record<string, string> = {
  head: "rune-full-helm", cape: "fire-cape", neck: "amulet-of-glory", ammo: "rune-arrow", weapon: "rune-scimitar",
  body: "rune-platebody", shield: "rune-kiteshield", legs: "rune-platelegs", hands: "barrows-gloves", feet: "climbing-boots", ring: "berserker-ring",
};

const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

/** Worn equipment laid out as a paper doll (click to remove), with the live bonuses below. */
export function EquipmentTab({ snapshot, content }: { snapshot: WorldSnapshot; content: ContentRegistry }) {
  const send = useSessionStore((s) => s.send);
  const setHover = useUiStore((s) => s.setHoverText);
  const p = snapshot.player;
  const b = p.bonuses;
  return (
    <>
      <div className={styles.doll} aria-label="Equipment" role="group">
        {EQUIPMENT_SLOTS.map((slot) => {
          const stack = p.equipment[slot];
          const def = stack ? content.items.get(stack.itemId) : undefined;
          const label = def ? `Remove ${def.name}` : `${slot} slot (empty)`;
          return (
            <button
              key={slot}
              type="button"
              className={styles.equipSlot}
              style={{ gridArea: slot }}
              data-empty={!def}
              disabled={!def}
              aria-label={label}
              onClick={() => def && send({ type: "unequipItem", slot })}
              onMouseEnter={() => setHover(def ? label : null)}
              onMouseLeave={() => setHover(null)}
            >
              <ItemIcon itemId={stack?.itemId ?? SILHOUETTE[slot]!} slot={slot} />
              {def?.stackable && <span className={styles.qty}>{stack!.quantity}</span>}
            </button>
          );
        })}
      </div>
      <div className={styles.bonusGrid} aria-label="Equipment bonuses">
        <h4>Attack bonus</h4>
        {(["stab", "slash", "crush", "ranged", "magic"] as const).map((s) => <div key={`a${s}`}><span>{s[0]!.toUpperCase() + s.slice(1)}</span><span>{sign(b.attack[s])}</span></div>)}
        <h4>Defence bonus</h4>
        {(["stab", "slash", "crush", "ranged", "magic"] as const).map((s) => <div key={`d${s}`}><span>{s[0]!.toUpperCase() + s.slice(1)}</span><span>{sign(b.defence[s])}</span></div>)}
        <h4>Other bonuses</h4>
        <div><span>Melee str</span><span>{sign(b.meleeStrength)}</span></div>
        <div><span>Ranged str</span><span>{sign(b.rangedStrength)}</span></div>
        <div><span>Magic dmg</span><span>{sign(b.magicDamagePercent)}%</span></div>
        <div><span>Prayer</span><span>{sign(b.prayer)}</span></div>
        <div><span>Speed</span><span>{p.weapon.speedTicks} ticks</span></div>
        <div><span>Range</span><span>{p.weapon.rangeTiles}</span></div>
      </div>
    </>
  );
}
