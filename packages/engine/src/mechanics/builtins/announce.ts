import { z } from "zod";
import { defineMechanic } from "../registry";

/** Posts a message to the combat log when the encounter starts. */
export const announceMechanic = defineMechanic({
  id: "announce",
  description: "Shows a message in the combat log when the encounter starts.",
  params: z.object({ text: z.string().min(1) }),
  create: ({ text }) => ({
    hooks: { onEncounterStart: (ctx) => ctx.message(text) },
  }),
});
