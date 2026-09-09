// Dalatro — main: app state holder + event delegation. UI events become actions.
// UI prefs (sound/motion/onboarding) live here, game state in Game.dispatch.
(function () {
  const SAVE_KEY = "dalatro_save_v2"; // v2: акты/новый баланс — старые сейфы несовместимы и не подхватываются
  const PREFS_KEY = "dalatro_prefs_v3";
  const ONBOARD_KEY = "dalatro_onboard_v3";

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
      return s;
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
    rerender();
  }

  function clearSelection() {
    state.combat.selectedUids = [];
    rerender();
  }

  function startRun(seedCode) {
    // Правила: URL ?rules=formation приоритетнее тумблера на титульном экране.
    const urlRules = new URLSearchParams(location.search).get("rules");
    state = Game.dispatch(state, { type: "START_RUN", seedCode, rules: urlRules || UI.UIState.rulesDraft });
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
      case "fight": dispatchAndRender({ type: "CONFIRM_FIGHT" }); break;
      case "discard": Sfx.play("discard"); dispatchAndRender({ type: "DISCARD", uids: state.combat.selectedUids.slice() }); break;
      case "clear-selection": clearSelection(); break;
      case "enter-shop":
        Sfx.play("click");
        dispatchAndRender({ type: "ENTER_SHOP" });
        break;
      case "buy": Sfx.play("buy"); dispatchAndRender({ type: "BUY_ITEM", itemId: el.dataset.id }); break;
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
        UI.UIState.search = "";
        rerender();
        break;
      case "open-score":
        UI.UIState.modal = "score";
        rerender();
        break;
      case "collection-tab":
        UI.UIState.collectionTab = el.dataset.tab;
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
      case "next-tip":
        UI.UIState.tipIndex = (UI.UIState.tipIndex + 1) % 6;
        rerender();
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
