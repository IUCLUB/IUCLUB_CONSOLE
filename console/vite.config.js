import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `npm run dev` (giao diện, cổng 5173) chạy cùng `CONSOLE_URL=http://localhost:5173 npm run dev:api`
// (server.js, cổng 3000): cookie và Origin khớp domain admin.
// changeOrigin: false để giữ Host localhost:5173 (dạng chuỗi ngắn của Vite tự đổi Host thành localhost:3000).
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": { target: "http://localhost:3000", changeOrigin: false } } },
});
