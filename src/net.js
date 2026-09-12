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
    const body = { name, password };
    const guest = guestToken();
    if (guest) body.guest = guest;
    return api("POST", "/api/" + mode, body)
      .then((d) => {
        state.me = d.player;
        state.busy = false;
        return d;
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

  // Токен браузера для гостевых забегов: без аккаунта забег всё равно уходит
  // на сервер (в таблице — «Гость #XXXX»), а при регистрации/входе с этим же
  // токеном все гостевые забеги переезжают в аккаунт.
  function guestToken() {
    try {
      if (typeof crypto === "undefined" || !crypto.getRandomValues) return null;
      let t = localStorage.getItem("dalatro_guest_v1");
      if (!t || !/^[a-f0-9]{16,64}$/.test(t)) {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        t = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
        localStorage.setItem("dalatro_guest_v1", t);
      }
      return t;
    } catch (e) {
      return null; // приватный режим — гостевые забеги не отправляем
    }
  }

  // Отправка забега: с аккаунта — обычная, без аккаунта — гостевая. Игра
  // сеть не ждёт; оффлайн — тихий no-op.
  function submitRun(payload) {
    if (!state.online) return Promise.resolve(null);
    const body = { ...payload };
    if (!state.me) {
      const guest = guestToken();
      if (!guest) return Promise.resolve(null);
      body.guest = guest;
    }
    return api("POST", "/api/runs", body)
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
