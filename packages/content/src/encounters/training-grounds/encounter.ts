import { defineEncounter } from "@sim/engine";

export const trainingGrounds = defineEncounter({
  id: "training-grounds",
  name: "Training Grounds",
  description: "A safe yard for learning movement and controls. The dummy never fights back, and respawns when knocked down.",
  arenaId: "training-yard",
  playerSpawn: "player",
  npcs: [{ npcId: "training-dummy", spawn: "dummy" }],
  mechanics: [{ id: "announce", params: { text: "Welcome to the training yard. Click a tile to move, or the dummy to attack it." } }],
  modifiers: ["heavy-legs"],
  winCondition: "none",
  playerDeath: "respawn",
  tags: ["tutorial"],
});
