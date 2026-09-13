// Тесты аналитики и админки: счётчики трафика, события бэкенда, авторизация
// админа, персистентность. Всё синхронное, файлы — во временных каталогах.
suite("analytics");

const DAY = 24 * 3600 * 1000;

test("analytics: запросы складываются в бакеты дня и часа", () => {
  const a = Backend.createAnalytics({});
  const now = Date.now();
  a.record({ method: "GET", path: "/index.html", status: 200, ms: 5, ip: "1.1.1.1", t: now });
  a.record({ method: "GET", path: "/src/ui/ui.js", status: 200, ms: 3, ip: "1.1.1.1", t: now });
  a.record({ method: "POST", path: "/api/login", status: 401, ms: 7, ip: "2.2.2.2", t: now });
  a.record({ method: "POST", path: "/api/players/Pudge", status: 200, ms: 4, ip: "2.2.2.2", t: now });
  const s = a.snapshot(now);
  assertEq(s.today.requests, 4);
  assertEq(s.today.views, 2, "GET без /api — просмотр");
  assertEq(s.today.api, 2);
  assertEq(s.today.errors, 1);
  assertEq(s.today.uniqueIps, 2);
  assertEq(s.today.statuses["401"], 1);
  assertEq(s.hourly[0].requests, 4);
  const top = s.topPaths.map((p) => p.path);
  assert(top.includes("POST /api/players/:name"), "параметризованный маршрут сгруппирован");
  assertEq(s.recent.length, 4, "хвост хранит все записи");
});

test("analytics: события (регистрации, логины, забеги) и игроки дня", () => {
  const a = Backend.createAnalytics({});
  const now = Date.now();
  a.event({ type: "register", name: "Pudge" }, now);
  a.event({ type: "login", name: "Pudge" }, now);
  a.event({ type: "run", name: "Pudge", won: true, rank: 3, score: 2500 }, now);
  a.event({ type: "run", name: "Lina", won: false, rank: 1, score: 400 }, now);
  const s = a.snapshot(now);
  assertEq(s.today.runs, 2);
  assertEq(s.today.wins, 1);
  assertEq(s.today.registers, 1);
  assertEq(s.today.logins, 1);
  assertEq(s.today.uniquePlayers, 2);
  assertEq(s.events.run, 2);
  assertEq(s.eventsLog[0].type, "run", "журнал свежим вперёд");
  assertEq(s.eventsLog[0].score, 400);
});

test("analytics: кап хвоста и prune старых дней/часов", () => {
  const a = Backend.createAnalytics({ maxDays: 3, maxHours: 2, maxRecent: 5 });
  const now = Date.now();
  for (let d = 0; d < 6; d++) a.record({ method: "GET", path: "/", status: 200, ms: 1, ip: "9.9.9.9", t: now - d * DAY });
  for (let i = 0; i < 12; i++) a.record({ method: "GET", path: "/x", status: 200, ms: 1, ip: "9.9.9.9", t: now });
  const s = a.snapshot(now);
  assertEq(s.daily.length, 3, "дни обрезаны до лимита");
  assertEq(s.hourly.length <= 2, true, "часы обрезаны");
  assertEq(s.recent.length, 5, "хвост ограничен");
});

test("analytics: save/load — данные переживают пересоздание", () => {
  const file = Backend.tmpDataDir() + "/analytics.json";
  const a1 = Backend.createAnalytics({ dataFile: file });
  a1.record({ method: "GET", path: "/", status: 200, ms: 2, ip: "5.5.5.5" });
  a1.event({ type: "run", name: "Pudge", won: true, rank: 2, score: 1800 });
  a1.save();
  const a2 = Backend.createAnalytics({ dataFile: file });
  const s = a2.snapshot();
  assertEq(s.today.requests, 1, "запрос восстановлен");
  assertEq(s.today.runs, 1, "событие восстановлено");
});

test("admin auth: генерация пароля при первом запуске, вход/выход", () => {
  const file = Backend.tmpDataDir() + "/admin.json";
  let printed = null;
  const auth = Backend.createAdminAuth({ dataFile: file, onCreated: (pw) => { printed = pw; } });
  assert(typeof printed === "string" && printed.length >= 8, "пароль сгенерирован и отдан наверх");
  assertEq(auth.login("неверный"), null);
  const token = auth.login(printed);
  assert(token && token.length > 20, "верный пароль даёт токен");
  assertEq(auth.validate(token), true);
  auth.logout(token);
  assertEq(auth.validate(token), false, "после logout токен мёртв");
});

test("admin auth: envPassword только при создании, файл переживает пересоздание", () => {
  const file = Backend.tmpDataDir() + "/admin.json";
  let printed = null;
  Backend.createAdminAuth({ dataFile: file, envPassword: "мой-пароль", onCreated: (pw) => { printed = pw; } });
  assertEq(printed, "мой-пароль");
  let printed2 = null;
  const auth2 = Backend.createAdminAuth({ dataFile: file, envPassword: "другой", onCreated: (pw) => { printed2 = pw; } });
  assertEq(printed2, null, "файл уже есть — пароль не перегенерируется");
  assertEq(auth2.login("другой"), null, "env при втором запуске игнорируется");
  assert(auth2.login("мой-пароль"), "оригинальный пароль работает");
});

