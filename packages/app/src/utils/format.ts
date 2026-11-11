import { TICK_MS } from "@sim/engine";

/** Formats a tick count as in-game time, e.g. 125 ticks -> "1:15.0". */
export function formatTicks(ticks: number): string {
  const totalTenths = Math.round((ticks * TICK_MS) / 100);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

/** Run energy is stored in hundredths of a percent. */
export const formatRunEnergy = (energy: number): string => `${Math.floor(energy / 100)}%`;

export const percent = (value: number, max: number): number => (max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100)));

/** Human-readable name for a KeyboardEvent.code, e.g. "KeyR" -> "R". */
export function keyLabel(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  return ({ Space: "Space", Period: ".", ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓" } as Record<string, string>)[code] ?? code;
}
