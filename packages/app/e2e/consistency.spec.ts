import { expect, test, type Page } from "@playwright/test";

test.beforeEach(({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

/** Differences between the drawn scene and the simulation, sampled between frames. */
const diff = (page: Page) => page.evaluate(() => window.__simDebug!.consistency());
const snap = (page: Page) => page.evaluate(() => window.__simDebug!.snapshot());

test("the arena always shows the simulation's state while the player does everything", async ({ page }) => {
  test.setTimeout(150_000);
  await page.addInitScript(() => localStorage.setItem("sim.settings", JSON.stringify({ version: 2, speed: 4 })));
  await page.goto("/fight/ashen-warden?loadout=melee-99&seed=21");
  await page.waitForFunction(() => window.__simDebug && window.__simDebug.snapshot().tick >= 1);

  const problems: string[] = [];
  let samples = 0;
  const seen = { hazards: 0, projectiles: 0 };
  const check = async (label: string) => {
    const [d, s] = await Promise.all([diff(page), snap(page)]);
    samples++;
    if (s.hazards.length) seen.hazards++;
    if (s.projectiles.length) seen.projectiles++;
    if (d.length) problems.push(`${label}: ${d.join("; ")}`);
  };
  const sample = async (label: string, ms: number) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      await check(label);
      await page.waitForTimeout(60);
    }
  };

  // Auto retaliate is on by default: being hit starts the fight.
  await sample("opening", 4000);
  expect((await snap(page)).player.targetId).toBe("npc-1");

  await page.keyboard.press("F5");
  await page.getByRole("button", { name: /^Piety/ }).click();
  for (const key of ["Digit3", "Digit2", "Digit1", "Digit3"]) {
    await page.keyboard.press(key);
    await sample(`prayer ${key}`, 600);
  }

  await page.keyboard.press("F3");
  await page.getByRole("button", { name: /^Drink Super combat/ }).click();
  await sample("drink", 800);
  await page.getByRole("button", { name: /^Eat Anglerfish/ }).first().click();
  await sample("eat", 800);
  await page.getByRole("button", { name: "Wield Dragon warhammer" }).click();
  await sample("switch to warhammer", 800);
  await page.getByTestId("orb-spec").click();
  await sample("special attack", 2500);
  await page.getByRole("button", { name: "Wield Abyssal whip" }).click();
  await sample("switch back", 800);

  // Walk away from the boss, then let auto retaliate bring the player back.
  const box = (await page.getByTestId("arena-canvas").boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.75);
  await sample("walking", 2500);

  // Pause and step: the scene follows each single tick exactly (if the fight is still on).
  if ((await snap(page)).outcome === null) {
    await page.keyboard.press("Space");
    await expect(page.getByTestId("paused")).toBeVisible();
    for (let i = 0; i < 4; i++) {
      const current = await snap(page);
      if (current.outcome) break; // a finished fight does not step
      const before = current.tick;
      await page.keyboard.press("Period");
      await expect.poll(async () => (await snap(page)).tick).toBe(before + 1);
      await page.waitForTimeout(150);
      await check(`step ${i}`);
    }
    await page.keyboard.press("Space");
  }

  // Keep fighting until a boss special has put fire on the floor.
  await page.waitForFunction(() => {
    const s = window.__simDebug!.snapshot();
    return s.hazards.length > 0 || s.outcome !== null || s.tick > 250;
  }, null, { timeout: 60_000 });
  await sample("hazards", 3000);

  // Reset: everything rebuilt from the new start state.
  await page.keyboard.press("Backspace");
  await page.waitForFunction(() => window.__simDebug!.snapshot().tick >= 2);
  await sample("after reset", 2000);

  console.log("COVERAGE", samples, JSON.stringify(seen));
  if (problems.length) console.log("PROBLEMS", JSON.stringify(problems));
  expect(samples).toBeGreaterThan(150);
  expect(seen.projectiles).toBeGreaterThan(5);
  expect(problems).toEqual([]);
});
