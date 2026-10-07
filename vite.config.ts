import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

// Short commit id shown in the landing footer so anyone can tell which build they are looking at.
function buildId(): string {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

// Two products, two entry pages: / is AI RolePlay (practice) and /assess/ is Conversation AI (assessment).

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { "import.meta.env.VITE_BUILD": JSON.stringify(buildId()) },
  build: {
    rollupOptions: {
      input: {
        roleplay: fileURLToPath(new URL("./index.html", import.meta.url)),
        assess: fileURLToPath(new URL("./assess/index.html", import.meta.url)),
      },
    },
  },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    host: process.env.HOST || "0.0.0.0",
    port: Number(process.env.PORT || 5173),
    proxy: { "/api": `http://localhost:${process.env.ROLEPLAY_API_PORT || "8787"}` },
  },
  preview: { port: Number(process.env.PORT || 5173) },
});
