import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test.beforeEach(({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("save loadout parts, build a loadout from them, then duplicate, rename, export, delete and import", async ({ page }) => {
  await page.goto("/loadouts");
  // Copy a preset and save its parts.
  await page.getByRole("button", { name: "Copy" }).nth(4).click(); // Melee (level 99, whip + warhammer)
  await page.getByRole("button", { name: "Save equipment..." }).click();
  await page.getByLabel("Name for saved equipment").fill("Whip gear");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: 'Saved "Whip gear"' })).toBeVisible();
  await page.getByRole("button", { name: "Save stats..." }).click();
  await page.getByLabel("Name for saved stats").fill("Maxed");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: 'Saved "Maxed"' })).toBeVisible();
  await page.getByRole("button", { name: "Save inventory..." }).click();
  await page.getByLabel("Name for saved inventory").fill("Melee supplies");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: 'Saved "Melee supplies"' })).toBeVisible();
  await page.getByLabel("Piety on at start").check();
  await page.getByLabel("Piety quick prayer").check();
  await page.getByLabel("Protect from Melee quick prayer").check();
  await page.getByRole("button", { name: "Save prayers..." }).click();
  await page.getByLabel("Name for saved prayers").fill("Melee prayers");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: 'Saved "Melee prayers"' })).toBeVisible();
  await page.locator("footer").getByRole("button", { name: "Cancel" }).click();

  // A new empty loadout made only from saved parts.
  await page.getByRole("button", { name: "New empty loadout" }).click();
  await page.getByLabel("Loadout name").fill("Assembled");
  await page.getByLabel("Load saved stats").selectOption({ label: "Maxed" });
  await page.getByLabel("Load saved equipment").selectOption({ label: "Whip gear" });
  await page.getByLabel("Load saved inventory").selectOption({ label: "Melee supplies" });
  await page.getByLabel("Load saved prayers").selectOption({ label: "Melee prayers" });
  await expect(page.getByLabel("weapon slot")).toHaveValue("abyssal-whip");
  await expect(page.getByLabel("Piety quick prayer")).toBeChecked();
  await expect(page.getByText("Ready to fight.")).toBeVisible();
  await page.getByRole("button", { name: "Save loadout" }).click();

  // Library: each kind has its tab.
  await expect(page.getByText("Assembled")).toBeVisible();
  for (const [tab, name] of [["Equipment", "Whip gear"], ["Stats", "Maxed"], ["Inventory", "Melee supplies"], ["Prayers", "Melee prayers"]] as const) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  }
  await expect(page.getByText(/Start: Piety · Quick: Piety, Protect from Melee/)).toBeVisible();

  // Duplicate, rename, delete.
  await page.getByRole("tab", { name: "Loadouts" }).click();
  const list = page.getByRole("list", { name: "Saved loadouts" });
  await list.getByRole("button", { name: "Duplicate" }).click();
  await expect(list.getByText("Assembled (copy)")).toBeVisible();
  await list.getByRole("listitem").filter({ hasText: "Assembled (copy)" }).getByRole("button", { name: "Rename" }).click();
  await page.getByLabel("New name").fill("Second set");
  await page.getByLabel("New name").press("Enter");
  await expect(list.getByText("Second set")).toBeVisible();

  // Export everything, wipe it, import it back.
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export all setups" }).click();
  const file = await (await dl).path();
  const bundle = JSON.parse(readFileSync(file!, "utf8"));
  expect(bundle.format).toBe("osrs-combat-sim/configs");
  expect(bundle.configs).toHaveLength(6);
  for (const tab of ["Loadouts", "Equipment", "Stats", "Inventory", "Prayers"]) {
    await page.getByRole("tab", { name: tab }).click();
    while (await page.getByRole("button", { name: "Delete" }).count()) {
      const n = await page.getByRole("button", { name: "Delete" }).count();
      await page.getByRole("button", { name: "Delete" }).first().click();
      await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(n - 1);
    }
  }
  await page.getByLabel("Setups file").setInputFiles(file!);
  await expect(page.getByRole("status")).toContainText("Imported 6");
  await page.getByRole("tab", { name: "Loadouts" }).click();
  await expect(page.getByText("Second set")).toBeVisible();
  await expect(page.getByText("Assembled", { exact: true })).toBeVisible();
});

