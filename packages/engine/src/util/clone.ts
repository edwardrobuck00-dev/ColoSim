/**
 * Deep copy for plain JSON-like data (snapshots, commands, replays).
 * The engine targets plain ES2022, which has no structuredClone.
 */
export function clonePlain<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}
