import type { HitStyle } from "../api/events";
import type { CombatStyle } from "../defs/common";
import type { MechanicContext } from "./context";
import type { PipelineStep } from "./pipelines";

export interface AttackInfo {
  attackerId: string;
  targetId: string;
  attackId: string;
  style: CombatStyle;
  landTick: number;
}

export interface HitInfo {
  sourceId: string;
  targetId: string;
  amount: number;
  style: HitStyle;
}

export interface DeathInfo {
  entityId: string;
  killerId: string | null;
}

/**
 * Lifecycle points a mechanic can subscribe to. Hooks run in the order
 * mechanics were attached: encounter, then NPCs, then modifiers.
 */
export interface MechanicHooks {
  onEncounterStart?(ctx: MechanicContext): void;
  onTick?(ctx: MechanicContext): void;
  /** After an attack has been rolled and its hit scheduled. */
  onAttackStart?(ctx: MechanicContext, attack: AttackInfo): void;
  /** After a hit has been applied to its target. */
  onHitLanded?(ctx: MechanicContext, hit: HitInfo): void;
  /** When an entity's hitpoints reach 0. */
  onEntityDeath?(ctx: MechanicContext, death: DeathInfo): void;
  /** When a dead entity comes back. */
  onEntityRespawn?(ctx: MechanicContext, entityId: string): void;
  /** Return a reason string to end the encounter as a loss. */
  checkLoss?(ctx: MechanicContext): string | undefined;
  /** Return a reason string to end the encounter as a win. */
  checkWin?(ctx: MechanicContext): string | undefined;
}

export interface MechanicInstance {
  hooks?: MechanicHooks;
  pipelines?: PipelineStep[];
}
