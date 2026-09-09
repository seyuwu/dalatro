// Dalatro — main: app state holder + event delegation. UI events become actions.
(function () {
  const SAVE_KEY = "dalatro_save_v1";

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

  let state = loadState() || Game.createInitialState("");
  let fighting = false;

  function dispatchAndRender(action) {
    state = Game.dispatch(state, action);
    saveState();

    // Fight: animate the resolution stack first, then reveal the result.
    if (action.type === "CONFIRM_FIGHT" && state.combat.lastResolution) {
      fighting = true;
      const resolution = state.combat.lastResolution;
      UI.playFightAnimation(resolution, () => {
        fighting = false;
        render();
      });
      return;
    }
    render();
  }

  function render() {
    UI.render(state);
  }

  document.getElementById("app").addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el || fighting) return;
    const action = el.dataset.action;
    switch (action) {
      case "start": {
        const input = document.getElementById("seed-input");
        dispatchAndRender({ type: "START_RUN", seedCode: input ? input.value : "" });
        break;
      }
      case "select": dispatchAndRender({ type: "SELECT_CARD", uid: el.dataset.uid }); break;
      case "fight": dispatchAndRender({ type: "CONFIRM_FIGHT" }); break;
      case "toggle-discard":
        UI.UIState.discardMode = !UI.UIState.discardMode;
        render();
        break;
      case "discard": dispatchAndRender({ type: "DISCARD", uids: state.combat.selectedUids.slice() }); break;
      case "enter-shop":
        UI.UIState.inspectedId = null;
        dispatchAndRender({ type: "ENTER_SHOP" });
        break;
      case "buy": dispatchAndRender({ type: "BUY_ITEM", itemId: el.dataset.id }); break;
      case "inspect": if (UI.setInspected(el.dataset.inspect)) render(); break;
      case "sell": dispatchAndRender({ type: "SELL_ITEM", itemId: el.dataset.id }); break;
      case "lock": dispatchAndRender({ type: "LOCK_OFFER", itemId: el.dataset.id }); break;
      case "reroll": dispatchAndRender({ type: "REROLL_SHOP" }); break;
      case "leave-shop": dispatchAndRender({ type: "LEAVE_SHOP" }); break;
      case "retry": dispatchAndRender({ type: "RETRY_WAVE" }); break;
      case "restart":
        localStorage.removeItem(SAVE_KEY);
        state = Game.createInitialState("");
        UI.UIState.discardMode = false;
        UI.UIState.debugOpen = false;
        UI.UIState.inspectedId = null;
        render();
        break;
      case "abandon":
        localStorage.removeItem(SAVE_KEY);
        state = Game.createInitialState("");
        UI.UIState.discardMode = false;
        UI.UIState.inspectedId = null;
        render();
        break;
      case "debug-toggle":
        UI.UIState.debugOpen = !UI.UIState.debugOpen;
        render();
        break;
      case "debug-gold": dispatchAndRender({ type: "DEBUG_GOLD" }); break;
      case "debug-fights": dispatchAndRender({ type: "DEBUG_FIGHTS" }); break;
      case "debug-tower": dispatchAndRender({ type: "DEBUG_DAMAGE_TOWER", amount: 100 }); break;
      case "debug-kill": dispatchAndRender({ type: "DEBUG_KILL_TOWER" }); break;
      case "debug-draw": dispatchAndRender({ type: "DEBUG_DRAW" }); break;
      case "debug-reveal": dispatchAndRender({ type: "DEBUG_REVEAL" }); break;
      default: break;
    }
  });

  // Shop inspect: hovering an offer shows its breakdown, clicking pins it.
  document.getElementById("app").addEventListener("mouseover", (e) => {
    if (state.phase !== "shop") return;
    const el = e.target.closest("[data-inspect]");
    if (el && UI.setInspected(el.dataset.inspect)) render();
  });

  // Enter key on seed input starts the run.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && state.phase === "title") {
      const input = document.getElementById("seed-input");
      if (input && document.activeElement === input) {
        dispatchAndRender({ type: "START_RUN", seedCode: input.value });
      }
    }
    // D = toggle debug sandbox
    if (e.key.toLowerCase() === "d" && state.phase !== "title") {
      UI.UIState.debugOpen = !UI.UIState.debugOpen;
      render();
    }
  });

  render();

  // Debug handle for sandbox/testing (used by docs screenshots and console).
  window.__dalatro = {
    get state() { return state; },
    Game, Sim, Advisor,
  };
})();
