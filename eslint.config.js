import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const nondeterministic = [
  { name: "setTimeout", message: "The engine has no clock. The host calls tick()." },
  { name: "setInterval", message: "The engine has no clock. The host calls tick()." },
  { name: "performance", message: "The engine has no clock." },
  { name: "window", message: "The engine and content must not touch the DOM." },
  { name: "document", message: "The engine and content must not touch the DOM." },
];

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/dist/**", "**/test-results/**", "**/playwright-report/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    // Determinism rules for the simulation and its data.
    files: ["packages/engine/src/**/*.ts", "packages/content/src/**/*.ts"],
    rules: {
      "no-restricted-globals": ["error", ...nondeterministic],
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Use the seeded RNG from the mechanic context." },
        { object: "Date", property: "now", message: "The engine has no clock." },
      ],
      "no-restricted-syntax": ["error", { selector: "NewExpression[callee.name='Date']", message: "The engine has no clock." }],
    },
  },
  {
    files: ["packages/app/**/*.{ts,tsx}", "packages/render/**/*.ts", "packages/storage/**/*.ts"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["packages/app/**/*.tsx"],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ["tools/**/*.ts", "**/*.config.ts", "**/*.config.js"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["**/*.cjs"],
    languageOptions: { globals: globals.node, sourceType: "commonjs" },
  },
);
