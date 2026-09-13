// Tiny dependency-free static server for development.
// Usage: node serve.js [port]  →  http://localhost:8000
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
// Тот же белый список, что у прода: data/ (там хэши и токены), .git и
// служебные каталоги не раздаются даже с дев-сервера.
import { staticPathAllowed } from "./server.js";

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2]) || 8000;

  const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
  };

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path === "/") path = "/index.html";
    if (!staticPathAllowed(path)) throw new Error("forbidden");
    const file = normalize(join(root, path));
    if (!file.startsWith(root)) throw new Error("forbidden");
    const data = await readFile(file);
    // no-cache: dev-сервер. Без него Chromium держит протухший скрипт в кэше,
    // и «свежая» загрузка страницы молча гоняет старый код.
    res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("404");
  }
});

// Без обработчика занятый порт роняет процесс необработанным EADDRINUSE.
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Порт ${port} занят — возможно, dev-сервер уже запущен. Запустите на другом: node serve.js ${port + 1}`);
    process.exit(1);
  }
  throw err;
});

// Только localhost: dev-сервер не должен смотреть в LAN.
server.listen(port, "localhost", () => {
  console.log(`dotora dev server → http://localhost:${port}`);
});
