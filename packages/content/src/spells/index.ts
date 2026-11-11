import { defineSpell } from "@sim/engine";
import { WIKI_SPELLS } from "../items/osrs/wiki-data.generated";

/**
 * Standard spellbook fire spells. Levels and base max hits come from the
 * spells' OSRS Wiki pages (wiki-data.generated.ts) and match the wiki's
 * "Maximum magic hit" table. All combat spells take 5 ticks.
 */
function spell(name: string, id: string) {
  const w = WIKI_SPELLS.find((s) => s.name === name);
  if (!w?.level || !w.maxHitField) throw new Error(`Missing wiki data for spell ${name}`);
  return defineSpell({ id, name, level: w.level, baseMaxHit: w.maxHitField, projectile: { visualId: "projectile.fire-bolt" } });
}

export const SPELLS = [
  spell("Fire Bolt", "fire-bolt"),
  spell("Fire Blast", "fire-blast"),
  spell("Fire Wave", "fire-wave"),
  spell("Fire Surge", "fire-surge"),
];
