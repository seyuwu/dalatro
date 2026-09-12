// Серверные тесты: аккаунты, отправка забегов, лидерборды, профили.
// HTTP-обёртка не участвует — гоняем синхронное API-ядро server.js, которое
// раннер инжектит в песочницу как Backend. Хранилище — временный каталог.
suite("backend");

const backend = Backend.createBackend({ dataDir: Backend.tmpDataDir() });

function req(method, path, body, token) {
  return backend.call(method, path, { body, cookie: token ? "dalatro_sess=" + token : "" });
}

function tokenOf(res) {
  const m = String(res.setCookie || "").match(/dalatro_sess=([a-f0-9]+)/);
  return m ? m[1] : "";
}

function login(name) {
  const res = req("POST", "/login", { name, password: "123456" });
  assertEq(res.status, 200, "login " + name);
  const token = tokenOf(res);
  assert(token.length > 0, "сессия не выдана");
  return token;
}

let startedAt = 1700000000000;
function winRun(over) {
  startedAt += 1000;
  return { seed: "TESTSEED", rank: 1, won: true, waves: 15, deaths: 0, timeMs: 300000, barracks: 0, biggestHit: 0, spareResets: 0, startedAt, ...(over || {}) };
}

test("register: аккаунт создаётся, сессия выдаётся, стартовый прогресс — ранг 1", () => {
  const res = req("POST", "/register", { name: "Pudge", password: "123456" });
  assertEq(res.status, 200);
  assertEq(res.json.player.name, "Pudge");
  assertEq(res.json.player.unlockedRank, 1);
  assertEq(res.json.player.stats.runs, 0);
  assert(tokenOf(res).length > 0, "нет cookie сессии");
});

test("register: дубликат имени отклоняется без учёта регистра", () => {
  assertEq(req("POST", "/register", { name: "pudge", password: "123456" }).status, 400);
});

test("register: валидация имени и пароля", () => {
  assertEq(req("POST", "/register", { name: "x", password: "123456" }).status, 400, "короткое имя");
  assertEq(req("POST", "/register", { name: "плохое имя!", password: "123456" }).status, 400, "кириллица/пробел");
  assertEq(req("POST", "/register", { name: "ok-name", password: "123" }).status, 400, "короткий пароль");
});

test("login: неверный пароль — 401, верный — 200 (регистр имени не важен)", () => {
  assertEq(req("POST", "/login", { name: "pudge", password: "неверный" }).status, 401);
  assertEq(req("POST", "/login", { name: "PUDGE", password: "123456" }).status, 200);
  assertEq(req("POST", "/login", { name: "ghost", password: "123456" }).status, 401, "нет аккаунта");
});

test("login: брутфорс ограничен — 10 неудач блокируют вход даже с верным паролем", () => {
  const b = Backend.createBackend({ dataDir: Backend.tmpDataDir() });
  assertEq(b.call("POST", "/register", { body: { name: "Brutus", password: "123456" } }).status, 200);
  for (let i = 0; i < 10; i++) {
    assertEq(b.call("POST", "/login", { body: { name: "brutus", password: "не-" + i }, ip: "7.7.7.7" }).status, 401);
  }
  assertEq(b.call("POST", "/login", { body: { name: "brutus", password: "123456" }, ip: "7.7.7.7" }).status, 429, "верный пароль под блоком");
  assertEq(b.call("POST", "/login", { body: { name: "brutus", password: "123456" }, ip: "9.9.9.9" }).status, 200, "другой IP не тронут");
  // Успешный вход с чистого IP сбрасывает счётчик неудач этой пары.
  assertEq(b.call("POST", "/login", { body: { name: "brutus", password: "не-" }, ip: "8.8.8.8" }).status, 401);
  assertEq(b.call("POST", "/login", { body: { name: "brutus", password: "123456" }, ip: "8.8.8.8" }).status, 200);
  for (let i = 0; i < 10; i++) {
    b.call("POST", "/login", { body: { name: "brutus", password: "не-" + i }, ip: "8.8.8.8" });
  }
  assertEq(b.call("POST", "/login", { body: { name: "brutus", password: "123456" }, ip: "8.8.8.8" }).status, 429, "счётчик снова набран");
});

test("register: пароль короче 6 символов отклоняется", () => {
  assertEq(req("POST", "/register", { name: "ShortPass", password: "1234" }).status, 400);
});

