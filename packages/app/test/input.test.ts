import { DEFAULT_SETTINGS } from "@sim/storage";
import { describe, expect, it } from "vitest";
import { commandForClick } from "../src/input/command-mapper";
import { actionForKey, cameraVelocity } from "../src/input/keybinds";

describe("command mapping", () => {
  it("attacks an NPC under the cursor before moving", () => {
    expect(commandForClick({ entityId: "npc-1", tile: { x: 1, y: 1 } })).toEqual({ type: "attack", targetId: "npc-1" });
    expect(commandForClick({ entityId: null, tile: { x: 1, y: 1 } })).toEqual({ type: "move", to: { x: 1, y: 1 } });
    expect(commandForClick({ entityId: null, tile: null })).toBeNull();
  });
});

describe("keybinds", () => {
  it("maps key codes to actions using the current binds", () => {
    expect(actionForKey("Space", DEFAULT_SETTINGS.keybinds)).toBe("pause");
    expect(actionForKey("KeyZ", DEFAULT_SETTINGS.keybinds)).toBeNull();
  });

  it("opposite camera keys cancel out", () => {
    expect(cameraVelocity(new Set(["cameraLeft", "cameraRight"])).yaw).toBe(0);
    expect(cameraVelocity(new Set(["cameraLeft"])).yaw).toBeLessThan(0);
  });
});
