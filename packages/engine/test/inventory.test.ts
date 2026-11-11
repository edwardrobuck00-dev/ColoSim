import { describe, expect, it } from "vitest";
import {
  applyConsumableEffects,
  createSimulation,
  levelAmount,
  poweredStaffMaxHit,
  weaponFromItem,
  ItemDefSchema,
  type ConsumableInput,
  type ItemDefInput,
  type PlayerCommand,
  type PlayerSetupInput,
  type SimEvent,
} from "../src";
import { ofType } from "./fixtures";
import { buildTestContent, testArena } from "./harness";

const STATS = { hitpoints: 99, attack: 99, strength: 99, defence: 99, ranged: 99, magic: 99, prayer: 99 };
const pct = (n: number) => ({ num: n, den: 100, mult: 1 });
const food = (id: string, heal: number, extra: Partial<ConsumableInput> = {}): ItemDefInput => ({
  id, name: id, consumable: { kind: "food", attackDelayTicks: 3, effects: [{ type: "heal", amount: { terms: [], flat: heal } }], ...extra },
});

const ITEMS: ItemDefInput[] = [
  { id: "whip", name: "Whip", slot: "weapon", requirements: { attack: 70 }, bonuses: { attack: { stab: 0, slash: 82, crush: 0, ranged: 0, magic: 0 }, meleeStrength: 82 },
    weapon: { category: "whip", attackSpeedTicks: 4, rangeTiles: 1 } },
  { id: "greatsword", name: "Greatsword", slot: "weapon", bonuses: { meleeStrength: 132 }, weapon: { category: "two-handed-sword", attackSpeedTicks: 6, rangeTiles: 1, twoHanded: true } },
  { id: "defender", name: "Defender", slot: "shield", bonuses: { meleeStrength: 6 } },
  { id: "helm", name: "Helm", slot: "head", requirements: { defence: 55 }, bonuses: { meleeStrength: 3, prayer: 3 } },
  { id: "bow", name: "Bow", slot: "weapon", bonuses: { attack: { stab: 0, slash: 0, crush: 0, ranged: 69, magic: 0 } },
    weapon: { category: "bow", attackSpeedTicks: 4, rangeTiles: 7, twoHanded: true, ammo: { kind: "arrow", maxTier: 50 } } },
  { id: "rune-arrow", name: "Rune arrow", slot: "ammo", stackable: true, ammo: { kind: "arrow", tier: 40 }, bonuses: { rangedStrength: 49 } },
  { id: "dragon-arrow", name: "Dragon arrow", slot: "ammo", stackable: true, ammo: { kind: "arrow", tier: 60 }, bonuses: { rangedStrength: 60 } },
  { id: "bolts", name: "Bolts", slot: "ammo", stackable: true, ammo: { kind: "bolt", tier: 61 } },
  { id: "trident", name: "Trident", slot: "weapon", bonuses: { attack: { stab: 0, slash: 0, crush: 0, ranged: 0, magic: 15 } },
    weapon: { category: "powered-staff", attackSpeedTicks: 4, rangeTiles: 7, poweredStaff: { magicDivisor: 3, offset: -5 } } },
  food("shark", 20),
  food("lobster", 12),
  { id: "karambwan", name: "Karambwan", consumable: { kind: "combo-food", attackDelayTicks: 2, effects: [{ type: "heal", amount: { terms: [], flat: 18 } }] } },
  { id: "anglerfish", name: "Anglerfish", consumable: { kind: "food", attackDelayTicks: 3,
    effects: [{ type: "heal", overheal: true, amount: { terms: [{ num: 1, den: 10, mult: 1 }, { num: 1, den: 25, mult: 2 }, { num: 1, den: 93, mult: 5 }], flat: 2 } }] } },
  { id: "super-combat", name: "Super combat", consumable: { kind: "potion", doses: 4, attackDelayTicks: 0,
    effects: [{ type: "boost", skills: ["attack", "strength", "defence"], amount: { terms: [pct(15)], flat: 5 } }] } },
  { id: "brew", name: "Brew", consumable: { kind: "potion", doses: 4, attackDelayTicks: 0, effects: [
    { type: "drain", skills: ["attack", "strength", "ranged", "magic"], amount: { terms: [pct(10)], flat: 2 } },
    { type: "heal", overheal: true, amount: { terms: [pct(15)], flat: 2 } },
    { type: "boost", skills: ["defence"], amount: { terms: [pct(20)], flat: 2 } },
  ] } },
  { id: "restore", name: "Restore", consumable: { kind: "potion", doses: 4, attackDelayTicks: 0,
    effects: [{ type: "restore", skills: ["attack", "strength", "defence", "ranged", "magic", "prayer"], amount: { terms: [{ num: 1, den: 4, mult: 1 }], flat: 8 } }] } },
];

