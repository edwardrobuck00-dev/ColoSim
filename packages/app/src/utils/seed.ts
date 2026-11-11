/** A fresh random seed for a new fight. Randomness lives here, never in the engine. */
export function randomSeed(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0]! | 0;
}
