/**
 * Scaffolds a new boss as its own content pack.
 * Usage: pnpm new:boss <id> "Display name"
 *
 * Creates packages/content/src/encounters/<id>/ with a working two-phase
 * template (arena, NPC, attacks, modifier, encounter, pack) and lists the
 * pack in packages/content/src/packs/index.ts. The boss is playable straight
 * away; edit the files to make it your own, then run pnpm validate-content.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [id, name] = process.argv.slice(2);
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "packages", "content", "src");

function fail(msg: string): never {
  console.error(msg);
  console.error('Usage: pnpm new:boss <id> "Display name"   (id is kebab-case, for example frost-sentinel)');
  process.exit(1);
}
if (!id || !name) fail("Missing arguments.");
if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)) fail(`"${id}" is not a kebab-case ID.`);
const dir = join(root, "encounters", id);
if (existsSync(dir)) fail(`${dir} already exists.`);

const camel = id.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
const q = JSON.stringify;

const files: Record<string, string> = {
  "arena.ts": `import { defineArena } from "@sim/engine";

/** The ${name}'s arena. visualId picks colours and props from packages/assets/src/manifest.ts. */
export const ${camel}Arena = defineArena({
  id: ${q(`${id}-arena`)},
  name: ${q(`${name}'s Arena`)},
  width: 20,
  height: 20,
  blocked: [{ x: 5, y: 5 }, { x: 14, y: 5 }, { x: 5, y: 14 }, { x: 14, y: 14 }],
  spawns: { player: { x: 9, y: 3 }, boss: { x: 9, y: 13 }, centre: { x: 9, y: 9 } },
  // Reuses an existing look; add your own entry to the asset manifest to change it.
  visualId: "arena.cinder-hall",
});
`,
  "attacks.ts": `import { defineAttack } from "@sim/engine";

// Keep the colour language: magic is blue / violet, ranged green, melee has no projectile.

export const ${camel}Strike = defineAttack({
  id: ${q(`${id}-strike`)},
  name: "Strike",
  style: "slash",
  maxHit: 25,
  speedTicks: 5,
  rangeTiles: 1,
  accuracyBonus: 40,
  animationCue: "attack.slam",
});

export const ${camel}Bolt = defineAttack({
  id: ${q(`${id}-bolt`)},
  name: "Bolt",
  style: "magic",
  maxHit: 22,
  speedTicks: 5,
  rangeTiles: 12,
  accuracyBonus: 30,
  projectile: { visualId: "projectile.warden-magic" },
  animationCue: "attack.cast",
});
`,
  "npcs.ts": `import { defineNpc } from "@sim/engine";

/**
 * ${name}. Behaviour is data for the engine's boss framework
 * (packages/engine/src/defs/behaviour.ts); see the Ashen Warden for every option.
 *
 * Phase 1 (100% to 50%): magic bolts, a strike if you stand next to it, a
 *   telegraphed 3x3 blast on your tile every 5th attack.
 * Phase 2 (50% to 0%): moves to the centre, attacks faster.
 */
export const ${camel} = defineNpc({
  id: ${q(id)},
  name: ${q(name)},
  size: 3,
  stats: { hitpoints: 300, attack: 120, strength: 120, defence: 120, ranged: 1, magic: 120, prayer: 1 },
  defence: { stab: 40, slash: 40, crush: 40, ranged: 40, magic: 40 },
  specials: [
    {
      id: ${q(`${id}-blast`)}, name: "Blast", kind: "tile-aoe", animationCue: "attack.cast",
      params: { area: { shape: "around-target", radius: 1 }, delayTicks: 4, damage: [20, 30] },
    },
  ],
  behaviour: {
    phases: [
      {
        id: "first", name: "First phase", movement: "chase",
        pattern: { type: "rotation", attacks: [${q(`${id}-bolt`)}] },
        closeRange: { attack: ${q(`${id}-strike`)}, chance: 0.5 },
        specials: { every: 5, ids: [${q(`${id}-blast`)}] },
      },
      {
        id: "second", name: "Second phase", atHpPercent: 50, movement: "chase",
        pattern: { type: "rotation", attacks: [${q(`${id}-bolt`)}] },
        closeRange: { attack: ${q(`${id}-strike`)}, chance: 0.5 },
        attackSpeedTicks: 4,
        specials: { every: 4, ids: [${q(`${id}-blast`)}] },
        onEnter: { message: ${q(`The ${name} grows restless.`)}, invulnerableTicks: 3, pauseTicks: 3, moveTo: "centre" },
      },
    ],
  },
  tags: ["boss"],
  // Reuses an existing model; add your own entry to the asset manifest to change it.
  visualId: "npc.ashen-warden",
});
`,
  "modifiers.ts": `import { defineModifier } from "@sim/engine";

/** Optional difficulty modifiers players can toggle on the boss screen. */
export const ${camel}Exhaustion = defineModifier({
  id: ${q(`${id}-exhaustion`)},
  name: "Exhaustion",
  description: "Run energy drains twice as fast.",
  mechanics: [{ id: "scale-resource-rate", params: { pipeline: "runEnergy.drainPerTick", multiplier: 2 } }],
});
`,
  "encounter.ts": `import { defineEncounter } from "@sim/engine";

export const ${camel}Encounter = defineEncounter({
  id: ${q(id)},
  name: ${q(name)},
  description: "Describe the fight here: what each attack looks like and how to react.",
  arenaId: ${q(`${id}-arena`)},
  playerSpawn: "player",
  npcs: [{ npcId: ${q(id)}, spawn: "boss" }],
  mechanics: [{ id: "announce", params: { text: ${q(`The ${name} awakens.`)} } }],
  modifiers: [${q(`${id}-exhaustion`)}],
  winCondition: "all-npcs-dead",
  tags: ["boss"],
});
`,
  "index.ts": `import type { ContentPack } from "../../packs/types";
import type { EncounterBundle } from "../types";
import { ${camel}Arena } from "./arena";
import { ${camel}Bolt, ${camel}Strike } from "./attacks";
import { ${camel}Encounter } from "./encounter";
import { ${camel}Exhaustion } from "./modifiers";
import { ${camel} } from "./npcs";

export const ${camel}Bundle: EncounterBundle = {
  encounter: ${camel}Encounter,
  npcs: [${camel}],
  attacks: [${camel}Strike, ${camel}Bolt],
  modifiers: [${camel}Exhaustion],
  mechanics: [],
};

export const ${camel}Pack: ContentPack = {
  id: ${q(id)},
  name: ${q(name)},
  version: "0.1.0",
  requires: ["osrs-base"],
  arenas: [${camel}Arena],
  encounters: [${camel}Bundle],
};
`,
};

mkdirSync(dir, { recursive: true });
for (const [file, text] of Object.entries(files)) writeFileSync(join(dir, file), text);

const packsFile = join(root, "packs", "index.ts");
let packs = readFileSync(packsFile, "utf8");
const listRe = /export const CONTENT_PACKS: ContentPack\[\] = \[([^\]]*)\];/;
if (!listRe.test(packs)) fail(`Created ${dir}, but could not find CONTENT_PACKS in ${packsFile}; add ${camel}Pack to it by hand.`);
packs = `import { ${camel}Pack } from "../encounters/${id}";\n` + packs.replace(listRe, (_, list: string) => `export const CONTENT_PACKS: ContentPack[] = [${list.trim()}, ${camel}Pack];`);
writeFileSync(packsFile, packs);

console.log(`Created packages/content/src/encounters/${id}/ and listed ${camel}Pack in packs/index.ts.`);
console.log("Next: edit the files, then run pnpm validate-content and pnpm dev.");