function content() {
  return buildTestContent({
    items: ITEMS,
    npcs: [{ id: "post", name: "Post", stats: { hitpoints: 5000, attack: 1, strength: 1, defence: 1, ranged: 1, magic: 1, prayer: 1 } }],
    encounters: [{ id: "vs-post", name: "post", description: "", arenaId: testArena.id, playerSpawn: "player", npcs: [{ npcId: "post", spawn: "boss" }], winCondition: "none" }],
  });
}

function sim(player: PlayerSetupInput) {
  return createSimulation({ seed: 1, encounterId: "vs-post", player: { stats: STATS, ...player } }, content());
}

/** Queues commands, runs one tick, returns its events. */
function step(s: ReturnType<typeof sim>, ...cmds: PlayerCommand[]): SimEvent[] {
  for (const c of cmds) s.queueCommand(c);
  return s.tick().events;
}
const rejections = (e: SimEvent[]) => ofType(e, "CommandRejected").map((r) => r.reason);

describe("equipping", () => {
  it("equips from the inventory, swapping the worn item into that slot, and updates bonuses and speed", () => {
    const s = sim({ equipment: { weapon: "greatsword" }, inventory: [null, "whip"] });
    expect(s.getSnapshot().player.bonuses.meleeStrength).toBe(132);
    step(s, { type: "equipItem", inventorySlot: 1 });
    const p = s.getSnapshot().player;
    expect(p.equipment.weapon!.itemId).toBe("whip");
    expect(p.inventory[1]!.itemId).toBe("greatsword");
    expect(p.bonuses.meleeStrength).toBe(82);
    expect(p.weapon).toMatchObject({ category: "whip", speedTicks: 4 });
    expect(p.combatStyles.map((c) => c.name)).toEqual(["Flick", "Lash", "Deflect"]);
  });

  it("checks requirements against base levels", () => {
    const s = sim({ stats: { ...STATS, attack: 60 }, inventory: ["whip"] });
    expect(rejections(step(s, { type: "equipItem", inventorySlot: 0 }))).toEqual(["Whip requires 70 Attack"]);
  });

  it("a two-handed weapon also takes off the shield, if there is room", () => {
    const s = sim({ equipment: { weapon: "whip", shield: "defender" }, inventory: ["greatsword"] });
    step(s, { type: "equipItem", inventorySlot: 0 });
    const p = s.getSnapshot().player;
    expect(p.equipment.shield).toBeUndefined();
    expect(p.inventory.slice(0, 2).map((x) => x?.itemId)).toEqual(["whip", "defender"]);

    const full = sim({ equipment: { weapon: "whip", shield: "defender" }, inventory: Array.from({ length: 28 }, (_, i) => (i === 0 ? "greatsword" : "shark")) });
    expect(rejections(step(full, { type: "equipItem", inventorySlot: 0 }))).toEqual(["not enough inventory space"]);
  });

  it("a shield takes off a two-handed weapon", () => {
    const s = sim({ equipment: { weapon: "greatsword" }, inventory: ["defender"] });
    step(s, { type: "equipItem", inventorySlot: 0 });
    const p = s.getSnapshot().player;
    expect(p.equipment.weapon).toBeUndefined();
    expect(p.weapon.category).toBe("unarmed");
    expect(p.inventory[0]!.itemId).toBe("greatsword");
  });

  it("stacks identical ammunition and unequips onto an existing stack", () => {
    const s = sim({ equipment: { weapon: "bow", ammo: { itemId: "rune-arrow", quantity: 100 } }, inventory: [{ itemId: "rune-arrow", quantity: 50 }] });
    step(s, { type: "equipItem", inventorySlot: 0 });
    expect(s.getSnapshot().player.equipment.ammo).toEqual({ itemId: "rune-arrow", quantity: 150 });
    step(s, { type: "unequipItem", slot: "ammo" });
    expect(s.getSnapshot().player.inventory[0]).toEqual({ itemId: "rune-arrow", quantity: 150 });
  });

  it("unequipping needs a free slot; moving swaps slots", () => {
    const full = sim({ equipment: { head: "helm" }, inventory: Array.from({ length: 28 }, () => "shark") });
    expect(rejections(step(full, { type: "unequipItem", slot: "head" }))).toEqual(["not enough inventory space"]);
    const s = sim({ inventory: ["shark", null, "lobster"] });
    step(s, { type: "moveItem", from: 0, to: 2 });
    expect(s.getSnapshot().player.inventory.slice(0, 3).map((x) => x?.itemId ?? null)).toEqual(["lobster", null, "shark"]);
  });

  it("rejects impossible starting loadouts", () => {
    expect(() => sim({ stats: { ...STATS, defence: 40 }, equipment: { head: "helm" } })).toThrow(/requires 55 Defence/);
    expect(() => sim({ equipment: { weapon: "greatsword", shield: "defender" } })).toThrow(/two-handed/);
  });
});

