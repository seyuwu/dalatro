// dotora — analytics: учёт трафика и игровых событий для админки.
// Синхронное ядро (как server.js): бакеты по дням/часам, топы путей и IP,
// хвост свежих запросов и событий. Пишется в data/analytics.json с той же
// атомарной заменой tmp+rename; живой сервер сбрасывает буфер по таймеру,
// тесты зовут save() руками. Ничего персональнее IP и имени аккаунта не
// собираем: ни user-agent, ни referer.
import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const MAX_ENTRIES = 300; // антираспухание карт ips/paths внутри бакета

function dayKey(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function hourKey(t) {
  return `${dayKey(t)}T${String(new Date(t).getHours()).padStart(2, "0")}`;
}

// /api/players/:name — единственный параметризованный маршрут: группируем,
// иначе топ путей превращается в список имён.
function normalizePath(pathname) {
  if (pathname.startsWith("/api/players/")) return "/api/players/:name";
  return pathname;
}

function newDayBucket() {
  return { requests: 0, api: 0, views: 0, errors: 0, runs: 0, wins: 0, registers: 0, logins: 0, promoClicks: 0, latSum: 0, statuses: {}, ips: {}, players: {}, paths: {} };
}
function newHourBucket() {
  return { requests: 0, api: 0, views: 0, errors: 0, runs: 0 };
}

export function createAnalytics({ dataFile, maxDays = 30, maxHours = 48, maxRecent = 200 } = {}) {
  let state = { days: {}, hours: {}, events: {}, recent: [], eventsLog: [] };
  if (dataFile) {
    try { state = { ...state, ...JSON.parse(readFileSync(dataFile, "utf8")) }; } catch { /* первый запуск */ }
  }

  function prune() {
    const dayKeys = Object.keys(state.days).sort().slice(-maxDays);
    state.days = Object.fromEntries(dayKeys.map((k) => [k, state.days[k]]));
    const hourKeys = Object.keys(state.hours).sort().slice(-maxHours);
    state.hours = Object.fromEntries(hourKeys.map((k) => [k, state.hours[k]]));
  }

  function bump(map, key, field, delta = 1) {
    if (!map[field]) map[field] = 0;
    map[field] += delta;
  }
  function bumpMap(obj, key, cap = MAX_ENTRIES) {
    if (!(key in obj) && Object.keys(obj).length >= cap) return; // хвост не бесконечен
    obj[key] = (obj[key] || 0) + 1;
  }

  // Запрос: { method, path, status, ms, ip, t? }
  function record({ method, path, status, ms, ip, t = Date.now() }) {
    const isApi = path.startsWith("/api");
    const dk = dayKey(t), hk = hourKey(t);
    const day = (state.days[dk] ||= newDayBucket());
    const hour = (state.hours[hk] ||= newHourBucket());
    for (const b of [day, hour]) {
      b.requests += 1;
      if (isApi) b.api += 1;
      else if (method === "GET") b.views += 1;
      if (status >= 400) b.errors += 1;
    }
    day.latSum += ms;
    day.statuses[String(status)] = (day.statuses[String(status)] || 0) + 1;
    if (ip) bumpMap(day.ips, ip);
    bumpMap(day.paths, `${method} ${normalizePath(path)}`);
    state.recent.push({ t, method, path, status, ms: Math.round(ms), ip });
    if (state.recent.length > maxRecent) state.recent = state.recent.slice(-maxRecent);
    prune();
  }

  // Игровое событие: { type: "register"|"login"|"run", name?, won?, rank?, score? }
  function event(e, t = Date.now()) {
    const dk = dayKey(t);
    const day = (state.days[dk] ||= newDayBucket());
    state.events[e.type] = (state.events[e.type] || 0) + 1;
    if (e.type === "run") { day.runs += 1; if (e.won) day.wins += 1; }
    if (e.type === "register") day.registers += 1;
    if (e.type === "login") day.logins += 1;
    if (e.type === "promo") day.promoClicks += 1;
    if (e.name) bumpMap(day.players, e.name);
    const entry = { t, type: e.type };
    for (const key of Object.keys(e)) if (key !== "type") entry[key] = e[key];
    state.eventsLog.push(entry);
    if (state.eventsLog.length > maxRecent) state.eventsLog = state.eventsLog.slice(-maxRecent);
  }

  // Вью-модель для админки: today из текущего дня, ряды по возрастанию.
  function snapshot(now = Date.now()) {
    const dk = dayKey(now);
    const day = state.days[dk] || newDayBucket();
    const sortDesc = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]);
    return {
      now,
      today: {
        requests: day.requests,
        api: day.api,
        views: day.views,
        errors: day.errors,
        avgLatencyMs: day.requests ? Math.round(day.latSum / day.requests) : 0,
        uniqueIps: Object.keys(day.ips).length,
        uniquePlayers: Object.keys(day.players).length,
        runs: day.runs,
        wins: day.wins,
        registers: day.registers,
        logins: day.logins,
        promoClicks: day.promoClicks || 0,
        statuses: day.statuses,
      },
      hourly: Object.keys(state.hours).sort().map((k) => ({ hour: k, ...state.hours[k] })),
      daily: Object.keys(state.days).sort().map((k) => {
        const b = state.days[k];
        return { day: k, requests: b.requests, views: b.views, api: b.api, errors: b.errors, runs: b.runs, wins: b.wins, registers: b.registers, uniqueIps: Object.keys(b.ips).length };
      }),
      topPaths: sortDesc(day.paths).slice(0, 15).map(([path, count]) => ({ path, count })),
      topIps: sortDesc(day.ips).slice(0, 10).map(([ip, count]) => ({ ip, count })),
      events: { ...state.events },
      recent: state.recent.slice(-50).reverse(),
      eventsLog: state.eventsLog.slice(-50).reverse(),
    };
  }

  // Сброс аналитики: трафик (просмотры/запросы/пути/IP) обнуляется,
  // счётчик промо-кликов и их журнал сохраняются — это метрика рекламы.
  function reset(keepPromo = true) {
    const promoTotal = keepPromo ? (state.events.promo || 0) : 0;
    const promoLog = keepPromo ? state.eventsLog.filter((e) => e.type === "promo") : [];
    state.days = {};
    state.hours = {};
    state.events = keepPromo ? { promo: promoTotal } : {};
    state.eventsLog = promoLog;
    state.recent = [];
    prune();
  }

  function save() {
    if (!dataFile) return;
    try { mkdirSync(dirname(dataFile), { recursive: true }); } catch { /* уже есть */ }
    const tmp = dataFile + ".tmp";
    writeFileSync(tmp, JSON.stringify(state), { mode: 0o600 }); // внутри — IP посетителей
    renameSync(tmp, dataFile);
  }

  return { record, event, snapshot, save, prune, reset };
}
