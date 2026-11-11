import type { EncounterConfig } from "@sim/storage";
import { PRESETS } from "../services/loadouts";

/** The fight URL for an encounter preset: encounter, modifiers, loadout, seed, speed and auto retaliate. */
export function encounterPresetUrl(p: EncounterConfig, opts: { speed?: boolean; retaliate?: boolean } = { speed: true, retaliate: true }): string {
  const q = new URLSearchParams();
  if (p.modifierIds.length) q.set("mods", p.modifierIds.join(","));
  q.set("loadout", p.loadoutId ?? PRESETS[0]!.id);
  if (p.seed.mode === "fixed") q.set("seed", String(p.seed.value));
  if (opts.speed) q.set("speed", String(p.speed));
  if (opts.retaliate) q.set("retaliate", p.autoRetaliate ? "1" : "0");
  return `/fight/${p.encounterId}?${q.toString()}`;
}
