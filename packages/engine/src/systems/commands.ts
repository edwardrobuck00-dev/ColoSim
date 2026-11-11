import type { World } from "../core/world";
import { AUTOCAST_CATEGORIES, combatStyles } from "../combat/weapon-categories";
import { consumeItem, equipFromInventory, moveItem, unequip } from "../player/inventory";
import { configurePlayer } from "../player/configure";
import { togglePrayer } from "../player/prayers";
import { isAlive } from "../entities/types";
import { findPath } from "../map/pathfinding";
import { assertNever } from "../util/assert";

/** Phase 1: apply commands queued since the previous tick, in the order received. */
export function applyCommands(world: World): void {
  const commands = world.pendingCommands;
  world.pendingCommands = [];
  const p = world.player;

  for (const cmd of commands) {
    if (!isAlive(p) && cmd.type !== "setRun") {
      world.events.push({ type: "CommandRejected", command: cmd.type, reason: "you are dead" });
      continue;
    }
    switch (cmd.type) {
      case "move": {
        if (!world.grid.inBounds(cmd.to)) {
          world.events.push({ type: "CommandRejected", command: cmd.type, reason: "out of bounds" });
          break;
        }
        p.path = findPath(world.grid, p.pos, cmd.to);
        setTarget(world, null);
        break;
      }
      case "setRun": {
        const running = cmd.running && p.runEnergy > 0;
        if (running !== p.running) {
          p.running = running;
          world.events.push({ type: "RunToggled", running });
        }
        break;
      }
      case "attack": {
        const npc = world.npcs.find((n) => n.id === cmd.targetId && isAlive(n));
        if (!npc) {
          world.events.push({ type: "CommandRejected", command: cmd.type, reason: "no such target" });
          break;
        }
        // The player turn paths into weapon range and attacks.
        setTarget(world, npc.id);
        break;
      }
      case "setAutoRetaliate": {
        p.autoRetaliate = cmd.enabled;
        world.events.push({ type: "AutoRetaliateChanged", enabled: cmd.enabled });
        break;
      }
      case "stop": {
        p.path = [];
        setTarget(world, null);
        break;
      }
      case "setCombatStyle": {
        const styles = combatStyles(p.weapon.category);
        const style = styles[cmd.index];
        if (!style) {
          world.events.push({ type: "CommandRejected", command: cmd.type, reason: "no such combat style" });
        } else if (AUTOCAST_CATEGORIES.has(p.weapon.category) && style.cls === "magic" && !p.autocastSpellId) {
          world.events.push({ type: "CommandRejected", command: cmd.type, reason: "choose a spell to autocast first" });
        } else if (p.combatStyleIndex !== cmd.index) {
          p.combatStyleIndex = cmd.index;
          world.events.push({ type: "CombatStyleChanged", index: cmd.index, name: style.name });
        }
        break;
      }
      case "togglePrayer": {
        const reason = togglePrayer(world, cmd.prayerId);
        if (reason) world.events.push({ type: "CommandRejected", command: cmd.type, reason });
        break;
      }
      case "setBaseLevel":
      case "setCurrentLevel":
      case "setHitpoints":
      case "setPrayerPoints": {
        const reason = configurePlayer(world, cmd);
        if (reason) world.events.push({ type: "CommandRejected", command: cmd.type, reason });
        break;
      }
      case "toggleSpecial": {
        if (!p.weapon.special) {
          world.events.push({ type: "CommandRejected", command: cmd.type, reason: "this weapon has no special attack" });
          break;
        }
        p.specialArmed = !p.specialArmed;
        world.events.push({ type: "SpecialToggled", armed: p.specialArmed });
        break;
      }
      case "setAutocast":
        setAutocast(world, cmd.spellId);
        break;
      case "equipItem": {
        const r = equipFromInventory(p, world.content, cmd.inventorySlot);
        if (r.ok) world.events.push({ type: "ItemEquipped", slot: r.slot, itemId: r.itemId });
        else world.events.push({ type: "CommandRejected", command: cmd.type, reason: r.reason });
        break;
      }
      case "unequipItem": {
        const r = unequip(p, world.content, cmd.slot);
        if (r.ok) world.events.push({ type: "ItemUnequipped", slot: cmd.slot, itemId: r.itemId });
        else world.events.push({ type: "CommandRejected", command: cmd.type, reason: r.reason });
        break;
      }
      case "moveItem": {
        const r = moveItem(p, cmd.from, cmd.to);
        if (!r.ok) world.events.push({ type: "CommandRejected", command: cmd.type, reason: r.reason });
        break;
      }
      case "useItem": {
        const r = consumeItem(p, world.content, cmd.inventorySlot, world.tick);
        if (r.ok) {
          world.events.push({ type: "ItemConsumed", itemId: r.itemId, kind: world.content.items.get(r.itemId)?.consumable?.kind ?? "food", hitpointsBefore: r.hitpointsBefore, hitpointsAfter: r.hitpointsAfter, dosesLeft: r.dosesLeft, changes: r.changes, attackDelayTicks: r.attackDelayTicks });
        } else {
          world.events.push({ type: "CommandRejected", command: cmd.type, reason: r.reason });
        }
        break;
      }
      default:
        assertNever(cmd, "command");
    }
  }
}

function setTarget(world: World, targetId: string | null): void {
  if (world.player.targetId === targetId) return;
  world.player.targetId = targetId;
  world.events.push({ type: "TargetChanged", entityId: world.player.id, targetId });
}

function setAutocast(world: World, spellId: string | null): void {
  const p = world.player;
  const reject = (reason: string): void => void world.events.push({ type: "CommandRejected", command: "setAutocast", reason });
  if (!AUTOCAST_CATEGORIES.has(p.weapon.category)) return reject("only staves can autocast");
  if (spellId === null) {
    p.autocastSpellId = null;
    p.combatStyleIndex = 0;
  } else {
    const spell = world.content.spells.get(spellId);
    if (!spell) return reject("no such spell");
    if (p.stats.magic < spell.level) return reject(`needs Magic level ${spell.level}`);
    p.autocastSpellId = spellId;
    // Select the plain "Spell" style (the last one for staves).
    p.combatStyleIndex = combatStyles(p.weapon.category).length - 1;
  }
  world.events.push({ type: "AutocastChanged", spellId: p.autocastSpellId });
}
