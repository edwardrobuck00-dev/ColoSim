import { expect, test, type Page } from "@playwright/test";

const player = (page: Page) => page.evaluate(() => window.__simDebug!.snapshot().player);

test.beforeEach(({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

/** Max hit from the Info tab; returns to the tab that was open. */
async function maxHit(page: Page, back: string): Promise<string> {
  await page.getByRole("tab", { name: "Info" }).click();
  const text = (await page.getByTestId("calc-max-hit").textContent()) ?? "";
  await page.getByRole("tab", { name: back }).click();
  return text;
}

async function open(page: Page, url: string) {
  await page.goto(url);
  await page.waitForFunction(() => window.__simDebug && window.__simDebug.snapshot().tick >= 1);
}

test("prayers change the combat calculations shown and used by the engine", async ({ page }) => {
  // melee-99: whip on Lash (controlled), +136 melee strength. Max hit 34 plain, 41 with Piety.
  await open(page, "/fight/training-grounds?loadout=melee-99&seed=4");
  await page.getByRole("tab", { name: "Prayer" }).click();
  expect(await maxHit(page, "Prayer")).toBe("34");

  await page.getByRole("button", { name: /^Piety/ }).click();
  await expect.poll(async () => (await player(page)).activePrayers).toEqual(["piety"]);
  await expect.poll(() => maxHit(page, "Prayer")).toBe("41");
  await expect(page.getByTestId("prayer-drain")).toHaveText("24");

  // Eagle Eye shares the attack and strength groups with Piety, so it replaces it.
  await page.getByRole("button", { name: /^Eagle Eye/ }).click();
  await expect.poll(async () => (await player(page)).activePrayers).toEqual(["eagle-eye"]);
  await expect.poll(() => maxHit(page, "Prayer")).toBe("34");

  // Prayer points drain while a prayer is on.
  const before = (await player(page)).prayerPoints;
  await expect.poll(async () => (await player(page)).prayerPoints, { timeout: 15_000 }).toBeLessThan(before);
});

test("the Skills tab sets levels, hitpoints and prayer points in the simulation", async ({ page }) => {
  await open(page, "/fight/training-grounds?loadout=melee-99&seed=4");
  await page.getByRole("tab", { name: "Skills" }).click();

  const base = page.getByLabel("Base Strength");
  await base.fill("80");
  await base.press("Enter");
  await expect.poll(async () => (await player(page)).baseLevels.strength).toBe(80);
  expect((await player(page)).levels.strength).toBe(80);
  // 80 + 1 + 8 = 89 -> floor((89 * 200 + 320) / 640) = 28
  await expect.poll(() => maxHit(page, "Skills")).toBe("28");

  // Primordial boots need 75 Strength: the engine refuses and the log says why.
  await base.fill("60");
  await base.press("Enter");
  await expect(page.getByLabel("Combat log")).toContainText("Primordial boots requires 75 Strength");
  expect((await player(page)).baseLevels.strength).toBe(80);

  await page.getByRole("tab", { name: "Skills" }).click();
  await page.getByLabel("Current Attack").fill("110");
  await page.getByLabel("Current Attack").press("Enter");
  await expect.poll(async () => (await player(page)).levels.attack).toBe(110);

  await page.getByLabel("Current Hitpoints").fill("40");
  await page.getByLabel("Current Hitpoints").press("Enter");
  await expect.poll(async () => (await player(page)).hitpoints).toBe(40);

  await page.getByLabel("Prayer points").fill("12");
  await page.getByLabel("Prayer points").press("Enter");
  await expect.poll(async () => (await player(page)).prayerPoints).toBe(12);

  // Lowering Prayer to 60 turns off Piety (needs 70) and caps points at 60.
  await page.getByLabel("Prayer points").fill("99");
  await page.getByLabel("Prayer points").press("Enter");
  await page.getByRole("tab", { name: "Prayer" }).click();
  await page.getByRole("button", { name: /^Piety/ }).click();
  await expect.poll(async () => (await player(page)).activePrayers).toEqual(["piety"]);
  await page.getByRole("tab", { name: "Skills" }).click();
  await page.getByLabel("Base Prayer").fill("60");
  await page.getByLabel("Base Prayer").press("Enter");
  await expect.poll(async () => (await player(page)).activePrayers).toEqual([]);
  expect((await player(page)).prayerPoints).toBeLessThanOrEqual(60);
  await page.getByRole("tab", { name: "Prayer" }).click();
  await expect(page.getByRole("button", { name: /^Piety/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /^Piety/ })).toContainText("Requires 70 Prayer");
});

test("Severed Faith knocks off the protection prayer and locks overheads", async ({ page }) => {
  test.setTimeout(60_000);
  await open(page, "/fight/ashen-warden?loadout=melee-99&seed=9&mods=severed-faith");
  await page.getByRole("tab", { name: "Prayer" }).click();
  await page.getByRole("button", { name: /^Protect from Melee/ }).click();
  await expect.poll(async () => (await player(page)).overhead).toBe("melee");
  // First severing at tick 25.
  await expect(page.getByTestId("overheads-locked")).toBeVisible({ timeout: 30_000 });
  expect((await player(page)).overhead).toBeNull();
  await expect(page.getByRole("button", { name: /^Protect from Melee/ })).toBeDisabled();
  await expect(page.getByTestId("overheads-locked")).toBeHidden({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: /^Protect from Melee/ })).toBeEnabled();
});

test("F-keys open interface tabs and can be remapped", async ({ page }) => {
  await open(page, "/fight/training-grounds?loadout=melee-99&seed=4");
  const selected = () => page.locator('[role="tab"][aria-selected="true"]').getAttribute("aria-label");
  await expect.poll(selected).toBe("Inventory");
  for (const [key, tab] of [["F1", "Combat"], ["F2", "Skills"], ["F4", "Equipment"], ["F5", "Prayer"], ["F6", "Magic"], ["F7", "Info"], ["F8", "Simulation"], ["F3", "Inventory"]]) {
    await page.keyboard.press(key!);
    await expect.poll(selected).toBe(tab);
  }

  // Remap the Prayer tab to F9 on the Settings page, then use it in a fight.
  await page.goto("/settings");
  await page.getByRole("row", { name: /Open Prayer tab/ }).getByRole("button").click();
  await page.keyboard.press("F9");
  await open(page, "/fight/training-grounds?loadout=melee-99&seed=4");
  await page.keyboard.press("F9");
  await expect.poll(selected).toBe("Prayer");
  await expect(page.getByRole("tab", { name: "Prayer" })).toHaveAttribute("title", "Prayer (F9)");
});

test("hovering shows what a click will do, and clicks leave a cross", async ({ page }) => {
  await open(page, "/fight/training-grounds?loadout=melee-99&seed=4");
  const box = (await page.getByTestId("arena-canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.35);
  await expect(page.getByTestId("mouse-text")).toHaveText("Walk here");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.35);
  await expect(page.locator("svg[data-kind='walk']")).toHaveCount(1);
  await page.getByRole("tab", { name: "Inventory" }).hover();
  await page.getByRole("button", { name: /^Drink Super combat/ }).hover();
  await expect(page.getByTestId("mouse-text")).toHaveText(/^Drink Super combat potion\(4\)/);
});
