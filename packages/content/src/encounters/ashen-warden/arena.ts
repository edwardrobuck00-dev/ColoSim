import { defineArena, type Tile } from "@sim/engine";

// Four broken columns near the corners leave the floor open for dodging
// telegraphed fire. The Warden returns to the centre between phases.
const pillars: Tile[] = [
  { x: 4, y: 4 }, { x: 17, y: 4 }, { x: 4, y: 17 }, { x: 17, y: 17 },
];

export const cinderHall = defineArena({
  id: "cinder-hall",
  name: "Cinder Hall",
  width: 22,
  height: 22,
  blocked: pillars,
  spawns: { player: { x: 10, y: 4 }, boss: { x: 9, y: 13 }, centre: { x: 9, y: 10 } },
  visualId: "arena.cinder-hall",
});
