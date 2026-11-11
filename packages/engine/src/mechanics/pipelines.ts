import type { CombatStyle } from "../defs/common";
import type { MechanicContext } from "./context";

/**
 * Named value pipelines. Every number a mechanic may want to change is
 * computed as `pipelines.run(name, baseValue, ctx, info)`; mechanics add steps
 * instead of editing formula code. Steps run in ascending priority, then
 * registration order. Results are floored to integers.
 */
export const PIPELINES = {
  runEnergyDrain: "runEnergy.drainPerTick",
  runEnergyRegen: "runEnergy.regenPerTick",
  /** Attacker's accuracy roll. */
  attackRoll: "accuracy.attackRoll",
  /** Defender's defence roll. */
  defenceRoll: "accuracy.defenceRoll",
  /** Maximum damage of an attack. */
  maxHit: "damage.maxHit",
  /** Damage about to be applied when a hit lands (after the roll). */
  incomingDamage: "damage.incoming",
  /** Ticks until the attacker may attack again. */
  attackSpeed: "attack.speedTicks",
  /** Total prayer drain effect added to the drain counter each tick. */
  prayerDrainEffect: "prayer.drainEffect",
  /** Ticks between natural hitpoint regeneration (1 HP each). */
  hitpointRegenInterval: "hitpoints.regenIntervalTicks",
} as const;
export type PipelineName = (typeof PIPELINES)[keyof typeof PIPELINES] | (string & {});

/** Who and what a combat pipeline value is about. Absent for non-combat pipelines. */
export interface PipelineInfo {
  attackerId?: string;
  targetId?: string;
  style?: CombatStyle;
  attackId?: string;
}

export interface PipelineStep {
  name: PipelineName;
  priority?: number;
  apply(value: number, ctx: MechanicContext, info: PipelineInfo): number;
}

interface RegisteredStep extends PipelineStep {
  priority: number;
  order: number;
}

export class PipelineRegistry {
  private readonly steps = new Map<string, RegisteredStep[]>();
  private order = 0;

  add(step: PipelineStep): void {
    const list = this.steps.get(step.name) ?? [];
    list.push({ ...step, priority: step.priority ?? 0, order: this.order++ });
    list.sort((a, b) => a.priority - b.priority || a.order - b.order);
    this.steps.set(step.name, list);
  }

  run(name: PipelineName, base: number, ctx: MechanicContext, info: PipelineInfo = {}): number {
    let value = base;
    for (const step of this.steps.get(name) ?? []) value = step.apply(value, ctx, info);
    return Math.floor(value);
  }
}
