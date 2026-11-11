import { behaviourOf, type AttackDef, type BossSpecialDef, type ContentRegistry, type EncounterDef, type NpcDef, type PhaseDef } from "@sim/engine";

/**
 * Turns encounter and NPC data into readable facts for the boss selection
 * screen. Everything comes from definitions, so a new boss needs no UI work.
 */

export interface AttackInfo {
  id: string;
  name: string;
  style: string;
  /** Colour-language class: "magic", "ranged" or "melee". */
  kind: "magic" | "ranged" | "melee";
  maxHit: number;
  speedTicks: number;
  rangeTiles: number;
  projectile: boolean;
}

export interface PhaseInfo {
  name: string;
  /** "100%" for the first phase, else the threshold. */
  from: string;
  lines: string[];
}

export interface BossInfo {
  npc: NpcDef;
  combatLevel: number;
  attacks: AttackInfo[];
  phases: PhaseInfo[];
  specials: Array<{ name: string; text: string }>;
  enrage: string | null;
  rules: string[];
}

/** OSRS combat level formula (OSRS Wiki "Combat level"), which NPC levels also use. */
export function combatLevel(s: NpcDef["stats"]): number {
  const base = 0.25 * (s.defence + s.hitpoints + Math.floor(s.prayer / 2));
  const melee = 0.325 * (s.attack + s.strength);
  const ranged = 0.325 * Math.floor((s.ranged * 3) / 2);
  const magic = 0.325 * Math.floor((s.magic * 3) / 2);
  return Math.floor(base + Math.max(melee, ranged, magic));
}

const kindOf = (style: string): AttackInfo["kind"] => (style === "magic" ? "magic" : style === "ranged" ? "ranged" : "melee");
const seconds = (ticks: number) => `${(ticks * 0.6).toFixed(1).replace(/\.0$/, "")} s`;

function attackInfo(a: AttackDef): AttackInfo {
  return {
    id: a.id, name: a.name ?? a.id, style: a.style, kind: kindOf(a.style), maxHit: a.maxHit,
    speedTicks: a.speedTicks, rangeTiles: a.rangeTiles, projectile: !!a.projectile,
  };
}

function patternText(phase: PhaseDef, name: (id: string) => string): string {
  const p = phase.pattern;
  switch (p.type) {
    case "rotation":
      return p.attacks.length === 1 ? `Uses ${name(p.attacks[0]!)}.` : `Cycles ${p.attacks.map(name).join(", then ")}.`;
    case "random":
      return `Picks at random: ${p.attacks.map((a) => name(a.attack)).join(" or ")}.`;
    case "switch":
      return `Uses one of ${p.attacks.map(name).join(" / ")} ${p.every} times, then switches${p.order === "random" ? " at random" : ""}.`;
  }
}

function specialText(s: BossSpecialDef, name: (id: string) => string): string {
  const p = s.params as Record<string, unknown>;
  if (s.kind === "volley") {
    const list = (p.attacks as Array<{ attack: string; delayTicks: number }>) ?? [];
    return list.map((a, i) => (i === 0 ? name(a.attack) : `${name(a.attack)} ${a.delayTicks} ticks later`)).join(", ") + ". Switch prayers as each lands.";
  }
  if (s.kind === "tile-aoe") {
    const area = p.area as { shape: string; radius?: number; inner?: number; outer?: number; count?: number; length?: number };
    const where =
      area.shape === "around-target" ? (area.radius ? `a ${area.radius * 2 + 1}x${area.radius * 2 + 1} area on you` : "your tile")
      : area.shape === "ring-around-self" ? `a ring ${area.inner} to ${area.outer} tiles around itself`
      : area.shape === "cross-on-target" ? `a cross through your tile`
      : `${area.count} tiles across the arena`;
    const dmg = p.damage as [number, number];
    let text = `Marks ${where}; ${p.delayTicks ?? 3} ticks later it bursts for ${dmg[0]} to ${dmg[1]} (prayer does not help).`;
    if (Number(p.lingerTicks) > 0) text += ` Burns for ${p.lingerTicks} more ticks (${p.lingerDamage} per tick).`;
    return text;
  }
  return `Special attack (${s.kind}).`;
}

