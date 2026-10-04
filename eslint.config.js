// @ts-check
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/dist/**", "**/coverage/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
      eqeqeq: ["error", "always"],
    },
  },
  {
    // The domain layer is pure and deterministic: no clocks, no randomness, no network, no UI.
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "Date", message: "The engine is deterministic: pass time in as data." },
        { name: "fetch", message: "No network in the domain layer." },
        { name: "setTimeout", message: "No timers in the domain layer." },
        { name: "localStorage", message: "No storage in the domain layer." },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "The engine is deterministic." },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react-dom", "@anthropic-ai/*", "node:*"],
              message: "Keep the domain layer pure.",
            },
          ],
        },
      ],
    },
  },
);
