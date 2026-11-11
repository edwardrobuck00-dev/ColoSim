import react from "@vitejs/plugin-react";
import { defineProject } from "vitest/config";

export default defineProject({
  plugins: [react()],
  test: {
    name: "app",
    environment: "jsdom",
    include: ["test/**/*.test.{ts,tsx}"],
    setupFiles: ["test/setup.ts"],
    css: { modules: { classNameStrategy: "non-scoped" } },
  },
});
