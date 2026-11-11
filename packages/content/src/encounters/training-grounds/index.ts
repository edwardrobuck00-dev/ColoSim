import type { ContentPack } from "../../packs/types";
import type { EncounterBundle } from "../types";
import { trainingYard } from "./arena";
import { trainingGrounds } from "./encounter";
import { heavyLegs } from "./modifiers";
import { trainingDummy } from "./npcs";

export const trainingGroundsBundle: EncounterBundle = {
  encounter: trainingGrounds,
  npcs: [trainingDummy],
  attacks: [],
  modifiers: [heavyLegs],
  mechanics: [],
};

export const trainingGroundsPack: ContentPack = {
  id: "training-grounds",
  name: "Training grounds",
  version: "1.0.0",
  description: "A practice dummy in an open yard, for trying setups.",
  requires: ["osrs-base"],
  arenas: [trainingYard],
  encounters: [trainingGroundsBundle],
};
