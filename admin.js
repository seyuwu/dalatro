// dotora — admin: доступ админки и страница-дашборд.
// Пароль хранится в data/admin.json (scrypt, как у аккаунтов). При первом
// запуске генерируется случайный — сервер печатает его в консоль один раз;
// можно задать свой через DOTORA_ADMIN_PASSWORD (учитывается при создании
// файла). Сессии — токены в памяти процесса: рестарт = перелогин, для
// админки это нормально. Страница — один HTML с ванильным JS, ноль зависимостей.
import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SESSION_TTL = 24 * 3600 * 1000;

function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString("hex");
}

function safeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function createAdminAuth({ dataFile, envPassword, ttl = SESSION_TTL, onCreated } = {}) {
  let store = null;
  let created = false;
  try { store = JSON.parse(readFileSync(dataFile, "utf8")); } catch { store = null; }
  if (!store || !store.salt || !store.hash) {
    const salt = randomBytes(16).toString("hex");
    const password = envPassword || randomBytes(9).toString("base64url");
    store = { salt, hash: hashPassword(password, salt) };
    try { mkdirSync(dirname(dataFile), { recursive: true }); } catch { /* уже есть */ }
    const tmp = dataFile + ".tmp";
    writeFileSync(tmp, JSON.stringify(store), { mode: 0o600 }); // соль+хэш пароля админки
    renameSync(tmp, dataFile);
    created = true;
    if (onCreated) onCreated(password);
  }

  const sessions = new Map(); // token → expiresAt

  function login(password) {
    if (typeof password !== "string" || !safeEqual(hashPassword(password, store.salt), store.hash)) return null;
    const token = randomBytes(24).toString("hex");
    sessions.set(token, Date.now() + ttl);
    // почистили протухшие
    const now = Date.now();
    for (const [t, exp] of sessions) if (exp < now) sessions.delete(t);
    return token;
  }

  function validate(token) {
    const exp = token && sessions.get(token);
    if (!exp) return false;
    if (exp < Date.now()) { sessions.delete(token); return false; }
    return true;
  }

  function logout(token) {
    sessions.delete(token);
  }

  return { login, validate, logout, created };
}

export const ADMIN_COOKIE = "dalatro_admin";