test("quick prayers from the loadout are toggled by the prayer orb", async ({ page }) => {
  await page.goto("/loadouts");
  await page.getByRole("button", { name: "Copy" }).nth(4).click();
  await page.getByLabel("Loadout name").fill("Quick test");
  await page.getByLabel("Piety quick prayer").check();
  await page.getByLabel("Protect from Melee quick prayer").check();
  await page.getByRole("button", { name: "Save loadout" }).click();
  await page.getByRole("listitem").filter({ hasText: "Quick test" }).getByRole("link", { name: "Try" }).click();
  await page.waitForFunction(() => window.__simDebug && window.__simDebug.snapshot().tick >= 1);
  const prayers = () => page.evaluate(() => [...window.__simDebug!.snapshot().player.activePrayers].sort());
  await page.getByTestId("orb-prayer").click();
  await expect.poll(prayers).toEqual(["piety", "protect-from-melee"]);
  await page.getByTestId("orb-prayer").click();
  await expect.poll(prayers).toEqual([]);
});

test("encounter presets remember boss, modifiers and seed", async ({ page }) => {
  await page.goto("/encounters");
  const details = page.getByTestId("encounter-ashen-warden");
  await details.getByRole("checkbox", { name: /Severed Faith/ }).check();
  await details.getByLabel("Seed mode").selectOption("fixed");
  await details.getByLabel("Seed", { exact: true }).fill("4242");
  await details.getByLabel("Loadout").selectOption("melee-99");
  await details.getByRole("button", { name: "Save as preset" }).click();
  await details.getByLabel("Preset name").fill("Faith practice");
  await details.getByRole("button", { name: "Save", exact: true }).click();
  const presets = page.getByRole("region", { name: "Your presets for this boss" });
  await expect(presets).toContainText("Faith practice");
  await expect(presets).toContainText("Severed Faith · seed 4242");

  await page.goto("/loadouts?tab=encounter");
  await expect(page.getByText(/The Ashen Warden \+ Severed Faith · seed 4242/)).toBeVisible();
  await page.getByRole("link", { name: "Start" }).click();
  await expect(page).toHaveURL(/mods=severed-faith.*loadout=melee-99.*seed=4242/);
  await page.waitForFunction(() => window.__simDebug && window.__simDebug.snapshot().tick >= 1);
  const snap = await page.evaluate(() => window.__simDebug!.snapshot());
  expect(snap.seed).toBe(4242);
  expect(snap.modifierIds).toEqual(["severed-faith"]);
});

test("editor filters gear by style, searches items by tag and shows effects that are not modelled", async ({ page }) => {
  await page.goto("/loadouts");
  await page.getByRole("button", { name: "Copy" }).nth(4).click(); // level 99 melee preset
  const head = page.getByLabel("head slot");
  await expect(head.locator("option", { hasText: "Masori mask" })).toHaveCount(1);
  await page.getByLabel("Show gear for").selectOption("melee");
  await expect(head.locator("option", { hasText: "Masori mask" })).toHaveCount(0);
  await expect(head.locator("option", { hasText: "Torva full helm" })).toHaveCount(1);
  // Notes for effects the simulator does not model appear under the slot.
  await page.getByLabel("weapon slot").selectOption({ label: "Dragon claws" });
  await expect(page.getByTestId("notes-weapon")).toContainText("not modelled");
  // Inventory search matches tags too.
  await page.getByRole("list", { name: "Loadout inventory" }).getByRole("button").last().click();
  await page.getByLabel("Search items").fill("set:torva");
  const picks = page.locator("div[class*='pickList'] button");
  await expect(picks).toHaveCount(4); // Empty + three Torva pieces
  await page.getByLabel("Search items").fill("");
  await page.getByLabel("Item type").selectOption("supplies");
  await expect(picks.filter({ hasText: "Shark" })).toHaveCount(1);
  await expect(picks.filter({ hasText: "Abyssal whip" })).toHaveCount(0);
});
