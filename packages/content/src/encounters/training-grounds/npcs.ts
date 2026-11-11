import { defineNpc } from "@sim/engine";

export const trainingDummy = defineNpc({
  id: "training-dummy",
  name: "Training dummy",
  size: 1,
  stats: { hitpoints: 300, attack: 1, strength: 1, defence: 1, ranged: 1, magic: 1, prayer: 1 },
  deathTicks: 3,
  respawnTicks: 10,
  tags: ["dummy"],
  visualId: "npc.training-dummy",
});
