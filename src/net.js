// dotora — net: клиент бэкенда (аккаунты, отправка забегов, лидерборды).
// Тот же origin, что и страница: сервер отдаёт и статику, и /api/*. Игра
// полностью работает оффлайн — каждый вызов гасит ошибку в state, UI читает
// Net.state и показывает онлайн-блоки только когда API живой. Файл грузится
// и в тестовый vm (см. tests/run.js), поэтому на верхнем уровне — только
// определение модуля: fetch/localStorage трогаем лениво, внутри методов.
const Net = (function () {
  const state = {
    checked: false,  // ping уже выполнялся
    online: false,   // API отвечал хотя бы раз
    me: null,        // { name, createdAt, unlockedRank, stats }
    error: "",       // последняя ошибка для модалки аккаунта
    authMode: "login",
    busy: false,
    boards: {},      // ключ "view|rank" → { rows } | { error }
    boardsLoading: false,
    profiles: {},    // имя → профиль (для модалки аккаунта)
  };

  function api(method, path, body) {
    if (typeof fetch !== "function") return Promise.reject(new Error("offline"));
    const opts = { method, headers: {} };
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    return fetch(path, opts).then((res) =>
      res.json().catch(() => null).then((data) => {
        if (!res.ok) {
          const err = new Error((data && data.error) || "HTTP " + res.status);
          err.status = res.status;
          throw err;
        }
        return data;
      })
    );
  }

  // Кто я? 401 значит «API жив, но сессии нет» — это тоже онлайн.
  function ping() {
    return api("GET", "/api/me")
      .then((d) => { state.online = true; state.checked = true; state.me = d.player || null; })
      .catch((e) => {
        state.checked = true;
        if (e && e.status === 401) { state.online = true; state.me = null; }
        else state.online = false;
      });
  }

  function auth(mode, name, password) {
    state.busy = true;
    state.error = "";
    return api("POST", "/api/" + mode, { name, password })
      .then((d) => {
        state.me = d.player;
        state.busy = false;
        return d.player;
      })
      .catch((e) => {
        state.busy = false;
        state.error = (e && e.message) || "не получилось";
        throw e;
      });
  }

  function logout() {
    state.me = null;
    return api("POST", "/api/logout", {}).catch(() => {});
  }

  // Отправка забега — fire-and-forget: игра не ждёт сеть. Оффлайн — тихий no-op.
  function submitRun(payload) {
    if (!state.online || !state.me) return Promise.resolve(null);
    return api("POST", "/api/runs", payload)
      .then((d) => {
        if (d && d.player) state.me = d.player;
        return d;
      })
      .catch(() => null);
  }

  function boardKey(view, rank) { return view + "|" + (rank || ""); }

  function leaderboard(view, rank) {
    state.boardsLoading = true;
    const q = rank ? `&rank=${encodeURIComponent(rank)}` : "";
    return api("GET", `/api/leaderboard?view=${encodeURIComponent(view)}${q}`)
      .then((d) => {
        state.boards[boardKey(view, rank)] = { rows: (d && d.rows) || [] };
        state.boardsLoading = false;
      })
      .catch((e) => {
        state.boards[boardKey(view, rank)] = { error: (e && e.message) || "нет связи" };
        state.boardsLoading = false;
      });
  }

  function fetchProfile(name) {
    return api("GET", "/api/players/" + encodeURIComponent(name))
      .then((d) => { if (d) state.profiles[name] = d; })
      .catch(() => {});
  }

  return { state, ping, auth, logout, submitRun, leaderboard, fetchProfile };
})();