test("me: без сессии — 401, с сессией — профиль", () => {
  assertEq(req("GET", "/me").status, 401);
  const token = login("pudge");
  const res = req("GET", "/me", undefined, token);
  assertEq(res.status, 200);
  assertEq(res.json.player.name, "Pudge");
});

test("runs: без аккаунта и без гостевого токена отправка запрещена", () => {
  assertEq(req("POST", "/runs", winRun()).status, 401);
  assertEq(req("POST", "/runs", { ...winRun(), guest: "не-токен" }).status, 401);
});

test("runs: гостевой забег попадает в лидерборд как «Гость #XXXX»", () => {
  const b = Backend.createBackend({ dataDir: Backend.tmpDataDir() });
  const token = "aabbccddeeff00112233445566778899";
  const body = { ...winRun({ rank: 2, biggestHit: 1000 }), guest: token };
  const res = b.call("POST", "/runs", { body });
  assertEq(res.status, 200);
  assertEq(res.json.guest, true, "пометка гостевого забега");
  assertEq(res.json.score, 1820); // 1500 + 300 + 1000/50
  const dup = b.call("POST", "/runs", { body });
  assertEq(dup.json.duplicate, true, "идемпотентность работает и у гостя");
  const lb = b.call("GET", "/leaderboard", { body: { view: "score" } }).json;
  assertEq(lb.rows[0].name, "Гость #aabb");
  assertEq(lb.rows.length, 1, "дедуп по токену гостя");
  const ladder = b.call("GET", "/leaderboard", { body: { view: "rank" } }).json;
  assertEq(ladder.rows[0].name, "Гость #aabb", "гость виден и в лестнице рангов");
});

test("runs: лимит гостевых забегов — 10 в час с одного IP", () => {
  const b = Backend.createBackend({ dataDir: Backend.tmpDataDir() });
  const tok = (n) => (String(n) + "abcdef0123456789").padEnd(32, "0").slice(0, 32);
  for (let i = 0; i < 10; i++) {
    assertEq(b.call("POST", "/runs", { body: { ...winRun({ won: false, waves: 3, timeMs: 120000, rank: 1 }), guest: tok(i) }, ip: "6.6.6.6" }).status, 200, "гостевой " + i);
  }
  assertEq(b.call("POST", "/runs", { body: { ...winRun({ won: false, waves: 3, timeMs: 120000 }), guest: tok(99) }, ip: "6.6.6.6" }).status, 429);
  assertEq(b.call("POST", "/runs", { body: { ...winRun({ won: false, waves: 3, timeMs: 120000 }), guest: tok(100) }, ip: "7.7.7.7" }).status, 200, "другой IP не ограничен");
});

test("register: гостевые забеги переезжают в аккаунт по токену браузера", () => {
  const b = Backend.createBackend({ dataDir: Backend.tmpDataDir() });
  const token = "ff".repeat(16);
  b.call("POST", "/runs", { body: { ...winRun({ rank: 3, barracks: 2, biggestHit: 5000, spareResets: 1, seed: "G1" }), guest: token } });
  const reg = b.call("POST", "/register", { body: { name: "Claimer", password: "123456", guest: token } });
  assertEq(reg.status, 200);
  assertEq(reg.json.claimed, 1, "гостевой забег засчитан");
  assertEq(reg.json.player.stats.runs, 1);
  assertEq(reg.json.player.stats.bestScore, 2550);
  assertEq(reg.json.player.unlockedRank, 4, "взят ранг 3 — открыт 4");
  const prof = b.call("GET", "/players/Claimer").json;
  assertEq(prof.runs.length, 1, "забег в профиле");
  assertEq(prof.runs[0].name, "Claimer", "уже не гость");
  // Повторный вход с тем же токеном ничего не переносит.
  const login = b.call("POST", "/login", { body: { name: "claimer", password: "123456", guest: token } });
  assertEq(login.json.claimed, 0);
});

test("runs: счёт пересчитывается на сервере по формуле scoreOf", () => {
  const token = login("pudge");
  // waves*100 + rank*150 + barracks*200 + biggestHit/50 + spareResets*100
  // 1500 + 450 + 400 + 100 + 100 = 2550
  const res = req("POST", "/runs", winRun({ rank: 3, barracks: 2, biggestHit: 5000, spareResets: 1 }), token);
  assertEq(res.status, 200);
  assertEq(res.json.score, 2550, "формула счёта");
  assert(res.json.personalBest === true, "первый забег — личный рекорд");
});

test("runs: подменённый с клиента счёт игнорируется", () => {
  const token = login("pudge");
  const res = req("POST", "/runs", { ...winRun(), score: 999999 }, token);
  assertEq(res.json.score, 1650); // 15*100 + 1*150
});

