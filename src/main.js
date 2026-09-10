// Dalatro — main: app state holder + event delegation. UI events become actions.
// UI prefs (sound/motion/onboarding) live here, game state in Game.dispatch.
(function () {
  const SAVE_KEY = "dalatro_save_v3"; // v3: архетипы старта + слоты предметов (старые сейвы не подхватываются)
  const PREFS_KEY = "dalatro_prefs_v3";
  const ONBOARD_KEY = "dalatro_onboard_v3";
  const RANKS_KEY = "dalatro_ranks_v1"; // прогресс лиги: максимальный открытый ранг
  const SCORES_KEY = "dalatro_scores_v1"; // локальный лидерборд (фаза H)

  // Мёрж дефолтов createInitialState: новые поля стейта (архетип, флаги перков,
  // слоты) не роняют сейвы, сохранённые в более ранней точке этой же версии.
  function normalizeState(s) {
    const fresh = Game.createInitialState("");
    return {
      ...fresh, ...s,
      run: { ...fresh.run, ...(s.run || {}) },
      player: { ...fresh.player, ...(s.player || {}) },
      combat: { ...fresh.combat, ...(s.combat || {}) },
      shop: { ...fresh.shop, ...(s.shop || {}) },
      stats: { ...fresh.stats, ...(s.stats || {}) },
    };
  }

  function loadScores() {
    try { return JSON.parse(localStorage.getItem(SCORES_KEY)) || []; } catch (e) { return []; }
  }

  // Запись забега (спек §8.1): один раз за забег, хвост 50 записей.
  function recordRun(state) {
    if (state.run.scoreRecorded) return;
    state.run.scoreRecorded = true;
    const entry = {
      date: Date.now(),
      seed: state.seedCode,
      rank: state.run.rank || 1,
      score: Game.scoreOf(state),
      waves: Math.min(state.run.waveIndex + (state.phase === "victory" ? 1 : 0), Content.waves.order.length),
      won: state.phase === "victory",
      timeMs: Math.max(0, Date.now() - (state.run.startedAt || Date.now())),
      deaths: state.run.deathsCount || 0,
    };
    const list = loadScores();
    UI.UIState.newRecord = !list.length || entry.score > Math.max(...list.map((e) => e.score));
    list.push(entry);
    try { localStorage.setItem(SCORES_KEY, JSON.stringify(list.slice(-50))); } catch (e) { /* приватный режим */ }
    UI.UIState.scores = loadScores();
  }

  function loadUnlockedRank() {
    try {
      const raw = Number(localStorage.getItem(RANKS_KEY));
      return raw >= 1 && raw <= Ranks.MAX_RANK ? raw : 1;
    } catch (e) { return 1; }
  }

  function saveUnlockedRank(rank) {
    try { localStorage.setItem(RANKS_KEY, String(rank)); } catch (e) { /* приватный режим */ }
  }

  function saveState() {
    try {
      const rng = Rng.current();
      const payload = { ...state, rngCount: rng ? rng.drawCount() : 0 };
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch (e) { /* приватный режим — без сейва */ }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !s.phase || s.phase === "title") return null;
      // Recreate the seeded stream and fast-forward to the saved position.
      if (s.seedCode) {
        const rng = Rng.create(s.seedCode);
        rng.fastForward(s.rngCount || 0);
        Rng.setActive(rng);
      }
      return normalizeState(s);
    } catch (e) { return null; }
  }

  function loadPrefs() {
    try {
      const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
      UI.UIState.motion = raw.motion !== false;
      if (raw.sound === false && !Sfx.isMuted()) Sfx.toggleMuted();
    } catch (e) { /* defaults */ }
  }

  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ sound: !Sfx.isMuted(), motion: UI.UIState.motion }));
    } catch (e) { /* ignore */ }
  }

  loadPrefs();
  UI.UIState.unlockedRank = loadUnlockedRank();
  UI.UIState.scores = loadScores();
  UI.UIState.scoreView = "score";
  let state = loadState() || Game.createInitialState("");
  let fighting = false;

  let audioContext = null;
  function playTone() {
    // Оставлен для совместимости: основной звук — через Sfx (ui/audio.js).
    Sfx.play("attack");
  }

  function rerender() {
    UI.render(state);
  }
  window.__dalatroRerender = rerender;

  function dispatchAndRender(action) {
    // Всплывает только реально обновлённое: новая раздача/шоп/реролл.
    // Выбор карты состояние коллекций не меняет — всё остаётся на местах.
    const HAND_DEAL = new Set(["START_RUN", "CONFIRM_FIGHT", "DISCARD", "RETRY_WAVE", "LEAVE_SHOP", "TAKE_ROUTE", "DEBUG_DRAW"]);
    const SHOP_REFRESH = new Set(["ENTER_SHOP", "REROLL_SHOP"]);
    const INV_REFRESH = new Set(["BUY_ITEM", "SELL_ITEM"]);
    const LAB_REFRESH = new Set(["BUY_RECRUIT", "EXILE_HERO"]);
    if (HAND_DEAL.has(action.type)) UI.UIState.animHand = true;
    if (SHOP_REFRESH.has(action.type)) {
      UI.UIState.animShop = true;
      UI.UIState.animInv = true;
      UI.UIState.animLab = true;
    }
    if (INV_REFRESH.has(action.type)) UI.UIState.animInv = true;
    if (LAB_REFRESH.has(action.type)) UI.UIState.animLab = true;
    if (action.type === "LEAVE_SHOP") UI.UIState.animRoute = true;

    state = Game.dispatch(state, action);
    saveState();

    // Победа на ранге N открывает N+1 навсегда (localStorage). Плашка — на
    // экране победы; сбросится при старте нового забега.
    if (state.phase === "victory" && !fighting) {
      const cleared = state.run.rank || 1;
      if (cleared >= UI.UIState.unlockedRank && UI.UIState.unlockedRank < Ranks.MAX_RANK) {
        const next = Math.min(Ranks.MAX_RANK, cleared + 1);
        UI.UIState.unlockedRank = next;
        UI.UIState.unlockBanner = Content.ranks.byId[next].name;
        saveUnlockedRank(next);
      }
    }

    // Конец забега: запись в локальный лидерборд (фаза H).
    if (state.phase === "victory" || state.phase === "gameover") recordRun(state);

    // Fight: animate the resolution stack first, then reveal the result.
    if (action.type === "CONFIRM_FIGHT" && state.combat.lastResolution) {
      fighting = true;
      Sfx.play("attack");
      const resolution = state.combat.lastResolution;
      UI.playFightAnimation(resolution, () => {
        fighting = false;
        if (state.combat.outcome === "cleared") Sfx.play("win");
        else if (state.combat.outcome === "failed") Sfx.play("lose");
        rerender();
      });
      return;
    }
    rerender();
  }

  function closeModal() {
    UI.UIState.modal = null;
    UI.UIState.detail = null;
    UI.UIState.labFocus = null;
    rerender();
  }

  function clearSelection() {
    state.combat.selectedUids = [];
    rerender();
  }

  // Перетаскивание героев по слотам формации: занятые меняются местами,
  // пустой слот принимает героя на это место. Порядок = позиции в бою.
  // Pointer-события вместо HTML5 DnD — работают с любым вводом и не зависят
  // от нативного dragstart.
  let drag = null;

  function reorderSelection(from, to) {
    const uids = state.combat.selectedUids;
    if (from === to || from < 0 || !uids[from]) return;
    if (uids[to]) {
      [uids[from], uids[to]] = [uids[to], uids[from]];
    } else {
      const [moved] = uids.splice(from, 1);
      uids.splice(to, 0, moved);
    }
    rerender();
  }

  function clearDragMarks() {
    document.querySelectorAll(".formation-slot.dragging, .formation-slot.drag-over")
      .forEach((el) => el.classList.remove("dragging", "drag-over"));
  }

  document.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || state.phase !== "wave" || state.combat.outcome || fighting) return;
    const slot = e.target.closest && e.target.closest(".formation-slot.occupied[data-idx]");
    if (!slot) return;
    drag = { from: Number(slot.dataset.idx), started: false, x: e.clientX, y: e.clientY };
  });

  document.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (!drag.started) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
      drag.started = true;
      document.querySelector(`.formation-slot[data-idx="${drag.from}"]`)?.classList.add("dragging");
    }
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const slot = under && under.closest(".formation-slot[data-idx]");
    document.querySelectorAll(".formation-slot.drag-over").forEach((el) => el.classList.remove("drag-over"));
    if (slot && Number(slot.dataset.idx) !== drag.from) slot.classList.add("drag-over");
  });

  document.addEventListener("pointerup", (e) => {
    if (!drag) return;
    const { from, started } = drag;
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const slot = under && under.closest(".formation-slot[data-idx]");
    drag = null;
    clearDragMarks();
    if (!started || !slot) return;
    const to = Number(slot.dataset.idx);
    if (to !== from) reorderSelection(from, to);
  });

  document.addEventListener("pointercancel", () => {
    drag = null;
    clearDragMarks();
  });

  function startRun(seedCode) {
    // Правила: URL ?rules=formation приоритетнее тумблера на титульном экране.
    const urlRules = new URLSearchParams(location.search).get("rules");
    state = Game.dispatch(state, { type: "START_RUN", seedCode, rules: urlRules || UI.UIState.rulesDraft, rank: UI.UIState.rankDraft || 1, starterId: UI.UIState.starterDraft || "standard" });
    UI.UIState.unlockBanner = null;
    saveState();
    if (!localStorage.getItem(ONBOARD_KEY)) {
      UI.UIState.onboarding = true;
      UI.UIState.onboardingStep = 0;
    }
    rerender();
  }

  document.getElementById("app").addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el || fighting) return;
    const action = el.dataset.action;
    switch (action) {
      case "start": {
        const input = document.getElementById("seed-input");
        startRun(input ? input.value : "");
        break;
      }
      case "select": Sfx.play("select"); dispatchAndRender({ type: "SELECT_CARD", uid: el.dataset.uid }); break;
      case "toggle-rules":
        UI.UIState.rulesDraft = el.dataset.rules;
        rerender();
        break;
      case "pick-rank":
        UI.UIState.rankDraft = Math.min(Ranks.MAX_RANK, Math.max(1, Number(el.dataset.rank) || 1));
        Sfx.play("select");
        rerender();
        break;
      case "pick-starter":
        UI.UIState.starterDraft = Content.archetypes.byId[el.dataset.starter] ? el.dataset.starter : "standard";
        Sfx.play("select");
        rerender();
        break;
      case "choose-curse":
        Sfx.play("lose");
        dispatchAndRender({ type: "CHOOSE_CURSE", curseId: el.dataset.curse });
        UI.toast(state, "Проклятие забега принято. До конца забега.");
        rerender();
        break;
      case "fight": dispatchAndRender({ type: "CONFIRM_FIGHT" }); break;
      case "discard": Sfx.play("discard"); dispatchAndRender({ type: "DISCARD", uids: state.combat.selectedUids.slice() }); break;
      case "clear-selection": clearSelection(); break;
      case "enter-shop":
        Sfx.play("click");
        dispatchAndRender({ type: "ENTER_SHOP" });
        break;
      case "buy": Sfx.play("buy"); dispatchAndRender({ type: "BUY_ITEM", itemId: el.dataset.id }); break;
      case "buy-upgrade":
        Sfx.play("buy");
        dispatchAndRender({ type: "BUY_UPGRADE", upgradeId: el.dataset.id });
        break;
      case "reroll-upgrades":
        dispatchAndRender({ type: "REROLL_UPGRADES" });
        break;
      case "refresh-upgrade":
        Sfx.play("buy");
        dispatchAndRender({ type: "REFRESH_UPGRADE", upgradeId: el.dataset.id });
        break;
      case "sell":
        dispatchAndRender({ type: "SELL_ITEM", itemId: el.dataset.id });
        if (UI.UIState.modal === "detail") UI.UIState.modal = null;
        UI.toast(state, "Предмет продан за половину цены");
        rerender();
        break;
      case "item-open":
        UI.UIState.modal = "detail";
        UI.UIState.detail = el.dataset.id;
        rerender();
        break;
      case "item-hint": UI.toast(state, "Новые предметы появятся в лавке после зачистки волны."); break;
      case "lock": dispatchAndRender({ type: "LOCK_OFFER", itemId: el.dataset.id }); break;
      case "reroll": dispatchAndRender({ type: "REROLL_SHOP" }); break;
      case "leave-shop": Sfx.play("click"); dispatchAndRender({ type: "LEAVE_SHOP" }); break;
      case "take-route":
        Sfx.play("path");
        dispatchAndRender({ type: "TAKE_ROUTE", kind: el.dataset.kind });
        break;
      case "buy-recruit":
        Sfx.play("buy");
        dispatchAndRender({ type: "BUY_RECRUIT", heroId: el.dataset.id });
        UI.toast(state, "Герой нанят — он в колоде");
        break;
      case "exile":
        Sfx.play("discard");
        dispatchAndRender({ type: "EXILE_HERO", heroId: el.dataset.id });
        break;
      case "train":
        Sfx.play("buy");
        dispatchAndRender({ type: "TRAIN_HERO", heroId: el.dataset.id });
        break;
      case "change-attr":
        dispatchAndRender({ type: "CHANGE_ATTR", heroId: el.dataset.id, attr: el.dataset.attr });
        UI.toast(state, `${Content.heroes.byId[el.dataset.id].name}: атрибут — ${Content.attrNames[el.dataset.attr]}`);
        break;
      case "retry": dispatchAndRender({ type: "RETRY_WAVE" }); break;
      case "restart": {
        const input = document.getElementById("seed-input-modal");
        localStorage.removeItem(SAVE_KEY);
        closeModal();
        startRun(input ? input.value : "");
        UI.toast(state, "Новый забег начался. Удачи на линии!");
        break;
      }
      case "open-modal":
        UI.UIState.modal = el.dataset.modal;
        if (el.dataset.modal === "collection") UI.UIState.collectionTab = "heroes";
        // «Новый забег»: пикер ранга начинается с ранга текущего забега,
        // а не с дефолтного Рекрута.
        if (el.dataset.modal === "new" && state.phase !== "title" && state.run && state.run.rank) {
          UI.UIState.rankDraft = Math.min(Ranks.MAX_RANK, Math.max(1, state.run.rank));
        }
        rerender();
        break;
      case "open-collection":
        UI.UIState.modal = "collection";
        UI.UIState.collectionTab = "heroes";
        UI.UIState.search = "";
        rerender();
        break;
      case "open-collection-deck":
        UI.UIState.modal = "collection";
        UI.UIState.collectionTab = "deck";
        UI.UIState.labFocus = "exile";
        UI.UIState.search = "";
        rerender();
        break;
      case "score-view":
        UI.UIState.scoreView = el.dataset.view;
        rerender();
        break;
      case "open-training":
        UI.UIState.modal = "collection";
        UI.UIState.collectionTab = "deck";
        UI.UIState.labFocus = "train";
        UI.UIState.search = "";
        rerender();
        break;
      case "open-score":
        UI.UIState.modal = "score";
        rerender();
        break;
      case "collection-tab":
        UI.UIState.collectionTab = el.dataset.tab;
        UI.UIState.labFocus = null;
        UI.UIState.search = "";
        rerender();
        break;
      case "close-modal": closeModal(); break;
      case "modal-backdrop":
        if (e.target === el) {
          if (UI.UIState.onboarding) {
            UI.UIState.onboarding = false;
            try { localStorage.setItem(ONBOARD_KEY, "seen"); } catch (err) { /* ignore */ }
          }
          closeModal();
        }
        break;
      case "sort":
        UI.UIState.sort = UI.UIState.sort === el.dataset.mode ? "deal" : el.dataset.mode;
        rerender();
        break;
      case "nav-play": closeModal(); break;
      case "toggle-sound":
        Sfx.toggleMuted();
        savePrefs();
        rerender();
        break;
      case "toggle-motion":
        UI.UIState.motion = !UI.UIState.motion;
        savePrefs();
        rerender();
        break;
      case "toggle-journal":
        UI.UIState.journalOpen = !UI.UIState.journalOpen;
        rerender();
        break;
      case "show-tip":
        UI.toast(state, "Совет: " + UI.tipText(UI.UIState.tipIndex));
        UI.UIState.tipIndex = (UI.UIState.tipIndex + 1) % 6;
        break;
      case "close-toast": UI.UIState.toast = ""; rerender(); break;
      case "onboard-start":
        UI.UIState.onboarding = true;
        UI.UIState.onboardingStep = 0;
        rerender();
        break;
      case "onboard-next": UI.UIState.onboardingStep += 1; rerender(); break;
      case "onboard-prev": UI.UIState.onboardingStep = Math.max(0, UI.UIState.onboardingStep - 1); rerender(); break;
      case "onboard-close":
        UI.UIState.onboarding = false;
        try { localStorage.setItem(ONBOARD_KEY, "seen"); } catch (err) { /* ignore */ }
        rerender();
        break;
      case "debug-toggle": UI.UIState.debugOpen = !UI.UIState.debugOpen; rerender(); break;
      case "debug-gold": dispatchAndRender({ type: "DEBUG_GOLD" }); break;
      case "debug-fights": dispatchAndRender({ type: "DEBUG_FIGHTS" }); break;
      case "debug-tower": dispatchAndRender({ type: "DEBUG_DAMAGE_TOWER", amount: 100 }); break;
      case "debug-kill": dispatchAndRender({ type: "DEBUG_KILL_TOWER" }); break;
      case "debug-draw": dispatchAndRender({ type: "DEBUG_DRAW" }); break;
      case "debug-reveal": dispatchAndRender({ type: "DEBUG_REVEAL" }); break;
      default: break;
    }
  });

  // Live search inside collection modal (input event, not click).
  document.getElementById("app").addEventListener("input", (e) => {
    const el = e.target.closest("[data-action-input=search]");
    if (el) {
      UI.UIState.search = el.value;
      // re-render only the modal grid: cheap full render is fine
      rerender();
      const input = document.querySelector("[data-action-input=search]");
      if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
      if (e.key === "Enter" && e.target.id === "seed-input") {
        startRun(e.target.value);
      }
      if (e.key === "Enter" && e.target.id === "seed-input-modal") {
        startRun(e.target.value);
      }
      return;
    }
    if (e.key === "Escape") {
      if (UI.UIState.onboarding) { UI.UIState.onboarding = false; try { localStorage.setItem(ONBOARD_KEY, "seen"); } catch (err) { } }
      closeModal();
      if (!fighting) clearSelection();
      return;
    }
    if (UI.UIState.onboarding) {
      if (e.key === "Enter" || e.key === "ArrowRight") {
        UI.UIState.onboardingStep += 1;
        rerender();
      }
      if (e.key === "ArrowLeft") {
        UI.UIState.onboardingStep = Math.max(0, UI.UIState.onboardingStep - 1);
        rerender();
      }
      return;
    }
    if (UI.UIState.modal || fighting) return;
    if (/^[1-7]$/.test(e.key) && state.phase === "wave" && !state.combat.outcome) {
      e.preventDefault();
      const order = UI.handOrder(state);
      const uid = order[Number(e.key) - 1];
      if (uid) dispatchAndRender({ type: "SELECT_CARD", uid });
    }
    if (e.key === "Enter" && state.phase === "wave" && !state.combat.outcome) {
      e.preventDefault();
      if (state.combat.selectedUids.length) dispatchAndRender({ type: "CONFIRM_FIGHT" });
    }
    // Лавка: 1–5 купить предложение, R — реролл, Enter — следующая волна.
    if (state.phase === "shop") {
      if (/^[1-5]$/.test(e.key)) {
        const offer = (state.shop.offers || [])[Number(e.key) - 1];
        if (offer) {
          const item = Content.items.byId[offer.id];
          const cost = Game.itemCost(state, offer.id);
          if (state.run.gold >= cost) {
            Sfx.play("buy");
            dispatchAndRender({ type: "BUY_ITEM", itemId: offer.id });
          } else UI.toast(state, `Не хватает золота: «${item.name}» стоит ${cost}.`);
        }
      }
      if ((e.key.toLowerCase() === "r" || e.key.toLowerCase() === "к") && state.run.gold >= Game.rerollCost(state)) {
        dispatchAndRender({ type: "REROLL_SHOP" });
      }
      if (e.key === "Enter") {
        e.preventDefault();
        Sfx.play("click");
        dispatchAndRender({ type: "LEAVE_SHOP" });
      }
      return;
    }
    // Развилка: 1..N — выбор маршрута (опции лежат в стейте).
    if (state.phase === "route" && /^[1-9]$/.test(e.key)) {
      const opt = (state.combat.routeOptions || [])[Number(e.key) - 1];
      if (opt) {
        Sfx.play("path");
        dispatchAndRender({ type: "TAKE_ROUTE", kind: opt.id });
      }
    }
    if ((e.key.toLowerCase() === "r" || e.key.toLowerCase() === "к") && state.phase === "wave" && !state.combat.outcome) {
      if (state.combat.selectedUids.length && state.player.discardsLeft > 0) {
        e.preventDefault();
        dispatchAndRender({ type: "DISCARD", uids: state.combat.selectedUids.slice() });
        UI.toast(state, "Подкрепление прибыло. Собери новую комбинацию.");
      }
    }
    if (e.key.toLowerCase() === "d" && state.phase !== "title") {
      UI.UIState.debugOpen = !UI.UIState.debugOpen;
      rerender();
    }
  });

  rerender();

  // Debug handle for sandbox/testing (used by docs screenshots and console).
  window.__dalatro = {
    get state() { return state; },
    Game, Sim, Advisor, UI,
  };
})();
