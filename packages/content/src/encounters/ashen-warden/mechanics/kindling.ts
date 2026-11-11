import { defineMechanic } from "@sim/engine";
import { z } from "zod";

/**
 * Unique rule: the Warden feeds on its own fire. Every point of fire damage
 * (Ember Rain, Ash Ring, Scorched Earth and its burning ground) the player
 * takes heals the Warden by `healPerDamage`. Standing in fire makes the fight longer.
 */
export const kindlingMechanic = defineMechanic({
  id: "ashen-warden.kindling",
  description: "Fire damage the player takes heals the Warden.",
  params: z.object({ healPerDamage: z.number().int().min(0) }),
  create: ({ healPerDamage }) => ({
    hooks: {
      onHitLanded: (ctx, hit) => {
        if (hit.style !== "typeless" || hit.targetId !== ctx.player.id || hit.amount <= 0) return;
        const warden = ctx.npcs.find((n) => n.id === hit.sourceId && n.defId === "ashen-warden");
        if (warden) ctx.npc.heal(warden.id, hit.amount * healPerDamage);
      },
    },
  }),
});
