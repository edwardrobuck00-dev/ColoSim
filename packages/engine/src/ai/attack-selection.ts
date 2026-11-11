import type { Rng } from "../core/rng";
import type { AttackDef } from "../defs/attack";

/**
 * Chooses the next attack from those currently in range.
 * - sequence: the next attack in rotation order that is in range.
 * - random: any in-range attack, uniformly, using the AI RNG stream.
 */
export function selectAttack(
  attacks: readonly AttackDef[],
  inRange: (a: AttackDef) => boolean,
  mode: "sequence" | "random",
  rotationIndex: number,
  rng: Rng,
): { attack: AttackDef; nextRotationIndex: number } | null {
  if (mode === "random") {
    const options = attacks.filter(inRange);
    if (options.length === 0) return null;
    return { attack: options[rng.int(options.length)]!, nextRotationIndex: rotationIndex };
  }
  for (let i = 0; i < attacks.length; i++) {
    const idx = (rotationIndex + i) % attacks.length;
    const attack = attacks[idx]!;
    if (inRange(attack)) return { attack, nextRotationIndex: idx + 1 };
  }
  return null;
}
