/**
 * Bump whenever a change can alter simulation results for the same inputs.
 * Replays store this and refuse to play back on a mismatch.
 */
export const ENGINE_VERSION = "0.9.0";

/** Length of one game tick in milliseconds. The engine never reads a clock; hosts use this. */
export const TICK_MS = 600;