test("backend: события register/login/run уходят в хук аналитики", () => {
  const events = [];
  const b = Backend.createBackend({ dataDir: Backend.tmpDataDir(), onEvent: (e) => events.push(e) });
  b.call("POST", "/register", { body: { name: "Pudge", password: "123456" } });
  b.call("POST", "/login", { body: { name: "Pudge", password: "123456" } });
  const token = b.call("POST", "/login", { body: { name: "pudge", password: "123456" } }).setCookie.match(/dalatro_sess=([a-f0-9]+)/)[1];
  b.call("POST", "/runs", { body: { seed: "EVT", rank: 2, won: true, waves: 15, deaths: 0, timeMs: 300000, barracks: 1, biggestHit: 500, spareResets: 0, startedAt: 1700000000000 }, cookie: "dalatro_sess=" + token });
  b.call("POST", "/runs", { body: { seed: "EVT", rank: 2, won: true, waves: 15, deaths: 0, timeMs: 300000, barracks: 1, biggestHit: 500, spareResets: 0, startedAt: 1700000000000 }, cookie: "dalatro_sess=" + token });
  assertEq(events.length, 4, "register + 2 логина + забег; дубль не порождает событие");
  assertEq(events[0].type, "register");
  assertEq(events[3].type, "run");
  assertEq(events[3].won, true);
  assertEq(events[3].score, 2010); // 1500 + 300 + 200 + 500/50
  assertEq(events[4], undefined, "идемпотентный повтор — без события");
});

test("backend: counts отдаёт живые счётчики для админки", () => {
  const b = Backend.createBackend({ dataDir: Backend.tmpDataDir() });
  assertEq(b.counts().accounts, 0);
  assertEq(b.counts().runs, 0);
  b.call("POST", "/register", { body: { name: "Pudge", password: "123456" } });
  const token = b.call("POST", "/login", { body: { name: "pudge", password: "123456" } }).setCookie.match(/dalatro_sess=([a-f0-9]+)/)[1];
  b.call("POST", "/runs", { body: { seed: "C1", rank: 1, won: false, waves: 5, deaths: 1, timeMs: 120000, barracks: 0, biggestHit: 0, spareResets: 0, startedAt: 1700000000000 }, cookie: "dalatro_sess=" + token });
  assertEq(b.counts().accounts, 1);
  assertEq(b.counts().runs, 1);
});

test("reset: трафик обнуляется, промо-клики и их журнал сохраняются", () => {
  const a = Backend.createAnalytics({});
  const now = Date.now();
  a.record({ method: "GET", path: "/", status: 200, ms: 2, ip: "1.1.1.1", t: now });
  a.event({ type: "promo", promo: "roshan", target: "visit", name: "Pudge" }, now);
  a.event({ type: "login", name: "Pudge" }, now);
  a.reset(true);
  const snap = a.snapshot(now);
  assertEq(snap.today.views, 0, "трафик обнулён");
  assertEq(snap.events.promo, 1, "промо-счётчик выжил");
  assertEq(snap.events.login, undefined, "остальные события обнулены");
  assertEq(snap.eventsLog.length, 1);
  assertEq(snap.eventsLog[0].type, "promo", "журнал промо сохранён");
  assertEq(snap.today.promoClicks, 0, "сегодняшний бакет чист — счётчик живёт в events.promo");
  // полный сброс без сохранения промо
  a.record({ method: "GET", path: "/", status: 200, ms: 1, ip: "1.1.1.1", t: now });
  a.event({ type: "promo", promo: "x", target: "view" }, now);
  a.reset(false);
  const s2 = a.snapshot(now);
  assertEq(s2.events.promo, undefined, "полный сброс чистит и промо");
});

test("аудитория: уникальные IP/игроки за окна 1/7/30 дней", () => {
  const a = Backend.createAnalytics({});
  const now = Date.now();
  const DAY = 24 * 3600 * 1000;
  // сегодня: ip A, игрок P1; 3 дня назад: ip B, игрок P1+P2; 40 дней назад: ip C
  a.record({ method: "GET", path: "/", status: 200, ms: 1, ip: "1.1.1.1", t: now });
  a.event({ type: "login", name: "P1" }, now);
  a.record({ method: "GET", path: "/", status: 200, ms: 1, ip: "2.2.2.2", t: now - 3 * DAY });
  a.event({ type: "login", name: "P1" }, now - 3 * DAY);
  a.event({ type: "login", name: "P2" }, now - 3 * DAY);
  a.record({ method: "GET", path: "/", status: 200, ms: 1, ip: "3.3.3.3", t: now - 40 * DAY });
  const s = a.snapshot(now);
  assertEq(s.audience.ips1, 1);
  assertEq(s.audience.players1, 1);
  assertEq(s.audience.ips7, 2, "7 дней: ip A+B");
  assertEq(s.audience.players7, 2, "7 дней: игроки P1+P2");
  assertEq(s.audience.ips30, 2, "30 дней не тянет 40-дневний ip (и prune держит 30)");
});
