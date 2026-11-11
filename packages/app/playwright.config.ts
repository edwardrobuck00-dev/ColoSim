import { defineConfig, devices } from "@playwright/test";

const PORT = 4174;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  // The arena renders with WebGL. Headless browsers use a CPU renderer, so run
  // one test at a time to keep frame rates (and tick timing) predictable.
  workers: 1,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "off" },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // WebGL without a GPU (CI and headless machines).
        launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
      },
    },
  ],
  webServer: {
    command: `pnpm exec vite build && pnpm exec vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
