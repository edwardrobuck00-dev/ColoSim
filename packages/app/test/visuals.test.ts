import { PROJECTILE_VISUALS, hasVisual } from "@sim/assets";
import { describe, expect, it } from "vitest";
import { content } from "../src/services/content";

describe("content visuals", () => {
  it("every NPC and arena visualId exists in the asset manifest", () => {
    const missing = [
      ...[...content.npcs.values()].map((n) => n.visualId),
      ...[...content.arenas.values()].map((a) => a.visualId),
    ].filter((id): id is string => !!id && !hasVisual(id));
    expect(missing).toEqual([]);
  });

  it("every projectile used by an item, spell or attack has a visual", () => {
    const used = [
      ...[...content.items.values()].map((i) => i.weapon?.projectile?.visualId),
      ...[...content.spells.values()].map((s) => s.projectile?.visualId),
      ...[...content.attacks.values()].map((a) => a.projectile?.visualId),
    ].filter((id): id is string => !!id);
    expect(used.filter((id) => !PROJECTILE_VISUALS.has(id))).toEqual([]);
  });
});