describe("eating and drinking", () => {
  it("food heals up to max and delays the next attack by 3 ticks", () => {
    const s = sim({ stats: { ...STATS, hitpoints: 99 }, inventory: ["shark"] });
    const e = step(s, { type: "useItem", inventorySlot: 0 });
    expect(ofType(e, "ItemConsumed")[0]).toMatchObject({ itemId: "shark", hitpointsBefore: 99, hitpointsAfter: 99 }); // already full
    expect(s.getSnapshot().player.inventory[0]).toBeNull();
    expect(s.getSnapshot().player.nextAttackTick).toBe(1 + 3);
  });

  it("normal food has a 3-tick eat timer; a karambwan can follow it in the same tick", () => {
    const s = sim({ inventory: ["shark", "lobster", "karambwan"] });
    const e = step(s, { type: "useItem", inventorySlot: 0 }, { type: "useItem", inventorySlot: 1 }, { type: "useItem", inventorySlot: 2 });
    expect(ofType(e, "ItemConsumed").map((c) => c.itemId)).toEqual(["shark", "karambwan"]);
    expect(rejections(e)).toEqual(["you can't eat yet"]);
    // Shark +3, then karambwan +2 more.
    expect(s.getSnapshot().player.nextAttackTick).toBe(1 + 3 + 2);
    expect(s.getSnapshot().player.eatReadyIn).toBe(3);
  });

  it("potions use their own timer, so food and a potion work in the same tick", () => {
    const s = sim({ inventory: ["shark", "super-combat", "super-combat"] });
    const e = step(s, { type: "useItem", inventorySlot: 0 }, { type: "useItem", inventorySlot: 1 }, { type: "useItem", inventorySlot: 2 });
    expect(ofType(e, "ItemConsumed").map((c) => c.itemId)).toEqual(["shark", "super-combat"]);
    expect(rejections(e)).toEqual(["you can't drink yet"]);
  });

  it("potions have doses; super combat boosts by floor(15%) + 5, and boosts do not stack", () => {
    const s = sim({ inventory: ["super-combat"] });
    step(s, { type: "useItem", inventorySlot: 0 });
    let p = s.getSnapshot().player;
    expect(p.levels).toMatchObject({ attack: 118, strength: 118, defence: 118 }); // 99 + 14 + 5
    expect(p.inventory[0]).toEqual({ itemId: "super-combat", quantity: 3 });
    for (let i = 0; i < 3; i++) s.tick();
    step(s, { type: "useItem", inventorySlot: 0 });
    p = s.getSnapshot().player;
    expect(p.levels.attack).toBe(118); // not 137
  });

  it("brews drain offensive levels, raise Defence and overheal; restores bring levels back", () => {
    const s = sim({ inventory: ["brew", "restore"] });
    step(s, { type: "useItem", inventorySlot: 0 });
    let p = s.getSnapshot().player;
    expect(p.levels).toMatchObject({ attack: 88, strength: 88, ranged: 88, magic: 88, defence: 99 + 19 + 2 }); // 99 - (9 + 2); def + floor(19.8) + 2
    expect(p.hitpoints).toBe(99 + 14 + 2); // floor(99 * 0.15) + 2 = 16 over max
    for (let i = 0; i < 3; i++) s.tick();
    step(s, { type: "useItem", inventorySlot: 1 });
    p = s.getSnapshot().player;
    expect(p.levels).toMatchObject({ attack: 99, strength: 99, ranged: 99, magic: 99, defence: 120 }); // restores never lower boosts
  });

  it("boosted and drained levels move 1 toward base every 100 ticks", () => {
    const s = sim({ inventory: ["super-combat"] });
    step(s, { type: "useItem", inventorySlot: 0 });
    for (let i = 1; i < 100; i++) s.tick();
    expect(s.getSnapshot().player.levels.attack).toBe(117);
  });

  it("rejects items that cannot be eaten", () => {
    const s = sim({ inventory: ["whip"] });
    expect(rejections(step(s, { type: "useItem", inventorySlot: 0 }))).toEqual(["Whip cannot be eaten or drunk"]);
  });
});

