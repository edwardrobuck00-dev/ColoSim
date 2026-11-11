import type { PlayerCommand } from "../api/commands";
import type { SimEvent } from "../api/events";
import type { TickResult } from "../api/simulation";
import type { WorldSnapshot } from "../api/snapshot";

/**
 * One tick of a fight as it happened: the state after the tick, the events it
 * produced, the player inputs applied at its start, and the state hash. Tick 0
 * holds the starting state and spawn events.
 */
export interface TickRecord {
  tick: number;
  snapshot: WorldSnapshot;
  events: SimEvent[];
  commands: PlayerCommand[];
  hash: string;
}

/**
 * Every tick of a fight, in order, for review and inspection. Pure data, no
 * UI: hosts read records by tick, and replays are rebuilt into one.
 */
export class FightHistory {
  private readonly records: TickRecord[] = [];

  constructor(initial: { snapshot: WorldSnapshot; events: SimEvent[]; hash: string }) {
    this.records.push({ tick: 0, snapshot: initial.snapshot, events: initial.events, commands: [], hash: initial.hash });
  }

  /** Adds the next tick. Ticks must arrive in order. */
  record(result: Pick<TickResult, "tick" | "snapshot" | "events" | "commands" | "hash">): TickRecord {
    const expected = this.latestTick + 1;
    if (result.tick !== expected) throw new Error(`FightHistory: expected tick ${expected}, got ${result.tick}`);
    const rec: TickRecord = { tick: result.tick, snapshot: result.snapshot, events: result.events, commands: result.commands, hash: result.hash };
    this.records.push(rec);
    return rec;
  }

  get latestTick(): number {
    return this.records[this.records.length - 1]!.tick;
  }

  get length(): number {
    return this.records.length;
  }

  /** The record for a tick, or undefined outside 0..latestTick. */
  at(tick: number): TickRecord | undefined {
    return Number.isInteger(tick) && tick >= 0 ? this.records[tick] : undefined;
  }

  /** Records from `from` to `to` inclusive (clamped). */
  range(from: number, to: number): TickRecord[] {
    return this.records.slice(Math.max(0, from), Math.min(this.latestTick, to) + 1);
  }

  /** Drops every tick after `tick` (when continuing a fight from an earlier point). */
  truncateAfter(tick: number): void {
    if (tick < 0) throw new Error("FightHistory: cannot truncate before tick 0");
    this.records.length = Math.min(this.records.length, tick + 1);
  }

  /** Player inputs up to and including `tick`, in replay input-log form. */
  inputsThrough(tick: number): Array<{ tick: number; commands: PlayerCommand[] }> {
    return this.records.slice(1, tick + 1).filter((r) => r.commands.length > 0).map((r) => ({ tick: r.tick, commands: r.commands }));
  }

  /** Ticks whose events match, e.g. phase changes, for timeline markers. */
  ticksWhere(match: (e: SimEvent) => boolean, fromTick = 0): number[] {
    const out: number[] = [];
    for (let i = Math.max(0, fromTick); i < this.records.length; i++) if (this.records[i]!.events.some(match)) out.push(this.records[i]!.tick);
    return out;
  }
}
