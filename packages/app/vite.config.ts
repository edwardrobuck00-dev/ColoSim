import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // The site's path prefix: "/" locally, "/ColoSim/" on GitHub Pages (set by the deploy workflow).
  base: process.env.BASE_PATH ?? "/",
  plugins: [react()],
  server: { port: 5173, strictPort: false },
  preview: { port: 4173 },
  build: {
    target: "es2022",
    sourcemap: true,
    rollupOptions: {
      output: {
        // Large libraries in their own long-cached chunks.
        manualChunks(id) {
          if (id.includes("/node_modules/three/")) return "three";
          if (/\/node_modules\/(react|react-dom|react-router|scheduler)\//.test(id)) return "react";
          return undefined;
        },
      },
    },
  },
});
