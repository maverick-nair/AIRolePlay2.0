import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@gk/roleplay",
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
