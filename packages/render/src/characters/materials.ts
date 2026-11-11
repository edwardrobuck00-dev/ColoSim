import { Color, MeshLambertMaterial } from "three";

/**
 * Matte, flat-shaded material for the classic low-poly look: no specular
 * highlights or metalness, just colour and light direction. `emissive` is
 * kept for glowing details and the hit flash.
 */
export function flat(color: string, opts: { emissive?: string; emissiveIntensity?: number; roughness?: number; metalness?: number } = {}) {
  return new MeshLambertMaterial({
    color,
    flatShading: true,
    emissive: new Color(opts.emissive ?? "#000000"),
    emissiveIntensity: opts.emissiveIntensity ?? 1,
  });
}

/** Lighter or darker variant of a hex colour (amount -1..1). */
export function shade(hex: string, amount: number): string {
  const c = new Color(hex);
  const target = amount >= 0 ? new Color("#ffffff") : new Color("#000000");
  return `#${c.lerp(target, Math.abs(amount)).getHexString()}`;
}
