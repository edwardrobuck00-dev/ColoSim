import type { ContentPack } from "../../packs/types";
import type { EncounterBundle } from "../types";
import { cinderHall } from "./arena";
import { wardenCinderBolt, wardenEmberLob, wardenSlam } from "./attacks";
import { ashenWardenEncounter } from "./encounter";
import { kindlingMechanic } from "./mechanics/kindling";
import { drainingEmbers, severedFaith, smotheringAsh } from "./modifiers";
import { ashenWarden } from "./npcs";

export const ashenWardenBundle: EncounterBundle = {
  encounter: ashenWardenEncounter,
  npcs: [ashenWarden],
  attacks: [wardenSlam, wardenCinderBolt, wardenEmberLob],
  modifiers: [smotheringAsh, severedFaith, drainingEmbers],
  mechanics: [kindlingMechanic],
};

export const ashenWardenPack: ContentPack = {
  id: "ashen-warden",
  name: "The Ashen Warden",
  version: "1.0.0",
  description: "An original three-phase boss in the Cinder Hall.",
  requires: ["osrs-base"],
  arenas: [cinderHall],
  encounters: [ashenWardenBundle],
};
