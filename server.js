// dotora — backend: аккаунты, забеги, лидерборды. Node ≥22, ноль зависимостей.
// Слой API синхронный (call) — его гоняет тот же синхронный тест-раннер, что и
// движок (tests/run.js инжектит фабрику в песочницу). HTTP — тонкая обёртка:
// парсинг запроса, лимит запросов, куки, статика. Запуск: node server.js [port].
//
// Хранилище — JSON-файлы в data/ с атомарной записью (tmp+rename): сбой питания
// не оставляет битый файл. Счёт забега сервер пересчитывает сам по компонентам
// (та же формула, что Game.scoreOf) — подменить очки с клиента нельзя.
import { createServer } from "node:http";
import { readFileSync, writeFileSync, renameSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname, extname, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SESSION_TTL = 30 * 24 * 3600 * 1000; // 30 дней
const SESSION_COOKIE = "dalatro_sess";
const MAX_SESSIONS = 10; // на аккаунт: хвост не бесконечен
const RUNS_PER_PLAYER = 100;
const RUNS_TOTAL = 20000;

// ---------- хранилище ----------
function makeStore(dataDir) {
  mkdirSync(dataDir, { recursive: true });
  const path = (name) => join(dataDir, name);
  function load(name, fallback) {
    try { return JSON.parse(readFileSync(path(name), "utf8")); } catch { return fallback; }
  }
  function save(name, value) {
    const tmp = path(name + ".tmp");
    writeFileSync(tmp, JSON.stringify(value));
    renameSync(tmp, path(name)); // атомарная замена: сбой не оставит битый JSON
  }
  return { load, save, dir: dataDir };
}

function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString("hex");
}

