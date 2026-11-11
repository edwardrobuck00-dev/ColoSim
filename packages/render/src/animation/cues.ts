/**
 * Cue fallback chain: "attack.slash.heavy" -> "attack.slash" -> "attack".
 * Lets content use specific cues while art only provides general clips.
 */
export function cueFallbacks(cue: string): string[] {
  const parts = cue.split(".");
  const out: string[] = [];
  for (let i = parts.length; i > 0; i--) out.push(parts.slice(0, i).join("."));
  return out;
}

/** First cue in the fallback chain that `has` accepts, or null. */
export function resolveCue(cue: string, has: (name: string) => boolean): string | null {
  return cueFallbacks(cue).find(has) ?? null;
}
