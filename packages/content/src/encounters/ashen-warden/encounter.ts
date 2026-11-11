import { defineEncounter } from "@sim/engine";

export const ashenWardenEncounter = defineEncounter({
  id: "ashen-warden",
  name: "The Ashen Warden",
  description: "A three-phase boss. It slams anyone next to it (melee), fires blue-violet bolts (magic) and lobs green rocks (ranged), rains fire on telegraphed tiles, and heals from fire you stand in. Read the colour, switch your protection prayer, move off the glowing tiles.",
  arenaId: "cinder-hall",
  playerSpawn: "player",
  npcs: [{ npcId: "ashen-warden", spawn: "boss" }],
  mechanics: [{ id: "announce", params: { text: "The Ashen Warden rises from the ash." } }],
  modifiers: ["smothering-ash", "severed-faith", "draining-embers"],
  winCondition: "all-npcs-dead",
  tags: ["boss"],
});
