import { z } from "zod";
import { PIPELINES } from "../pipelines";
import { defineMechanic } from "../registry";

/** Multiplies run energy drain or regeneration. Demonstrates the pipeline extension point. */
export const scaleResourceRateMechanic = defineMechanic({
  id: "scale-resource-rate",
  description: "Multiplies run energy drain or regeneration by a factor.",
  params: z.object({
    pipeline: z.enum([PIPELINES.runEnergyDrain, PIPELINES.runEnergyRegen]),
    multiplier: z.number().min(0).max(100),
  }),
  create: ({ pipeline, multiplier }) => ({
    pipelines: [{ name: pipeline, priority: 100, apply: (v) => v * multiplier }],
  }),
});
