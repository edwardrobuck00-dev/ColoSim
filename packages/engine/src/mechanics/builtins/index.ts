import { MechanicRegistry } from "../registry";
import { announceMechanic } from "./announce";
import { loseAtResourceZeroMechanic } from "./lose-at-resource-zero";
import { scaleResourceRateMechanic } from "./scale-resource-rate";
import { disableProtectionPrayersMechanic, drainPrayerOnHitMechanic, scalePrayerDrainMechanic } from "./prayer-mechanics";

export const BUILTIN_MECHANICS = [
  announceMechanic,
  loseAtResourceZeroMechanic,
  scaleResourceRateMechanic,
  disableProtectionPrayersMechanic,
  drainPrayerOnHitMechanic,
  scalePrayerDrainMechanic,
];

/** A registry pre-loaded with every built-in mechanic. Content adds its own on top. */
export function createDefaultMechanicRegistry(): MechanicRegistry {
  const registry = new MechanicRegistry();
  for (const m of BUILTIN_MECHANICS) registry.register(m);
  return registry;
}
