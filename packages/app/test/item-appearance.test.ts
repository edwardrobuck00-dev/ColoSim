import { ITEM_APPEARANCE } from "@sim/assets";
import { getContentRegistry } from "@sim/content";
import { describe, expect, it } from "vitest";

describe("item appearance", () => {
  it("every item in the database has a shape and colours (no grey fallbacks)", () => {
    const missing = [...getContentRegistry().items.keys()].filter((id) => !ITEM_APPEARANCE[id]);
    expect(missing).toEqual([]);
  });

  it("no appearance entry is left over for an item that does not exist", () => {
    const items = getContentRegistry().items;
    expect(Object.keys(ITEM_APPEARANCE).filter((id) => !items.has(id))).toEqual([]);
  });
});
