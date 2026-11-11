import { defineAttack } from "@sim/engine";

/*
 * The Ashen Warden's attacks. Colour language (docs/visual-style.md):
 * magic is a blue-violet orb, ranged a green lobbed rock, melee a slam with no projectile.
 */

/** Heavy overhead slam, only when the player stands next to the Warden. */
export const wardenSlam = defineAttack({
  id: "warden-slam",
  name: "Slam",
  style: "crush",
  maxHit: 32,
  speedTicks: 5,
  rangeTiles: 1,
  accuracyBonus: 60,
  animationCue: "attack.slam",
});

/** A burning bolt: magic. */
export const wardenCinderBolt = defineAttack({
  id: "warden-cinder-bolt",
  name: "Cinder bolt",
  style: "magic",
  maxHit: 28,
  speedTicks: 5,
  rangeTiles: 14,
  accuracyBonus: 40,
  projectile: { visualId: "projectile.warden-magic" },
  animationCue: "attack.cast",
});

/** A lobbed rock: ranged. */
export const wardenEmberLob = defineAttack({
  id: "warden-ember-lob",
  name: "Ember lob",
  style: "ranged",
  maxHit: 26,
  speedTicks: 5,
  rangeTiles: 14,
  accuracyBonus: 40,
  projectile: { visualId: "projectile.warden-ranged" },
  animationCue: "attack.throw",
});
