import { describe, expect, it } from "vitest";
import { describeEvent } from "../src/utils/event-log";
import { formatRunEnergy, formatTicks, keyLabel, percent } from "../src/utils/format";
import { equippedItems, totalBonuses } from "../src/utils/equipment";
import { content } from "../src/services/content";
import { PRESETS } from "../src/services/loadouts";
import { replayProblem } from "../src/utils/replays";
import { ENGINE_VERSION } from "@sim/engine";

describe("format", () => {
  it("formats ticks as game time", () => {
    expect(formatTicks(0)).toBe("0:00.0");
    expect(formatTicks(100)).toBe("1:00.0");
    expect(formatTicks(1)).toBe("0:00.6");
  });

  it("formats run energy, percentages and key names", () => {
    expect(formatRunEnergy(9950)).toBe("99%");
    expect(percent(5, 0)).toBe(0);
    expect(percent(50, 100)).toBe(50);
    expect(keyLabel("KeyR")).toBe("R");
  });
});

describe("event log", () => {
  it("describes mechanic messages and ignores movement", () => {
    expect(describeEvent({ type: "MechanicMessage", mechanicId: "x", text: "Hi" }, (id) => id)).toEqual({ category: "mechanic", text: "Hi" });
    expect(describeEvent({ type: "EntityMoved", entityId: "player", from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, running: false }, (id) => id)).toBeNull();
  });
});

describe("equipment totals", () => {
  it("sums bonuses of the equipped items", () => {
    // melee-70: dragon scimitar 66, neitiznot 3, fighter torso 4, dragon platelegs 0, dragon defender 6,
    // barrows gloves 12, dragon boots 4, fire cape 4, amulet of glory 6, berserker ring 4 (OSRS Wiki).
    const items = Object.values(equippedItems(PRESETS[0]!.setup, content));
    expect(items.length).toBe(10);
    expect(totalBonuses(items).meleeStrength).toBe(109);
  });
});

describe("replay compatibility", () => {
  it("accepts replays from this engine and content, and explains the others", () => {
    expect(replayProblem(ENGINE_VERSION, content.contentHash)).toBeNull();
    expect(replayProblem("0.1.0", content.contentHash)).toMatch(/different version of the combat engine \(0\.1\.0/);
    expect(replayProblem(ENGINE_VERSION, "deadbeef")).toMatch(/different game content/);
  });
});
