/**
 * Package boundary rules (docs/architecture.md section 3).
 * Workspace packages resolve to their real paths (packages/<name>/...).
 * Run with: pnpm lint
 */
const pkg = (name) => `^packages/${name}/`;
const lib = (...names) => `node_modules/(${names.join("|")})/`;

module.exports = {
  forbidden: [
    {
      name: "engine-is-pure",
      comment: "The engine may only depend on zod (plus test tools). No rendering, UI, storage, assets or content.",
      severity: "error",
      from: { path: pkg("engine") },
      to: { pathNot: [pkg("engine"), lib("zod", "vitest", "@vitest", "fast-check")] },
    },
    {
      name: "content-only-uses-engine",
      severity: "error",
      from: { path: pkg("content") },
      to: { path: [pkg("render"), pkg("app"), pkg("storage"), pkg("assets"), lib("three", "react", "react-dom", "dexie")] },
    },
    {
      name: "render-does-not-know-content-ui-or-storage",
      severity: "error",
      from: { path: pkg("render") },
      to: { path: [pkg("content"), pkg("app"), pkg("storage"), lib("react", "react-dom", "zustand", "dexie")] },
    },
    {
      name: "storage-does-not-know-render-content-or-ui",
      severity: "error",
      from: { path: pkg("storage") },
      to: { path: [pkg("render"), pkg("app"), pkg("content"), lib("three", "react", "react-dom")] },
    },
    {
      name: "assets-is-data-only",
      severity: "error",
      from: { path: pkg("assets") },
      to: { path: [pkg("engine"), pkg("content"), pkg("render"), pkg("app"), pkg("storage")] },
    },
    { name: "no-circular", severity: "error", from: {}, to: { circular: true } },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: ["dist/", "\\.d\\.ts$"] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.base.json" },
    enhancedResolveOptions: { exportsFields: ["exports"], conditionNames: ["import", "default"], extensions: [".ts", ".tsx", ".js"] },
  },
};
