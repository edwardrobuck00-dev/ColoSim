import { defineNpc } from "@sim/engine";

/**
 * The Ashen Warden: an original three-phase boss, defined entirely as data
 * for the engine's boss framework (defs/behaviour.ts).
 *
 * Phase 1, Smouldering (100% to 66%): switches between magic and ranged every
 *   4 attacks; half its attacks are slams if you stand next to it; every 6th attack is Ember Rain
 *   (3x3 fire on your tile, 4 ticks to move).
 * Phase 2, Kindled (66% to 33%): returns to the centre (invulnerable 4 ticks),
 *   opens with a Cinder Volley (magic, ranged, magic, 2 ticks apart), then
 *   picks magic or ranged at random every attack. Every 5th attack is a
 *   volley or Ember Rain.
 * Phase 3, Inferno (33% to 0%): armour cracks (lower defence), faster
 *   attacks, opens with Scorched Earth (fire across the arena that keeps
 *   burning). Every 4th attack is Ash Ring (around itself), Ember Rain or
 *   Scorched Earth.
 * Enrage: at 12% hitpoints, or after 5 minutes: 1 tick faster, max hits x1.25.
 */
export const ashenWarden = defineNpc({
  id: "ashen-warden",
  name: "The Ashen Warden",
  size: 3,
  stats: { hitpoints: 450, attack: 150, strength: 150, defence: 150, ranged: 140, magic: 140, prayer: 1 },
  defence: { stab: 60, slash: 80, crush: 30, ranged: 80, magic: 40 },
  specials: [
    {
      id: "ember-rain", name: "Ember Rain", kind: "tile-aoe", say: "Burn!", animationCue: "attack.cast",
      params: { area: { shape: "around-target", radius: 1 }, delayTicks: 4, damage: [25, 40] },
    },
    {
      id: "cinder-volley", name: "Cinder Volley", kind: "volley", animationCue: "attack.cast", cooldownTicks: 7,
      params: { attacks: [
        { attack: "warden-cinder-bolt", delayTicks: 0 },
        { attack: "warden-ember-lob", delayTicks: 2 },
        { attack: "warden-cinder-bolt", delayTicks: 4 },
      ] },
    },
    {
      id: "ash-ring", name: "Ash Ring", kind: "tile-aoe", say: "Back!", animationCue: "attack.slam",
      params: { area: { shape: "ring-around-self", inner: 1, outer: 2 }, delayTicks: 3, damage: [30, 45] },
    },
    {
      id: "scorched-earth", name: "Scorched Earth", kind: "tile-aoe", animationCue: "attack.slam", cooldownTicks: 6,
      params: { area: { shape: "random-tiles", count: 70 }, delayTicks: 4, damage: [15, 25], lingerTicks: 8, lingerDamage: 4 },
    },
  ],
  behaviour: {
    phases: [
      {
        id: "smouldering", name: "Smouldering", movement: "chase",
        pattern: { type: "switch", attacks: ["warden-cinder-bolt", "warden-ember-lob"], every: 4 },
        closeRange: { attack: "warden-slam", chance: 0.5 },
        specials: { every: 6, ids: ["ember-rain"] },
      },
      {
        id: "kindled", name: "Kindled", atHpPercent: 66, movement: "chase",
        pattern: { type: "random", attacks: [{ attack: "warden-cinder-bolt" }, { attack: "warden-ember-lob" }] },
        closeRange: { attack: "warden-slam", chance: 0.5 },
        specials: { every: 5, ids: ["cinder-volley", "ember-rain"] },
        onEnter: {
          say: "The ash stirs!", message: "The Warden returns to the centre of the hall, wreathed in fire.",
          invulnerableTicks: 4, pauseTicks: 4, moveTo: "centre", special: "cinder-volley",
        },
      },
      {
        id: "inferno", name: "Inferno", atHpPercent: 33, movement: "chase",
        pattern: { type: "rotation", attacks: ["warden-cinder-bolt", "warden-ember-lob"] },
        closeRange: { attack: "warden-slam", chance: 0.6 },
        attackSpeedTicks: 4,
        defence: { stab: 20, slash: 30, crush: 0, ranged: 50, magic: 20 },
        specials: { every: 4, ids: ["ash-ring", "ember-rain", "scorched-earth"] },
        onEnter: {
          say: "Burn with me!", message: "The Warden's armour cracks. The floor catches fire.",
          invulnerableTicks: 4, pauseTicks: 3, special: "scorched-earth",
        },
      },
    ],
    enrage: {
      atHpPercent: 12, afterTicks: 500, attackSpeedDelta: -1, maxHitMultiplier: [5, 4],
      say: "ENOUGH!", message: "The Warden erupts in fury: faster, harder attacks.",
    },
  },
  mechanics: [{ id: "ashen-warden.kindling", params: { healPerDamage: 2 } }],
  tags: ["boss"],
  visualId: "npc.ashen-warden",
});
