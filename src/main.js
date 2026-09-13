// dotora — main: app state holder + event delegation. UI events become actions.
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
    // Онлайн-синхронизация: компоненты шлём как есть, счёт сервер пересчитывает
    // сам (зеркало scoreOf) — подменить очки с клиента нельзя. Оффлайн — no-op.
    Net.submitRun({
      seed: state.seedCode,
      rank: state.run.rank || 1,
      won: state.phase === "victory",
      waves: entry.waves,
      deaths: entry.deaths,
      timeMs: entry.timeMs,
      barracks: state.run.barracks || 0,
      biggestHit: state.stats.biggestHit || 0,
      spareResets: (((state.run.upgradeState || {}).vozvrat || {}).charges) || 0,
      startedAt: state.run.startedAt || 0,
    }).then((res) => {
      // Гостевой забег ушёл на сервер без аккаунта — на экране конца
      // покажем предложение забрать его в аккаунт.
      if (res && res.guest) {
        UI.UIState.guestRunSaved = true;
        rerender();
      }
      if (res && res.player && res.player.unlockedRank > UI.UIState.unlockedRank) {
        // Победа, учтённая сервером, сразу открывает ранг лиги локально
        // (раньше — только при следующем входе).
        UI.UIState.unlockedRank = res.player.unlockedRank;
        saveUnlockedRank(res.player.unlockedRank);
      }
      if (res && res.personalBest) {
        UI.UIState.toast = `🏆 Личный рекорд на сервере: ${res.score.toLocaleString("ru")}`;
        rerender();
      }
    });
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
      const restored = normalizeState(s);
      DeckSys.syncUidCounter(restored); // иначе наём после перезагрузки перезапишет чужую карту
      return restored;
    } catch (e) { return null; }
  }

  function loadPrefs() {
    try {
      const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
      UI.UIState.motion = raw.motion !== false;
      UI.UIState.keepBase = raw.keepBase !== false;
      if (raw.sound === false && !Sfx.isMuted()) Sfx.toggleMuted();
    } catch (e) { /* defaults */ }
  }

  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ sound: !Sfx.isMuted(), motion: UI.UIState.motion, keepBase: UI.UIState.keepBase !== false }));
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
    if (action.type === "LEAVE_SHOP" || action.type === "TAKE_ROUTE") Net.fetchPromoConfig(true); // свежий промо на следующую волну
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

  // Онлайн-борды: грузим текущий вид и перерисовываемся дважды — сразу
  // (состояние загрузки) и по приходу данных.
  function fetchLeaders() {
    if (!Net.state.online) return;
    Net.leaderboard(UI.UIState.scoreView || "score", UI.UIState.leadersRank || "")
      .then(() => rerender());
    rerender();
  }

  function submitAuth() {
    const nameEl = document.getElementById("auth-name");
    const passEl = document.getElementById("auth-pass");
    const name = ((nameEl || {}).value || "").trim();
    const password = (passEl || {}).value || "";
    const mode = Net.state.authMode === "register" ? "register" : "login";
    Net.auth(mode, name, password)
      .then((res) => {
        const player = res.player;
        UI.UIState.toast = res.claimed
          ? (res.claimed === 1 ? "Гостевой забег перенесён в твой аккаунт 🏆" : `В аккаунт перенесено забегов: ${res.claimed}`)
          : (mode === "register" ? `Аккаунт создан. Привет, ${player.name}!` : `С возвращением, ${player.name}!`);
        // Сервер знает о победах на других устройствах — берём его прогресс,
        // если он дальше локального.
        if (player.unlockedRank > UI.UIState.unlockedRank) {
          UI.UIState.unlockedRank = player.unlockedRank;
          saveUnlockedRank(player.unlockedRank);
        }
        UI.UIState.guestRunSaved = false;
        if (UI.UIState.modal === "account") UI.UIState.modal = null;
        rerender();
      })
      .catch(() => rerender()); // ошибка уже в Net.state.error — модалка покажет
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
    // Счётчик перестановок формаций: кормит скипетры Pudge/Axe и шарды
    // PA/Legion/Anti-Mage/Tusk (docs/AGHANIMS.md).
    state.combat.movesUsed = (state.combat.movesUsed || 0) + 1;
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
    // Клик (без сдвига) по занятому слоту: герой возвращается в руку —
    // тот же splice, что делает тоггл карты. Перестановкой не считается:
    // movesUsed кормит аугменты только за честные перестановки.
    if (!started) {
      if (slot && !state.combat.outcome) {
        const uid = state.combat.selectedUids[from];
        if (uid) dispatchAndRender({ type: "SELECT_CARD", uid });
      }
      return;
    }
    if (!slot) return;
    const to = Number(slot.dataset.idx);
    if (to !== from) reorderSelection(from, to);
  });

  document.addEventListener("pointercancel", () => {
    drag = null;
    clearDragMarks();
  });

  function startRun(seedCode) {
    // Ядро скоринга одно — формации. Тумблер и ?rules= выпилены:
    // какой-либо выбор режима больше не предусмотрен.
    state = Game.dispatch(state, {
      type: "START_RUN", seedCode, rules: "formation", rank: UI.UIState.rankDraft || 1,
      starterId: UI.UIState.starterDraft || "standard", keepBase: UI.UIState.keepBase !== false,
    });
    UI.UIState.unlockBanner = null;
    saveState();
    // Онбординг: вместо модалки-простыни — интерактивный сценарий (tutorial.js),
    // он сам вооружается на титульном экране. «Как играть — 5 шагов» остаётся
    // кнопкой на титуле для тех, кто хочет полный текст.
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
      case "pick-rank":
        UI.UIState.rankDraft = Math.min(Ranks.MAX_RANK, Math.max(1, Number(el.dataset.rank) || 1));
        Sfx.play("select");
        rerender();
        break;
      case "pick-starter":
        UI.UIState.starterDraft = Content.archetypes.byId[el.dataset.starter] ? el.dataset.starter : "standard";
        UI.UIState.starterPicks = (UI.UIState.starterPicks || 0) + 1; // туториал: клик по уже активному билду тоже прогресс
        Sfx.play("select");
        rerender();
        break;
      case "toggle-keep-base":
        UI.UIState.keepBase = !(UI.UIState.keepBase !== false);
        savePrefs();
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
      case "apply-hint": {
        // Клик по подсказке «в руке собирается формация»: выставляем её отряд
        // целиком в готовом порядке. Те же проверки, что у SELECT_CARD, —
        // состояние могло измениться с момента расчёта подсказки.
        if (state.phase !== "wave" || state.combat.outcome) break;
        const uids = String(el.dataset.uids || "").split("|").filter(Boolean);
        const mined = state.combat.minedUids || [];
        const wave = state.combat.wave || {};
        const ok = uids.length > 0
          && uids.length <= Game.maxSlots(state)
          && uids.every((uid) => {
            if (!state.player.handUids.includes(uid) || mined.includes(uid) || !state.cards[uid]) return false;
            const heroId = state.cards[uid].heroId;
            if (wave.bannedHeroId === heroId) return false;
            if (wave.banAttrs && wave.banAttrs.includes(Game.heroAttr(state, heroId))) return false;
            if (wave.noRepeat && (wave.lastFightHeroes || []).includes(heroId)) return false;
            return true;
          });
        if (!ok) break;
        Sfx.play("select");
        state.combat.selectedUids = uids;
        rerender();
        break;
      }
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
      case "activate-upgrade": {
        Sfx.play("click");
        dispatchAndRender({ type: "ACTIVATE_UPGRADE", upgradeId: el.dataset.upgrade, targetId: el.dataset.target });
        if (state.run.pickDiscard) {
          UI.UIState.modal = "discard-pick";
          rerender();
        } else {
          const def = Content.upgrades.byId[el.dataset.upgrade];
          if (def) UI.toast(state, `${def.emoji} «${def.name}» активировано`);
        }
        break;
      }
      case "pick-discard":
        dispatchAndRender({ type: "PICK_DISCARD", uid: el.dataset.uid });
        UI.UIState.modal = null;
        break;
      case "retry-free":
        dispatchAndRender({ type: "RETRY_WAVE", useUpgradeId: el.dataset.upgrade });
        break;
      case "sell":
        dispatchAndRender({ type: "SELL_ITEM", itemId: el.dataset.id });
        if (UI.UIState.modal === "detail") { UI.UIState.modal = null; UI.UIState.detail = null; }
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
      case "undo-route":
        Sfx.play("click");
        dispatchAndRender({ type: "UNDO_ROUTE" });
        break;
      case "buy-recruit":
        Sfx.play("buy");
        dispatchAndRender({ type: "BUY_RECRUIT", heroId: el.dataset.id });
        UI.toast(state, "Герой нанят — он в колоде");
        break;
      case "buy-augh": {
        Sfx.play("buy");
        const kindWord = el.dataset.kind === "scepter" ? "Скипетр Аганима" : "Осколок Аганима";
        dispatchAndRender({ type: "BUY_AUGMENT", heroId: el.dataset.hero, kind: el.dataset.kind });
        const aug = Content.aghanims.forHero(el.dataset.hero, el.dataset.kind);
        if (aug) UI.toast(state, `${kindWord} «${aug.name}» — ${Content.heroes.byId[el.dataset.hero].name}`);
        break;
      }
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
        if (el.dataset.modal === "leaders") fetchLeaders();
        if (el.dataset.modal === "account" && !Net.state.me && UI.UIState.guestRunSaved) {
          Net.state.authMode = "register"; // клик с плашки «забрать забег»
          Net.state.error = "";
        }
        if (el.dataset.modal === "account" && Net.state.me) {
          Net.fetchProfile(Net.state.me.name).then(() => rerender());
        }
        rerender();
        break;
      case "open-collection":
        UI.UIState.modal = "collection";
        UI.UIState.collectionTab = "heroes";
        UI.UIState.search = "";
        if (typeof Tutorial !== "undefined" && Tutorial.note) Tutorial.note("coll", "📚", "Коллекция — это и прокачка: героев можно нанимать, тренировать (+1 ранг) и усиливать аугментами.");
        rerender();
        break;
      case "open-collection-deck":
        UI.UIState.modal = "collection";
        UI.UIState.collectionTab = "deck";
        UI.UIState.labFocus = "exile";
        UI.UIState.search = "";
        if (typeof Tutorial !== "undefined" && Tutorial.note) Tutorial.note("coll", "📚", "Коллекция — это и прокачка: героев можно нанимать, тренировать (+1 ранг) и усиливать аугментами.");
        rerender();
        break;
      case "score-view":
        UI.UIState.scoreView = el.dataset.view;
        if (UI.UIState.scoreSrc === "global" || UI.UIState.modal === "leaders") fetchLeaders();
        else rerender();
        break;
      case "score-src":
        UI.UIState.scoreSrc = el.dataset.src;
        if (UI.UIState.scoreSrc === "global") fetchLeaders();
        else rerender();
        break;
      case "lb-rank":
        UI.UIState.leadersRank = el.dataset.rank || "";
        fetchLeaders();
        break;
      case "auth-mode":
        Net.state.authMode = el.dataset.mode;
        Net.state.error = "";
        rerender();
        break;
      case "promo-visit": {
        const promo = Net.getPromo(el.dataset.promo);
        if (promo) {
          Net.trackPromo(el.dataset.promo, "visit");
          if (promo.url) window.open(promo.url, "_blank", "noopener");
        }
        break;
      }
      case "promo-view": {
        if (Net.getPromo(el.dataset.promo)) Net.trackPromo(el.dataset.promo, "view");
        break;
      }
      case "auth-submit": submitAuth(); break;
      case "logout":
        Net.logout().then(() => { UI.UIState.toast = "Вы вышли из аккаунта."; rerender(); });
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

  // Фильтр «топ на ранге N» в онлайн-таблице (select — событие change).
  document.getElementById("app").addEventListener("change", (e) => {
    const el = e.target.closest("[data-action-change=lb-rank]");
    if (el) {
      UI.UIState.leadersRank = el.value;
      fetchLeaders();
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
      if (e.key === "Enter" && (e.target.id === "auth-name" || e.target.id === "auth-pass")) {
        submitAuth();
      }
      return;
    }
    // Enter на сфокусированной кнопке/ссылке — её нативная активация:
    // не перехватываем, иначе получаем двойное действие (клик + хоткей).
    if (e.key === "Enter" && e.target instanceof HTMLElement && e.target.closest("button, a, [data-action]")) return;
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
    if (/^[1-9]$/.test(e.key) && state.phase === "wave" && !state.combat.outcome) {
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

  // Онлайн: проверяем API в фоне. Сессия с другого устройства подтягивает
  // прогресс лиги (unlockedRank), титул/модалки/экран конца забега
  // перерисуются с аккаунтом и онлайн-вкладками «Зала славы».
  Net.ping().then(() => {
    if (Net.state.me && Net.state.me.unlockedRank > UI.UIState.unlockedRank) {
      UI.UIState.unlockedRank = Net.state.me.unlockedRank;
      saveUnlockedRank(Net.state.me.unlockedRank);
    }
    Net.fetchPromoConfig().then(() => { if (state.phase === "wave") rerender(); });
    const p = state.phase;
    if (p === "title" || p === "victory" || p === "gameover" || UI.UIState.modal === "account" || UI.UIState.modal === "leaders") rerender();
  });

  // Debug handle for sandbox/testing (used by docs screenshots and console).
  window.__dalatro = {
    get state() { return state; },
    Game, Sim, Advisor, UI,
  };
})();
