import { defineModifier } from "@sim/engine";

export const smotheringAsh = defineModifier({
  id: "smothering-ash",
  name: "Smothering Ash",
  description: "Run energy drains twice as fast and never recovers. You lose at 0 run energy.",
  mechanics: [
    { id: "scale-resource-rate", params: { pipeline: "runEnergy.drainPerTick", multiplier: 2 } },
    { id: "scale-resource-rate", params: { pipeline: "runEnergy.regenPerTick", multiplier: 0 } },
    { id: "lose-at-resource-zero", params: { resource: "runEnergy" } },
  ],
  tags: ["contract"],
});

/** Encounter prayer mechanic: protection prayers are knocked off and locked out on a timer. */
export const severedFaith = defineModifier({
  id: "severed-faith",
  name: "Severed Faith",
  description: "Every 25 ticks the Warden severs your overhead prayers; they cannot be used again for 5 ticks.",
  mechanics: [{ id: "disable-protection-prayers", params: { everyTicks: 25, lockTicks: 5, message: "The Warden severs your faith!" } }],
  tags: ["contract"],
});

/** Encounter prayer mechanic: ember hits burn away prayer points, even when blocked. */
export const drainingEmbers = defineModifier({
  id: "draining-embers",
  name: "Draining Embers",
  description: "Ember lobs drain 3 prayer points plus half the damage dealt, even through protection.",
  mechanics: [{ id: "drain-prayer-on-hit", params: { flat: 3, percentOfDamage: 50, styles: ["ranged"] } }],
  tags: ["contract"],
});
