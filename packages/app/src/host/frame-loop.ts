export interface FrameDeps {
  requestFrame: (cb: (time: number) => void) => number;
  cancelFrame: (handle: number) => void;
}

const browserDeps = (): FrameDeps => ({
  requestFrame: (cb) => requestAnimationFrame(cb),
  cancelFrame: (h) => cancelAnimationFrame(h),
});

/**
 * Longest frame gap passed on, so a tab that was hidden for minutes does not
 * report all of that time. Large enough that slow frames (a busy machine)
 * still keep real-time tick pacing; the runner separately caps catch-up ticks.
 */
export const MAX_FRAME_MS = 1000;

/**
 * Calls `onFrame(elapsedMs, now)` once per animation frame. This only
 * measures time; it never decides game outcomes (the engine's runner turns
 * elapsed time into whole ticks).
 */
export class FrameLoop {
  private handle: number | null = null;
  private last: number | null = null;
  private readonly deps: FrameDeps;

  constructor(private readonly onFrame: (elapsedMs: number, now: number) => void, deps?: Partial<FrameDeps>) {
    this.deps = { ...browserDeps(), ...deps };
  }

  start(): void {
    if (this.handle !== null) return;
    this.last = null;
    this.handle = this.deps.requestFrame(this.loop);
  }

  stop(): void {
    if (this.handle !== null) this.deps.cancelFrame(this.handle);
    this.handle = null;
  }

  get running(): boolean {
    return this.handle !== null;
  }

  private readonly loop = (now: number): void => {
    const elapsed = this.last === null ? 0 : Math.min(MAX_FRAME_MS, Math.max(0, now - this.last));
    this.last = now;
    this.onFrame(elapsed, now);
    this.handle = this.deps.requestFrame(this.loop);
  };
}
