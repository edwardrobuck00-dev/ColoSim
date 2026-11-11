import { defineModifier } from "@sim/engine";

export const heavyLegs = defineModifier({
  id: "heavy-legs",
  name: "Heavy Legs",
  description: "Run energy drains three times faster.",
  mechanics: [{ id: "scale-resource-rate", params: { pipeline: "runEnergy.drainPerTick", multiplier: 3 } }],
});
