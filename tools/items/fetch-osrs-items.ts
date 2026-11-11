/**
 * Fetches verified item data from the OSRS Wiki (Bucket API + page text) and
 * writes packages/content/src/items/osrs/wiki-data.generated.ts.
 *
 * Usage: pnpm items:fetch
 *
 * Uses curl so the HTTPS proxy settings of the environment apply.
 * Wiki content is CC BY-NC-SA 3.0; numeric game data is attributed per item.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ITEM_NAMES, SPELL_NAMES } from "./item-names";

const API = "https://oldschool.runescape.wiki/api.php";
const UA = "osrs-combat-sim item-db builder";
const OUT = resolve(import.meta.dirname, "../../packages/content/src/items/osrs/wiki-data.generated.ts");

function get(params: Record<string, string>): unknown {
  const args = ["-sS", "-G", "-A", UA, API, ...Object.entries({ format: "json", ...params }).flatMap(([k, v]) => ["--data-urlencode", `${k}=${v}`])];
  const text = execFileSync("curl", args, { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
  return JSON.parse(text);
}

const q = (s: string) => `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

function bucket<T>(table: string, fields: string[], where: [string, string]): T[] {
  const query = `bucket(${q(table)}).select(${fields.map(q).join(",")}).where(${q(where[0])},${q(where[1])}).run()`;
  const res = get({ action: "bucket", query }) as { bucket?: T[]; error?: string };
  if (res.error) throw new Error(`${table} ${where[1]}: ${res.error}`);
  return res.bucket ?? [];
}

function pageText(title: string): string {
  const res = get({ action: "parse", page: title, prop: "wikitext", redirects: "1" }) as { parse?: { wikitext: { "*": string } } };
  return res.parse?.wikitext["*"] ?? "";
}

function revisions(titles: string[]): Map<string, { revid: number; timestamp: string }> {
  const out = new Map<string, { revid: number; timestamp: string }>();
  for (let i = 0; i < titles.length; i += 40) {
    const res = get({ action: "query", prop: "revisions", rvprop: "ids|timestamp", redirects: "1", titles: titles.slice(i, i + 40).join("|") }) as {
      query: { pages: Record<string, { title: string; revisions?: Array<{ revid: number; timestamp: string }> }> };
    };
    for (const p of Object.values(res.query.pages)) if (p.revisions?.[0]) out.set(p.title, p.revisions[0]);
  }
  return out;
}

/** Candidate requirement sentences from the page lead, for human review. */
function requirementText(wikitext: string): string[] {
  const lead = wikitext.replace(/\{\{Infobox[\s\S]*?\n\}\}/g, "").slice(0, 6000);
  const sentences = lead.split(/(?<=[.!?])\s+/);
  return sentences
    .filter((s) => /requir|in order to (wield|wear|equip|use)/i.test(s) && /\d/.test(s))
    .map((s) => s.replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1").replace(/\{\{SCP\|(\w+)\|(\d+)[^}]*\}\}/g, "$2 $1").replace(/\s+/g, " ").trim().slice(0, 260))
    .slice(0, 4);
}

interface ItemRow { page_name: string; page_name_sub: string; item_name: string; weight?: number; item_id?: string[] }
interface BonusRow {
  equipment_slot?: string; weapon_attack_speed?: number; weapon_attack_range?: string; combat_style?: string;
  stab_attack_bonus?: number; slash_attack_bonus?: number; crush_attack_bonus?: number; range_attack_bonus?: number; magic_attack_bonus?: number;
  stab_defence_bonus?: number; slash_defence_bonus?: number; crush_defence_bonus?: number; range_defence_bonus?: number; magic_defence_bonus?: number;
  strength_bonus?: number; ranged_strength_bonus?: number; prayer_bonus?: number; magic_damage_bonus?: number;
}
const BONUS_FIELDS = [
  "page_name_sub", "equipment_slot", "weapon_attack_speed", "weapon_attack_range", "combat_style",
  "stab_attack_bonus", "slash_attack_bonus", "crush_attack_bonus", "range_attack_bonus", "magic_attack_bonus",
  "stab_defence_bonus", "slash_defence_bonus", "crush_defence_bonus", "range_defence_bonus", "magic_defence_bonus",
  "strength_bonus", "ranged_strength_bonus", "prayer_bonus", "magic_damage_bonus",
];

const items: unknown[] = [];
const problems: string[] = [];
const pages = new Set<string>();

for (const name of ITEM_NAMES) {
  const rows = bucket<ItemRow>("infobox_item", ["page_name", "page_name_sub", "item_name", "weight", "item_id"], ["item_name", name]);
  const row = rows[0];
  if (!row) {
    problems.push(`no infobox_item row for "${name}"`);
    continue;
  }
  pages.add(row.page_name);
  const bonus = bucket<BonusRow & { page_name_sub: string }>("infobox_bonuses", BONUS_FIELDS, ["page_name_sub", row.page_name_sub])[0] ?? null;
  const text = pageText(row.page_name);
  items.push({
    name,
    wikiPage: row.page_name,
    wikiVersion: row.page_name_sub,
    itemIds: row.item_id ?? [],
    weightKg: row.weight ?? 0,
    bonuses: bonus,
    requirementText: requirementText(text),
  });
  process.stdout.write(".");
}

const spells: unknown[] = [];
for (const name of SPELL_NAMES) {
  const text = pageText(name);
  pages.add(name);
  const level = /\|level\s*=\s*(\d+)/.exec(text)?.[1];
  const max = /\|(?:max ?hit|damage)\s*=\s*(\d+)/i.exec(text)?.[1];
  spells.push({ name, wikiPage: name, level: level ? Number(level) : null, maxHitField: max ? Number(max) : null });
}

const revs = revisions([...pages]);
const withRev = (x: { wikiPage: string }) => ({ ...x, wikiRevision: revs.get(x.wikiPage)?.revid ?? null, wikiRevisionTime: revs.get(x.wikiPage)?.timestamp ?? null });

const out = `// GENERATED by tools/items/fetch-osrs-items.ts on ${new Date().toISOString()}. Do not edit by hand.
// Source: Old School RuneScape Wiki (https://oldschool.runescape.wiki), CC BY-NC-SA 3.0.
// Each entry records the wiki page and revision the numbers were read from.

export interface WikiBonuses {
  equipment_slot?: string; weapon_attack_speed?: number; weapon_attack_range?: string; combat_style?: string;
  stab_attack_bonus?: number; slash_attack_bonus?: number; crush_attack_bonus?: number; range_attack_bonus?: number; magic_attack_bonus?: number;
  stab_defence_bonus?: number; slash_defence_bonus?: number; crush_defence_bonus?: number; range_defence_bonus?: number; magic_defence_bonus?: number;
  strength_bonus?: number; ranged_strength_bonus?: number; prayer_bonus?: number; magic_damage_bonus?: number;
}
export interface WikiItem {
  name: string; wikiPage: string; wikiVersion: string; wikiRevision: number | null; wikiRevisionTime: string | null;
  itemIds: string[]; weightKg: number; bonuses: (WikiBonuses & { page_name_sub: string }) | null; requirementText: string[];
}
export interface WikiSpell { name: string; wikiPage: string; wikiRevision: number | null; wikiRevisionTime: string | null; level: number | null; maxHitField: number | null }

export const WIKI_ITEMS: WikiItem[] = ${JSON.stringify(items.map((i) => withRev(i as { wikiPage: string })), null, 2)};

export const WIKI_SPELLS: WikiSpell[] = ${JSON.stringify(spells.map((s) => withRev(s as { wikiPage: string })), null, 2)};
`;
writeFileSync(OUT, out);
console.log(`\nWrote ${items.length} items and ${spells.length} spells to ${OUT}`);
if (problems.length) {
  console.error(`Problems:\n  ${problems.join("\n  ")}`);
  process.exitCode = 1;
}
