import { z } from "zod";
import { TileSchema } from "../defs/common";

/** Everything a player can ask the engine to do. Applied at the start of the next tick. */
export const PlayerCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("move"), to: TileSchema }),
  z.object({ type: z.literal("setRun"), running: z.boolean() }),
  /** Attack an NPC: walk into range of the current combat style, then attack whenever the attack timer allows. */
  z.object({ type: z.literal("attack"), targetId: z.string() }),
  z.object({ type: z.literal("stop") }),
  z.object({ type: z.literal("setAutoRetaliate"), enabled: z.boolean() }),
  /** Select a combat style by index in the weapon's style list. */
  z.object({ type: z.literal("setCombatStyle"), index: z.number().int().min(0) }),
  z.object({ type: z.literal("togglePrayer"), prayerId: z.string() }),
  /** Arm (or disarm) the weapon's special attack for the next attack. */
  z.object({ type: z.literal("toggleSpecial") }),
  /** Choose a spell to autocast (staves), or null to stop autocasting. */
  z.object({ type: z.literal("setAutocast"), spellId: z.string().nullable() }),
  /** Equip the item in an inventory slot (0-27). */
  z.object({ type: z.literal("equipItem"), inventorySlot: z.number().int().min(0).max(27) }),
  z.object({ type: z.literal("unequipItem"), slot: z.enum(["head", "cape", "neck", "ammo", "weapon", "body", "shield", "legs", "hands", "feet", "ring"]) }),
  /** Swap two inventory slots. */
  z.object({ type: z.literal("moveItem"), from: z.number().int().min(0).max(27), to: z.number().int().min(0).max(27) }),
  /** Eat or drink the item in an inventory slot. */
  z.object({ type: z.literal("useItem"), inventorySlot: z.number().int().min(0).max(27) }),
  /**
   * Player configuration (practice tools). Base levels: 1-99. Current
   * levels: the boosted or drained level of a combat skill. Applied on the
   * next tick and recorded in replays like any other input.
   */
  z.object({ type: z.literal("setBaseLevel"), skill: z.enum(["attack", "strength", "defence", "ranged", "magic", "prayer", "hitpoints"]), level: z.number().int().min(1).max(99) }),
  z.object({ type: z.literal("setCurrentLevel"), skill: z.enum(["attack", "strength", "defence", "ranged", "magic"]), level: z.number().int().min(0).max(255) }),
  z.object({ type: z.literal("setHitpoints"), value: z.number().int().min(1).max(255) }),
  z.object({ type: z.literal("setPrayerPoints"), value: z.number().int().min(0).max(99) }),
]);
export type PlayerCommand = z.infer<typeof PlayerCommandSchema>;