function phaseLines(phase: PhaseDef, npc: NpcDef, name: (id: string) => string): string[] {
  const lines: string[] = [];
  const e = phase.onEnter;
  const entry: string[] = [];
  if (e.moveTo) entry.push("returns to the centre");
  if (e.invulnerableTicks) entry.push(`immune for ${e.invulnerableTicks} ticks`);
  if (e.pauseTicks) entry.push(`pauses ${e.pauseTicks} ticks`);
  if (e.healPercent) entry.push(`heals ${e.healPercent}%`);
  if (e.special) entry.push(`opens with ${npc.specials.find((s) => s.id === e.special)?.name ?? e.special}`);
  if (entry.length) lines.push(`On entry: ${entry.join(", ")}.`);
  lines.push(patternText(phase, name));
  if (phase.closeRange) {
    const pct = Math.round(phase.closeRange.chance * 100);
    lines.push(`Next to you: ${name(phase.closeRange.attack)}${pct < 100 ? ` (${pct}% of attacks)` : ""}.`);
  }
  if (phase.attackSpeedTicks) lines.push(`Attacks every ${phase.attackSpeedTicks} ticks (${seconds(phase.attackSpeedTicks)}).`);
  if (phase.specials) {
    const names = phase.specials.ids.map((id) => npc.specials.find((s) => s.id === id)?.name ?? id);
    lines.push(`Every ${phase.specials.every}${phase.specials.every === 1 ? "" : "th"} attack: ${names.join(", ")}${names.length > 1 ? (phase.specials.order === "random" ? " (random)" : " (in turn)") : ""}.`);
  }
  if (phase.defence) lines.push("Defences change (see table).");
  lines.push(phase.movement === "chase" ? "Follows you." : "Stays in place.");
  return lines;
}

export function bossInfo(content: ContentRegistry, encounter: EncounterDef): BossInfo | null {
  const npcId = encounter.npcs[0]?.npcId;
  const npc = npcId ? content.npcs.get(npcId) : undefined;
  if (!npc) return null;
  const name = (id: string) => content.attacks.get(id)?.name ?? id;
  const b = behaviourOf(npc);
  const attackIds = new Set<string>(npc.attacks);
  for (const ph of b.phases) {
    const p = ph.pattern;
    for (const id of p.type === "random" ? p.attacks.map((a) => a.attack) : p.attacks) attackIds.add(id);
    if (ph.closeRange) attackIds.add(ph.closeRange.attack);
  }
  const attacks = [...attackIds].map((id) => content.attacks.get(id)).filter((a): a is AttackDef => !!a).map(attackInfo);
  const phases = b.phases.map((ph, i) => ({
    name: ph.name ?? `Phase ${i + 1}`,
    from: i === 0 ? "100%" : `${ph.atHpPercent}%`,
    lines: phaseLines(ph, npc, name),
  }));
  const en = b.enrage;
  const enrage = en
    ? [
        [en.atHpPercent !== undefined ? `below ${en.atHpPercent}% hitpoints` : null, en.afterTicks !== undefined ? `after ${seconds(en.afterTicks).replace(" s", "")} seconds` : null].filter(Boolean).join(" or "),
      ].map((when) => {
        const parts: string[] = [];
        if (en.attackSpeedDelta) parts.push(`attacks ${Math.abs(en.attackSpeedDelta)} tick${Math.abs(en.attackSpeedDelta) === 1 ? "" : "s"} ${en.attackSpeedDelta < 0 ? "faster" : "slower"}`);
        if (en.maxHitMultiplier[0] !== en.maxHitMultiplier[1]) parts.push(`max hits x${(en.maxHitMultiplier[0] / en.maxHitMultiplier[1]).toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}`);
        if (en.accuracyMultiplier[0] !== en.accuracyMultiplier[1]) parts.push(`accuracy x${(en.accuracyMultiplier[0] / en.accuracyMultiplier[1]).toFixed(2)}`);
        return `Enrages ${when}: ${parts.join(", ")}.`;
      })[0]!
    : null;
  const rules = [...npc.mechanics, ...encounter.mechanics]
    .filter((m) => m.id !== "announce")
    .map((m) => content.mechanics.list().find((d) => d.id === m.id)?.description)
    .filter((d): d is string => !!d);
  return {
    npc,
    combatLevel: combatLevel(npc.stats),
    attacks,
    phases,
    specials: npc.specials.map((s) => ({ name: s.name, text: specialText(s, name) })),
    enrage,
    rules,
  };
}
