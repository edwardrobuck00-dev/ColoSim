export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Integer division rounding toward negative infinity (OSRS formulas floor everything). */
export function floorDiv(a: number, b: number): number {
  return Math.floor(a / b);
}
