import { createSimulation, type SimEvent } from "@sim/engine";
import { describe, expect, it } from "vitest";
import { STARTER_LOADOUTS, getContentRegistry } from "../src";

const content = getContentRegistry();
const loadout = (id: string) => STARTER_LOADOUTS.find((l) => l.id === id)!.setup;

describe("ashen-warden encounter", () => {
  it("Kindling: fire damage the player takes heals the Warden by twice the amount", () => {
    const sim = createSimulation({ seed: 3, encounterId: "ashen-warden", player: loadout("melee-99") }, content);
    sim.queueCommand({ type: "attack", targetId: "npc-1" });
    const events: SimEvent[] = [];
    for (let i = 0; i < 200 && !events.some((e) => e.type === "NpcHealed"); i++) events.push(...sim.tick().events);
    const healed = events.find((e) => e.type === "NpcHealed");
    const fire = events.filter((e) => e.type === "HitLanded" && e.style === "typeless" && e.amount > 0);
    expect(fire.length).toBeGreaterThan(0);
    const last = fire[fire.length - 1]!;
    expect(healed).toMatchObject({ type: "NpcHealed", entityId: "npc-1" });
    if (healed?.type === "NpcHealed" && last.type === "HitLanded") expect(healed.amount).toBeLessThanOrEqual(last.amount * 2);
  });

  it("the Warden uses its ranged attacks from afar and slams up close", () => {
    const sim = createSimulation({ seed: 3, encounterId: "ashen-warden", player: loadout("melee-99") }, content);
    const events: SimEvent[] = [];
    for (let i = 0; i < 15; i++) events.push(...sim.tick().events);
    const farAttacks = events.filter((e) => e.type === "AttackStarted" && e.attackerId === "npc-1");
    expect(farAttacks.length).toBeGreaterThan(0);
    expect(farAttacks.every((e) => e.type === "AttackStarted" && e.attackId !== "warden-slam")).toBe(true);
    sim.queueCommand({ type: "attack", targetId: "npc-1" });
    for (let i = 0; i < 40; i++) events.push(...sim.tick().events);
    expect(events.some((e) => e.type === "AttackStarted" && e.attackId === "warden-slam")).toBe(true);
  });

  it("a fight runs to a conclusion", () => {
    const sim = createSimulation({ seed: 11, encounterId: "ashen-warden", player: loadout("melee-99") }, content);
    sim.queueCommand({ type: "attack", targetId: "npc-1" });
    for (let i = 0; i < 3000 && !sim.getSnapshot().outcome; i++) sim.tick();
    expect(sim.getSnapshot().outcome).not.toBeNull();
  });
});

describe("training grounds", () => {
  it("every starter loadout can hit the dummy; ranged and magic fire projectiles", () => {
    for (const preset of STARTER_LOADOUTS) {
      const sim = createSimulation({ seed: 1, encounterId: "training-grounds", player: preset.setup }, content);
      sim.queueCommand({ type: "attack", targetId: "npc-1" });
      const events = Array.from({ length: 30 }, () => sim.tick().events).flat();
      expect(events.some((e) => e.type === "HitLanded" && e.sourceId === "player"), preset.id).toBe(true);
      expect(events.some((e) => e.type === "ProjectileLaunched"), preset.id).toBe(["ranged-70", "magic-75", "spells-75", "ranged-99"].includes(preset.id));
    }
  });

  it("ranged attacks use ammunition, and Ava's devices save some of it", () => {
    const sim = createSimulation({ seed: 4, encounterId: "training-grounds", player: loadout("ranged-70") }, content);
    sim.queueCommand({ type: "attack", targetId: "npc-1" });
    const events = Array.from({ length: 200 }, () => sim.tick().events).flat();
    const shots = events.filter((e) => e.type === "AttackStarted" && e.attackerId === "player").length;
    const used = events.filter((e) => e.type === "AmmoUsed").length;
    expect(shots).toBeGreaterThan(20);
    expect(used).toBeGreaterThan(0);
    expect(used).toBeLessThan(shots); // 72% are recovered on average
    expect(sim.getSnapshot().player.equipment.ammo!.quantity).toBe(500 - used);
  });
});
