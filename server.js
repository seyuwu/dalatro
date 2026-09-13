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
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createAnalytics } from "./analytics.js";
import { createAdminAuth, adminPageHtml, ADMIN_COOKIE } from "./admin.js";

// Ре-экспорт для тестов: vm-раннер инжектит только server.js (как Backend).
export { createAnalytics } from "./analytics.js";
export { createAdminAuth, ADMIN_COOKIE } from "./admin.js";
export { staticPathAllowed, WAVE_META };

const ROOT = dirname(fileURLToPath(import.meta.url));
const SESSION_TTL = 30 * 24 * 3600 * 1000; // 30 дней
const SESSION_COOKIE = "dalatro_sess";
const MAX_SESSIONS = 10; // на аккаунт: хвост не бесконечен
const RUNS_PER_PLAYER = 100;
const RUNS_TOTAL = 20000;

// ---------- хранилище ----------
function makeStore(dataDir) {
  // 0700/0600: в файлах хэши паролей и токены сессий — читать их должен
  // только владелец процесса (на Windows режим игнорируется, там это не важно).
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const path = (name) => join(dataDir, name);
  function load(name, fallback) {
    try { return JSON.parse(readFileSync(path(name), "utf8")); } catch { return fallback; }
  }
  function save(name, value) {
    const tmp = path(name + ".tmp");
    writeFileSync(tmp, JSON.stringify(value), { mode: 0o600 });
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

// Выравнивание времени ответа: scrypt гоняется и для несуществующего имени
// и для битого пароля, иначе перебор имён отличает «аккаунт есть» (~150 мс)
// от «аккаунта нет» (~3 мс) по времени 401.
const PAD_SALT = "dotora-timing-pad";
const PAD_HASH = scryptSync("dotora-timing-pad-password", PAD_SALT, 64);
function burnScrypt(password) {
  const actual = scryptSync(typeof password === "string" ? password : "", PAD_SALT, 64);
  timingSafeEqual(actual, PAD_HASH);
}

// Токены сессий в accounts.json лежат хэшем: утечка файла не отдаёт живые
// куки, их нельзя ни применить, ни подобрать по хэшу (сами токены 192 бита).
function tokenHash(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

function validName(name) {
  return typeof name === "string" && /^[A-Za-z0-9_.-]{2,20}$/.test(name);
}

  function validPassword(password) {
    return typeof password === "string" && password.length >= 6 && password.length <= 128;
  }

function intIn(v, min, max) {
  return Number.isInteger(v) && v >= min && v <= max;
}

// Вытеснение в картах лимитов: выкидываем только протухшие ключи, а не карту
// целиком — иначе шквал одноразовых IP выметает счётчики честных клиентов.
// Значения — либо массивы таймстампов, либо бакеты { start, count }.
function pruneMap(map, maxAgeMs) {
  const cutoff = Date.now() - maxAgeMs;
  for (const [k, v] of map) {
    const newest = Array.isArray(v) ? v[v.length - 1] : v && v.start;
    if (newest === undefined || newest < cutoff) map.delete(k);
  }
}

// ---------- API-ядро (синхронное) ----------
// call(method, path, { body, cookie, bearer }) → { status, json, setCookie? }
// onEvent — крючок аналитики: register/login/run уходят в analytics.js.
// Метаданные волн для редактора промо (зеркало WAVES_DATA из world.js —
// id/название/акт; при добавлении волн не забывать сюда).
const WAVE_META = [
  { id: "t1", act: 1, name: "T1 Башня" }, { id: "t2", act: 1, name: "T2 Башня" }, { id: "t3", act: 1, name: "T3 Башня" },
  { id: "techies", act: 1, name: "Techies", miniBoss: true }, { id: "roshan", act: 1, name: "Roshan", boss: true },
  { id: "f1", act: 2, name: "Руины" }, { id: "f2", act: 2, name: "Сторожевой лагерь" }, { id: "f3", act: 2, name: "Цитадель" },
  { id: "fmini", act: 2, name: "Сапёры", miniBoss: true }, { id: "fboss", act: 2, name: "Древний Рошан", boss: true },
  { id: "p1", act: 3, name: "Пепелище" }, { id: "p2", act: 3, name: "Бастион" }, { id: "p3", act: 3, name: "Сердце тьмы" },
  { id: "pmini", act: 3, name: "Шахты Трона", miniBoss: true }, { id: "pfinal", act: 3, name: "Трон", boss: true },
];

export function createBackend({ dataDir = join(ROOT, "data"), waveCount = 15, onEvent = () => {}, runGapMs = 15 * 1000 } = {}) {
  const store = makeStore(dataDir);
  const accounts = store.load("accounts.json", {}); // ключ — имя в нижнем регистре
  const runs = store.load("runs.json", { list: [], counter: 0 });
  const promoStore = store.load("promo.json", { waves: {} }); // промо-башни из админки

  function savePromo() { store.save("promo.json", promoStore); }

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
    acc.sessions[tokenHash(token)] = now + SESSION_TTL;
    return token;
  }

  function accountByToken(token) {
    if (!token) return null;
    const h = tokenHash(token);
    const now = Date.now();
    for (const key of Object.keys(accounts)) {
      const acc = accounts[key];
      if (acc.sessions && acc.sessions[h]) {
        if (acc.sessions[h] < now) { delete acc.sessions[h]; saveAccounts(); return null; }
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
    if (!intIn(r.timeMs, 0, 24 * 3600 * 1000)) return "время забега слишком большое";
    if (r.won && r.timeMs < 180000) return "победа быстрее трёх минут — так не бывает";
    if (!intIn(r.barracks, 0, 2)) return "казармы 0..2";
    // Синтетический кап: реальные удары (симуляция движка) — сотни, максимум
    // единицы тысяч; в счёт и так идёт обрезка до 99999. 1e6 отсекает мусор.
    if (!intIn(r.biggestHit, 0, 1e6)) return "лучший удар слишком большой";
    if (!intIn(r.spareResets, 0, 10)) return "заряды 0..10";
    if (typeof r.seed !== "string" || !/^[A-Za-z0-9_-]{0,24}$/.test(r.seed)) return "seed — до 24 символов латиницы/цифр";
    if (!intIn(r.startedAt, 0, Date.now() + 60000)) return "startedAt — время начала забега";
    return null;
  }

  // Регистрации: не больше 5 в минуту с одного IP — аккаунты не фармятся.
  const registerTimes = new Map();
  function registerMarked(ip) {
    if (!registerTimes.has(ip) && registerTimes.size > 5000) { pruneMap(registerTimes, 60000); if (registerTimes.size > 5000) registerTimes.clear(); }
    const arr = registerTimes.get(ip) || [];
    arr.push(Date.now());
    registerTimes.set(ip, arr);
  }

  function registerLimited(ip) {
    const now = Date.now();
    const fresh = (registerTimes.get(ip) || []).filter((t) => now - t < 60000);
    registerTimes.set(ip, fresh);
    return fresh.length >= 5;
  }

  // Троттлинг брутфорса логина: 10 неудач на пару «имя + IP» за 15 минут
  // блокируют вход (верный пароль тоже), успех сбрасывает счётчик. В памяти
  // процесса: рестарт снимает блокировки — для игры это приемлемо.
  const LOGIN_FAILS_MAX = 10;
  const LOGIN_WINDOW = 15 * 60 * 1000;
  const loginFails = new Map();
  function loginThrottled(key) {
    const fresh = (loginFails.get(key) || []).filter((t) => t > Date.now() - LOGIN_WINDOW);
    loginFails.set(key, fresh);
    return fresh.length >= LOGIN_FAILS_MAX;
  }
  function loginFail(key) {
    if (!loginFails.has(key) && loginFails.size > 5000) { pruneMap(loginFails, LOGIN_WINDOW); if (loginFails.size > 5000) loginFails.clear(); }
    const arr = loginFails.get(key) || [];
    arr.push(Date.now());
    loginFails.set(key, arr);
  }
  function loginOk(key) {
    loginFails.delete(key);
  }

  // ---- роут ----
  function call(method, path, { body = undefined, cookie = "", bearer = "", ip = "-", secure = false, isAdmin = false } = {}) {
    const send = (status, json, setCookie) => ({ status, json, setCookie });
    const token = bearer || cookieToken(cookie);
    const me = accountByToken(token);

    if (method === "POST" && path === "/register") {
      const name = body && body.name;
      const password = body && body.password;
      if (!validName(name)) return send(400, { error: "Имя: 2–20 символов, латиница/цифры/._-" });
      if (!validPassword(password)) return send(400, { error: "Пароль: минимум 6 символов" });
      if (registerLimited(ip)) return send(429, { error: "слишком много регистраций с одного адреса — попробуйте позже" });
      if (Object.keys(accounts).length >= 100000) return send(503, { error: "регистрация временно закрыта" });
      const key = name.toLowerCase();
      if (accounts[key]) {
        // Имя занято: ответ такой же по времени, как успешная регистрация
        // (scrypt), иначе /register становится оракулом «занято ли имя».
        burnScrypt(password);
        return send(400, { error: "Такое имя уже занято" });
      }
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
      registerMarked(ip);
      const t = newSession(acc);
      saveAccounts();
      onEvent({ type: "register", name: acc.name });
      const claimed = typeof body.guest === "string" && GUEST_RE.test(body.guest) ? claimGuestRuns(body.guest, acc) : 0;
      return send(200, { player: publicPlayer(acc), claimed }, sessionCookie(t, undefined, secure));
    }

    if (method === "POST" && path === "/login") {
      const throttleKey = `${String((body && body.name) || "").toLowerCase()}|${ip}`;
      if (loginThrottled(throttleKey)) {
        return send(429, { error: "слишком много неудачных попыток — подождите 15 минут" });
      }
      const acc = findAccount(body && body.name);
      const password = body && body.password;
      if (!acc || !validPassword(password)) {
        burnScrypt(password);
        loginFail(throttleKey);
        return send(401, { error: "Неверное имя или пароль" });
      }
      if (!checkPassword(password, acc.salt, acc.hash)) {
        loginFail(throttleKey);
        return send(401, { error: "Неверное имя или пароль" });
      }
      loginOk(throttleKey);
      const t = newSession(acc);
      saveAccounts();
      onEvent({ type: "login", name: acc.name });
      const claimed = typeof body.guest === "string" && GUEST_RE.test(body.guest) ? claimGuestRuns(body.guest, acc) : 0;
      return send(200, { player: publicPlayer(acc), claimed }, sessionCookie(t, undefined, secure));
    }

    if (method === "POST" && path === "/logout") {
      if (me && token) { delete me.sessions[tokenHash(token)]; saveAccounts(); }
      return send(200, { ok: true }, sessionCookie("", 0));
    }

    if (method === "GET" && path === "/me") {
      if (!me) return send(401, { error: "не авторизован" });
      return send(200, { player: publicPlayer(me) });
    }

    if (method === "POST" && path === "/runs") {
      const err = validateRun(body);
      if (err) return send(400, { error: err });
      // С аккаунта — обычный забег; без аккаунта — гостевой по токену браузера
      // (виден в таблице как «Гость #XXXX», при регистрации переедет в аккаунт).
      let player;
      let isGuest = false;
      if (me) {
        player = me.name;
      } else {
        if (typeof (body && body.guest) !== "string" || !GUEST_RE.test(body.guest)) {
          return send(401, { error: "забег отправляется с аккаунта или с гостевым токеном" });
        }
        if (guestLimited(ip)) return send(429, { error: "слишком много гостевых забегов с одного адреса — попробуйте через час" });
        player = "guest:" + body.guest;
        isGuest = true;
      }
      // Сначала идемпотентность (повтор — не фарм), потом антифарм-лимит.
      const key = `${player}|${body.seed}|${body.startedAt}|${body.won ? 1 : 0}`;
      const dup = runs.list.find((r) => r.key === key);
      if (dup) return send(200, { ok: true, duplicate: true, score: dup.score, ...(me ? { player: publicPlayer(me) } : { guest: true }) });
      if (runSubmitLimited(player)) return send(429, { error: "слишком много забегов подряд — отдохни пару минут" });
      runSubmitMarked(player);
      const run = {
        id: ++runs.counter,
        key,
        player,
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
      const mine = runs.list.filter((r) => r.player === player);
      if (mine.length > RUNS_PER_PLAYER) {
        const drop = new Set(mine.slice(0, mine.length - RUNS_PER_PLAYER).map((r) => r.id));
        runs.list = runs.list.filter((r) => !drop.has(r.id));
      }
      const personalBest = !isGuest && run.score > me.stats.bestScore;
      if (!isGuest) {
        const s = me.stats;
        s.runs += 1;
        if (run.won) s.wins += 1;
        s.bestScore = Math.max(s.bestScore, run.score);
        if (run.won) s.bestRankWon = Math.max(s.bestRankWon, run.rank);
        s.bestWaves = Math.max(s.bestWaves, run.waves);
        saveAccounts();
      } else {
        guestRunAccepted(ip);
      }
      saveRuns();
      onEvent({ type: "run", ...(isGuest ? {} : { name: me.name }), won: run.won, rank: run.rank, score: run.score });
      const result = { ok: true, score: run.score };
      if (isGuest) result.guest = true;
      else {
        result.personalBest = personalBest;
        result.player = publicPlayer(me);
      }
      return send(200, result);
    }

    // Промо-конфиг для боя: метаданные волн + записи из админки.
    if (method === "GET" && path === "/promo-config") {
      return send(200, { waves: WAVE_META, promos: promoStore.waves });
    }

    // Сохранение промо-волны из админки (пустое name = убрать промо).
    if (method === "POST" && path === "/admin/promo") {
      if (!isAdmin) return send(401, { error: "требуется вход админа" });
      const waveId = body && body.waveId;
      if (!WAVE_META.some((w) => w.id === waveId)) return send(400, { error: "нет такой волны" });
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";
      const url = typeof body.url === "string" ? body.url.trim() : "";
      const tagline = typeof body.tagline === "string" ? body.tagline.trim().slice(0, 140) : "";
      const desc = typeof body.desc === "string" ? body.desc.trim().slice(0, 300) : "";
      if (!name) {
        delete promoStore.waves[waveId];
        savePromo();
        return send(200, { ok: true, deleted: true });
      }
      if (url && !/^https:\/\/\S{1,200}$/.test(url)) return send(400, { error: "ссылка должна начинаться с https://" });
      const prev = promoStore.waves[waveId] || {};
      promoStore.waves[waveId] = { name, url, tagline, desc, hasImage: !!prev.hasImage };
      savePromo();
      return send(200, { ok: true });
    }

    // Метка о загруженной картинке (файл пишет HTTP-слой, тут только стейт).
    if (method === "POST" && path === "/admin/promo-image") {
      if (!isAdmin) return send(401, { error: "требуется вход админа" });
      const waveId = body && body.waveId;
      if (!WAVE_META.some((w) => w.id === waveId)) return send(400, { error: "нет такой волны" });
      const entry = promoStore.waves[waveId] || { name: waveId, url: "", tagline: "", desc: "" };
      entry.hasImage = !!body.hasImage;
      promoStore.waves[waveId] = entry;
      savePromo();
      return send(200, { ok: true });
    }

    // Клик по промо-боссу: анонимно, без состояния — просто счётчик интереса.
    if (method === "POST" && path === "/promo") {
      const promo = body && body.promo;
      const target = body && body.target;
      if (typeof promo !== "string" || !/^[a-z0-9_.-]{1,40}$/.test(promo)) return send(400, { error: "неизвестный промо-босс" });
      if (target !== "visit" && target !== "view") return send(400, { error: "неизвестный тип клика" });
      onEvent({ type: "promo", promo, target, ...(me ? { name: me.name } : {}) });
      return send(200, { ok: true });
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

  // Лимит гостевых забегов: 10 в час с одного IP — таблицу не заспамить.
  const GUEST_RUNS_MAX = 10;
  const GUEST_WINDOW = 3600 * 1000;
  const guestRuns = new Map();
  function guestLimited(ip) {
    const fresh = (guestRuns.get(ip) || []).filter((t) => t > Date.now() - GUEST_WINDOW);
    guestRuns.set(ip, fresh);
    return fresh.length >= GUEST_RUNS_MAX;
  }
  function guestRunAccepted(ip) {
    if (!guestRuns.has(ip) && guestRuns.size > 5000) { pruneMap(guestRuns, GUEST_WINDOW); if (guestRuns.size > 5000) guestRuns.clear(); }
    const arr = guestRuns.get(ip) || [];
    arr.push(Date.now());
    guestRuns.set(ip, arr);
  }

  // Антифарм лидербордов: одному игроку не чаще раза в 15 c и не больше
  // 40 забегов в час. Гости дополнительно ограничены по IP.
  const RUN_SUBMIT_MIN_GAP = runGapMs;
  const RUN_SUBMIT_HOURLY = 40;
  const runSubmits = new Map();
  function runSubmitLimited(key) {
    const now = Date.now();
    const fresh = (runSubmits.get(key) || []).filter((t) => now - t < 3600 * 1000);
    runSubmits.set(key, fresh);
    if (fresh.length && now - fresh[fresh.length - 1] < RUN_SUBMIT_MIN_GAP) return true;
    return fresh.length >= RUN_SUBMIT_HOURLY;
  }
  function runSubmitMarked(key) {
    if (!runSubmits.has(key) && runSubmits.size > 5000) { pruneMap(runSubmits, 3600 * 1000); if (runSubmits.size > 5000) runSubmits.clear(); }
    const arr = runSubmits.get(key) || [];
    arr.push(Date.now());
    runSubmits.set(key, arr);
  }

  const GUEST_RE = /^[a-f0-9]{16,64}$/;

  // Гостевые забеги переезжают в аккаунт при регистрации/входе с тем же
  // токеном браузера; статистика аккаунта пересчитывается с нуля по его
  // забегам — источник истины один, и это runs.json.
  function claimGuestRuns(guestToken, acc) {
    const key = "guest:" + guestToken;
    let claimed = 0;
    for (const r of runs.list) {
      if (r.player === key) {
        r.player = acc.name;
        r.key = acc.name + r.key.slice(key.length);
        claimed += 1;
      }
    }
    if (claimed) {
      const mine = runs.list.filter((r) => r.player === acc.name);
      const s = acc.stats;
      s.runs = mine.length;
      s.wins = mine.filter((r) => r.won).length;
      s.bestScore = mine.reduce((m, r) => Math.max(m, r.score), 0);
      s.bestRankWon = mine.reduce((m, r) => Math.max(m, r.won ? r.rank : 0), 0);
      s.bestWaves = mine.reduce((m, r) => Math.max(m, r.waves), 0);
      saveRuns();
      saveAccounts();
    }
    return claimed;
  }

  // Гость в лидерборде — не «guest:<токен>», а читаемое имя.
  function displayName(player) {
    const m = /^guest:([a-f0-9]+)/.exec(player);
    return m ? "Гость #" + m[1].slice(0, 4) : player;
  }

  function publicRun(r) {
    return { name: displayName(r.player), score: r.score, rank: r.rank, waves: r.waves, won: r.won, deaths: r.deaths, timeMs: r.timeMs, date: r.date, seed: r.seed };
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
        .map((p) => ({ name: displayName(p.name), rank: p.bestRankWon, score: p.bestScore, wins: p.wins, runs: p.runs }));
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

  // Живые счётчики для админки.
  function counts() {
    return { accounts: Object.keys(accounts).length, runs: runs.list.length };
  }

  // Сводка по игрокам для админки (активнейшие вперёд).
  function players(limit = 100) {
    return Object.values(accounts)
      .map((a) => ({ name: a.name, runs: a.stats.runs, wins: a.stats.wins, bestScore: a.stats.bestScore, bestRank: a.stats.bestRankWon, createdAt: a.createdAt }))
      .sort((x, y) => y.runs - x.runs || y.bestScore - x.bestScore)
      .slice(0, limit);
  }

  return { call, leaderboard, wipe, counts, players };
}

function cookieToken(cookie) {
  const m = String(cookie || "").match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([a-f0-9]+)`));
  return m ? m[1] : "";
}

function sessionCookie(token, maxAge, secure = false) {
  const age = maxAge === undefined ? SESSION_TTL / 1000 : maxAge;
  return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${age}; SameSite=Lax${secure ? "; Secure" : ""}`;
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

// Белый список статики: наружу отдаётся только то, что нужно браузеру.
// Всё прочее (data/ с хэшами и токенами, .git, deploy, tests, docs…) — 404.
const STATIC_ALLOWED = [/^\/index\.html$/, /^\/src\//, /^\/images\//, /^\/dist\//];
const STATIC_BLOCKED = [/^\/(data|deploy|tests|test|additions|docs|node_modules|\.git)(\/|$)/, /\/\./];

function staticPathAllowed(path) {
  if (STATIC_BLOCKED.some((re) => re.test(path))) return false;
  return STATIC_ALLOWED.some((re) => re.test(path));
}

// Базовые заголовки для всех ответов; HSTS только на HTTPS.
// CSP: скрипты и стили — свои плюс инлайн (dist-сборка инлайнит всё в один
// html, админка — один файл); шрифты Google Fonts; внешнего JS нет.
function securityHeaders(secure) {
  const headers = {
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
  };
  if (secure) headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  return headers;
}

// IP клиента. X-Forwarded-For доверяем ТОЛЬКО если запрос пришёл с локального
// адреса (наш nginx): из интернета заголовок подделывается, и через него
// обходятся лимиты и мусорится аналитика.
function isHttpsReq(req) {
  return (req.headers["x-forwarded-proto"] || "").includes("https");
}

function isLocalAddress(addr) {
  const a = String(addr || "").replace(/^::ffff:/, "");
  return a === "127.0.0.1" || a === "::1" || a.startsWith("10.") || a.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[01])\./.test(a);
}

function clientIp(req) {
  const remote = req.socket.remoteAddress || "?";
  if (isLocalAddress(remote)) {
    const xff = req.headers["x-forwarded-for"];
    if (xff) {
      // Берём ПОСЛЕДНИЙ элемент: nginx дописывает реального клиента в конец
      // ($proxy_add_x_forwarded_for), а всё левее атакующий подделывает сам.
      // Взяв первый элемент, отдали бы ему ключи всех IP-лимитов.
      const parts = String(xff).split(",");
      return parts[parts.length - 1].trim();
    }
  }
  return remote;
}

// Фиксированное окно 60 c: защита от грубой силы логина и флуда.
const RATE_LIMIT = 240;
const rateBuckets = new Map();
function rateLimited(ip) {
  const now = Date.now();
  let bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.start > 60000) { bucket = { start: now, count: 0 }; rateBuckets.set(ip, bucket); }
  bucket.count += 1;
  if (rateBuckets.size > 5000) { pruneMap(rateBuckets, 60000); if (rateBuckets.size > 5000) rateBuckets.clear(); }
  return bucket.count > RATE_LIMIT;
}

// Отдельное жёсткое окно для логина админки: брутфорс тут дороже всего.
const ADMIN_RATE_LIMIT = 15;
const adminBuckets = new Map();
function adminRateLimited(ip) {
  const now = Date.now();
  let bucket = adminBuckets.get(ip);
  if (!bucket || now - bucket.start > 60000) { bucket = { start: now, count: 0 }; adminBuckets.set(ip, bucket); }
  bucket.count += 1;
  if (adminBuckets.size > 5000) { pruneMap(adminBuckets, 60000); if (adminBuckets.size > 5000) adminBuckets.clear(); }
  return bucket.count > ADMIN_RATE_LIMIT;
}

function adminCookie(token, maxAge, secure = false) {
  return `${ADMIN_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure ? "; Secure" : ""}`;
}

function adminCookieToken(cookie) {
  const m = String(cookie || "").match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE}=([a-f0-9]+)`));
  return m ? m[1] : "";
}

// Возвращает Buffer: JSON-ветки сами делают .toString("utf8"), бинарная
// загрузка промо-картинок берёт сырые байты (utf8-декод ломает PNG/JPG).
function readBody(req, cap = 65536) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > cap) { reject(new Error("body too large")); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export function startServer({ port = 8787, dataDir = join(ROOT, "data") } = {}) {
  const analytics = createAnalytics({ dataFile: join(dataDir, "analytics.json") });
  const backend = createBackend({ dataDir, onEvent: (e) => analytics.event(e) });
  const admin = createAdminAuth({
    dataFile: join(dataDir, "admin.json"),
    envPassword: process.env.DOTORA_ADMIN_PASSWORD,
    onCreated: (password) => {
      console.log(`Админка: http://localhost:${port}/admin · пароль: ${password}`);
      console.log(`(пароль сохранён в ${join(dataDir, "admin.json")}; свой — DOTORA_ADMIN_PASSWORD при первом запуске, либо удалите файл)`);
    },
  });

  // Буфер аналитики сбрасываем на диск раз в 30 c и на выходе процесса.
  const saveAnalytics = () => analytics.save();
  const flushTimer = setInterval(saveAnalytics, 30000);
  flushTimer.unref();
  process.on("exit", saveAnalytics);
  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));

  const server = createServer(async (req, res) => {
    const t0 = performance.now();
    const url = new URL(req.url, "http://x");
    const ip = clientIp(req);
    const https = isHttpsReq(req);
    const baseHeaders = securityHeaders(https);
    res.on("finish", () => {
      // админку из трафика игры исключаем
      if (url.pathname === "/admin" || url.pathname.startsWith("/api/admin")) return;
      analytics.record({ method: req.method, path: url.pathname, status: res.statusCode, ms: performance.now() - t0, ip });
    });

    // ---- админка ----
    if (url.pathname === "/admin") {
      res.writeHead(200, { ...baseHeaders, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache", "X-Robots-Tag": "noindex" });
      res.end(adminPageHtml());
      return;
    }
    if (url.pathname === "/api/admin/login" && req.method === "POST") {
      const headers = { ...baseHeaders, "Content-Type": "application/json", "Cache-Control": "no-cache" };
      if (adminRateLimited(ip)) {
        res.writeHead(429, headers).end(JSON.stringify({ error: "слишком много попыток входа" }));
        return;
      }
      let body = {};
      try { body = JSON.parse((await readBody(req)) || "{}"); } catch { /* битый JSON = неверный пароль */ }
      const token = admin.login(typeof body.password === "string" ? body.password : "");
      if (!token) {
        res.writeHead(401, headers).end(JSON.stringify({ error: "неверный пароль" }));
        return;
      }
      res.writeHead(200, { ...headers, "Set-Cookie": adminCookie(token, 24 * 3600, https) }).end(JSON.stringify({ ok: true }));
      return;
    }
    if (url.pathname === "/api/admin/logout" && req.method === "POST") {
      admin.logout(adminCookieToken(req.headers.cookie || ""));
      res.writeHead(200, { ...baseHeaders, "Content-Type": "application/json", "Set-Cookie": adminCookie("", 0) }).end(JSON.stringify({ ok: true }));
      return;
    }
    if (url.pathname === "/api/admin/stats") {
      const headers = { ...baseHeaders, "Content-Type": "application/json", "Cache-Control": "no-cache" };
      if (!admin.validate(adminCookieToken(req.headers.cookie || ""))) {
        res.writeHead(401, headers).end(JSON.stringify({ error: "требуется вход админа" }));
        return;
      }
      res.writeHead(200, headers).end(JSON.stringify({ ...analytics.snapshot(), store: backend.counts(), players: backend.players() }));
      return;
    }

    // ---- админ: промо-башни (картинки приходят сырым телом) ----
    let m2;
    if ((m2 = url.pathname.match(/^\/api\/admin\/promo-image\/([a-z0-9_]{1,20})$/)) && req.method === "POST") {
      const headers = { ...baseHeaders, "Content-Type": "application/json", "Cache-Control": "no-cache" };
      if (!admin.validate(adminCookieToken(req.headers.cookie || ""))) {
        res.writeHead(401, headers).end(JSON.stringify({ error: "требуется вход админа" }));
        return;
      }
      const waveId = m2[1];
      let buf;
      try { buf = await readBody(req, 400 * 1024); } catch { buf = Buffer.alloc(0); }
      if (!Buffer.isBuffer(buf)) buf = Buffer.alloc(0);
      const isPng = buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
      const isJpg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8;
      const isWebp = buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP";
      if (!isPng && !isJpg && !isWebp) {
        res.writeHead(400, headers).end(JSON.stringify({ error: "нужен PNG, JPEG или WebP (админка жмёт сама)" }));
        return;
      }
      const ext = isPng ? "png" : isJpg ? "jpg" : "webp";
      const imgDir = join(dataDir, "promo-img");
      mkdirSync(imgDir, { recursive: true });
      for (const old of ["png", "jpg"]) { try { rmSync(join(imgDir, waveId + "." + old)); } catch {} }
      writeFileSync(join(imgDir, waveId + "." + ext), buf);
      const marked = backend.call("POST", "/admin/promo-image", { body: { waveId, hasImage: true }, isAdmin: true });
      res.writeHead(marked.status, headers).end(JSON.stringify(marked.json));
      return;
    }
    if (url.pathname === "/api/admin/promo-image-remove" && req.method === "POST") {
      const headers = { ...baseHeaders, "Content-Type": "application/json", "Cache-Control": "no-cache" };
      if (!admin.validate(adminCookieToken(req.headers.cookie || ""))) {
        res.writeHead(401, headers).end(JSON.stringify({ error: "требуется вход админа" }));
        return;
      }
      let body = {};
      try { body = JSON.parse((await readBody(req)).toString("utf8") || "{}"); } catch {}
      const waveId = typeof body.waveId === "string" && /^[a-z0-9_]{1,20}$/.test(body.waveId) ? body.waveId : null;
      if (waveId) for (const ext of ["png", "jpg"]) { try { rmSync(join(dataDir, "promo-img", waveId + "." + ext)); } catch {} }
      const marked = backend.call("POST", "/admin/promo-image", { body: { waveId, hasImage: false }, isAdmin: true });
      res.writeHead(marked.status, headers).end(JSON.stringify(marked.json));
      return;
    }
    // Публичная раздача промо-картинок из data/promo-img
    if ((m2 = url.pathname.match(/^\/promo-image\/([a-z0-9_]{1,20})$/)) && req.method === "GET") {
      for (const ext of ["png", "jpg"]) {
        try {
          const data = readFileSync(join(dataDir, "promo-img", m2[1] + "." + ext));
          res.writeHead(200, { ...baseHeaders, "Content-Type": ext === "png" ? "image/png" : "image/jpeg", "Cache-Control": "public, max-age=120" });
          res.end(data);
          return;
        } catch {}
      }
      res.writeHead(404, { ...baseHeaders }).end("404");
      return;
    }
    // Админ-сохранение текстов промо — через ядро с флагом isAdmin
    if (url.pathname === "/api/admin/promo" && req.method === "POST") {
      const headers = { ...baseHeaders, "Content-Type": "application/json", "Cache-Control": "no-cache" };
      if (!admin.validate(adminCookieToken(req.headers.cookie || ""))) {
        res.writeHead(401, headers).end(JSON.stringify({ error: "требуется вход админа" }));
        return;
      }
      let promoBody = {};
      try { promoBody = JSON.parse((await readBody(req)).toString("utf8") || "{}"); } catch { promoBody = {}; }
      const result = backend.call("POST", "/admin/promo", { body: promoBody, isAdmin: true });
      res.writeHead(result.status, headers).end(JSON.stringify(result.json));
      return;
    }

    if (url.pathname.startsWith("/api/")) {
      const headers = { ...baseHeaders, "Content-Type": "application/json", "Cache-Control": "no-cache" };
      if (rateLimited(ip)) {
        res.writeHead(429, headers).end(JSON.stringify({ error: "слишком много запросов" }));
        return;
      }
      let body;
      if (req.method === "POST") {
        try {
          const raw = await readBody(req);
          body = raw.length ? JSON.parse(raw.toString("utf8")) : {};
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
        ip,
        secure: https,
      });
      const respHeaders = { ...baseHeaders, ...headers };
      if (result.setCookie) respHeaders["Set-Cookie"] = result.setCookie;
      res.writeHead(result.status, respHeaders).end(JSON.stringify(result.json));
      return;
    }
    // статика — из корня репозитория, no-cache против протухших скриптов.
    // Служебные каталоги раздавать нельзя: в data/ лежат хэши паролей и
    // токены сессий, в .git — история, остальное наружу не нужно.
    try {
      let path = decodeURIComponent(url.pathname);
      if (path === "/") path = "/index.html";
      if (!staticPathAllowed(path)) throw new Error("forbidden");
      const file = normalize(join(ROOT, path));
      if (!file.startsWith(ROOT)) throw new Error("forbidden");
      const data = readFileSync(file);
      res.writeHead(200, {
        ...securityHeaders(isHttpsReq(req)),
        "Content-Type": MIME[extname(file)] || "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      res.end(data);
    } catch {
      res.writeHead(404, { ...baseHeaders }).end("404");
    }
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Порт ${port} занят. Запустите на другом: node server.js ${Number(port) + 1}`);
      process.exit(1);
    }
    throw err;
  });
  // Адрес: по умолчанию localhost (запуск на сервере напрямую — наружу только
  // nginx). В контейнере HOST=0.0.0.0 — иначе проброс порта Docker не достанется.
  const host = process.env.HOST || "localhost";
  server.listen(port, host, () => {
    console.log(`dotora server (API + статика) → http://${host}:${port}`);
  });
  return server;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const port = Number(process.argv[2]) || 8787;
  startServer({ port });
}
