import { expect, test, type Page } from "@playwright/test";

const tick = async (page: Page) => (await page.evaluate(() => window.__simDebug!.snapshot().tick)) as number;

test.beforeEach(({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("pause, single-tick stepping and speed control", async ({ page }) => {
  await page.goto("/fight/training-grounds?loadout=melee-70&seed=5");
  await page.waitForFunction(() => window.__simDebug && window.__simDebug.snapshot().tick >= 1);

  await page.keyboard.press("Space");
  await expect(page.getByTestId("paused")).toBeVisible();
  const paused = await tick(page);
  await page.waitForTimeout(1500);
  expect(await tick(page)).toBe(paused);

  await page.keyboard.press("Period");
  await expect.poll(() => tick(page)).toBe(paused + 1);
  await page.getByRole("button", { name: "Step" }).click();
  await expect.poll(() => tick(page)).toBe(paused + 2);

  await page.getByLabel("Simulation speed").selectOption("2");
  await expect.poll(() => page.evaluate(() => window.__simDebug!.runner().speed)).toBe(2);
  await page.keyboard.press("Space");
  await expect(page.getByTestId("paused")).toBeHidden();
  await expect.poll(() => tick(page), { timeout: 10_000 }).toBeGreaterThan(paused + 4);
});

test("the same seed and inputs reproduce the same fight", async ({ page }) => {
  test.setTimeout(240_000);
  // No player input: the outcome depends only on the seed. Run fast.
  await page.addInitScript(() => localStorage.setItem("sim.settings", JSON.stringify({ version: 2, speed: 8 })));
  await page.goto("/fight/ashen-warden?loadout=melee-70&seed=123");
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 100_000 });
  const first = await page.evaluate(() => ({ outcome: window.__simDebug!.snapshot().outcome, hash: window.__simDebug!.runner().hash }));
  await expect(page.getByTestId("seed")).toHaveText("123");

  await page.getByRole("button", { name: "Same seed" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 100_000 });
  const second = await page.evaluate(() => ({ outcome: window.__simDebug!.snapshot().outcome, hash: window.__simDebug!.runner().hash }));

  expect(second).toEqual(first);
});

test("prayers, combat styles and special attacks from the side panel", async ({ page }) => {
  await page.goto("/fight/training-grounds?loadout=melee-99-ags&seed=2");
  await page.waitForFunction(() => window.__simDebug && window.__simDebug.snapshot().tick >= 1);
  const player = () => page.evaluate(() => window.__simDebug!.snapshot().player);

  await page.getByRole("tab", { name: "Prayer" }).click();
  await page.keyboard.press("Digit1");
  await expect(page.getByRole("button", { name: /Protect from Melee/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /^Piety/ }).click();
  await expect.poll(async () => (await player()).activePrayers.sort()).toEqual(["piety", "protect-from-melee"]);

  await page.getByRole("tab", { name: "Combat" }).click();
  await page.getByRole("button", { name: /Smash/ }).click();
  await expect.poll(async () => (await player()).weapon.style).toBe("crush");
  await page.getByRole("button", { name: /Special attack \(50%\)/ }).click();
  await expect.poll(async () => (await player()).specialArmed).toBe(true);
});
