import type { Keybinds } from "@sim/storage";

export type KeyAction = keyof Keybinds;

export const KEY_ACTION_LABELS: Record<KeyAction, string> = {
  cameraLeft: "Rotate camera left",
  cameraRight: "Rotate camera right",
  cameraUp: "Tilt camera up",
  cameraDown: "Tilt camera down",
  toggleRun: "Toggle run",
  pause: "Pause / resume",
  step: "Step one tick forward (while paused or reviewing)",
  stepBack: "Step one tick back (review history)",
  goLive: "Return to the live fight",
  reset: "Reset fight",
  cameraReset: "Reset camera",
  protectMelee: "Protect from melee",
  protectRanged: "Protect from ranged",
  protectMagic: "Protect from magic",
  toggleSpecial: "Special attack",
  tabCombat: "Open Combat tab",
  tabSkills: "Open Skills tab",
  tabInventory: "Open Inventory tab",
  tabEquipment: "Open Equipment tab",
  tabPrayer: "Open Prayer tab",
  tabMagic: "Open Magic tab",
  tabInfo: "Open Info tab",
  tabSimulation: "Open Simulation tab",
  toggleAnalytics: "Show / hide combat analytics",
};

export type TabId = "combat" | "skills" | "inventory" | "equipment" | "prayer" | "magic" | "info" | "simulation";

/** Keybind action that opens each interface tab. */
export const TAB_ACTIONS: Record<TabId, KeyAction> = {
  combat: "tabCombat",
  skills: "tabSkills",
  inventory: "tabInventory",
  equipment: "tabEquipment",
  prayer: "tabPrayer",
  magic: "tabMagic",
  info: "tabInfo",
  simulation: "tabSimulation",
};

export function tabForAction(action: KeyAction): TabId | null {
  for (const [tab, a] of Object.entries(TAB_ACTIONS) as Array<[TabId, KeyAction]>) if (a === action) return tab;
  return null;
}

/** Actions that repeat while held (applied per frame), rather than firing once per press. */
export const HELD_ACTIONS: ReadonlySet<KeyAction> = new Set(["cameraLeft", "cameraRight", "cameraUp", "cameraDown"]);

export function actionForKey(code: string, binds: Keybinds): KeyAction | null {
  for (const [action, bound] of Object.entries(binds) as Array<[KeyAction, string]>) if (bound === code) return action;
  return null;
}

/** Camera rotation speed from held keys, in radians per second. */
export function cameraVelocity(held: ReadonlySet<KeyAction>): { yaw: number; pitch: number } {
  const YAW = 2.2;
  const PITCH = 1.2;
  return {
    yaw: (held.has("cameraLeft") ? -YAW : 0) + (held.has("cameraRight") ? YAW : 0),
    pitch: (held.has("cameraUp") ? PITCH : 0) + (held.has("cameraDown") ? -PITCH : 0),
  };
}
