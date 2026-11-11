import { ItemDefSchema } from "@sim/engine";
import { describe, expect, it } from "vitest";
import { getContentRegistry } from "../src";
import { CATALOGUE } from "../src/items/osrs/catalogue";
import { ItemBuildError, buildOsrsItems } from "../src/items/osrs/build";
import { WIKI_ITEMS } from "../src/items/osrs/wiki-data.generated";

const content = getContentRegistry();
const item = (id: string) => content.items.get(id)!;

describe("item database", () => {
  it("every catalogue entry has verified wiki data with a page revision", () => {
    for (const e of CATALOGUE) {
      const w = WIKI_ITEMS.find((x) => x.name === e.name);
      expect(w, e.name).toBeDefined();
      expect(w!.wikiRevision, e.name).toBeGreaterThan(0);
    }
  });

  it("every item records its source", () => {
    for (const i of content.items.values()) expect(i.source?.wikiPage, i.id).toBeTruthy();
  });

  it("reproduces the wiki's numbers exactly (spot checks)", () => {
    // Abyssal whip: +82 slash, +82 strength, 4 ticks (wiki infobox).
    expect(item("abyssal-whip")).toMatchObject({ slot: "weapon", bonuses: { attack: { slash: 82 }, meleeStrength: 82 }, weapon: { attackSpeedTicks: 4, category: "whip" } });
    // Armadyl godsword: two-handed, 6 ticks, +132 slash/str, +8 prayer.
    expect(item("armadyl-godsword")).toMatchObject({ weapon: { twoHanded: true, attackSpeedTicks: 6, category: "two-handed-sword" }, bonuses: { meleeStrength: 132, prayer: 8 } });
    // Magic shortbow: 4 ticks, range 7, +69 ranged; rune arrows +49 ranged strength.
    expect(item("magic-shortbow")).toMatchObject({ weapon: { attackSpeedTicks: 4, rangeTiles: 7, ammo: { kind: "arrow", maxTier: 50 } }, bonuses: { attack: { ranged: 69 } } });
    expect(item("rune-arrow")).toMatchObject({ slot: "ammo", stackable: true, bonuses: { rangedStrength: 49 }, ammo: { tier: 40 } });
    // Occult necklace: +5% magic damage. Seers ring: +0.2%.
    expect(item("occult-necklace").bonuses.magicDamagePercent).toBe(5);
    expect(item("seers-ring").bonuses.magicDamagePercent).toBe(0.2);
  });

  it("fails loudly when an item has no wiki data", () => {
    expect(() => buildOsrsItems([{ name: "Not a real item" }])).toThrow(ItemBuildError);
  });

  it("every built item passes the engine schema", () => {
    for (const i of buildOsrsItems()) expect(ItemDefSchema.safeParse(i).success, i.id).toBe(true);
  });
});
