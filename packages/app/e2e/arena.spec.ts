import { expect, test, type Page } from "@playwright/test";

const stats = (page: Page) => page.evaluate(() => window.__simDebug!.renderer());
const snapshot = (page: Page) => page.evaluate(() => window.__simDebug!.snapshot());

async function waitForDebug(page: Page) {
  await page.waitForFunction(() => !!window.__simDebug && window.__simDebug.renderer().entities > 0);
}

async function attackNpc(page: Page) {
  const pos = await page.evaluate(() => window.__simDebug!.screenPosition("npc-1"));
  expect(pos).not.toBeNull();
  await page.mouse.click(pos!.x, pos!.y);
  await expect.poll(async () => (await snapshot(page)).player.targetId, { timeout: 10_000 }).toBe("npc-1");
}

test.describe("combat arena", () => {
  test.beforeEach(({ page }) => {
    page.on("pageerror", (e) => {
      throw e;
    });
  });

  test("renders a detailed scene, not a blank canvas", async ({ page }) => {
    await page.goto("/fight/ashen-warden?loadout=melee-70");
    await waitForDebug(page);
    await page.waitForTimeout(500);
    const png = await page.getByTestId("arena-canvas").screenshot();
    // A flat or nearly empty frame compresses to a few KB; the arena is far richer.
    expect(png.byteLength).toBeGreaterThan(60_000);
    expect((await stats(page)).entities).toBe(2);
  });

  test("ranged attacks fire projectiles and produce damage splats", async ({ page }) => {
    await page.goto("/fight/training-grounds?loadout=ranged-70");
    await waitForDebug(page);
    await attackNpc(page);
    await expect.poll(async () => (await stats(page)).projectiles, { timeout: 8000 }).toBeGreaterThan(0);
    await expect.poll(async () => (await stats(page)).splats, { timeout: 8000 }).toBeGreaterThan(0);
    await expect(page.getByLabel("Combat log")).toContainText(/You (hit|miss) Training dummy/);
  });

  test("the boss attacks the player with projectiles", async ({ page }) => {
    await page.goto("/fight/ashen-warden?loadout=melee-70");
    await waitForDebug(page);
    await expect.poll(async () => (await stats(page)).projectiles, { timeout: 10000 }).toBeGreaterThan(0);
    await expect(page.getByLabel("Combat log")).toContainText(/The Ashen Warden (hits|misses) you/, { timeout: 10000 });
  });

  test("a fight plays out to the results screen", async ({ page }) => {
    test.setTimeout(150_000);
    await page.addInitScript(() => localStorage.setItem("sim.settings", JSON.stringify({ version: 2, speed: 4 })));
    await page.goto("/fight/ashen-warden?loadout=melee-99");
    await waitForDebug(page);
    await attackNpc(page);
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 120_000 });
    const outcome = (await snapshot(page)).outcome!;
    await expect(page.getByRole("heading", { name: outcome.result === "win" ? "Victory" : "Defeat" })).toBeVisible();
    if (outcome.result === "win") {
      // The fight ends on the killing tick; the boss stays down in its dying state.
      expect((await snapshot(page)).npcs[0]!.life).toBe("dying");
      expect((await stats(page)).entities).toBe(2);
    }
  });
});
