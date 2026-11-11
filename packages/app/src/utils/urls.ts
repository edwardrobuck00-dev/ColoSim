/** URL of a fight with the given encounter, modifiers and loadout. */
export function fightUrl(encounterId: string, modifierIds: string[], loadoutId: string): string {
  const q = new URLSearchParams();
  if (modifierIds.length) q.set("mods", modifierIds.join(","));
  q.set("loadout", loadoutId);
  return `/fight/${encounterId}?${q.toString()}`;
}
