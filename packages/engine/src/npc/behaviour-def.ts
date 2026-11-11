import type { BehaviourDef, PhaseDef } from "../defs/behaviour";
import type { StyleBonuses } from "../defs/common";
import type { NpcDef } from "../defs/npc";
import type { NpcState } from "../entities/types";

/** Pure lookups on an NPC's behaviour data (no simulation side effects). */

const implicit = new WeakMap<NpcDef, BehaviourDef>();

/** The NPC's behaviour, or one phase built from its legacy `attacks` and `ai` fields. */
export function behaviourOf(def: NpcDef): BehaviourDef {
  if (def.behaviour) return def.behaviour;
  let b = implicit.get(def);
  if (!b) {
    const phase: PhaseDef = {
      id: "default",
      movement: def.ai.movement,
      pattern:
        def.ai.selection === "random"
          ? { type: "random", attacks: def.attacks.map((attack) => ({ attack, weight: 1 })) }
          : { type: "rotation", attacks: def.attacks },
      onEnter: { invulnerableTicks: 0, pauseTicks: 0, healPercent: 0 },
    };
    b = { phases: [phase] };
    implicit.set(def, b);
  }
  return b;
}

export function currentPhase(def: NpcDef, npc: NpcState): PhaseDef {
  const phases = behaviourOf(def).phases;
  return phases[Math.min(npc.boss.phaseIndex, phases.length - 1)]!;
}

/** Defence bonuses in force: the phase's, or the NPC's own. */
export function npcDefenceBonuses(def: NpcDef, npc: NpcState): StyleBonuses {
  return currentPhase(def, npc).defence ?? def.defence;
}

