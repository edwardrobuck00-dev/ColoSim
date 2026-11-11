import { defineArena } from "@sim/engine";

export const trainingYard = defineArena({
  id: "training-yard",
  name: "Training Yard",
  width: 16,
  height: 16,
  blocked: [
    { x: 4, y: 11 }, { x: 11, y: 11 }, { x: 4, y: 4 }, { x: 11, y: 4 }, // corner posts
  ],
  spawns: { player: { x: 7, y: 2 }, dummy: { x: 7, y: 9 } },
  visualId: "arena.training-yard",
});