describe("consumable formulas", () => {
  it("anglerfish heals 22 at 99 Hitpoints (wiki: 3 to 22)", () => {
    const amount = { terms: [{ num: 1, den: 10, mult: 1 }, { num: 1, den: 25, mult: 2 }, { num: 1, den: 93, mult: 5 }], flat: 2 };
    expect(levelAmount(99, amount)).toBe(22); // 9 + 6 + 5 + 2
    expect(levelAmount(10, amount)).toBe(3); // 1 + 0 + 0 + 2
  });

  it("overheal is capped at max + the amount healed", () => {
    const base = { attack: 99, strength: 99, defence: 99, ranged: 99, magic: 99, prayer: 99, hitpoints: 99 };
    const heal = [{ type: "heal" as const, overheal: true, amount: { terms: [], flat: 22 } }];
    expect(applyConsumableEffects({ base, current: { ...base, hitpoints: 110 } }, heal).current.hitpoints).toBe(121);
    expect(applyConsumableEffects({ base, current: { ...base, hitpoints: 121 } }, heal).current.hitpoints).toBe(121);
  });
});

describe("ammunition", () => {
  function shoot(equipment: PlayerSetupInput["equipment"]) {
    const s = sim({ equipment });
    s.queueCommand({ type: "attack", targetId: "npc-1" });
    const events: SimEvent[] = [];
    for (let i = 0; i < 12; i++) events.push(...s.tick().events);
    return { s, events };
  }

  it("uses one arrow per shot without an Ava's device", () => {
    const { s, events } = shoot({ weapon: "bow", ammo: { itemId: "rune-arrow", quantity: 10 } });
    const shots = ofType(events, "AttackStarted").filter((a) => a.attackerId === "player").length;
    expect(s.getSnapshot().player.equipment.ammo!.quantity).toBe(10 - shots);
  });

  it("refuses ammunition of the wrong kind or above the bow's tier, and stops attacking", () => {
    for (const ammo of ["bolts", "dragon-arrow"]) {
      const { events } = shoot({ weapon: "bow", ammo: { itemId: ammo, quantity: 10 } });
      expect(ofType(events, "AttackStarted").filter((a) => a.attackerId === "player")).toHaveLength(0);
      expect(rejections(events)[0]).toMatch(/can't/);
    }
  });

  it("stops when the ammunition runs out", () => {
    const { s, events } = shoot({ weapon: "bow", ammo: { itemId: "rune-arrow", quantity: 2 } });
    expect(ofType(events, "AttackStarted").filter((a) => a.attackerId === "player")).toHaveLength(2);
    expect(rejections(events)).toContain("you have no ammunition left");
    expect(s.getSnapshot().player.equipment.ammo).toBeUndefined();
  });
});

describe("powered staves", () => {
  it("trident max hit is floor(magic / 3) - 5, using the current (boosted) Magic level", () => {
    const w = weaponFromItem(ItemDefSchema.parse(ITEMS.find((i) => i.id === "trident")!));
    expect(poweredStaffMaxHit(w, 75)).toBe(20);
    expect(poweredStaffMaxHit(w, 99)).toBe(28);
    expect(poweredStaffMaxHit(w, 103)).toBe(29);
  });
});
