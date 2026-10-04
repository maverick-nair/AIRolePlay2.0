import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    host: process.env.HOST || "0.0.0.0",
    port: Number(process.env.PORT || 5173),
    proxy: { "/api": `http://localhost:${process.env.ROLEPLAY_API_PORT || "8787"}` },
  },
  preview: { port: Number(process.env.PORT || 5173) },
});
