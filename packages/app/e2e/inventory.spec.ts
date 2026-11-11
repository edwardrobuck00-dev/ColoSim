import { expect, test, type Page } from "@playwright/test";

const player = (page: Page) => page.evaluate(() => window.__simDebug!.snapshot().player);

test.beforeEach(({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("inventory items can be wielded, drunk, eaten and moved", async ({ page }) => {
  await page.goto("/fight/training-grounds?loadout=melee-70&seed=3");
  await page.waitForFunction(() => window.__simDebug && window.__simDebug.snapshot().tick >= 1);
  await page.getByRole("tab", { name: "Inventory" }).click();

  // Wield: the scimitar swaps into the dagger's slot and bonuses update (109 - 66 + 40).
  await page.getByRole("button", { name: "Wield Dragon dagger" }).click();
  await expect.poll(async () => (await player(page)).equipment.weapon?.itemId).toBe("dragon-dagger");
  expect((await player(page)).inventory[0]?.itemId).toBe("dragon-scimitar");
  expect((await player(page)).bonuses.meleeStrength).toBe(83);

  // Drink: super combat boosts 70 -> 85 (floor(70 * 15/100) + 5) and leaves 3 doses.
  await page.getByRole("button", { name: /Drink Super combat potion\(4\)/ }).click();
  await expect.poll(async () => (await player(page)).levels.attack).toBe(85);
  expect((await player(page)).inventory[1]).toEqual({ itemId: "super-combat-potion", quantity: 3 });

  // Eat: a shark is consumed (the slot empties).
  const sharkSlot = (await player(page)).inventory.findIndex((s) => s?.itemId === "shark");
  await page.getByTestId(`inv-${sharkSlot}`).getByRole("button").click();
  await expect.poll(async () => (await player(page)).inventory[sharkSlot]).toBeNull();

  // Move: drag the scimitar to the last slot.
  await page.getByTestId("inv-0").dragTo(page.getByTestId("inv-27"));
  await expect.poll(async () => (await player(page)).inventory[27]?.itemId).toBe("dragon-scimitar");

  // Unequip from the Equipment tab.
  await page.getByRole("tab", { name: "Equipment" }).click();
  await page.getByRole("button", { name: "Remove Dragon defender" }).click();
  await expect.poll(async () => (await player(page)).equipment.shield).toBeUndefined();
});

test("a custom loadout can be built, saved and used in a fight", async ({ page }) => {
  await page.goto("/loadouts");
  await page.getByRole("button", { name: "Copy" }).first().click();
  await page.getByLabel("Loadout name").fill("Test whip set");
  await page.getByLabel("attack level").fill("75");
  await page.getByLabel("weapon slot").selectOption("abyssal-whip");
  await expect(page.getByText("Ready to fight.")).toBeVisible();

  // An item whose requirement is not met blocks saving.
  await page.getByLabel("feet slot").selectOption("primordial-boots");
  await expect(page.getByRole("alert")).toContainText("Primordial boots requires");
  await expect(page.getByRole("button", { name: "Save loadout" })).toBeDisabled();
  await page.getByLabel("feet slot").selectOption("dragon-boots");

  await page.getByRole("button", { name: "Save loadout" }).click();
  await expect(page.getByText("Test whip set")).toBeVisible();
  await page.getByRole("link", { name: "Try" }).first().click();
  await page.waitForFunction(() => window.__simDebug && window.__simDebug.snapshot().tick >= 1);
  expect((await player(page)).equipment.weapon?.itemId).toBe("abyssal-whip");
});
