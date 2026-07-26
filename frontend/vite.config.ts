import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Dev-only: browser praat met Vite; Vite forward /api naar FastAPI.
    // Productie heeft een aparte reverse proxy (nginx, Caddy, …) nodig.
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
  },
});
