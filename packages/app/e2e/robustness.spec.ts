import { expect, test, type Page } from "@playwright/test";

test.beforeEach(({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

/** Writes a record straight into the app's IndexedDB, bypassing validation (as old or hand-edited data would). */
async function plantConfig(page: Page, record: Record<string, unknown>) {
  await page.evaluate(async (rec) => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("osrs-combat-sim");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction("configs", "readwrite");
        tx.objectStore("configs").put(rec);
        tx.oncomplete = () => { open.result.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, record);
}

const base = { notes: "", schemaVersion: 1, createdAt: 1, updatedAt: 1, revision: 1, origin: "local" };
const stats = { hitpoints: 99, attack: 99, strength: 99, defence: 99, ranged: 99, magic: 99, prayer: 99 };

test("a saved loadout that no longer fits the game is explained, not a broken fight", async ({ page }) => {
  await page.goto("/loadouts"); // creates the database
  await expect(page.getByRole("heading", { name: "Setups" })).toBeVisible();
  await plantConfig(page, {
    ...base, id: "stale", kind: "loadout", name: "Old gear",
    data: { stats, equipment: { weapon: "removed-sword" }, inventory: [], prayers: [], combatStyle: 0, autocastSpellId: null, quickPrayers: [] },
  });
  await plantConfig(page, { ...base, id: "corrupt", kind: "loadout", name: "Corrupt", data: { stats: "nonsense" } });
  await page.goto("/fight/training-grounds?loadout=custom:stale");
  await expect(page.getByRole("heading", { name: "This loadout can't be used" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Old gear");
  // The Setups page still lists everything, including records it cannot read.
  await plantConfig(page, { ...base, id: "corrupt-prayers", kind: "prayers", name: "Bad prayers", data: { start: 5 } });
  await page.goto("/loadouts?tab=prayers");
  await expect(page.getByText("Bad prayers")).toBeVisible();
  await expect(page.getByText("can't be read")).toBeVisible();
  await page.goto("/loadouts");
  await expect(page.getByText("Old gear")).toBeVisible();
  // A corrupt record falls back to the default loadout instead of loading forever.
  await page.goto("/fight/training-grounds?loadout=custom:corrupt");
  await expect(page.locator("canvas").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "This loadout can't be used" })).toHaveCount(0);
});
