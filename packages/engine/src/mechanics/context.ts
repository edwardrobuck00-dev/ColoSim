import type { RngStreamName, Rng } from "../core/rng";
import type { NpcState, PlayerState } from "../entities/types";

/**
 * The restricted API that mechanics see. Mechanics read state and act through
 * this object only, which stops them from depending on engine internals.
 */
export interface MechanicContext {
  readonly tick: number;
  readonly player: Readonly<PlayerState>;
  readonly npcs: ReadonlyArray<Readonly<NpcState>>;
  rng(stream: RngStreamName): Rng;
  /** Shows a message in the combat log. */
  message(text: string): void;
  /** Act on NPCs (encounter rules). */
  npc: {
    /** Heals a living NPC, up to its max hitpoints. */
    heal(npcId: string, amount: number): void;
    /** Overhead text above an NPC. */
    say(npcId: string, text: string): void;
  };
  /** Encounter prayer mechanics. */
  prayer: {
    /** Remove prayer points (all prayers switch off at 0). */
    drainPoints(points: number): void;
    /** Switch off all prayers, or only overheads. */
    deactivate(which: "all" | "overheads"): void;
    /** Prevent overhead prayers from being switched on for `ticks` ticks. */
    lockOverheads(ticks: number): void;
  };
}
