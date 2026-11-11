/**
 * Queue of events due on a future tick (delayed hits, projectile landings,
 * hazard detonations). Events due on the same tick run in insertion order,
 * which keeps the simulation deterministic.
 */
export interface ScheduledEvent<T = unknown> {
  dueTick: number;
  seq: number;
  kind: string;
  payload: T;
}

export class Scheduler {
  private queue: ScheduledEvent[] = [];
  private seq = 0;

  schedule<T>(dueTick: number, kind: string, payload: T): void {
    this.queue.push({ dueTick, seq: this.seq++, kind, payload });
    this.queue.sort((a, b) => a.dueTick - b.dueTick || a.seq - b.seq);
  }

  /** Removes and returns every event due on or before `tick`. */
  takeDue(tick: number): ScheduledEvent[] {
    let n = 0;
    while (n < this.queue.length && this.queue[n]!.dueTick <= tick) n++;
    return this.queue.splice(0, n);
  }

  get size(): number {
    return this.queue.length;
  }

  serialize(): ScheduledEvent[] {
    return this.queue.map((e) => ({ ...e }));
  }
}
