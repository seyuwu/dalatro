// Dalatro — UI. Reads state, renders DOM, dispatches actions via data-attributes.
// Never a source of truth: State -> Render.
const UI = (function () {
  const app = () => document.getElementById("app");
  const UIState = {
    debugOpen: false,
    discardMode: false,
    inspectedId: null, // item currently pinned in the shop inspect panel
  };

  const RARITY_NAMES = { common: "ОБЫЧНЫЙ", rare: "РЕДКИЙ", epic: "ЭПИК" };
  const CATEGORY_NAMES = { power: "СИЛА", mult: "МНОЖИТЕЛЬ", rule: "ПРАВИЛА", economy: "ЭКОНОМИКА" };

  function h(tag, cls, html) {
    return `<${tag} class="${cls || ""}">${html || ""}</${tag}>`;
  }

  function esc(str) {
    return String(str).replace(/"/g, "&quot;");
  }

  function heroTooltip(hero) {
    let t = `${hero.name} — ${Content.attrNames[hero.attr]}, сила ${hero.power}`;
    if (hero.ability) t += `\n✦ ${hero.ability.name}: ${abilityText(hero)}`;
    t += `\nЦвет рамки = атрибут: 5 карт одного цвета собирают флеш «Тимфайт атрибута»`;
    return esc(t);
  }

  const ABILITY_TEXT = {
    morphling: "копирует атрибут героя слева",
    pudge: "50%: вернётся в руку при сбросе",
    pa: "50%: ×2 множитель в комбо",
    juggernaut: "в слоте 1: +8 силы",
    zeus: "рядом INT-герой: +2 множителя",
    axe: "сет (ганг): +10 силы",
    cm: "сброс: +2 золота",
  };

  function abilityText(hero) {
    return ABILITY_TEXT[hero.id] || hero.ability.name;
  }

  function cardHtml(card, opts = {}) {
    const hero = Content.heroes.byId[card.heroId];
    const cls = [
      "card",
      "attr-" + hero.attr,
      opts.selected ? "selected" : "",
      opts.inDiscardMode ? "discard-mode" : "",
      opts.static ? "static" : "",
      card.illusion ? "illusion" : "",
    ].join(" ");
    return `<div class="${cls}" ${opts.static ? "" : `data-action="select" data-uid="${card.uid}"`} title="${heroTooltip(hero)}">
      <div class="card-art">${Art.heroArt(hero)}</div>
      <div class="card-top">
        <span class="power-gem">${hero.power}</span>
        ${hero.ability ? '<span class="ability-dot" title="У героя есть способность — детали в тултипе и в превью боя">✦</span>' : ""}
      </div>
      <div class="card-name-strip">${hero.name}</div>
    </div>`;
  }

  function itemsStrip(state, shopMode) {
    const items = state.player.items.map((id) => {
      const item = Content.items.byId[id];
      const sell = shopMode
        ? `<button class="btn small danger" data-action="sell" data-id="${id}">Продать +${Economy.sellValue(id)}</button>`
        : "";
      return `<div class="item-chip" title="${esc(item.name + ": " + item.desc)}">
        ${Art.itemIcon(item)}<span>${item.name}</span>${sell}
      </div>`;
    });
    return items.length ? items.join("") : `<span class="muted">предметов нет</span>`;
  }

  // ---------- Screens ----------

  function renderTitle(state) {
    app().innerHTML = h("div", "title-screen", `
      ${h("div", "logo", "DALATRO")}
      ${h("div", "tagline", "Дота × покер × Balatro")}
      <div class="title-card-demo">
        ${cardHtml({ heroId: "morphling" }, { static: true })}
        ${cardHtml({ heroId: "axe" }, { static: true })}
        ${cardHtml({ heroId: "pa" }, { static: true })}
      </div>
      <div class="seed-row">
        <input id="seed-input" placeholder="Seed (пусто = случайный)" maxlength="12">
        <button class="btn primary" data-action="start">Начать забег</button>
      </div>
      ${h("div", "how-to", `
        ${h("div", "how-title", "Как играть")}
        ${h("div", "how-lines", `
          <div>Выбирай 1–5 героев — это твой тимфайт. Лучшее покерное комбо = урон по башне.</div>
          <div><b>Сила × Множитель</b>. Пара — дуо, сет — ганг, флеш — тимфайт атрибута, фулл-хаус — 4 protect 1.</div>
          <div>Порядок клика = порядок в бою: позиции важны. Превью справа показывает весь стек до нажатия «В бой».</div>
          <div><b>Цвет рамки карты = атрибут</b>: пять карт одного цвета собирают флеш. ✦ — у героя есть способность (детали по наведению).</div>
          <div>Оверкилл конвертируется в золото, точный ласт-хит даёт бонус. 4 боя на волну, 3 ТП на сбросы.</div>
          <div>Между волнами — секретный шоп: 5 предметов, редкости, локи и панель билда. Провал = −1 казарма.</div>
        `)}
      `)}
    `);
  }

  function headerHtml(state) {
    const barracks = Array.from({ length: 6 }, (_, i) =>
      `<span class="barrack ${i < state.run.barracks ? "alive" : "dead"}" title="Казармы: 6 жизней забега"></span>`
    ).join("");
    return h("div", "header", `
      ${h("div", "header-left", `
        <span class="seed" title="Seed забега — тем же seedом можно повторить забег">DALATRO-${state.seedCode}</span>
        ${h("div", "barracks-row", barracks)}
      `)}
      ${h("div", "header-right", `
        <span class="gold">💰 ${state.run.gold}</span>
        <button class="btn small" data-action="debug-toggle" title="Debug-песочница (клавиша D)">⚙</button>
        <button class="btn small" data-action="abandon" title="Бросить забег и начать новый">⏏</button>
      `)}
    `);
  }

  function towerZoneHtml(state) {
    const wave = state.combat.wave;
    const hpPct = Math.max(0, Math.round((wave.hp / wave.maxHp) * 100));
    const badges = (wave.modifiers || []).map((m) => {
      const def = Content.modifiers.byId[m.id];
      const used = m.id === "aegis" && wave.aegisUsed;
      return `<span class="mod-badge ${used ? "used" : ""}" title="${esc(def.desc)}">${used ? "☑" : "☠"} ${def.name}</span>`;
    }).join("");
    const enemyRapier = (wave.enemyItems || []).includes("rapier")
      ? `<span class="mod-badge enemy-rapier" title="Враг держит Divine Rapier: твой урон ×0.5">⚔️ враг держит Рапиру</span>`
      : "";
    const glyphWarn = (wave.modifiers || []).some((m) => m.id === "glyph") && state.combat.fightIndex % 3 === 2
      ? h("div", "glyph-warn", "⚠ Glyph заблокирует этот бой — отправляй минимальный отряд!")
      : "";
    return `
      ${h("div", `tower-zone ${wave.isBoss ? "boss" : ""}`, `
        ${h("div", "tower-emoji", wave.emoji)}
        ${h("div", "tower-info", `
          ${h("div", "tower-name", `${wave.name}${wave.isBoss ? " — БОСС" : ""}`)}
          <div class="hp-bar"><div class="hp-fill" style="width:${hpPct}%"></div></div>
          ${h("div", "hp-text", `${Math.max(0, wave.hp)} / ${wave.maxHp}`)}
          <div class="mod-row">${badges}${enemyRapier}</div>
        `)}
      `)}
      ${glyphWarn}
    `;
  }

  function slotsHtml(state) {
    const slots = [];
    for (let i = 0; i < Combat.MAX_SLOTS; i++) {
      const uid = state.combat.selectedUids[i];
      if (uid) {
        slots.push(`<div class="slot filled">${cardHtml({ heroId: state.cards[uid].heroId }, { static: true })}</div>`);
      } else {
        slots.push(`<div class="slot">${h("div", "slot-num", i + 1)}</div>`);
      }
    }
    return h("div", "slots-row", slots.join(""));
  }

  function lotteryNote(state) {
    const notes = [];
    if (state.player.items.includes("daedalus")) notes.push("Daedalus 25% ×2");
    const paPlayed = state.combat.selectedUids.some((uid) => state.cards[uid].heroId === "pa");
    if (paPlayed) notes.push("PA 50% ×2");
    return notes.join(", ");
  }

  function previewHtml(state, preview) {
    if (!preview) {
      return h("div", "preview-panel", `
        ${h("div", "panel-title", "Превью боя")}
        ${h("div", "muted preview-hint", "Выбери 1–5 героев из руки. Порядок клика = порядок в бою (позиции важны!).")}
      `);
    }
    const steps = preview.steps.map((st) =>
      h("div", "preview-step", `<span class="step-icon">${st.icon}</span><span>${st.label}</span>`)
    ).join("");
    const lottery = lotteryNote(state);
    const hpPct = Math.max(0, Math.round(((preview.towerHpAfter ?? state.combat.wave.hp) / state.combat.wave.maxHp) * 100));
    return h("div", "preview-panel", `
      ${h("div", "panel-title", "Превью боя")}
      <div class="preview-combo">${preview.combo.name}</div>
      ${h("div", "preview-damage", `${preview.damage}`)}
      ${h("div", "preview-damage-label", "урона")}
      ${h("div", "preview-math", `${preview.power} × ${round2(preview.mult)}${preview.damage && preview.power ? " → башне останется " + Math.max(0, preview.towerHpAfter ?? 0) + " HP" : ""}`)}
      ${preview.goldGained ? h("div", "preview-gold", `+${preview.goldGained} 💰`) : ""}
      ${lottery ? h("div", "preview-lottery", `🎲 В бою возможны: ${lottery}`) : ""}
      <div class="preview-hpbar"><div class="hp-fill" style="width:${hpPct}%"></div></div>
      ${h("div", "preview-steps", steps || h("div", "muted", "модификаторов нет"))}
    `);
  }

  function debugPanelHtml(state) {
    if (!UIState.debugOpen) return "";
    const deckOrder = state.player.deckUids.map((uid) => Content.heroes.byId[state.cards[uid].heroId].name).join(", ") || "—";
    const logTail = state.log.slice(-24).map((l) => `<div>${esc(l)}</div>`).join("");
    return h("div", "debug-panel", `
      ${h("div", "debug-title", "DEBUG SANDBOX")}
      <div class="debug-buttons">
        <button class="btn small" data-action="debug-gold">+1000 💰</button>
        <button class="btn small" data-action="debug-fights">+5 боёв</button>
        <button class="btn small" data-action="debug-tower">−100 HP башни</button>
        <button class="btn small" data-action="debug-kill">убить башню</button>
        <button class="btn small" data-action="debug-draw">добить руку</button>
        <button class="btn small" data-action="debug-reveal">колода</button>
      </div>
      ${state.debugReveal ? h("div", "debug-deck", "Колода: " + esc(deckOrder)) : ""}
      ${h("div", "debug-log", logTail || '<div class="muted">лог пуст</div>')}
    `);
  }

  function outcomeModalHtml(state) {
    const outcome = state.combat.outcome;
    if (!outcome) return "";
    const res = state.combat.lastResolution;
    if (outcome === "cleared") {
      return h("div", "modal-backdrop", h("div", "modal", `
        ${h("div", "modal-title win", "✔ Волна зачищена!")}
        <div class="reward-row">Зачистка: <b>+${Game.WAVE_CLEAR_GOLD} 💰</b></div>
        ${res && res.goldGained ? `<div class="reward-row">Оверкилл / ласт-хит: <b>+${res.goldGained} 💰</b></div>` : ""}
        ${state.combat.wave.isBoss ? h("div", "reward-row", "Рошан повержен!") : ""}
        <button class="btn primary" data-action="enter-shop">В магазин →</button>
      `));
    }
    return h("div", "modal-backdrop", h("div", "modal", `
      ${h("div", "modal-title lose", "✖ Пуш провален")}
      <div class="reward-row">Казарма разрушена: <b>−1</b> (осталось ${state.run.barracks})</div>
      ${state.player.items.includes("rapier") || (state.combat.wave.enemyItems || []).includes("rapier")
        ? h("div", "reward-row rapier-note", "⚔️ Враг подобрал твою Divine Rapier! Урон по этой башне ×0.5, пока он её держит.") : ""}
      <button class="btn primary" data-action="retry">Новая попытка</button>
    `));
  }

  function renderWave(state) {
    const fightsDots = Array.from({ length: 4 }, (_, i) =>
      `<span class="fight-dot ${i < 4 - state.player.fightsLeft ? "spent" : ""}"></span>`).join("");
    const handCards = state.player.handUids.map((uid) =>
      cardHtml(state.cards[uid], { selected: state.combat.selectedUids.includes(uid), inDiscardMode: UIState.discardMode })
    ).join("");
    const canFight = !state.combat.outcome && state.player.fightsLeft > 0 && state.combat.selectedUids.length > 0 && !UIState.discardMode;
    const canDiscard = !state.combat.outcome && state.player.discardsLeft > 0 && UIState.discardMode && state.combat.selectedUids.length > 0;
    const preview = computePreview(state);

    app().innerHTML = `
      ${headerHtml(state)}
      ${h("div", "wave-label", `Волна ${state.run.waveIndex + 1} / ${Content.waves.order.length}`)}
      ${towerZoneHtml(state)}
      ${h("div", "main-row", `
        ${h("div", "board", `
          ${slotsHtml(state)}
          ${h("div", "hand", handCards)}
          ${h("div", "controls", `
            ${UIState.discardMode
        ? `<button class="btn primary ${canDiscard ? "" : "disabled"}" data-action="discard">🗑 Сбросить (${state.combat.selectedUids.length})</button>
               <button class="btn" data-action="toggle-discard">Отмена</button>`
        : `<button class="btn primary big ${canFight ? "" : "disabled"}" data-action="fight">⚔ В БОЙ</button>
               <button class="btn ${state.player.discardsLeft > 0 && !state.combat.outcome ? "" : "disabled"}" data-action="toggle-discard">🗑 ТП-сброс (${state.player.discardsLeft})</button>`}
          `)}
          ${h("div", "status-row", `
            <span title="Осталось боёв до провала волны">Бои: ${fightsDots}</span>
            <span title="Карты в колоде / сбросе">🂠 ${state.player.deckUids.length} / 🗑 ${state.player.discardUids.length}</span>
            ${h("span", "items-inline", itemsStrip(state, false))}
          `)}
        `)}
        ${previewHtml(state, preview)}
      `)}
      ${debugPanelHtml(state)}
      ${outcomeModalHtml(state)}
    `;
  }

  // ---------- Shop: 5 offers, rarities, locks, build panel, inspect panel ----------

  function shopOfferHtml(offer, state) {
    const item = Content.items.byId[offer.id];
    const afford = state.run.gold >= item.cost;
    return `<div class="shop-item rar-border-${item.rarity} ${offer.locked ? "locked" : ""}" data-inspect="${item.id}" data-action="inspect">
      <div class="shop-item-head">
        ${Art.itemIcon(item)}
        <button class="btn tiny lock-btn ${offer.locked ? "locked" : ""}" data-action="lock" data-id="${item.id}" title="Зафиксировать предмет при реролле">${offer.locked ? "🔒" : "🔓"}</button>
      </div>
      ${h("div", "shop-item-name", item.name)}
      <div class="chip-row">
        <span class="chip rar-${item.rarity}">${RARITY_NAMES[item.rarity]}</span>
        <span class="chip cat-${item.category}">${CATEGORY_NAMES[item.category]}</span>
      </div>
      ${h("div", "shop-item-desc", item.desc)}
      <div class="shop-item-cost">${item.cost} 💰</div>
      <button class="btn ${afford ? "primary" : "disabled"}" data-action="buy" data-id="${item.id}">Купить</button>
    </div>`;
  }

  function buildPanelHtml(state) {
    const builds = Advisor.analyzeBuilds(state);
    const rows = builds.map((b) => `
      <div class="build-row" title="${esc(b.hint)}">
        <div class="build-head"><span>${b.name}</span><span class="build-frac">${b.have}/${b.need}</span></div>
        <div class="build-bar"><div class="build-fill" style="width:${b.pct}%"></div></div>
      </div>`).join("");
    return h("div", "side-panel", `
      ${h("div", "panel-title", "Твой билд")}
      ${rows || h("div", "muted", "Купи героев-синергий и предметы — направления появятся здесь")}
      ${h("div", "build-foot muted", "Наведи на предмет справа, чтобы увидеть, что он даст именно твоему забегу")}
    `);
  }

  function inspectPanelHtml(state) {
    const item = UIState.inspectedId ? Content.items.byId[UIState.inspectedId] : null;
    if (!item) {
      return h("div", "side-panel", `
        ${h("div", "panel-title", "Лупа")}
        ${h("div", "muted", "Кликни или наведи на предмет в шопе — здесь появится его разбор: правила, синергии и что он изменит в твоём билде.")}
      `);
    }
    const synergies = Advisor.itemSynergy(item.id, state);
    const owned = state.player.items.includes(item.id);
    return h("div", "side-panel inspect", `
      ${h("div", "panel-title", "Разбор предмета")}
      <div class="inspect-head">${Art.itemIcon(item)} ${h("div", "inspect-name", item.name)}</div>
      <div class="chip-row">
        <span class="chip rar-${item.rarity}">${RARITY_NAMES[item.rarity]}</span>
        <span class="chip cat-${item.category}">${CATEGORY_NAMES[item.category]}</span>
        <span class="chip">💰 ${item.cost}</span>
        ${owned ? '<span class="chip owned">КУПЛЕН</span>' : ""}
      </div>
      ${h("div", "inspect-desc", item.desc)}
      ${synergies.length ? h("div", "inspect-synergies",
      h("div", "inspect-sub", "Что даст твоему забегу") +
      synergies.map((s) => h("div", "inspect-line", "• " + s)).join("")) : ""}
    `);
  }

  function renderShop(state) {
    const offers = state.shop.offers.map((o) => shopOfferHtml(o, state)).join("");
    const canReroll = state.run.gold >= Economy.REROLL_COST;
    const lockedCount = state.shop.offers.filter((o) => o.locked).length;
    app().innerHTML = `
      ${headerHtml(state)}
      ${h("div", "shop-title", "🏪 Секретный шоп")}
      ${h("div", "shop-layout", `
        ${h("div", "shop-main", `
          ${h("div", "shop-grid", offers)}
          ${h("div", "shop-controls", `
            <button class="btn ${canReroll ? "" : "disabled"}" data-action="reroll">🔄 Реролл (${Economy.REROLL_COST} 💰)${lockedCount ? ` — локов: ${lockedCount}` : ""}</button>
            <button class="btn primary big" data-action="leave-shop">В бой →</button>
          `)}
          ${h("div", "owned-row", `${h("div", "owned-label", "Твои предметы:")} ${itemsStrip(state, true)}`)}
        `)}
        ${h("div", "shop-side", buildPanelHtml(state) + inspectPanelHtml(state))}
      `)}
      ${debugPanelHtml(state)}
    `;
  }

  function renderGameover(state) {
    app().innerHTML = h("div", "end-screen", `
      ${h("div", "end-emoji", "💀")}
      ${h("div", "end-title lose", "ТРОН РАЗРУШЕН")}
      ${h("div", "end-sub", `Seed: DALATRO-${state.seedCode} — тот же seed даст тот же забег`)}
      ${h("div", "end-stats", `
        <div>Пройдено волн: ${state.run.waveIndex}</div>
        <div>Всего урона: ${state.stats.totalDamage}</div>
        <div>Самый жирный бой: ${state.stats.biggestHit}</div>
      `)}
      <button class="btn primary big" data-action="restart">Новый забег</button>
    `);
  }

  function renderVictory(state) {
    app().innerHTML = h("div", "end-screen", `
      ${h("div", "end-emoji", "🏆")}
      ${h("div", "end-title win", "ROSHAN ПОВЕРЖЕН — ТИ ВЗЯТ")}
      ${h("div", "end-sub", `Seed: DALATRO-${state.seedCode}`)}
      ${h("div", "end-stats", `
        <div>Всего урона: ${state.stats.totalDamage}</div>
        <div>Самый жирный бой: ${state.stats.biggestHit}</div>
        <div>Казарм осталось: ${state.run.barracks} / 6</div>
      `)}
      ${h("div", "muted", "Акт 2: новые боссы, Tinker, Techies, Aghanim — скоро (см. ROADMAP.md)")}
      <button class="btn primary big" data-action="restart">Новый забег</button>
    `);
  }

  function computePreview(state) {
    if (state.phase !== "wave" || state.combat.outcome) return null;
    if (!state.combat.selectedUids.length || state.player.fightsLeft <= 0) return null;
    const clone = Sim.simulate(state, { type: "CONFIRM_FIGHT" });
    return clone ? clone.combat.lastResolution : null;
  }

  function round2(v) {
    return Math.round(v * 100) / 100;
  }

  // ---------- Fight animation: replays the resolution stack (same object used by preview) ----------

  function playFightAnimation(resolution, onDone) {
    const overlay = document.createElement("div");
    overlay.className = "fight-overlay";
    overlay.innerHTML = `
      <div class="fight-box">
        ${h("div", "fight-combo", resolution.combo.name)}
        <div class="fight-steps"></div>
        ${h("div", "fight-damage", resolution.blocked ? "ГЛИФ!" : `${resolution.damage}`)}
        ${h("div", "fight-hint", "клик — пропустить")}
      </div>
    `;
    document.body.appendChild(overlay);

    const stepsEl = overlay.querySelector(".fight-steps");
    const damageEl = overlay.querySelector(".fight-damage");
    let timers = [];
    let finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
      overlay.remove();
      onDone();
    }
    overlay.addEventListener("click", finish);

    resolution.steps.forEach((step, i) => {
      timers.push(setTimeout(() => {
        const el = document.createElement("div");
        el.className = "preview-step appear";
        el.innerHTML = `<span class="step-icon">${step.icon}</span><span>${step.label}</span>`;
        stepsEl.appendChild(el);
      }, 150 + i * 300));
    });
    const damageAt = 400 + resolution.steps.length * 300;
    timers.push(setTimeout(() => damageEl.classList.add("show"), damageAt));
    timers.push(setTimeout(finish, damageAt + 1200));
  }

  // ---------- entry ----------

  function render(state) {
    switch (state.phase) {
      case "title": return renderTitle(state);
      case "wave": return renderWave(state);
      case "shop": return renderShop(state);
      case "victory": return renderVictory(state);
      case "gameover": return renderGameover(state);
    }
  }

  // Returns true if the inspected item changed (caller re-renders).
  function setInspected(itemId) {
    if (UIState.inspectedId === itemId) return false;
    UIState.inspectedId = itemId;
    return true;
  }

  return { render, playFightAnimation, UIState, setInspected };
})();
