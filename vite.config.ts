import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// Two products, two entry pages: / is AI RolePlay (practice) and /assess/ is Conversation AI (assessment).

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
