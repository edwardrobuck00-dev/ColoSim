import { expect, test } from "@playwright/test";

test.beforeEach(({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("the boss select screen describes the boss and starts the fight", async ({ page }) => {
  await page.goto("/encounters");
  const details = page.getByTestId("encounter-ashen-warden");
  await expect(details.getByRole("heading", { name: "The Ashen Warden" })).toBeVisible();
  await expect(details).toContainText("Smouldering");
  await expect(details).toContainText("Ember Rain");
  await details.getByLabel("Loadout").selectOption("melee-99");
  await details.getByRole("button", { name: "Start" }).click();
  await expect(page).toHaveURL(/\/fight\/ashen-warden\?loadout=melee-99/);
  await expect(page.getByTestId("boss-phase")).toHaveText(/Phase 1\/3: Smouldering/);
});

test("telegraphed fire appears on the floor and the chatbox names the special", async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => localStorage.setItem("sim.settings", JSON.stringify({ version: 2, speed: 4 })));
  await page.goto("/fight/ashen-warden?loadout=melee-99&seed=4");
  await page.waitForFunction(() => window.__simDebug && window.__simDebug.snapshot().tick >= 1);
  // Every 6th attack in phase 1 is Ember Rain.
  await page.waitForFunction(() => window.__simDebug!.snapshot().hazards.length > 0, null, { timeout: 60_000 });
  await expect.poll(() => page.evaluate(() => window.__simDebug!.renderer().hazards), { timeout: 5_000 }).toBeGreaterThan(0);
  await expect(page.getByLabel("Combat log")).toContainText("uses Ember Rain!");
});