export function adminPageHtml() {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex,nofollow">
<title>dotora — админка</title>
<style>
  :root { --bg:#10150f; --panel:#1a2218; --line:#2e3c28; --text:#d8e2cf; --muted:#7d8b72; --gold:#e9c98f; --red:#ff9a7a; --green:#a8d99b; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.5 system-ui, sans-serif; }
  header { display: flex; align-items: center; gap: 14px; padding: 14px 22px; border-bottom: 1px solid var(--line); }
  header h1 { font-size: 16px; margin: 0; color: var(--gold); }
  header .spacer { flex: 1; }
  header small { color: var(--muted); }
  button { font: inherit; background: #242d20; color: var(--text); border: 1px solid #3d4a35; border-radius: 4px; padding: 6px 12px; cursor: pointer; }
  button:hover { border-color: var(--gold); color: var(--gold); }
  main { padding: 22px; max-width: 1280px; margin: 0 auto; }
  .login { max-width: 360px; margin: 12vh auto; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 26px; }
  .login input { width: 100%; margin: 8px 0 14px; background: #141c15; border: 1px solid #3e5134; border-radius: 4px; padding: 10px 12px; color: var(--text); }
  .login .err { color: var(--red); font-size: 12px; margin-bottom: 10px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-bottom: 22px; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 12px; }
  .card b { display: block; font-size: 22px; color: var(--gold); }
  .card span { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .5px; }
  .card.bad b { color: var(--red); }
  section { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 14px 16px; margin-bottom: 18px; }
  section h2 { font-size: 12px; margin: 0 0 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  @media (max-width: 900px) { .grid2 { grid-template-columns: 1fr; } }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  td, th { text-align: left; padding: 5px 8px; border-bottom: 1px solid var(--line); }
  th { color: var(--muted); font-weight: 600; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .bar rect.b1 { fill: #4a6b3f; }
  .bar rect.b2 { fill: #7a6437; }
  .bar rect:hover { fill: var(--gold); }
  .muted { color: var(--muted); }
  .tag { display: inline-block; padding: 1px 7px; border-radius: 3px; font-size: 11px; border: 1px solid var(--line); }
  .tag.win { color: var(--green); border-color: #3f5a35; }
  .tag.loss { color: var(--red); border-color: #6b3a2a; }
  .tag.err { color: var(--red); }
  .tag.ok { color: var(--green); }
  .pr { border: 1px solid var(--line); border-radius: 5px; margin-bottom: 8px; background: #16201a66; }
  .pr summary { cursor: pointer; padding: 8px 12px; font-size: 12px; }
  .pr-body { padding: 10px 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .pr-body label { display: flex; flex-direction: column; gap: 3px; font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: .5px; }
  .pr-body input, .pr-body textarea { background: #141c15; border: 1px solid #3e5134; border-radius: 4px; padding: 7px 9px; color: var(--text); font: inherit; }
  .pr-body .wide { grid-column: 1 / -1; }
  .pr-actions { grid-column: 1 / -1; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .pr-thumb { width: 46px; height: 46px; object-fit: cover; border-radius: 5px; border: 1px solid var(--line); }
  .pr-status { font-size: 11px; color: var(--green); }
  @media (max-width: 720px) { .pr-body { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<header>
  <h1>⚔ dotora — админка</h1>
  <small id="updated"></small>
  <span class="spacer"></span>
  <button id="refresh">Обновить</button>
  <button id="logout">Выйти</button>
</header>
<main id="app"></main>
<script>
const app = document.getElementById("app");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtN = (n) => Number(n || 0).toLocaleString("ru");
const fmtMs = (ms) => { const t = Math.round(ms / 1000); return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"); };
const fmtTime = (t) => new Date(t).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

async function api(path, opts) {
  const res = await fetch(path, opts);
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) { const err = new Error((data && data.error) || "HTTP " + res.status); err.status = res.status; throw err; }
  return data;
}

function loginView(err) {
  app.innerHTML = '<div class="login"><h2>Доступ админа</h2>' +
    (err ? '<div class="err">' + esc(err) + '</div>' : '') +
    '<input id="pw" type="password" placeholder="Пароль (data/admin.json, печатается при первом запуске)">' +
    '<button id="go" style="width:100%">Войти</button></div>';
  const go = async () => {
    try {
      await api("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: document.getElementById("pw").value }) });
      refresh();
    } catch (e) { loginView(e.message); }
  };
  document.getElementById("go").onclick = go;
  document.getElementById("pw").onkeydown = (e) => { if (e.key === "Enter") go(); };
  document.getElementById("pw").focus();
}

function card(v, label, bad) { return '<div class="card' + (bad ? " bad" : "") + '"><b>' + v + '</b><span>' + esc(label) + '</span></div>'; }

function barChart(rows, keyA, keyB, labelA, labelB) {
  const W = 720, H = 160, pad = 4, n = rows.length || 1;
  const max = Math.max(1, ...rows.map((r) => Math.max(r[keyA] || 0, r[keyB] || 0)));
  const bw = (W - pad * (n - 1)) / n;
  const bars = rows.map((r, i) => {
    const ha = Math.round((r[keyA] || 0) / max * (H - 24));
    const hb = Math.round((r[keyB] || 0) / max * (H - 24));
    const x = i * (bw + pad);
    return '<rect class="b1" x="' + x + '" y="' + (H - ha) + '" width="' + (bw / 2 - 1) + '" height="' + ha + '"><title>' + esc(r.hour || r.day) + " · " + labelA + ": " + (r[keyA] || 0) + '</title></rect>' +
      '<rect class="b2" x="' + (x + bw / 2) + '" y="' + (H - hb) + '" width="' + (bw / 2 - 1) + '" height="' + hb + '"><title>' + esc(r.hour || r.day) + " · " + labelB + ": " + (r[keyB] || 0) + '</title></rect>';
  }).join("");
  return '<svg class="bar" viewBox="0 0 ' + W + " " + H + '" width="100%" height="' + H + '" preserveAspectRatio="none">' + bars + "</svg>" +
    '<small class="muted">■ ' + labelA + " &nbsp; ■ " + labelB + " — максимум " + max + "</small>";
}

function tableView(rows, cols) {
  if (!rows.length) return '<div class="muted">Пока пусто.</div>';
  const cell = (r, c) => {
    const [key, , num, fmt] = c;
    const html = fmt ? fmt(r) : esc(r[key]);
    return "<td" + (num ? ' class="num"' : "") + ">" + html + "</td>";
  };
  return "<table><tr>" + cols.map((c) => "<th>" + esc(c[1]) + "</th>").join("") + "</tr>" +
    rows.map((r) => "<tr>" + cols.map((c) => cell(r, c)).join("") + "</tr>").join("") + "</table>";
}

function dashboard(d) {
  const t = d.today, s = d.store;
  const players = d.players || [];
  const errRate = t.requests ? Math.round(t.errors / t.requests * 1000) / 10 + "%" : "—";
  const hours = d.hourly || [];
  const days = d.daily || [];
  app.innerHTML =
    '<div class="cards">' +
      card(fmtN(t.views), "Просмотры сегодня") +
      card(fmtN(t.api), "API-запросы сегодня") +
      card(fmtN(t.uniqueIps), "Посетители (IP)") +
      card(fmtN(t.uniquePlayers), "Игроки (аккаунты)") +
      card(fmtN(t.registers), "Регистрации") +
      card(fmtN(t.runs), "Забегов сегодня") +
      card(fmtN(t.promoClicks), "Клики по промо") +
      card(fmtN(s.accounts), "Аккаунтов всего") +
      card(fmtN(s.runs), "Забегов всего") +
      card(t.avgLatencyMs + " мс", "Средняя задержка") +
      card(errRate, "Доля ошибок", t.errors > 0) +
    "</div>" +
    '<div id="promo-slot"></div>' +
    '<section><h2>Трафик по часам (48 ч)</h2>' + barChart(hours, "requests", "api", "все запросы", "API") + "</section>" +
    '<div class="grid2">' +
      '<section><h2>Топ путей (сегодня)</h2>' + tableView(d.topPaths, [["path", "Путь"], ["count", "Запросов", 1, (r) => fmtN(r.count)]]) + "</section>" +
      '<section><h2>Топ посетителей (сегодня)</h2>' + tableView(d.topIps, [["ip", "IP"], ["count", "Запросов", 1, (r) => fmtN(r.count)]]) + "</section>" +
    "</div>" +
    '<section><h2>Забеги по дням (30 д)</h2>' + barChart(days, "runs", "wins", "забеги", "победы") + "</section>" +
    '<div class="grid2">' +
      '<section><h2>Игроки</h2>' + tableView(players.slice(0, 20), [["name", "Игрок"], ["runs", "Забеги", 1], ["wins", "Победы", 1], ["bestScore", "Лучший счёт", 1, (r) => fmtN(r.bestScore)], ["bestRank", "Ранг", 1]]) + "</section>" +
      '<section><h2>Статусы ответов (сегодня)</h2>' + tableView(Object.entries(t.statuses).map(([code, count]) => ({ code, count })), [["code", "Код", 0, (r) => '<span class="tag ' + (r.code >= 400 ? "err" : "ok") + '">' + r.code + "</span>"], ["count", "Штук", 1, (r) => fmtN(r.count)]]) +
        '<h2 style="margin-top:16px">События (счётчик всего)</h2>' + tableView(Object.entries(d.events || {}).map(([type, count]) => ({ type, count })), [["type", "Событие"], ["count", "Штук", 1, (r) => fmtN(r.count)]]) + "</section>" +
    "</div>" +
    '<div class="grid2">' +
      '<section><h2>Живой хвост запросов</h2>' + tableView(d.recent.slice(0, 25), [["t", "Время", 0, (r) => fmtTime(r.t)], ["method", "Метод"], ["path", "Путь"], ["status", "Код", 0, (r) => '<span class="tag ' + (r.status >= 400 ? "err" : "ok") + '">' + r.status + "</span>"], ["ms", "мс", 1]]) + "</section>" +
      '<section><h2>Журнал событий</h2>' + tableView(d.eventsLog.slice(0, 25), [["t", "Время", 0, (r) => fmtTime(r.t)], ["type", "Событие"], ["name", "Кто"], ["detail", "Детали", 0, (r) => {
        if (r.type === "run") return '<span class="tag ' + (r.won ? "win" : "loss") + '">' + (r.won ? "победа" : "поражение") + " · ранг " + r.rank + " · " + fmtN(r.score) + "</span>";
        if (r.type === "promo") return '<span class="tag ' + (r.target === "visit" ? "win" : "ok") + '">' + (r.target === "visit" ? "переход" : "просмотр") + " · " + esc(r.promo || "") + "</span>";
        return "";
      }]]) + "</section>" +
    "</div>";
}

let PROMO_CFG = null;
const esc2 = esc;

async function loadPromoEditor() {
  try {
    PROMO_CFG = await api("/api/promo-config");
    const slot = document.getElementById("promo-slot");
    if (!slot || document.getElementById("promo-sec")) return; // уже отрисован
    slot.innerHTML = '<section id="promo-sec"><h2>Промо-башни (реклама волн)</h2><div id="promo-rows" class="muted">Загрузка…</div></section>';
    const host = document.getElementById("promo-rows");
    if (!host) return;
    host.className = "";
    host.innerHTML = PROMO_CFG.waves.map((w) => {
      const p = (PROMO_CFG.promos[w.id]) || {};
      const badge = w.boss ? " · босс акта" : w.miniBoss ? " · мини-босс" : "";
      const thumb = p.hasImage ? '<img class="pr-thumb" src="/promo-image/' + w.id + '?v=' + Date.now() + '">' : "";
      return '<details class="pr" data-wave="' + w.id + '"><summary>Акт ' + w.act + ' · ' + esc(w.name) + badge + (p.name ? ' — <b style="color:var(--gold)">' + esc(p.name) + '</b>' : '') + '</summary>' +
        '<div class="pr-body">' +
        '<label>Название проекта (пусто = убрать промо)<input class="pr-name" maxlength="40" value="' + esc(p.name || "") + '"></label>' +
        '<label>Ссылка (https://…)<input class="pr-url" value="' + esc(p.url || "") + '" placeholder="https://…"></label>' +
        '<label>Жёлтый заголовок<input class="pr-tag" maxlength="140" value="' + esc(p.tagline || "") + '"></label>' +
        '<label>Жёлтый текст<textarea class="pr-desc" maxlength="300" rows="2">' + esc(p.desc || "") + '</textarea></label>' +
        '<div class="pr-actions">' + thumb +
        '<label style="flex-direction:row;align-items:center;gap:6px;text-transform:none;letter-spacing:0">Картинка (PNG/JPG ≤400КБ): <input type="file" class="pr-file" accept="image/png,image/jpeg"></label>' +
        (p.hasImage ? '<button class="pr-imgdel">Убрать картинку</button>' : "") +
        '<button class="pr-save">Сохранить</button><span class="pr-status"></span></div>' +
        '</div></details>';
    }).join("") + '<button id="promo-reload">Обновить</button>';
    document.getElementById("promo-reload").onclick = loadPromoEditor;
    host.querySelectorAll(".pr").forEach((row) => {
      const waveId = row.dataset.wave;
      row.querySelector(".pr-save").onclick = async () => {
        const st = row.querySelector(".pr-status");
        st.textContent = "сохраняем…"; st.style.color = "var(--muted)";
        const res = await api("/api/admin/promo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          waveId,
          name: row.querySelector(".pr-name").value,
          url: row.querySelector(".pr-url").value.trim(),
          tagline: row.querySelector(".pr-tag").value,
          desc: row.querySelector(".pr-desc").value,
        }) }).catch((e) => ({ error: e.message }));
        if (res && res.ok) {
          st.style.color = "var(--green)"; st.textContent = res.deleted ? "промо убрано" : "сохранено";
          // Обновляем строку на месте: полный refresh стёр бы заполнение соседних полей.
          if (res.deleted) delete PROMO_CFG.promos[waveId];
          else PROMO_CFG.promos[waveId] = { ...(PROMO_CFG.promos[waveId] || { hasImage: false }), name: row.querySelector(".pr-name").value, url: row.querySelector(".pr-url").value.trim(), tagline: row.querySelector(".pr-tag").value, desc: row.querySelector(".pr-desc").value };
          const p2 = PROMO_CFG.promos[waveId];
          row.querySelector("summary").innerHTML = 'Акт ' + (PROMO_CFG.waves.find((w) => w.id === waveId) || {}).act + ' · ' + esc((PROMO_CFG.waves.find((w) => w.id === waveId) || {}).name) + (p2 && p2.name ? ' — <b style="color:var(--gold)">' + esc(p2.name) + '</b>' : '');
        }
        else { st.style.color = "var(--red)"; st.textContent = (res && res.error) || "ошибка"; }
      };
      row.querySelector(".pr-file").onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const st = row.querySelector(".pr-status");
        st.textContent = "загружаем картинку…"; st.style.color = "var(--muted)";
        const buf = await file.arrayBuffer();
        const res = await fetch("/api/admin/promo-image/" + waveId, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: buf })
          .then((r) => r.json()).catch((e2) => ({ error: e2.message }));
        if (res && res.ok) {
          st.style.color = "var(--green)"; st.textContent = "картинка загружена";
          if (PROMO_CFG.promos[waveId]) PROMO_CFG.promos[waveId].hasImage = true;
          const actions = row.querySelector(".pr-actions");
          let thumb = row.querySelector(".pr-thumb");
          if (!thumb) { thumb = document.createElement("img"); thumb.className = "pr-thumb"; actions.prepend(thumb); }
          thumb.src = "/promo-image/" + waveId + "?v=" + Date.now();
          if (!row.querySelector(".pr-imgdel")) {
            const del = document.createElement("button");
            del.className = "pr-imgdel"; del.textContent = "Убрать картинку";
            del.onclick = () => removePromoImage(waveId, row);
            actions.insertBefore(del, st);
          }
        }
        else { st.style.color = "var(--red)"; st.textContent = (res && res.error) || "ошибка"; }
      };
      const del = row.querySelector(".pr-imgdel");
      if (del) del.onclick = () => removePromoImage(waveId, row);
    });
  } catch (e) {
    const host = document.getElementById("promo-rows");
    if (host) host.textContent = "Не загрузился конфиг: " + e.message;
  }
}

async function removePromoImage(waveId, row) {
  await fetch("/api/admin/promo-image-remove", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ waveId }) }).catch(() => {});
  if (PROMO_CFG.promos[waveId]) PROMO_CFG.promos[waveId].hasImage = false;
  const thumb = row.querySelector(".pr-thumb");
  if (thumb) thumb.remove();
  const del = row.querySelector(".pr-imgdel");
  if (del) del.remove();
  const st = row.querySelector(".pr-status");
  if (st) { st.style.color = "var(--green)"; st.textContent = "картинка убрана"; }
}

async function refresh() {
  try {
    const d = await api("/api/admin/stats");
    document.getElementById("updated").textContent = "обновлено " + fmtTime(Date.now());
    // Секция промо вынимается перед перерисовкой и возвращается на место:
    // человек мог заполнять поля — автообновление не имеет права их стирать.
    const promoSec = document.getElementById("promo-sec");
    if (promoSec) promoSec.remove(); // сохранить узел с заполненными полями
    dashboard(d); // сама пишет app.innerHTML
    const slot = document.getElementById("promo-slot");
    if (promoSec) slot.appendChild(promoSec);
    else loadPromoEditor();
  } catch (e) {
    if (e.status === 401) { loginView(); return; }
    app.innerHTML = '<div class="card bad"><b>—</b><span>Сервер не ответил: ' + esc(e.message) + '</span></div>';
  }
}

document.getElementById("refresh").onclick = refresh;
document.getElementById("logout").onclick = async () => { await api("/api/admin/logout", { method: "POST" }).catch(() => {}); loginView(); };
refresh();
setInterval(refresh, 30000);
</script>
</body>
</html>`;
}
