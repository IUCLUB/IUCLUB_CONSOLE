// Cấu hình từ biến môi trường: đọc một lần lúc khởi động.
import { fileURLToPath } from "node:url";

export const {
  PORT = 3000,
  SECRET,
  GATE_SECRET,
  CONSOLE_USERS,
  CONSOLE_RESET,
  CONSOLE_URL = "http://admin.localhost:8088",
  PROJECT_URL = "http://{slug}.localhost:8088",
  DATA_FILE = "/data/console.json",
  BACKUP_DIR = "/backups",
  DEPLOYER_URL = "http://deployer:4000",
  SEED_FILE = fileURLToPath(new URL("../seed.json", import.meta.url)),
} = process.env;
if (!SECRET || SECRET.length < 24) throw new Error("Thiếu SECRET (>= 24 ký tự) trong .env");
// Chỉ gateway (Caddy) biết: /gate trả x-iu-key, nên không để container dự án trong mạng iuclub gọi thẳng
if (!GATE_SECRET || GATE_SECRET.length < 24)
  throw new Error("Thiếu GATE_SECRET (>= 24 ký tự) trong .env");
export const CONSOLE_HOST = new URL(CONSOLE_URL).host;
export const projectUrl = (slug) => PROJECT_URL.replace("{slug}", slug);
