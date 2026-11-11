/**
 * Validates all game content and prints a summary per content pack.
 * Usage: pnpm validate-content
 */
import { ContentValidationError, getContentPacks, getContentRegistry } from "@sim/content";

try {
  const c = getContentRegistry();
  const { packs } = getContentPacks();
  console.log("Content is valid.");
  for (const p of packs) {
    const counts = Object.entries(p.counts).map(([k, n]) => `${n} ${k}${n === 1 ? "" : "s"}`).join(", ");
    console.log(`  ${p.id}@${p.version}  ${p.name}: ${counts || "empty"}`);
  }
  console.log(`  encounters: ${[...c.encounters.keys()].join(", ")}`);
  console.log(`  totals:     ${c.items.size} items, ${c.npcs.size} npcs, ${c.modifiers.size} modifiers, ${c.arenas.size} arenas`);
  console.log(`  mechanics:  ${c.mechanics.list().map((m) => m.id).join(", ")}`);
  console.log(`  hash:       ${c.contentHash}`);
} catch (e) {
  if (e instanceof ContentValidationError) {
    console.error(e.message);
    process.exit(1);
  }
  throw e;
}
