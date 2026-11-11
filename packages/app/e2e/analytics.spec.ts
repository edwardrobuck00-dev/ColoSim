import { expect, test } from "@playwright/test";

test.beforeEach(({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("live statistics update during combat and link to the events behind them", async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => localStorage.setItem("sim.settings", JSON.stringify({ version: 2, speed: 4 })));
  await page.goto("/fight/ashen-warden?loadout=melee-99&seed=6");
  await page.waitForFunction(() => window.__simDebug && window.__simDebug.snapshot().tick >= 1);

  await page.keyboard.press("KeyL");
  const panel = page.getByRole("dialog", { name: "Combat analytics" });
  await expect(panel).toBeVisible();

  // Drinking is counted on the next tick.
  await page.getByRole("button", { name: /^Drink Super combat/ }).click();
  await expect(page.getByTestId("stat-potions")).toContainText("Super combat potion x1");

  // Auto retaliate starts the fight; damage dealt climbs while we watch.
  await expect.poll(async () => Number((await page.getByTestId("stat-dealt").textContent())?.replace(/,/g, "")), { timeout: 30_000 }).toBeGreaterThan(0);
  const first = Number((await page.getByTestId("stat-dealt").textContent())?.replace(/,/g, ""));
  await expect.poll(async () => Number((await page.getByTestId("stat-dealt").textContent())?.replace(/,/g, "")), { timeout: 30_000 }).toBeGreaterThan(first);
  await expect(page.getByTestId("stat-dps")).not.toHaveText("0.00");
  // Successful + missed = every hit the player landed.
  const successful = Number((await page.getByTestId("stat-successful").textContent())!.split(" ")[0]);
  const missed = Number(await page.getByTestId("stat-missed").textContent());
  expect(successful + missed).toBeGreaterThan(0);


  // A statistic opens the event log filtered to its events; an event explains itself.
  await panel.getByRole("button", { name: "Successful (accurate)" }).click();
  await expect(panel.getByLabel("Event filter")).toHaveValue("player-hits");
  const rows = panel.getByRole("list", { name: "Event log" }).getByRole("button");
  await expect(rows.first()).toContainText(/You (hit|miss)/);
  await rows.first().click();
  const detail = page.getByTestId("event-detail");
  await expect(detail).toContainText("chance to hit");
  await expect(detail).toContainText(/accuracy roll (succeeded|failed)/);
  await expect(detail).toContainText(/Tick \d+/);

  // The full log, searchable.
  await panel.getByLabel("Event filter").selectOption("all");
  await panel.getByLabel("Search events").fill("Super combat");
  await expect(rows.first()).toContainText("Drank Super combat potion");
  await rows.first().click();
  await expect(detail).toContainText("Strength");

  await panel.getByRole("button", { name: "Close analytics" }).click();
  await expect(panel).toBeHidden();
});
