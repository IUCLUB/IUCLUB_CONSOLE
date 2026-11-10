import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `npm run dev` (giao diện, cổng 5173) chạy cùng `npm run dev:api` (server.js, cổng 3000)
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:3000" } },
});
