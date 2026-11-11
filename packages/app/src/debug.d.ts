import type { WorldSnapshot } from "@sim/engine";

declare global {
  interface Window {
    /** Read-only debug hook set while a fight is on screen (used by browser tests). */
    __simDebug?: {
      renderer: () => { entities: number; projectiles: number; splats: number; hazards: number; tick: number; drawCalls: number; triangles: number; programs: number };
      snapshot: () => WorldSnapshot;
      runner: () => { state: string; seed: number; speed: number; hash: string; mode: string; viewTick: number; latestTick: number };
      screenPosition: (entityId: string) => { x: number; y: number } | null;
      pick: (clientX: number, clientY: number) => { entityId: string | null; tile: { x: number; y: number } | null };
      /** Differences between what is drawn and the simulation state; empty when they match. */
      consistency: () => string[];
    };
  }
}
