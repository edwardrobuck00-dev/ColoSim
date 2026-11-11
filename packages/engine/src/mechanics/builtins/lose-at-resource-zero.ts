import { z } from "zod";
import { defineMechanic } from "../registry";

/** Ends the encounter as a loss when one of the player's resources reaches zero. */
export const loseAtResourceZeroMechanic = defineMechanic({
  id: "lose-at-resource-zero",
  description: "The player loses when the chosen resource reaches 0.",
  params: z.object({ resource: z.enum(["prayerPoints", "runEnergy"]) }),
  create: ({ resource }) => ({
    hooks: {
      checkLoss: (ctx) => (ctx.player[resource] <= 0 ? `${resource} reached 0` : undefined),
    },
  }),
});