test("runs: победа обязана быть на всех 15 волнах и не быстрее минуты", () => {
  const token = login("pudge");
  assertEq(req("POST", "/runs", winRun({ waves: 14 }), token).status, 400, "14/15 волн");
  assertEq(req("POST", "/runs", winRun({ timeMs: 1000 }), token).status, 400, "секундная победа");
  assertEq(req("POST", "/runs", winRun({ rank: 99 }), token).status, 400, "ранг вне лиги");
});

test("runs: идемпотентность — повтор той же записи не удваивает статистику", () => {
  const token = login("pudge");
  const body = winRun({ rank: 2 });
  assertEq(req("POST", "/runs", body, token).json.duplicate, undefined, "первая отправка — новая запись");
  const again = req("POST", "/runs", body, token);
  assertEq(again.json.duplicate, true, "повтор распознан");
  assertEq(again.json.score, 1800); // 1500 + 300
  assertEq(req("GET", "/me", undefined, token).json.player.stats.runs, 3, "забегов всё ещё 3");
});

test("runs: поражение тоже пишется, статистика растёт", () => {
  const token = login("pudge");
  const res = req("POST", "/runs", { ...winRun(), won: false, waves: 7, timeMs: 120000 }, token);
  assertEq(res.status, 200);
  assertEq(req("GET", "/me", undefined, token).json.player.stats.runs, 4);
});

test("leaderboard: дедуп по игроку, сортировки всех четырёх видов", () => {
  const token = login("pudge");
  assertEq(req("POST", "/register", { name: "kekw", password: "123456" }).status, 200, "второй игрок");
  const token2 = login("kekw");
  // kekw: победа быстрее и счётом выше, но рангом ниже (2 против 3 у pudge).
  assertEq(req("POST", "/runs", winRun({ rank: 2, timeMs: 200000, biggestHit: 20000 }), token2).status, 200);

  const score = req("GET", "/leaderboard", { view: "score" }).json;
  // pudge: лучший забег 2550 (ранг 3); kekw: 1500+300+400 = 2200 (ранг 2).
  assertEq(score.rows[0].name, "Pudge", "2550 > 2200");
  assertEq(score.rows.length, 2, "дедуп: pudge имел 4 забега, строка одна");
  assertEq(score.rows[0].rank, 3, "в строке — ранг лучшего забега");

  const ladder = req("GET", "/leaderboard", { view: "rank" }).json;
  assertEq(ladder.rows[0].name, "Pudge", "взятый ранг 3 выше ранга 2");
  assertEq(ladder.rows[0].rank, 3);
  assertEq(ladder.rows[1].name, "kekw");
  assertEq(ladder.rows[1].wins, 1);

  const fastest = req("GET", "/leaderboard", { view: "fastest" }).json;
  assertEq(fastest.rows[0].name, "kekw", "200 c быстрее 300 c");

  const nodeath = req("GET", "/leaderboard", { view: "nodeath" }).json;
  assert(nodeath.rows.every((r) => !r.deaths), "только забеги без смертей");
});

test("leaderboard: фильтр по рангу — только забеги на этом ранге", () => {
  const res = req("GET", "/leaderboard", { view: "score", rank: "3" }).json;
  assertEq(res.rows.length, 1);
  assertEq(res.rows[0].name, "Pudge");
  assertEq(res.rows[0].rank, 3);
  const empty = req("GET", "/leaderboard", { view: "score", rank: "14" }).json;
  assertEq(empty.rows.length, 0);
});

test("players: публичный профиль со статистикой и хвостом забегов", () => {
  const res = req("GET", "/players/pudge");
  assertEq(res.status, 200);
  assertEq(res.json.player.name, "Pudge");
  assertEq(res.json.player.unlockedRank, 4, "взят ранг 3 — открыт 4");
  assertEq(res.json.player.stats.wins, 3);
  assert(res.json.runs.length >= 3 && res.json.runs.length <= 20, "хвост забегов");
  assertEq(req("GET", "/players/ghost").status, 404);
});

test("logout: сессия закрывается, токен больше не работает", () => {
  const token = login("kekw");
  assertEq(req("POST", "/logout", {}, token).status, 200);
  assertEq(req("GET", "/me", undefined, token).status, 401);
});

test("неизвестный маршрут API отдаёт 404, а не падение", () => {
  assertEq(req("GET", "/nope").status, 404);
});
