import { expect, test, type Page } from "@playwright/test";

test.beforeEach(({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

const dbg = (page: Page) => page.evaluate(() => ({ ...window.__simDebug!.runner(), tick: window.__simDebug!.snapshot().tick, drift: window.__simDebug!.consistency() }));

test("review earlier ticks of a live fight, inspect one, and continue from there", async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => localStorage.setItem("sim.settings", JSON.stringify({ version: 2, speed: 4 })));
  await page.goto("/fight/ashen-warden?loadout=melee-99&seed=8");
  await page.waitForFunction(() => window.__simDebug && window.__simDebug.snapshot().tick >= 25);

  // Step back: the fight pauses and the whole screen shows the earlier tick.
  await page.keyboard.press("Comma");
  await expect(page.getByTestId("mode")).toHaveText("Reviewing");
  let d = await dbg(page);
  expect(d.mode).toBe("review");
  expect(d.viewTick).toBe(d.latestTick - 1);
  expect(d.tick).toBe(d.viewTick);
  expect(d.drift).toEqual([]);
  const latest = d.latestTick;

  // The fight does not move on while reviewing.
  await page.waitForTimeout(1000);
  expect((await dbg(page)).latestTick).toBe(latest);

  // Drag the timeline to tick 10, then step forward one tick.
  await page.getByLabel("Timeline").fill("10");
  await expect.poll(async () => (await dbg(page)).tick).toBe(10);
  expect((await dbg(page)).drift).toEqual([]);
  await page.keyboard.press("Period");
  await expect.poll(async () => (await dbg(page)).tick).toBe(11);

  // The tick inspector shows this tick.
  await page.keyboard.press("KeyL");
  await page.getByRole("tab", { name: "Tick inspector" }).click();
  await expect(page.getByTestId("inspect-tick")).toContainText("Tick 11");
  await page.getByRole("button", { name: "Previous tick" }).click();
  await expect(page.getByTestId("inspect-tick")).toContainText("Tick 10");
  await expect(page.getByTestId("inspect-calcs")).toContainText("Your max hit");

  // Back to live, then review again and continue from an earlier tick.
  await page.getByRole("button", { name: "Live" }).click();
  await expect(page.getByTestId("mode")).toHaveText("Live");
  expect((await dbg(page)).tick).toBe(latest);
  await page.getByLabel("Timeline").fill("20");
  await expect.poll(async () => (await dbg(page)).tick).toBe(20);
  const hashAt20 = (await dbg(page)).hash;
  await page.getByRole("button", { name: "Play from here" }).click();
  await expect(page.getByTestId("mode")).toHaveText("Live");
  d = await dbg(page);
  expect(d.latestTick).toBe(20);
  expect(d.hash).toBe(hashAt20);
  await page.getByRole("button", { name: "Resume" }).click();
  await expect.poll(async () => (await dbg(page)).tick).toBeGreaterThan(22);
});

test("a finished fight is saved, replays identically, and can be verified and managed", async ({ page }) => {
  test.setTimeout(150_000);
  await page.addInitScript(() => localStorage.setItem("sim.settings", JSON.stringify({ version: 2, speed: 8 })));
  await page.goto("/fight/ashen-warden?loadout=melee-70&seed=5");
  await page.waitForFunction(() => window.__simDebug && window.__simDebug.snapshot().tick >= 1);
  // No prayers: the Warden wins quickly.
  await expect(page.getByRole("dialog", { name: /Defeat|Victory/ })).toBeVisible({ timeout: 120_000 });
  const live = await page.evaluate(() => {
    const h = window.__simDebug!.runner();
    return { latest: h.latestTick };
  });
  // Record the live hash at tick 30 by reviewing it.
  await page.getByRole("button", { name: "Review the end" }).click();
  await page.getByLabel("Timeline").fill("30");
  await expect.poll(async () => (await dbg(page)).tick).toBe(30);
  const liveHash30 = (await dbg(page)).hash;

  await page.getByRole("button", { name: "Live" }).click();
  await page.getByRole("button", { name: "Watch replay" }).click();
  await expect(page).toHaveURL(/\/replay\//);
  await page.waitForFunction(() => window.__simDebug && window.__simDebug.runner().mode === "replay");
  await expect(page.getByTestId("mode")).toHaveText("Replay");
  expect((await dbg(page)).latestTick).toBe(live.latest);
  await page.getByLabel("Timeline").fill("30");
  await expect.poll(async () => (await dbg(page)).tick).toBe(30);
  const d = await dbg(page);
  expect(d.hash).toBe(liveHash30);
  expect(d.drift).toEqual([]);

  // The replays list: verify, download, delete.
  await page.getByRole("link", { name: "Replays" }).click();
  const row = page.getByRole("table", { name: "Saved replays" }).getByRole("row").nth(1);
  await expect(row).toContainText("The Ashen Warden");
  await row.getByRole("button", { name: "Verify" }).click();
  await expect(row.getByRole("status")).toHaveText("Reproduces exactly");
  const download = page.waitForEvent("download");
  await row.getByRole("button", { name: "Download" }).click();
  expect((await download).suggestedFilename()).toMatch(/^replay-ashen-warden-.*\.json$/);
  await row.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText(/No replays yet/)).toBeVisible(); // it was the only one in this fresh browser profile
});