function checkPassword(password, salt, expectedHex) {
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function validName(name) {
  return typeof name === "string" && /^[A-Za-z0-9_.-]{2,20}$/.test(name);
}

function validPassword(password) {
  return typeof password === "string" && password.length >= 4 && password.length <= 128;
}

function intIn(v, min, max) {
  return Number.isInteger(v) && v >= min && v <= max;
}

// ---------- API-ядро (синхронное) ----------
// call(method, path, { body, cookie, bearer }) → { status, json, setCookie? }
export function createBackend({ dataDir = join(ROOT, "data"), waveCount = 15 } = {}) {
  const store = makeStore(dataDir);
  const accounts = store.load("accounts.json", {}); // ключ — имя в нижнем регистре
  const runs = store.load("runs.json", { list: [], counter: 0 });

  function saveAccounts() { store.save("accounts.json", accounts); }
  function saveRuns() { store.save("runs.json", runs); }

  function findAccount(name) {
    return accounts[String(name || "").toLowerCase()] || null;
  }

  // Публичный профиль: то, что видит любой игрок и сам владелец.
  function publicPlayer(acc) {
    const s = acc.stats;
    return {
      name: acc.name,
      createdAt: acc.createdAt,
      unlockedRank: s.bestRankWon ? Math.min(14, s.bestRankWon + 1) : 1,
      stats: { ...s },
    };
  }

  function newSession(acc) {
    const token = randomBytes(24).toString("hex");
    const now = Date.now();
    // Чистим протухшие, держим хвост MAX_SESSIONS.
    for (const t of Object.keys(acc.sessions)) {
      if ((acc.sessions[t] || 0) < now) delete acc.sessions[t];
    }
    const keys = Object.keys(acc.sessions);
    if (keys.length >= MAX_SESSIONS) delete acc.sessions[keys[0]];
    acc.sessions[token] = now + SESSION_TTL;
    return token;
  }

  function accountByToken(token) {
    if (!token) return null;
    const now = Date.now();
    for (const key of Object.keys(accounts)) {
      const acc = accounts[key];
      if (acc.sessions && acc.sessions[token]) {
        if (acc.sessions[token] < now) { delete acc.sessions[token]; saveAccounts(); return null; }
        return acc;
      }
    }
    return null;
  }

  // Формула счёта — зеркало Game.scoreOf: клиент шлёт компоненты, сервер считает.
  function computeScore(r) {
    return Math.round(
      r.waves * 100
      + r.rank * 150
      + r.barracks * 200
      + Math.min(99999, r.biggestHit) / 50
      + r.spareResets * 100
    );
  }

  function validateRun(body) {
    if (!body || typeof body !== "object") return "нет тела запроса";
    const r = body;
    if (!intIn(r.rank, 1, 14)) return "ранг 1..14";
    if (!intIn(r.waves, 0, waveCount)) return `волн 0..${waveCount}`;
    if (typeof r.won !== "boolean") return "won — булево";
    if (r.won && r.waves !== waveCount) return `победа — это все ${waveCount} волн`;
    if (!intIn(r.deaths, 0, 1000)) return "смерти 0..1000";
    if (!intIn(r.timeMs, 0, 7 * 24 * 3600 * 1000)) return "время забега слишком большое";
    if (r.won && r.timeMs < 60000) return "победа быстрее минуты — ошибка или спидран из будущего";
    if (!intIn(r.barracks, 0, 10)) return "казармы 0..10";
    if (!intIn(r.biggestHit, 0, 1e9)) return "лучший удар 0..1e9";
    if (!intIn(r.spareResets, 0, 99)) return "заряды 0..99";
    if (typeof r.seed !== "string" || r.seed.length > 24) return "seed — строка до 24 символов";
    if (!intIn(r.startedAt, 0, Date.now() + 60000)) return "startedAt — время начала забега";
    return null;
  }

  // ---- роут ----
  function call(method, path, { body = undefined, cookie = "", bearer = "" } = {}) {
    const send = (status, json, setCookie) => ({ status, json, setCookie });
    const token = bearer || cookieToken(cookie);
    const me = accountByToken(token);

    if (method === "POST" && path === "/register") {
      const name = body && body.name;
      const password = body && body.password;
      if (!validName(name)) return send(400, { error: "Имя: 2–20 символов, латиница/цифры/._-" });
      if (!validPassword(password)) return send(400, { error: "Пароль: минимум 4 символа" });
      const key = name.toLowerCase();
      if (accounts[key]) return send(400, { error: "Такое имя уже занято" });
      const salt = randomBytes(16).toString("hex");
      const acc = {
        name,
        salt,
        hash: hashPassword(password, salt),
        createdAt: Date.now(),
        sessions: {},
        stats: { runs: 0, wins: 0, bestScore: 0, bestRankWon: 0, bestWaves: 0 },
      };
      accounts[key] = acc;
      const t = newSession(acc);
      saveAccounts();
      return send(200, { player: publicPlayer(acc) }, sessionCookie(t));
    }

    if (method === "POST" && path === "/login") {
      const acc = findAccount(body && body.name);
      const password = body && body.password;
      if (!acc || !validPassword(password) || !checkPassword(password, acc.salt, acc.hash)) {
        return send(401, { error: "Неверное имя или пароль" });
      }
      const t = newSession(acc);
      saveAccounts();
      return send(200, { player: publicPlayer(acc) }, sessionCookie(t));
    }

    if (method === "POST" && path === "/logout") {
      if (me && token) { delete me.sessions[token]; saveAccounts(); }
      return send(200, { ok: true }, sessionCookie("", 0));
    }

    if (method === "GET" && path === "/me") {
      if (!me) return send(401, { error: "не авторизован" });
      return send(200, { player: publicPlayer(me) });
    }

    if (method === "POST" && path === "/runs") {
      if (!me) return send(401, { error: "забег можно отправить только с аккаунта" });
      const err = validateRun(body);
      if (err) return send(400, { error: err });
      const key = `${me.name}|${body.seed}|${body.startedAt}|${body.won ? 1 : 0}`;
      const dup = runs.list.find((r) => r.key === key);
      if (dup) return send(200, { ok: true, duplicate: true, score: dup.score, player: publicPlayer(me) });
      const run = {
        id: ++runs.counter,
        key,
        player: me.name,
        date: Date.now(),
        seed: body.seed,
        rank: body.rank,
        won: body.won,
        waves: body.waves,
        deaths: body.deaths,
        timeMs: body.timeMs,
        barracks: body.barracks,
        biggestHit: body.biggestHit,
        spareResets: body.spareResets,
        score: computeScore(body),
      };
      runs.list.push(run);
      if (runs.list.length > RUNS_TOTAL) runs.list = runs.list.slice(-RUNS_TOTAL);
      const mine = runs.list.filter((r) => r.player === me.name);
      if (mine.length > RUNS_PER_PLAYER) {
        const drop = new Set(mine.slice(0, mine.length - RUNS_PER_PLAYER).map((r) => r.id));
        runs.list = runs.list.filter((r) => !drop.has(r.id));
      }
      const s = me.stats;
      const personalBest = run.score > s.bestScore;
      s.runs += 1;
      if (run.won) s.wins += 1;
      s.bestScore = Math.max(s.bestScore, run.score);
      if (run.won) s.bestRankWon = Math.max(s.bestRankWon, run.rank);
      s.bestWaves = Math.max(s.bestWaves, run.waves);
      saveRuns();
      saveAccounts();
      return send(200, { ok: true, score: run.score, personalBest, player: publicPlayer(me) });
    }

    let m;
    if (method === "GET" && (m = path.match(/^\/leaderboard$/))) {
      return send(200, leaderboard(body || {}));
    }

    if (method === "GET" && (m = path.match(/^\/players\/([A-Za-z0-9_.-]{2,20})$/))) {
      const acc = findAccount(decodeURIComponent(m[1]));
      if (!acc) return send(404, { error: "игрок не найден" });
      const list = runs.list
        .filter((r) => r.player === acc.name)
        .sort((a, b) => b.date - a.date)
        .slice(0, 20)
        .map(publicRun);
      return send(200, { player: publicPlayer(acc), runs: list });
    }

    return send(404, { error: "нет такого маршрута" });
  }

  function publicRun(r) {
    return { name: r.player, score: r.score, rank: r.rank, waves: r.waves, won: r.won, deaths: r.deaths, timeMs: r.timeMs, date: r.date, seed: r.seed };
  }

  // Лидерборды §8.1: счёт / лестница рангов / быстрая победа / без смертей.
  // Дедуп по игроку — один игрок занимает одну строку своим лучшим забегом.
  function leaderboard({ view = "score", rank = 0, limit = 50 }) {
    const byPlayer = new Map();
    for (const r of runs.list) {
      let p = byPlayer.get(r.player);
      if (!p) {
        p = { name: r.player, bestScore: 0, bestRun: null, bestRankWon: 0, fastest: null, nodeath: null, onRank: {}, runs: 0, wins: 0 };
        byPlayer.set(r.player, p);
      }
      p.runs += 1;
      if (r.won) p.wins += 1;
      if (r.score > p.bestScore) { p.bestScore = r.score; p.bestRun = r; }
      if (r.won && r.rank > p.bestRankWon) p.bestRankWon = r.rank;
      if (r.won && (!p.fastest || r.timeMs < p.fastest.timeMs)) p.fastest = r;
      if (r.won && !r.deaths && (!p.nodeath || r.score > p.nodeath.score)) p.nodeath = r;
      if (!p.onRank[r.rank] || r.score > p.onRank[r.rank].score) p.onRank[r.rank] = r;
    }
    const players = [...byPlayer.values()];
    const cap = Math.max(1, Math.min(100, Number(limit) || 50));
    let rows;
    if (view === "rank") {
      rows = players
        .slice()
        .sort((a, b) => b.bestRankWon - a.bestRankWon || b.bestScore - a.bestScore)
        .slice(0, cap)
        .map((p) => ({ name: p.name, rank: p.bestRankWon, score: p.bestScore, wins: p.wins, runs: p.runs }));
    } else if (view === "fastest") {
      rows = players
        .filter((p) => p.fastest)
        .sort((a, b) => a.fastest.timeMs - b.fastest.timeMs)
        .slice(0, cap)
        .map((p) => publicRun(p.fastest));
    } else if (view === "nodeath") {
      rows = players
        .filter((p) => p.nodeath)
        .sort((a, b) => b.nodeath.score - a.nodeath.score)
        .slice(0, cap)
        .map((p) => publicRun(p.nodeath));
    } else {
      const source = rank >= 1 && rank <= 14
        ? players.map((p) => p.onRank[rank]).filter(Boolean)
        : players.map((p) => p.bestRun).filter(Boolean);
      rows = source
        .sort((a, b) => b.score - a.score)
        .slice(0, cap)
        .map(publicRun);
    }
    return { view, rank: rank || undefined, rows };
  }

  function wipe() {
    rmSync(store.dir, { recursive: true, force: true });
  }

  return { call, leaderboard, wipe };
}

function cookieToken(cookie) {
  const m = String(cookie || "").match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([a-f0-9]+)`));
  return m ? m[1] : "";
}

function sessionCookie(token, maxAge) {
  const age = maxAge === undefined ? SESSION_TTL / 1000 : maxAge;
  return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${age}; SameSite=Lax`;
}

// Для тестов: уникальный каталог в tmp, чтобы прогон не трогал data/ живого сервера.
export function tmpDataDir() {
  return join(tmpdir(), `dotora-test-${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
}

// ---------- HTTP-обёртка ----------
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

// Фиксированное окно 60 c: защита от грубой силы логина и флуда.
const RATE_LIMIT = 240;
const rateBuckets = new Map();
function rateLimited(ip) {
  const now = Date.now();
  let bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.start > 60000) { bucket = { start: now, count: 0 }; rateBuckets.set(ip, bucket); }
  bucket.count += 1;
  if (rateBuckets.size > 5000) rateBuckets.clear();
  return bucket.count > RATE_LIMIT;
}

function readBody(req, cap = 65536) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > cap) { reject(new Error("body too large")); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export function startServer({ port = 8787, backend = createBackend() } = {}) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname.startsWith("/api/")) {
      const ip = req.socket.remoteAddress || "?";
      const headers = { "Content-Type": "application/json", "Cache-Control": "no-cache" };
      if (rateLimited(ip)) {
        res.writeHead(429, headers).end(JSON.stringify({ error: "слишком много запросов" }));
        return;
      }
      let body;
      if (req.method === "POST") {
        try {
          const raw = await readBody(req);
          body = raw ? JSON.parse(raw) : {};
        } catch {
          res.writeHead(400, headers).end(JSON.stringify({ error: "битый JSON" }));
          return;
        }
      }
      const apiPath = url.pathname.slice(4); // "/api/me" → "/me"
      const auth = req.headers.authorization || "";
      // GET-параметры приходят в ядро как поля body (view/rank/limit у /leaderboard).
      const input = body !== undefined ? body : Object.fromEntries(url.searchParams);
      const result = backend.call(req.method, apiPath, {
        body: input,
        cookie: req.headers.cookie || "",
        bearer: auth.startsWith("Bearer ") ? auth.slice(7) : "",
      });
      if (result.setCookie) headers["Set-Cookie"] = result.setCookie;
      res.writeHead(result.status, headers).end(JSON.stringify(result.json));
      return;
    }
    // статика — как serve.js: из корня репозитория, no-cache против протухших скриптов
    try {
      let path = decodeURIComponent(url.pathname);
      if (path === "/") path = "/index.html";
      const file = normalize(join(ROOT, path));
      if (!file.startsWith(ROOT)) throw new Error("forbidden");
      const data = readFileSync(file);
      res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
      res.end(data);
    } catch {
      res.writeHead(404).end("404");
    }
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Порт ${port} занят. Запустите на другом: node server.js ${Number(port) + 1}`);
      process.exit(1);
    }
    throw err;
  });
  server.listen(port, "localhost", () => {
    console.log(`dotora server (API + статика) → http://localhost:${port}`);
  });
  return server;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const port = Number(process.argv[2]) || 8787;
  startServer({ port });
}
