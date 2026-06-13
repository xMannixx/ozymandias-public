import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  server: {
    proxy: {
      "/auth": "http://localhost:8000",
      "/turns": "http://localhost:8000",
      "/claims": "http://localhost:8000",
      "/proposals": "http://localhost:8000",
      "/projects": "http://localhost:8000",
      "/files": "http://localhost:8000",
      "/mail": "http://localhost:8000",
      "/calendar": "http://localhost:8000",
      "/llm": "http://localhost:8000",
      "/voice": "http://localhost:8000",
      "/health": "http://localhost:8000",
    },
  },
});
