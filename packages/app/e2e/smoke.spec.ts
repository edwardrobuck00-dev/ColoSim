import { expect, test } from "@playwright/test";

test("home page links to the encounter list", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Practise boss fights");
  await page.getByRole("link", { name: "Choose an encounter" }).click();
  await expect(page.getByRole("heading", { name: "The Ashen Warden" })).toBeVisible();
  await page.getByRole("button", { name: /^Training Grounds/ }).click();
  await expect(page.getByRole("heading", { name: "Training Grounds" })).toBeVisible();
  await expect(page).toHaveURL(/boss=training-grounds/);
});

test("a fight starts, ticks, and responds to clicks", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/fight/training-grounds?loadout=melee-70");

  const canvas = page.getByTestId("arena-canvas");
  await expect(canvas).toBeVisible();
  await expect(page.getByTestId("tick-count")).toHaveText(/Tick [2-9]/, { timeout: 15_000 });

  // Click near the top of the arena to walk north; the position is shown in the Info tab.
  await page.getByRole("tab", { name: "Info" }).click();
  const position = page.locator("dt:text('Position') + dd");
  const before = await position.textContent();
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.3);
  await expect(position).not.toHaveText(before ?? "", { timeout: 10_000 });

  // Pause stops the tick counter.
  await page.getByRole("button", { name: "Pause" }).click();
  const paused = await page.getByTestId("tick-count").textContent();
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("tick-count")).toHaveText(paused ?? "");

  expect(errors).toEqual([]);
});

test("settings persist across reloads", async ({ page }) => {
  await page.goto("/settings");
  await page.getByLabel("Simulation speed").selectOption("0.5");
  await page.reload();
  await expect(page.getByLabel("Simulation speed")).toHaveValue("0.5");
});
