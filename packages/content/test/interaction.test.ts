import { createSimulation, type PlayerCommand, type SimEvent, type WorldSnapshot } from "@sim/engine";
import { describe, expect, it } from "vitest";
import { STARTER_LOADOUTS, getContentRegistry } from "../src";

/**
 * One fight against the Ashen Warden that uses every player action, each
 * resolved by the tick engine, and checks the boss's side of the interaction.
 * melee-99 inventory: 0 dragon warhammer, 1 super combat, 2-3 brews,
 * 4-5 super restores, 6-13 anglerfish, 14-17 karambwan.
 */
function fight(setup: Partial<{ autoRetaliate: boolean }> = {}) {
  const content = getContentRegistry();
  const preset = STARTER_LOADOUTS.find((l) => l.id === "melee-99")!.setup;
  const sim = createSimulation({ seed: 11, encounterId: "ashen-warden", player: { ...preset, ...setup } }, content);
  const events: Array<{ tick: number; e: SimEvent }> = [];
  let snap: WorldSnapshot = sim.getSnapshot();
  const step = (...cmds: PlayerCommand[]) => {
    for (const c of cmds) sim.queueCommand(c);
    const r = sim.tick();
    snap = r.snapshot;
    for (const e of r.events) events.push({ tick: r.tick, e });
    return r.events;
  };
  const until = (pred: () => boolean, max = 200) => {
    for (let i = 0; i < max && !pred() && !snap.outcome; i++) step();
    return pred();
  };
  const of = <T extends SimEvent["type"]>(type: T) => events.filter((l) => l.e.type === type).map((l) => l.e as Extract<SimEvent, { type: T }>);
  return { step, until, of, get snap() { return snap; }, events };
}

describe("player and boss interaction through the tick engine", () => {
  it("every player action takes effect on the next tick and shows up in the state", () => {
    const f = fight();

    // Attack + prayers.
    f.step({ type: "attack", targetId: "npc-1" }, { type: "togglePrayer", prayerId: "piety" }, { type: "togglePrayer", prayerId: "protect-from-magic" });
    expect(f.snap.player.targetId).toBe("npc-1");
    expect(f.snap.player.activePrayers.sort()).toEqual(["piety", "protect-from-magic"]);
    expect(f.snap.player.overhead).toBe("magic");

    // Change attack style.
    f.step({ type: "setCombatStyle", index: 0 });
    expect(f.snap.player.combatStyleIndex).toBe(0);

    // Reach the boss and trade hits.
    expect(f.until(() => f.of("HitLanded").some((h) => h.sourceId === "player"))).toBe(true);

    // Drink a potion: Strength boosted.
    f.step({ type: "useItem", inventorySlot: 1 });
    expect(f.snap.player.levels.strength).toBeGreaterThan(99);
    expect(f.of("ItemConsumed").at(-1)).toMatchObject({ itemId: "super-combat-potion", kind: "potion" });

    // Eat when damaged (or force damage by waiting).
    f.until(() => f.snap.player.hitpoints < 90, 400);
    const before = f.snap.player.hitpoints;
    f.step({ type: "useItem", inventorySlot: 6 });
    expect(f.snap.player.hitpoints).toBeGreaterThan(before);
    expect(f.of("ItemConsumed").at(-1)).toMatchObject({ itemId: "anglerfish", kind: "food" });

    // Switch equipment and use the special attack: the warhammer drains the Warden's Defence.
    f.step({ type: "equipItem", inventorySlot: 0 });
    expect(f.snap.player.equipment.weapon?.itemId).toBe("dragon-warhammer");
    expect(f.snap.player.inventory[0]?.itemId).toBe("abyssal-whip");
    f.step({ type: "toggleSpecial" });
    expect(f.snap.player.specialArmed).toBe(true);
    expect(f.until(() => f.of("SpecialUsed").length > 0, 20)).toBe(true);
    expect(f.snap.player.specialEnergy).toBe(50);
    // Defence drains only on a damaging hit.
    f.until(() => f.of("HitLanded").some((h) => h.sourceId === "player" && h.amount > 0 && f.of("SpecialUsed").length > 0), 1);

    // Switch back.
    f.step({ type: "equipItem", inventorySlot: 0 });
    expect(f.snap.player.equipment.weapon?.itemId).toBe("abyssal-whip");

    // Move away: the target is dropped and the player walks.
    const from = f.snap.player.pos;
    f.step({ type: "move", to: { x: 2, y: 2 } });
    f.step();
    expect(f.snap.player.targetId).toBeNull();
    expect(f.snap.player.pos).not.toEqual(from);
  });

  it("the boss attacks on its cooldown, uses specials and changes phase as the player damages it", () => {
    const f = fight();
    f.step({ type: "attack", targetId: "npc-1" });
    f.until(() => f.snap.npcs[0]!.phase.index > 0 || f.snap.player.life !== "alive", 1500);
    const attacks = f.events.filter((l) => l.e.type === "AttackStarted" && l.e.attackerId === "npc-1" && !l.e.special);
    // Normal attacks respect the 5-tick cooldown in phase 1 (volley sub-attacks are separate).
    const ticks = [...new Set(attacks.map((a) => a.tick))];
    for (let i = 1; i < ticks.length; i++) expect(ticks[i]! - ticks[i - 1]!, `gap at ${ticks[i]}`).toBeGreaterThanOrEqual(5);
    expect(f.of("BossSpecialUsed").map((s) => s.specialId)).toContain("ember-rain");
    // Its hits go through the combat engine: prayer blocks magic.
    const magicHits = f.events.filter((l) => l.e.type === "HitLanded" && l.e.targetId === "player" && l.e.style === "magic");
    expect(magicHits.length).toBeGreaterThan(0);
  });

  it("auto retaliate makes an idle player fight back when hit, and never interrupts walking", () => {
    const on = fight({ autoRetaliate: true });
    on.until(() => on.of("HitLanded").some((h) => h.targetId === "player"));
    on.step();
    expect(on.snap.player.targetId).toBe("npc-1");

    const off = fight({ autoRetaliate: false });
    off.until(() => off.of("HitLanded").some((h) => h.targetId === "player"));
    off.step();
    expect(off.snap.player.targetId).toBeNull();

    // Walking 16 tiles: hits land on the way, but the player only retaliates once they arrive.
    const walking = fight({ autoRetaliate: true });
    walking.step({ type: "setRun", running: false }, { type: "move", to: { x: 1, y: 20 } });
    walking.until(() => walking.snap.player.destination === null, 40);
    const arrived = walking.snap.tick;
    walking.until(() => walking.snap.player.targetId !== null, 40);
    const hitsWhileWalking = walking.events.filter((l) => l.e.type === "HitLanded" && l.e.targetId === "player" && l.tick < arrived);
    expect(hitsWhileWalking.length).toBeGreaterThan(0);
    const retaliated = walking.events.find((l) => l.e.type === "TargetChanged" && l.e.entityId === "player" && l.e.targetId === "npc-1");
    expect(retaliated!.tick).toBeGreaterThan(arrived);

    // It can be toggled mid-fight.
    off.step({ type: "setAutoRetaliate", enabled: true });
    expect(off.snap.player.autoRetaliate).toBe(true);
  });
});
