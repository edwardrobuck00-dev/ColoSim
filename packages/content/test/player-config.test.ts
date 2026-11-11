import { createSimulation, type PlayerCommand, type SimEvent } from "@sim/engine";
import { describe, expect, it } from "vitest";
import { STARTER_LOADOUTS, getContentRegistry } from "../src";

/**
 * Equipment, stats and prayers together, with real OSRS items and prayers.
 * Expected max hits are worked out by hand from the OSRS Wiki formulas.
 *
 * melee-99 preset: abyssal whip and gear totalling +136 melee strength.
 * Whip styles: Flick (accurate), Lash (controlled, +1), Deflect (defensive).
 */
const content = getContentRegistry();
const preset = STARTER_LOADOUTS.find((l) => l.id === "melee-99")!.setup;

function fight(...setup: PlayerCommand[]) {
  const sim = createSimulation({ seed: 2, encounterId: "training-grounds", player: { ...preset, combatStyle: 1 } }, content);
  for (const c of setup) sim.queueCommand(c);
  sim.tick();
  return {
    sim,
    nextMaxHit(): number {
      sim.queueCommand({ type: "attack", targetId: "npc-1" });
      for (let i = 0; i < 30; i++) {
        const hit = sim.tick().events.find((e): e is Extract<SimEvent, { type: "HitLanded" }> => e.type === "HitLanded" && e.sourceId === "player");
        if (hit) return hit.maxHit;
      }
      throw new Error("no hit");
    },
  };
}

const drink = (slot: number): PlayerCommand => ({ type: "useItem", inventorySlot: slot });
const pray = (id: string): PlayerCommand => ({ type: "togglePrayer", prayerId: id });

describe("equipment + stats + prayers (hand-calculated)", () => {
  it("whip, no boosts: (99 + 1 + 8) = 108 -> floor((108 * 200 + 320) / 640) = 34", () => {
    expect(fight().nextMaxHit()).toBe(34);
  });

  it("Piety: floor(99 * 1.23) = 121; + 1 + 8 = 130 -> 41", () => {
    expect(fight(pray("piety")).nextMaxHit()).toBe(41);
  });

  it("super combat (+19 Str) and Piety: floor(118 * 1.23) = 145; + 9 = 154 -> 48", () => {
    expect(fight(drink(1), pray("piety")).nextMaxHit()).toBe(48);
  });

  it("then a Saradomin brew drains Str 118 -> 105: floor(105 * 1.23) = 129; + 9 = 138 -> 43", () => {
    const f = fight(drink(1), pray("piety"));
    f.sim.queueCommand(drink(2)); // potion timer: 3 ticks later
    for (let i = 0; i < 4; i++) f.sim.tick();
    f.sim.queueCommand(drink(2));
    f.sim.tick();
    expect(f.sim.getSnapshot().player.levels.strength).toBe(105);
    expect(f.nextMaxHit()).toBe(43);
  });

  it("taking off the berserker ring (+4 Str): 154 * 196 -> 47", () => {
    expect(fight(drink(1), pray("piety"), { type: "unequipItem", slot: "ring" }).nextMaxHit()).toBe(47);
  });

  it("the equipment prayer bonus (+9) slows Piety's drain: resistance 78", () => {
    const f = fight(pray("piety"));
    for (let i = 0; i < 99; i++) f.sim.tick();
    // 24 per tick against 78: one point every 3.25 ticks -> 30 points in 100 ticks.
    expect(99 - f.sim.getSnapshot().player.prayerPoints).toBe(30);
  });
});

describe("the snapshot's combat readout follows configuration, prayers and gear", () => {
  it("max hit and defence rolls change on the tick a prayer or level changes", () => {
    const f = fight();
    const snap = () => f.sim.getSnapshot().player;
    expect(snap().offence?.maxHit).toBe(34);
    const plainDef = snap().defenceRolls.slash;

    f.sim.queueCommand(pray("piety"));
    f.sim.tick();
    expect(snap().offence?.maxHit).toBe(41);
    // Piety +25% Defence: floor(99 * 1.25) + 1 + 8 = 132 vs 108 without, same gear bonus.
    expect(snap().defenceRolls.slash * 108).toBe(plainDef * 132);

    f.sim.queueCommand(pray("piety"));
    // Primordial boots need 75 Strength, so 60 is refused; 80 is allowed.
    f.sim.queueCommand({ type: "setBaseLevel", skill: "strength", level: 60 });
    expect(f.sim.tick().events).toContainEqual({ type: "CommandRejected", command: "setBaseLevel", reason: "Primordial boots requires 75 Strength" });
    f.sim.queueCommand({ type: "setBaseLevel", skill: "strength", level: 80 });
    f.sim.tick();
    // 80 + 1 + 8 = 89 -> floor((89 * 200 + 320) / 640) = 28
    expect(snap().offence?.maxHit).toBe(28);
    expect(snap().defenceRolls.slash).toBe(plainDef);
  });
});

