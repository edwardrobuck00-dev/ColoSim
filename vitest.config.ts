import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/engine",
      "packages/content",
      "packages/render",
      "packages/assets",
      "packages/storage",
      "packages/app",
    ],
  },
});
