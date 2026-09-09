// Dalatro — UI v3 ("lane" edition). Reads state, renders DOM, dispatches
// actions via data-attributes. Never a source of truth: State -> Render.
// Layout: topbar → run-bar → [sidebar | play-area | combos panel] → footer.
const UI = (function () {
  const FIGHTS = Game.FIGHTS_PER_WAVE;
  const DISCARDS = Game.DISCARDS_PER_WAVE;
  const BARRACKS = Game.BARRACKS_MAX;

  const ATTR_SYMBOLS = { str: "◆", agi: "✦", int: "✺", uni: "◈" };
  const ATTR_NAMES = Content.attrNames;

  const COMBO_META = {
    high_card: { poker: "Старшая карта", rule: "Любой герой" },
    pair: { poker: "Пара", rule: "2 героя одного ранга" },
    two_pair: { poker: "Две пары", rule: "Две пары рангов" },
    three: { poker: "Тройка", rule: "3 героя одного ранга" },
    straight: { poker: "Стрит", rule: "5 последовательных рангов" },
    flush: { poker: "Флеш", rule: "5 героев одного атрибута" },
    full_house: { poker: "Фулл-хаус", rule: "Тройка и пара" },
  };

  const ABILITY_TEXT = {
    morphling: "копирует атрибут героя слева — порядок важен",
    pudge: "50%: вернётся в руку при ТП-сбросе",
    pa: "50%: ×2 множителя в комбо",
    juggernaut: "в слоте 1: +8 силы",
    zeus: "рядом INT-герой: +2 множителя",
    axe: "комбо «Ганг»: +10 силы",
    cm: "ТП-сброс: +2 золота",
    // таверна (ростер)
    undying: "+2 силы за карту в сбросе (до 12)",
    ogre_magi: "25%: +3 к множителю",
    legion: "пара и выше: +12 силы",
    huskar: "+3 силы за разрушенную казарму",
    tidehunter: "5 героев: +2 множителя",
    meepo: "рядом AGI-герой: +6 силы",
    bounty: "точный ласт-хит: +8 золота",
    slark: "+4 силы за каждый ТП-сброс в этой волне",
    phantom_lancer: "все сыгранные — Ловкость: +3 множителя",
    anti_mage: "+4 силы за пустую позицию",
    faceless: "на волне босса: +2 множителя",
    oracle: "если он слабейший в бою: +10 силы",
    skywrath: "в одиночном рейде: ×2 к множителю",
    lina: "1–2 героя: +20 силы",
    invoker: "3+ разных атрибута: +3 множителя",
    storm_spirit: "в слоте 1: +9 силы",
    outworld: "3+ разных атрибута: +12 силы",
    io: "есть герой Силы: +6 силы",
    muerta: "в слоте 3: +8 силы",
    marci: "сосед другого атрибута: +8 силы",
    snapfire: "на последней позиции: +1 множитель",
    void_spirit: "если он сильнейший в бою: +8 силы",
    beastmaster: "+5 силы за героя своего ранга",
    tiny: "+3 силы за каждого сыгранного героя",
  };

  const RARITY_NAMES = { common: "Обычный", rare: "Редкий", epic: "Эпический" };

  const TIPS = [
    { t: "Маленькая синергия. Большая разница.", p: "Поставь Juggernaut первым — получишь +8 силы." },
    { t: "Morphling — хамелеон.", p: "Он копирует атрибут соседа слева: поставь его после Zeus, чтобы открыть его способность." },
    { t: "Ставка решает.", p: "Один герой — харас +1 золота. Пятёрка — ×1.25 к урону. Выбирай по ситуации." },
    { t: "Серия — золото.", p: "Импульс даёт +5% урона за каждую зачищенную волну подряд. Провал сбрасывает серию." },
    { t: "Точность платит.", p: "Оверкилл конвертируется в золото, а точный ласт-хит даёт +5 сверху." },
    { t: "Techies не прощают.", p: " bombs закрывают 2 карты руки. Sentry Ward или BKB обезвреживают их." },
  ];

  const UIState = {
    modal: null, // help | collection | settings | history | new | score | detail | null
    detail: null,
    collectionTab: "heroes",
    search: "",
    sort: "deal", // deal | rank | attr
    onboarding: false,
    onboardingStep: 0,
    motion: true,
    debugOpen: false,
    toast: "",
    tipIndex: Math.floor(Date.now() / 86400000) % TIPS.length,
    // Входные анимации играют только когда коллекция реально обновилась
    // (новая раздача, реролл, найм). Выбор карты — без «всплытия всего».
    animHand: false,
    animShop: false,
    animInv: false,
    animLab: false,
    animRoute: false,
  };

  // ---------- helpers ----------

  function h(tag, cls, html) {
    return `<${tag} class="${cls || ""}">${html || ""}</${tag}>`;
  }

  function esc(str) {
    return String(str).replace(/"/g, "&quot;");
  }

  function icon(name, size) {
    return Icons.icon(name, size);
  }

  function heroDesc(hero) {
    if (hero.ability) return ABILITY_TEXT[hero.id] || hero.ability.name;
    return "Без способности — играет через ранг и атрибут.";
  }

  function attrOf(state, uid) {
    return Content.heroes.byId[state.cards[uid].heroId].attr;
  }

  function rankOf(state, uid) {
    return Content.heroes.byId[state.cards[uid].heroId].power;
  }

  // Displayed hand order (respect sort). Selection and hotkeys use it.
  function handOrder(state) {
    const uids = state.player.handUids.slice();
    if (UIState.sort === "rank") uids.sort((a, b) => rankOf(state, b) - rankOf(state, a));
    if (UIState.sort === "attr") uids.sort((a, b) => attrOf(state, a).localeCompare(attrOf(state, b)));
    return uids;
  }

  function computePreview(state) {
    if (state.phase !== "wave" || state.combat.outcome) return null;
    if (!state.combat.selectedUids.length || state.player.fightsLeft <= 0) return null;
    const clone = Sim.simulate(state, { type: "CONFIRM_FIGHT" });
    return clone ? clone.combat.lastResolution : null;
  }

  // Which combos the CURRENT HAND could assemble (not just the selection).
  function handComboState(state) {
    const heroes = state.player.handUids.map((uid) => Content.heroes.byId[state.cards[uid].heroId]);
    const byRank = new Map();
    const byAttr = new Map();
    for (const hr of heroes) {
      byRank.set(hr.power, (byRank.get(hr.power) || 0) + 1);
      byAttr.set(hr.attr, (byAttr.get(hr.attr) || 0) + 1);
    }
    const counts = [...byRank.values()].sort((a, b) => b - a);
    const ranks = [...byRank.keys()].sort((a, b) => a - b);
    let run = 1;
    let straight = false;
    for (let i = 1; i < ranks.length; i++) {
      run = ranks[i] === ranks[i - 1] + 1 ? run + 1 : 1;
      if (run >= 5) straight = true;
    }
    return {
      pair: (counts[0] || 0) >= 2,
      two_pair: counts.filter((n) => n >= 2).length >= 2,
      three: (counts[0] || 0) >= 3,
      straight,
      flush: [...byAttr.values()].some((n) => n >= 5),
      full_house: (counts[0] || 0) >= 3 && counts[1] >= 2,
    };
  }

  // Подзаголовок под названием комбо/формации. У формаций нет покерного
  // эквивалента — читаем правило и тип урона (rules: "formation").
  function comboSubtitle(combo) {
    if (combo && combo.tier != null) {
      const dt = Content.damageTypeNames[combo.damageType] || combo.damageType;
      return `${combo.rule || ""} · ${dt} урон`;
    }
    const meta = combo ? COMBO_META[combo.type] : null;
    return meta ? `${meta.poker} · ${meta.rule}` : "Сила героев × множитель";
  }

  function toast(state, text) {
    UIState.toast = text;
    clearTimeout(UIState._toastTimer);
    UIState._toastTimer = setTimeout(() => {
      UIState.toast = "";
      if (window.__dalatroRerender) window.__dalatroRerender();
    }, 3600);
  }

  // ---------- shared blocks ----------

  function brandMark() {
    return '<svg viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="M4 5L30 3L33 30L6 33Z" stroke="currentColor" stroke-width="3"/><path d="M10 10L26 26M22 9L27 14M10 23L14 28" stroke="currentColor" stroke-width="4"/></svg>';
  }

  function heroRank(state, heroId) {
    return Game.rankOf(state, heroId);
  }

  function heroCardHtml(state, uid, index) {
    const hero = Content.heroes.byId[state.cards[uid].heroId];
    const rank = heroRank(state, hero.id);
    const selectedIdx = state.combat.selectedUids.indexOf(uid);
    const selected = selectedIdx !== -1;
    const mined = (state.combat.minedUids || []).includes(uid);
    const cls = [
      "hero-card",
      hero.attr,
      selected ? "selected" : "",
      mined ? "mined" : "",
    ].join(" ");
    const trained = rank !== hero.power;
    return `<button class="${cls}" ${mined ? "" : `data-action="select" data-uid="${uid}"`} aria-pressed="${selected}">
      ${selected ? `<span class="selection-order">${selectedIdx + 1}${icon("check", 10)}</span>` : ""}
      ${mined ? `<span class="mine-mark" title="💣 Заминировано Techies — эта карта не играет в текущем бою (Sentry Ward / BKB снимают мины)">${icon("bomb", 22)}</span>` : ""}
      <div class="hero-art">${Art.heroArt(hero)}<span class="hero-vignette"></span>
        <span class="hero-rank">${rank}</span>
        <span class="attribute-icon">${ATTR_SYMBOLS[hero.attr]}</span>
        <span class="hero-name">${hero.name}</span>
      </div>
      <div class="hero-card-bottom">
        <span class="hero-attribute">${ATTR_SYMBOLS[hero.attr]} ${ATTR_NAMES[hero.attr]}</span>
        <span class="hero-ability">${hero.ability ? hero.ability.name : "—"}</span>
        <div class="card-foot"><span>${rank} ${icon("zap", 10)}</span><kbd>${index + 1}</kbd></div>
      </div>
      <span class="hero-tooltip">
        <strong>${hero.ability ? hero.ability.name : hero.name}</strong>
        <p>${esc(heroDesc(hero))}</p>
        <small>Ранг ${rank}${trained ? ` (тренирован, база ${hero.power})` : ""} · ${ATTR_NAMES[hero.attr]} — 5 карт одного цвета = флеш</small>
      </span>
    </button>`;
  }

  function waveRuleRows(state) {
    const wave = state.combat.wave;
    const disarmed = state.player.items.includes("sentry") || state.player.items.includes("bkb");
    const rows = [];
    for (const m of wave.modifiers || []) {
      const def = Content.modifiers.byId[m.id];
      if (!def) continue;
      let text = "";
      let used = false;
      if (m.id === "armor") text = state.rules === "formation" ? "Укрепления: первый бой ×0.5" : "Броня: первый бой ×0.5";
      else if (m.id === "glyph") text = "Глиф: каждый 3-й бой = 0";
      else if (m.id === "mines") {
        used = disarmed;
        text = disarmed ? "Мины обезврежены Sentry/BKB" : "Мины: 2 карты руки закрыты";
      } else if (m.id === "aegis") text = wave.aegisUsed ? "Aegis потрачен" : "Aegis: возрождение с 50% HP";
      else if (def.curse) {
        used = state.player.items.includes("bkb");
        text = used ? `${def.name}: обезврежено BKB` : `${def.name}: ${def.desc}`;
      }
      rows.push(`<div class="wave-rule ${used ? "done" : ""} ${def.curse && !used ? "danger" : ""}">${icon("shield", 13)}<span>${text}</span></div>`);
    }
    if (state.rules === "formation") {
      // Третья ось: числовая защита цели — телеграфируется до боя.
      const d = Content.towerDefense.byId[wave.towerId];
      if (d && (d.armor || d.mr)) {
        const bkb = state.player.items.includes("bkb");
        const parts = [];
        if (d.armor) parts.push(`броня ${d.armor}`);
        if (d.mr) parts.push(`сопротивление ${Math.round(d.mr * 100)}%`);
        rows.push(`<div class="wave-rule ${bkb ? "done" : ""}">${icon("shield", 13)}<span>Защита: ${parts.join(" · ")}${bkb ? " — снимает BKB" : ""}</span></div>`);
      }
    }
    if (wave.elite) {
      rows.push(`<div class="wave-rule momentum">${icon("sparkles", 13)}<span>Элитная добыча: золото ×1.5, эпик в лавке</span></div>`);
    }
    if ((wave.enemyItems || []).includes("rapier")) {
      rows.push(`<div class="wave-rule danger">${icon("zap", 13)}<span>Враг держит Рапиру: твой урон ×0.5</span></div>`);
    }
    const mom = state.run.momentum || 0;
    if (mom > 0) {
      const mult = (1 + Math.min(mom, Combat.MOMENTUM_CAP) * Combat.MOMENTUM_STEP).toFixed(2).replace(/0$/, "");
      rows.push(`<div class="wave-rule momentum">${icon("flame", 13)}<span>Импульс ×${mult} — серия ${mom} волн</span></div>`);
    }
    if ((wave.modifiers || []).some((m) => m.id === "glyph") && state.combat.fightIndex % 3 === 2 && !state.player.items.includes("bkb")) {
      rows.push(`<div class="wave-rule danger">${icon("skull", 13)}<span>Этот бой заблокирует глиф — играй минимальный отряд!</span></div>`);
    }
    return rows.join("");
  }

  function sidebarHtml(state) {
    const wave = state.combat.wave;
    const hpPct = Math.max(0, Math.round((wave.hp / wave.maxHp) * 100));
    const isBoss = !!wave.isBoss;
    const ruleText = wave.isBoss ? "Aegis: возрождение с 50% HP" : "Постройка Света";
    void ruleText;
    const faction = isBoss || wave.miniBoss ? "БОСС АКТА" : "ПОСТРОЙКА СВЕТА";
    return `
    <section class="encounter-panel panel">
      <div class="section-label"><span>ТЕКУЩАЯ ЦЕЛЬ</span><span class="wave-badge">${state.run.waveIndex + 1} / ${Content.waves.order.length}</span></div>
      <div class="tower-emblem ${isBoss ? "boss" : ""}">${isBoss || wave.miniBoss ? icon("skull", 37) : icon("castle", 37)}<span class="emblem-ring"></span></div>
      <span class="enemy-faction">${faction}</span>
      <h2>${wave.name}${wave.miniBoss ? " — мини-босс" : ""}</h2>
      <div class="target-health">${icon("heart", 13)}<strong>${Math.max(0, wave.hp).toLocaleString("ru")}</strong><span>/ ${wave.maxHp.toLocaleString("ru")}</span></div>
      <div class="health-track"><div style="width:${hpPct}%"></div></div>
      ${waveRuleRows(state)}
      <div class="reward-row"><span>Награда за победу</span><b>${icon("coins", 14)}${Game.WAVE_CLEAR_GOLD}+</b></div>
    </section>
    <section class="resource-panel panel">
      <div class="resource-stat"><span>${icon("swords", 13)}Тимфайты</span><strong class="mint">${state.player.fightsLeft}<small> / ${FIGHTS}</small></strong>
        <div class="resource-pips">${Array.from({ length: FIGHTS }, (_, i) => `<i class="${i < state.player.fightsLeft ? "filled mint-bg" : ""}"></i>`).join("")}</div></div>
      <div class="resource-stat"><span>${icon("rotate", 13)}ТП-сбросы</span><strong class="blue">${state.player.discardsLeft}<small> / ${DISCARDS}</small></strong>
        <div class="resource-pips">${Array.from({ length: DISCARDS }, (_, i) => `<i class="${i < state.player.discardsLeft ? "filled blue-bg" : ""}"></i>`).join("")}</div></div>
    </section>
    <section class="economy-panel panel">
      <div><span>${icon("coins", 15)}Твоё золото</span><strong class="gold">${state.run.gold}<small> G</small></strong></div>
      <div><span>${icon("castle", 15)}Казармы</span><div class="lives">${Array.from({ length: BARRACKS }, (_, i) =>
      `<span class="${i < state.run.barracks ? "alive" : ""}" title="Казармы: ${BARRACKS} жизней забега">${icon("shield", 13)}</span>`).join("")}</div></div>
    </section>
    <section class="journal-panel panel">
      <div class="section-label"><span>${icon("history", 13)}ЖУРНАЛ БОЯ</span><button class="icon-button small" data-action="open-modal" data-modal="history" title="Весь журнал">${icon("maximize", 12)}</button></div>
      <div class="journal-entries">${state.log.slice(-3).reverse().map((entry, i) =>
      `<div class="${i === 0 ? "latest" : ""}"><span class="log-dot"></span><p>${esc(entry)}</p></div>`).join("")}</div>
      <button class="text-button" data-action="open-modal" data-modal="history">Вся история ${icon("arrow", 12)}</button>
    </section>
    <button class="combo-guide" data-action="open-modal" data-modal="help">
      <div class="guide-icon">${icon("book", 18)}</div>
      <span><strong>Знание — сила</strong><small>Что дают цифры и цвета</small></span>${icon("chevron", 15)}
    </button>`;
  }

  function inventoryHtml(state) {
    const slots = [];
    const items = state.player.items;
    for (let i = 0; i < Math.max(5, items.length); i++) {
      const id = items[i];
      if (id) {
        const item = Content.items.byId[id];
        slots.push(`<button class="item-slot ${item.rarity === "epic" ? "legendary" : ""}" data-action="item-open" data-id="${id}" title="${esc(item.name + ": " + item.desc)}">
          <div class="item-art">${Art.itemIcon(item)}</div>
          <span><strong>${item.name}</strong><small>${esc(item.desc)}</small></span>
          <span class="item-slot-dot"></span>
        </button>`);
      } else {
        slots.push(`<button class="item-slot empty-slot" data-action="item-hint"><span>${icon("plus", 18)}</span><span>Слот предмета</span></button>`);
      }
    }
    return `<section class="inventory-panel panel">
      <div class="inventory-heading">
        <div class="section-label"><span>${icon("bag", 14)}ТВОЙ БИЛД</span><span class="slot-count">${items.length} <span>слотов</span></span></div>
        <span class="inventory-help">Предметы меняют правила игры ${icon("sparkles", 11)}</span>
      </div>
      <div class="inventory-slots ${UIState.animInv ? "" : "no-anim"}">${slots.join("")}</div>
    </section>`;
  }

  function battlefieldHtml(state, preview) {
    const max = Game.maxSlots(state);
    const slots = Array.from({ length: max }, (_, i) => {
      const uid = state.combat.selectedUids[i];
      const hero = uid ? Content.heroes.byId[state.cards[uid].heroId] : null;
      return `<div class="formation-slot ${hero ? "occupied" : ""}" ${uid ? `title="${esc(hero.name)} — слот ${i + 1}"` : ""}>${hero ? Art.heroArt(hero) : icon("plus", 14)}<span>${i + 1}</span></div>`;
    }).join("");
    return `<section class="battlefield" id="battlefield">
      <div class="battlefield-shade"></div>
      <div class="battlefield-content">
        <div class="battlefield-eyebrow"><span class="live-dot"></span>БОЕВОЕ ПОЛЕ <span>/</span> ВОЛНА ${state.run.waveIndex + 1}</div>
        <h2>Сломай их оборону.</h2>
        <p>Не просто герои. Твоя победная комбинация.</p>
        <div class="formation"><div class="formation-cards">${slots}</div>
          <span class="formation-note">Порядок выбора —<br/>порядок в бою</span></div>
      </div>
      <div class="arena-label"><span class="radial-dot"></span><span>ТЕРРИТОРИЯ СВЕТА</span></div>
      <div class="enemy-mark">${icon("target", 17)}</div>
    </section>`;
  }

  function handSectionHtml(state) {
    const order = handOrder(state);
    const sortBtn = (mode, label) =>
      `<button class="sort-button ${UIState.sort === mode ? "active" : ""}" data-action="sort" data-mode="${mode}">${label}</button>`;
    return `<section class="hand-section">
      <div class="hand-heading">
        <div><h2>Твоя рука <span>${state.player.handUids.length}<small> / ${DeckSys.HAND_SIZE}</small></span></h2>
          <span class="hand-instruction">Выбери до ${Game.maxSlots(state)} героев для тимфайта</span></div>
        <div class="hand-tools"><span>Сортировка</span>
          ${sortBtn("rank", `${icon("sort", 12)}Сила`)}${sortBtn("attr", "Атрибут")}${sortBtn("deal", "Раздача")}
          <button class="deck-button" data-action="open-collection-deck" title="Посмотреть колоду">${icon("layers", 17)}<span>${state.player.deckUids.length}</span></button>
        </div>
      </div>
      <div class="hero-hand ${UIState.animHand ? "" : "no-anim"}">${order.map((uid, i) => heroCardHtml(state, uid, i)).join("")}</div>
      <div class="under-hand">
        <span><span class="selection-dot"></span>Выбрано <strong>${state.combat.selectedUids.length} / ${Combat.MAX_SLOTS}</strong>
          ${state.combat.selectedUids.length ? '<button data-action="clear-selection">Снять выбор</button>' : ""}</span>
        <span><kbd>1</kbd>–<kbd>${DeckSys.HAND_SIZE}</kbd> выбрать героя <span class="keyboard-divider">·</span> наведи, чтобы узнать способность</span>
      </div>
    </section>`;
  }

  function commitInfoHtml(state, preview) {
    const chips = [];
    const n = preview ? preview.playedCount || state.combat.selectedUids.length : 0;
    const tier = Combat.COMMIT_TIERS[n];
    if (tier) {
      chips.push(tier.finalMult !== 1
        ? `<span class="commit-chip">СТАВКА ×${tier.finalMult}</span>`
        : `<span class="commit-chip neutral">ХАРАС +${tier.gold}G</span>`);
    }
    const mom = state.run.momentum || 0;
    if (mom > 0) {
      const mult = (1 + Math.min(mom, Combat.MOMENTUM_CAP) * Combat.MOMENTUM_STEP).toFixed(2).replace(/0$/, "");
      chips.push(`<span class="commit-chip momentum">ИМПУЛЬС ×${mult}</span>`);
    }
    return chips.length ? `<div class="commit-row">${chips.join("")}</div>` : "";
  }

  function playControlsHtml(state, preview) {
    const combo = preview ? preview.combo : null;
    const power = preview ? preview.power : 0;
    const mult = preview ? Math.round(preview.mult * 100) / 100 : 0;
    const damage = preview ? preview.damage : 0;
    const canFight = preview && !state.combat.outcome && state.player.fightsLeft > 0;
    const canDiscard = state.combat.selectedUids.length > 0 && state.player.discardsLeft > 0 && !state.combat.outcome;
    return `<section class="play-controls panel">
      <button class="combo-preview" data-action="${preview ? "open-score" : "open-modal"}" ${preview ? "" : 'data-modal="help"'}>
        <span class="section-label">${preview ? (combo && combo.tier != null ? "ТВОЯ ФОРМАЦИЯ" : "ТВОЯ КОМБИНАЦИЯ") : "ТВОЙ СЛЕДУЮЩИЙ ХОД"}</span>
        <strong>${combo ? combo.name : "Собери тимфайт"} ${icon("chevron", 14)}</strong>
        <small>${combo ? comboSubtitle(combo) : "Сила героев × множитель"}</small>
      </button>
      <div class="score-formula">
        <div class="score-block power"><strong>${power}</strong><span>СИЛА</span></div>
        <span class="times">${icon("x", 14)}</span>
        <div class="score-block multiplier"><strong>${mult}</strong><span>МНОЖ.</span></div>
        <span class="equals">=</span>
        <div class="total-score"><strong>${damage.toLocaleString("ru")}</strong><span>УРОНА</span></div>
      </div>
      ${commitInfoHtml(state, preview)}
      <div class="action-buttons">
        <button class="primary-button attack-button" ${canFight ? "" : "disabled"} data-action="fight">${icon("swords", 17)}В бой<kbd>↵</kbd></button>
        <button class="discard-button" ${canDiscard ? "" : "disabled"} data-action="discard">${icon("rotate", 14)}ТП-сброс<kbd>R</kbd></button>
      </div>
    </section>`;
  }

  function strategyTipHtml() {
    const tip = TIPS[UIState.tipIndex];
    return `<div class="strategy-tip">${icon("sparkles", 14)}<p><strong>${tip.t}</strong> ${tip.p}</p>
      <button data-action="next-tip">Ещё совет ${icon("arrow", 12)}</button></div>`;
  }

  function combosPanelHtml(state) {
    if (state.rules === "formation") return formationsPanelHtml(state);
    const preview = state.phase === "wave" ? computePreview(state) : null;
    const current = preview ? preview.combo.type : null;
    const ready = state.phase === "wave" ? handComboState(state) : {};
    const rows = Content.combos.list.map((c) => {
      const meta = COMBO_META[c.id];
      const cls = c.id === current ? "hit" : ready[c.id] ? "ready" : "";
      return `<div class="combo-row ${cls}" title="${esc(meta.rule + " · " + c.basePower + " силы × " + c.baseMult + " множитель")}">
        <div class="combo-row-name"><strong>${c.name}</strong><small>${meta.poker}</small></div>
        <div class="combo-row-rule">${meta.rule}</div>
        <div class="combo-row-value"><b class="mint">${c.basePower}</b><span>×</span><b class="gold">${c.baseMult}</b></div>
      </div>`;
    }).join("");
    return `<aside class="combos-panel">
      <section class="panel combos-panel-inner">
        <div class="section-label"><span>${icon("book", 13)}КОМБИНАЦИИ</span>
          <button class="icon-button small" data-action="open-modal" data-modal="help" title="Справочник: что дают цифры и атрибуты">${icon("help", 13)}</button></div>
        <div class="combo-rows">${rows}</div>
        <div class="combo-legend">
          <span><i class="dot hit"></i>собрано</span>
          <span><i class="dot ready"></i>есть в руке</span>
        </div>
      </section>
    </aside>`;
  }

  // rules: "formation" — список формаций + активные связки + альтернативы
  // текущего выбора с итоговым уроном (панель заменяет покерные комбинации).
  function formationsPanelHtml(state) {
    const preview = state.phase === "wave" ? computePreview(state) : null;
    const combo = preview ? preview.combo : null;
    const dtName = (dt) => Content.damageTypeNames[dt] || dt;
    const rows = Content.formations.list.map((f) => {
      const cls = combo && combo.type === f.id ? "hit" : "";
      return `<div class="combo-row ${cls}" title="${esc(f.rule + " · " + dtName(f.damageType) + " урон")}">
        <div class="combo-row-name"><strong>${f.name}</strong><small>${dtName(f.damageType)}${f.positional ? " · порядок" : ""}</small></div>
        <div class="combo-row-rule">${f.rule}</div>
        <div class="combo-row-value"><b class="mint">${f.basePower}</b><span>×</span><b class="gold">${f.baseMult}</b></div>
      </div>`;
    }).join("");
    let bondsHtml = "";
    if (combo && combo.bonds && combo.bonds.length) {
      bondsHtml = `<div class="section-label" style="margin-top:12px"><span>${icon("sparkles", 13)}АКТИВНЫЕ СВЯЗКИ</span></div>
        <div class="combo-rows">${combo.bonds.map((b) => {
        const val = [b.power ? `+${b.power} силы` : "", b.mult ? `+${b.mult} множ.` : ""].filter(Boolean).join(", ");
        return `<div class="combo-row hit"><div class="combo-row-name"><strong>${b.trait}</strong></div><div class="combo-row-rule">${val}</div></div>`;
      }).join("")}</div>`;
    }
    let altHtml = "";
    if (combo && combo.alternatives && combo.alternatives.length > 1) {
      altHtml = `<div class="section-label" style="margin-top:12px"><span>${icon("target", 13)}АЛЬТЕРНАТИВЫ ПРОТИВ ЦЕЛИ</span></div>
        <div class="combo-rows">${combo.alternatives.slice(0, 4).map((f) =>
        `<div class="combo-row ${f.id === combo.type ? "hit" : ""}">
            <div class="combo-row-name"><strong>${f.name}</strong><small>${dtName(f.damageType)}</small></div>
            <div class="combo-row-value"><b class="gold">${f.damage}</b><span>урона</span></div>
          </div>`).join("")}</div>
        <div class="combo-legend"><span>Переставляй героев — формация и урон меняются</span></div>`;
    }
    return `<aside class="combos-panel">
      <section class="panel combos-panel-inner">
        <div class="section-label"><span>${icon("book", 13)}ФОРМАЦИИ</span>
          <button class="icon-button small" data-action="open-modal" data-modal="help" title="Справочник: формации, связки, типы урона">${icon("help", 13)}</button></div>
        <div class="combo-rows">${rows}</div>
        <div class="combo-legend">
          <span><i class="dot hit"></i>собрано</span>
          <span>связки складываются все</span>
        </div>
        ${bondsHtml}
        ${altHtml}
      </section>
    </aside>`;
  }

  function footerHtml(state) {
    const names = ["T1", "T2", "T3", "TECHIES", "ROSHAN"];
    const steps = names.map((n, i) => {
      const cls = i === state.run.waveIndex ? "current" : i < state.run.waveIndex ? "complete" : "";
      const ico = i === names.length - 1 ? icon("skull", 12) : i < state.run.waveIndex ? icon("check", 11) : icon("castle", 12);
      return `<span class="${cls}">${ico}<span>${n}</span>${i < names.length - 1 ? "<i></i>" : ""}</span>`;
    }).join("");
    return `<footer class="footer">
      <div class="act-progress">${steps}</div>
      <span class="footer-tagline">Немного Dota. Немного покера. Ещё один забег.</span>
      <span class="footer-ver">DALATRO <span>v0.5</span></span>
    </footer>`;
  }

  // Выбор ядра скоринга (state.rules). Один и тот же блок на титульном экране
  // и в окне «Новый забег» — режим применяется к следующему запускаемому забегу.
  function rulesToggleHtml(active) {
    const rules = active === "formation" ? "formation" : "classic";
    return `<div class="title-rules">
      <button class="rule-choice ${rules === "classic" ? "active-rule" : ""}" data-action="toggle-rules" data-rules="classic">
        <strong>Классика</strong>
        <small>Покерные комбо: пары, сеты, стриты. Сила × множитель = урон.</small>
      </button>
      <button class="rule-choice ${rules === "formation" ? "active-rule" : ""}" data-action="toggle-rules" data-rules="formation">
        <strong>Формации <span class="rule-beta">эксперимент</span></strong>
        <small>Строй тимфайт: порядок слотов решает, связки складываются все, урон встречает броню башни.</small>
      </button>
    </div>`;
  }

  function runBarHtml(state) {
    return `<section class="run-bar">
      <div class="run-heading"><span class="live-dot"></span><h1>Твой забег</h1>
        <span class="run-id">#DL–${esc(state.seedCode)}</span><span class="run-divider"></span>
        <span class="act-pill ${state.rules === "formation" ? "rules-formation" : ""}" title="Ядро скоринга этого забега">${state.rules === "formation" ? icon("target", 12) : icon("leaf", 12)} ${state.rules === "formation" ? "ФОРМАЦИИ" : "КЛАССИКА"}</span>
        <span class="act-pill">${icon("leaf", 12)} АКТ ${state.run.act}</span>
        <span class="act-name">На линии</span></div>
      <div class="run-tools">
        <span class="autosave">${icon("check", 12)}Прогресс сохранён</span>
        <button class="subtle-button" data-action="open-modal" data-modal="new">${icon("rotate", 13)}Новый забег</button>
        <button class="subtle-button" data-action="debug-toggle" title="Debug-песочница (клавиша D)">⚙</button>
      </div>
    </section>`;
  }

  // ---------- screens ----------

  function renderTitle(state) {
    const rules = UIState.rulesDraft === "formation" ? "formation" : "classic";
    app().innerHTML = `
    <div class="title-screen">
      <div class="title-bg"></div>
      <div class="title-inner">
        <a class="brand big">${brandMark()}<span>DALATRO<span class="brand-dot">.</span></span></a>
        <p class="title-caption">DOTA В КАРТАХ.<br/>ВЕЗЕНИЕ — В ТВОИХ РУКАХ.</p>
        <div class="title-formula">
          <div class="score-block power"><strong>69</strong><span>СИЛА</span></div>
          <span class="times">${icon("x", 14)}</span>
          <div class="score-block multiplier"><strong>6</strong><span>МНОЖ.</span></div>
          <span class="equals">=</span>
          <div class="total-score"><strong>414</strong><span>УРОНА</span></div>
        </div>
        ${rulesToggleHtml(UIState.rulesDraft)}
        <div class="seed-row">
          <input id="seed-input" placeholder="Seed (пусто = случайный)" maxlength="12">
          <button class="primary-button" data-action="start">Начать забег ${icon("arrow", 15)}</button>
        </div>
        <div class="title-links">
          <button class="subtle-button" data-action="onboard-start">${icon("book", 13)}Как играть — 5 шагов</button>
          <span class="keyboard-divider">·</span>
          <span class="title-hint">${rules === "formation" ? "Собирай формации из героев Dota: порядок слотов решает" : "Собирай покерные комбинации из героев Dota и сноси башни"}</span>
        </div>
      </div>
    </div>`;
  }

  // ---------- route fork: три тропы после лавки ----------

  function routeCardHtml(state, kind, cls, emoji, title, lines, foot, disabled) {
    return `<button class="route-card ${cls} ${disabled ? "disabled" : ""}" data-action="take-route" data-kind="${kind}" ${disabled ? "disabled" : ""}>
      <span class="route-emoji">${emoji}</span>
      <strong>${title}</strong>
      <div class="route-lines">${lines.map((l) => `<span>${l}</span>`).join("")}</div>
      <small>${foot}</small>
    </button>`;
  }

  function renderRoute(state) {
    const nextIndex = state.run.waveIndex + 1;
    const nextDef = Content.waves.byId[Content.waves.order[nextIndex]];
    const curse = state.combat.route ? Content.modifiers.byId[state.combat.route.curse] : null;
    const baseRules = (nextDef.modifiers || []).map((m) => Content.modifiers.byId[m.id].name).join(" · ") || "без модификаторов";
    const campDisabled = state.combat.campTaken;
    app().innerHTML = `
      ${topbarHtml(state)}
      <main class="page-shell">
        ${runBarHtml(state)}
        <div class="game-layout">
          <aside class="sidebar">${sidebarHtml(state)}</aside>
          <div class="play-area">
            <section class="route-screen panel">
              <span class="section-label mint">${icon("target", 15)}РАЗВИЛКА · ВОЛНА ${nextIndex + 1} ИЗ ${Content.waves.order.length}</span>
              <h2>Куда двинемся?</h2>
              <p class="route-sub">Следующая цель: <b>${nextDef.name}</b> · ${nextDef.hp} HP · ${baseRules}</p>
              <div class="route-cards ${UIState.animRoute ? "" : "no-anim"}">
                ${routeCardHtml(state, "normal", "normal", "🗼", "Обычная башня", [
                  `${nextDef.name} · ${nextDef.hp} HP`,
                  baseRules,
                  "Полный темп забега",
                ], "Честный бой")}
                ${routeCardHtml(state, "elite", "elite", "💀", "Элитная башня", [
                  `HP ×1.5 → ${Math.round(nextDef.hp * 1.5)} HP`,
                  `Проклятие: ${curse ? curse.name : "—"} — ${curse ? curse.desc : ""}`,
                  "Награда: золото ×1.5 и эпик в лавке",
                ], "Риск · награда")}
                ${routeCardHtml(state, "camp", "camp", "🏕️", "Крип-лагерь", [
                  "Бой пропускается",
                  "+6 золота и привал: +1 казарма",
                  "Бесплатное увольнение героя в лавке",
                ], campDisabled ? "Лагерь уже зачищен" : "Безопасный темп", campDisabled)}
              </div>
              ${curse ? `<div class="route-curse">Проклятие элитки выбрано заранее: <b>${curse.name}</b> — ${esc(curse.desc)} BKB игнорирует любые проклятия.</div>` : ""}
            </section>
          </div>
          ${combosPanelHtml(state)}
        </div>
        ${footerHtml(state)}
      </main>
      ${debugPanelHtml(state)}
      ${overlayHtml(state)}
      ${toastHtml()}
    `;
    UIState.animRoute = false;
  }

  function renderWave(state) {
    const preview = computePreview(state);
    app().innerHTML = `
      ${topbarHtml(state)}
      <main class="page-shell">
        ${runBarHtml(state)}
        <div class="game-layout">
          <aside class="sidebar">${sidebarHtml(state)}</aside>
          <div class="play-area">
            ${inventoryHtml(state)}
            ${battlefieldHtml(state, preview)}
            ${handSectionHtml(state)}
            ${playControlsHtml(state, preview)}
            ${strategyTipHtml()}
          </div>
          ${combosPanelHtml(state)}
        </div>
        ${footerHtml(state)}
      </main>
      ${debugPanelHtml(state)}
      ${outcomeModalHtml(state)}
      ${overlayHtml(state)}
      ${toastHtml()}
    `;
    UIState.animHand = false;
    UIState.animInv = false;
  }

  function renderShop(state) {
    const nextId = Content.waves.order[state.run.waveIndex + 1];
    const next = nextId ? Content.waves.byId[nextId] : null;
    const nextRule = next ? waveRuleText(next) : "";
    const offers = state.shop.offers.map((o) => {
      const item = Content.items.byId[o.id];
      const afford = state.run.gold >= item.cost;
      return `<div class="shop-card ${item.rarity === "epic" ? "legendary" : ""}" data-action="item-open" data-id="${item.id}" title="Клик — полный разбор предмета">
        <div class="shop-card-top">
          <span class="rarity">${RARITY_NAMES[item.rarity]}</span>
          <button class="icon-button small lock-btn ${o.locked ? "locked" : ""}" data-action="lock" data-id="${item.id}" title="Зафиксировать предмет при реролле">${o.locked ? "🔒" : "🔓"}</button>
        </div>
        <div class="shop-card-art">${Art.itemIcon(item)}</div>
        <h3>${item.name}</h3>
        <p>${esc(item.desc)}</p>
        <button class="buy-button" ${afford ? "" : "disabled"} data-action="buy" data-id="${item.id}">
          <span>${afford ? "Купить" : "Дорого"}</span><span>${item.cost} ${icon("coins", 13)}</span>
        </button>
      </div>`;
    }).join("");
    app().innerHTML = `
      ${topbarHtml(state)}
      <main class="page-shell">
        ${runBarHtml(state)}
        <div class="game-layout">
          <aside class="sidebar">${sidebarHtml(state)}</aside>
          <div class="play-area">
            ${inventoryHtml(state)}
            <section class="shop panel">
              <div class="shop-banner">
                <div class="shop-emblem">${icon("bag", 30)}</div>
                <div><span class="section-label gold">ЛИНИЯ ЗАЧИЩЕНА</span><h2>Тайная лавка</h2>
                  <p>Хороший предмет усиливает руку. Отличный — меняет весь билд.</p></div>
                <span class="shop-gold">${icon("coins", 24)}${state.run.gold}</span>
              </div>
              <div class="shop-section-title"><h3>Предметы торговца</h3>
                <button class="secondary-button" data-action="reroll" ${state.run.gold >= Economy.REROLL_COST ? "" : "disabled"}>${icon("rotate", 13)}Обновить <span>${Economy.REROLL_COST} ${icon("coins", 12)}</span></button></div>
              <div class="shop-items ${UIState.animShop ? "" : "no-anim"}">${offers || '<div class="empty-shop">Всё раскуплено. Обнови товары или отправляйся в бой.</div>'}</div>
              <div class="shop-lab">
                <div class="shop-lab-head">
                  <h3>${icon("layers", 14)} Лаборатория колоды</h3>
                  <button class="secondary-button" data-action="open-collection-deck" title="Увольнение и тренировка героев">${state.run.campBoon ? "Уволить бесплатно 🏕️" : `Уволить героя · ${Game.EXILE_COST} ${icon("coins", 12)}`}</button>
                </div>
                <div class="recruit-row ${UIState.animLab ? "" : "no-anim"}">
                  ${(state.shop.recruits || []).length ? state.shop.recruits.map((heroId) => {
      const hr = Content.heroes.byId[heroId];
      const price = Game.recruitPrice(heroId);
      const afford = state.run.gold >= price;
      return `<div class="recruit-card ${hr.attr}" title="${esc(`${hr.name} — ${ATTR_NAMES[hr.attr]}, сила ${hr.power}. ${heroDesc(hr)}`)}">
                      <div class="recruit-portrait">${Art.heroArt(hr)}<b>${hr.power}</b></div>
                      <div class="recruit-info"><strong>${hr.name}</strong>
                        <span class="hero-attribute">${ATTR_SYMBOLS[hr.attr]} ${ATTR_NAMES[hr.attr]}</span>
                        <small>${heroDesc(hr)}</small></div>
                      <button class="buy-button recruit-buy" ${afford ? "" : "disabled"} data-action="buy-recruit" data-id="${heroId}">
                        <span>Нанять</span><span>${price} ${icon("coins", 13)}</span>
                      </button>
                    </div>`;
    }).join("") : '<span class="muted-note">Таверна пуста — все ростерные герои уже у тебя.</span>'}
                </div>
                <small class="shop-hint left">Нанятые герои попадают в колоду. В коллекции (вкладка «Колода») можно тренировать героев: +1 ранг за ${Game.TRAIN_COST} 💰.</small>
              </div>
              <div class="shop-bottom">
                <div><span class="section-label">СЛЕДУЮЩАЯ ЦЕЛЬ</span>
                  <strong>${next ? next.name : "—"} ${next ? `<span>· ${next.hp} HP</span>` : ""}</strong>
                  <small>${nextRule}</small></div>
                <button class="primary-button" data-action="leave-shop">Следующая волна ${icon("arrow", 17)}</button>
              </div>
              <p class="shop-hint">Нажми на свой предмет в билде сверху, чтобы продать его за половину цены.</p>
            </section>
          </div>
          ${combosPanelHtml(state)}
        </div>
        ${footerHtml(state)}
      </main>
      ${debugPanelHtml(state)}
      ${overlayHtml(state)}
      ${toastHtml()}
    `;
    UIState.animShop = false;
    UIState.animInv = false;
    UIState.animLab = false;
  }

  function waveRuleText(def) {
    const map = {
      armor: "Первая атака наносит половину урона",
      glyph: "Каждый 3-й бой блокируется глифом",
      mines: "Минирует 2 карты руки каждый бой — Sentry/BKB решают",
      aegis: "Возрождается с половиной здоровья",
    };
    const mods = (def.modifiers || []).map((m) => map[m.id] || m.id);
    return mods.length ? mods.join(" · ") : "Без модификаторов";
  }

  function renderVictory(state) {
    endScreen(state, true);
  }

  function renderGameover(state) {
    endScreen(state, false);
  }

  function endScreen(state, won) {
    app().innerHTML = `
      ${topbarHtml(state)}
      <main class="page-shell">
        ${runBarHtml(state)}
        <div class="game-layout">
          <aside class="sidebar">${sidebarHtml(state)}</aside>
          <div class="play-area">
            <section class="end-screen panel">
              <div class="end-emblem">${won ? icon("crown", 64) : icon("skull", 64)}</div>
              <span class="section-label">${won ? "ДРЕВНИЙ ПАЛ" : "КРЕПОСТЬ РАЗРУШЕНА"}</span>
              <h2>${won ? "Это был легендарный забег." : "Каждый конец — новая раздача."}</h2>
              <p>${won
      ? `${Content.waves.order.length} волн. Один невероятный билд. Серия: ${state.run.momentum || 0} волн импульса.`
      : "Попробуй другой билд: ставка, импульс и контры боссов решают."}</p>
              <div class="end-stats">
                <div><strong>${state.run.waveIndex + (won ? 1 : 0)}</strong><span>Волн пройдено</span></div>
                <div><strong>${state.stats.totalDamage.toLocaleString("ru")}</strong><span>Всего урона</span></div>
                <div><strong>${state.stats.biggestHit.toLocaleString("ru")}</strong><span>Лучший тимфайт</span></div>
              </div>
              <button class="primary-button" data-action="open-modal" data-modal="new">${icon("rotate", 16)}Ещё один забег</button>
            </section>
          </div>
          ${combosPanelHtml(state)}
        </div>
        ${footerHtml(state)}
      </main>
      ${overlayHtml(state)}
      ${toastHtml()}
    `;
  }

  function topbarHtml(state) {
    const inModal = UIState.modal !== null;
    return `<header class="topbar">
      <a class="brand" data-action="nav-play">${brandMark()}<span>DALATRO<span class="brand-dot">.</span></span></a>
      <div class="brand-divider"></div>
      <span class="brand-caption">DOTA В КАРТАХ.<br/>ВЕЗЕНИЕ — В ТВОИХ РУКАХ.</span>
      <nav class="main-nav">
        <button class="${!inModal ? "active" : ""}" data-action="nav-play">${icon("swords", 16)}Играть</button>
        <button class="${UIState.modal === "collection" ? "active" : ""}" data-action="open-collection">${icon("layers", 16)}Коллекция</button>
        <button class="${UIState.modal === "help" ? "active" : ""}" data-action="open-modal" data-modal="help">${icon("book", 16)}Как играть</button>
      </nav>
      <div class="header-right">
        <span class="version">BETA <span>0.5</span></span>
        <button class="icon-button" data-action="toggle-sound" title="${Sfx.isMuted() ? "Включить звук" : "Выключить звук"}">${Sfx.isMuted() ? icon("mute", 18) : icon("volume", 18)}</button>
        <button class="icon-button" data-action="open-modal" data-modal="settings" title="Настройки">${icon("settings", 18)}</button>
      </div>
    </header>`;
  }

  // ---------- overlays: outcome / modals / onboarding / toast ----------

  function outcomeModalHtml(state) {
    const outcome = state.combat.outcome;
    if (!outcome) return "";
    const res = state.combat.lastResolution;
    if (outcome === "cleared") {
      const mom = state.run.momentum || 0;
      return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true">
        <div class="outcome-emblem win">${icon("check", 44)}</div>
        <span class="section-label mint">ВОЛНА ЗАЧИЩЕНА</span>
        <h2>${state.combat.wave.isBoss ? "Рошан повержен!" : "Башня пала."}</h2>
        <div class="outcome-rows">
          <div><span>Зачистка</span><b>${icon("coins", 13)}+${Game.WAVE_CLEAR_GOLD}</b></div>
          ${res && res.goldGained ? `<div><span>Оверкилл / ласт-хит</span><b>${icon("coins", 13)}+${res.goldGained}</b></div>` : ""}
          ${mom > 0 ? `<div><span>Импульс</span><b class="momentum-text">${icon("flame", 13)}${mom} волн подряд</b></div>` : ""}
        </div>
        <button class="primary-button full-width" data-action="enter-shop">В тайную лавку ${icon("arrow", 15)}</button>
      </section></div>`;
    }
    return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true">
      <div class="outcome-emblem lose">${icon("skull", 44)}</div>
      <span class="section-label lose-text">ПУШ ПРОВАЛЕН</span>
      <h2>Казарма разрушена</h2>
      <div class="outcome-rows">
        <div><span>Осталось казарм</span><b>${state.run.barracks} / ${BARRACKS}</b></div>
        <div><span>Импульс</span><b class="lose-text">серия сброшена</b></div>
        ${state.player.items.includes("rapier") || (state.combat.wave.enemyItems || []).includes("rapier")
        ? `<div><span>Divine Rapier</span><b class="lose-text">у врага: урон ×0.5</b></div>` : ""}
      </div>
      <button class="primary-button full-width" data-action="retry">Новая попытка ${icon("rotate", 15)}</button>
    </section></div>`;
  }

  function debugPanelHtml(state) {
    if (!UIState.debugOpen) return "";
    const deckOrder = state.player.deckUids.map((uid) => Content.heroes.byId[state.cards[uid].heroId].name).join(", ") || "—";
    const logTail = state.log.slice(-24).map((l) => `<div>${esc(l)}</div>`).join("");
    return `<div class="debug-panel">
      <div class="debug-title">DEBUG SANDBOX</div>
      <div class="debug-buttons">
        <button class="btn small" data-action="debug-gold">+1000 💰</button>
        <button class="btn small" data-action="debug-fights">+5 боёв</button>
        <button class="btn small" data-action="debug-tower">−100 HP</button>
        <button class="btn small" data-action="debug-kill">убить башню</button>
        <button class="btn small" data-action="debug-draw">добить руку</button>
        <button class="btn small" data-action="debug-reveal">колода</button>
      </div>
      ${state.debugReveal ? `<div class="debug-deck">Колода: ${esc(deckOrder)}</div>` : ""}
      <div class="debug-log">${logTail || '<div class="muted-note">лог пуст</div>'}</div>
    </div>`;
  }

  function toastHtml() {
    if (!UIState.toast) return "";
    return `<div class="toast" role="status">${icon("sparkles", 16)}${esc(UIState.toast)}
      <button data-action="close-toast">${icon("x", 13)}</button></div>`;
  }

  // ---------- modals ----------

  function overlayHtml(state) {
    if (UIState.onboarding) return onboardingHtml();
    if (!UIState.modal && !UIState.detail) return "";
    const wide = UIState.modal === "collection" || UIState.modal === "help" ? "wide-modal" : "";
    return `<div class="modal-backdrop" data-action="modal-backdrop"><section class="modal ${wide}" role="dialog" aria-modal="true">
      <button class="modal-close icon-button" data-action="close-modal">${icon("x", 20)}</button>
      ${modalBodyHtml(state)}
    </section></div>`;
  }

  function onboardingSteps() {
    return [
      {
        title: "Цифра — это сила героя",
        icon: "zap",
        body: "Ранг (число на карте) добавляется к силе тимфайта. Одинаковые ранги собирают комбинации: две пятёрки — «Дуо», три — «Ганг». Соседние ранги (7-8-9-10-11) собирают «Смок» — стрит.",
        demo: "ranks",
      },
      {
        title: "Цвет — это атрибут",
        icon: "sparkles",
        body: "Атрибут — это цвет рамки: Сила ◆, Ловкость ✦, Интеллект ✺, Универсал ◈. Пять героев одного цвета собирают флеш «Тимфайт атрибута». Способности тоже смотрят на цвета: Zeus даёт +2 множителя рядом с INT-героем.",
        demo: "attrs",
      },
      {
        title: "Порядок клика — позиции в бою",
        icon: "target",
        body: "Кого выбрал первым — тот стоит в слоте 1. Juggernaut даёт +8 силы только из первого слота. Morphling копирует атрибут соседа слева: поставь его справа от нужного героя.",
        demo: "slots",
      },
      {
        title: "Сила × Множитель = урон",
        icon: "swords",
        body: "Комбинация даёт базу и множитель, герои и предметы добавляют своё. Умножение — и башня получает урон. Превью перед боем показывает весь расчёт шаг за шагом.",
        demo: "formula",
      },
      {
        title: "Ставка, импульс и развилки",
        icon: "flame",
        body: "1 герой — харас (+1 золото), 4 героя — ×1.1, 5 героев — ×1.25 к урону. Зачищай волны подряд: серия даёт +5% урона. После каждой лавки — развилка: обычная башня, элитка с проклятием (жирнее награда) или крип-лагерь (+6 золота, +1 казарма). В лавке — таверна: нанимай новых героев в колоду.",
        demo: "risk",
      },
    ];
  }

  function onboardingDemoHtml(demo) {
    const mini = (heroId, opts = {}) => {
      const hero = Content.heroes.byId[heroId];
      return `<span class="demo-card ${hero.attr} ${opts.dim ? "dim" : ""}"><b>${hero.power}</b><i>${ATTR_SYMBOLS[hero.attr]}</i><em>${hero.name}</em></span>`;
    };
    if (demo === "ranks") {
      return `<div class="demo-row">${mini("axe")}${mini("zeus")}<span class="demo-eq">→</span><span class="demo-combo">Дуо на линии<small>пара · 10 × 2</small></span></div>
        <div class="demo-row">${mini("pudge")}${mini("sven")}${mini("pa")}${mini("centaur")}${mini("primal")}<span class="demo-eq">→</span><span class="demo-combo">Смок на Рошана<small>стрит 7–11</small></span></div>`;
    }
    if (demo === "attrs") {
      return `<div class="demo-attrs">
        <span class="demo-attr str">◆ Сила — стойкость и флеш Силы</span>
        <span class="demo-attr agi">✦ Ловкость — криты и морфы</span>
        <span class="demo-attr int">✺ Интеллект — множители</span>
        <span class="demo-attr uni">◈ Универсал — джокер в стрите</span></div>
        <div class="demo-row">${mini("tusk")}${mini("axe")}${mini("pudge")}${mini("sven")}${mini("centaur")}<span class="demo-eq">→</span><span class="demo-combo">Тимфайт атрибута<small>флеш · 35 × 4</small></span></div>`;
    }
    if (demo === "slots") {
      const j = Content.heroes.byId.juggernaut;
      const m = Content.heroes.byId.morphling;
      const z = Content.heroes.byId.zeus;
      return `<div class="demo-slots">
        <span class="demo-slot">1 ${mini("juggernaut")}<em>+8 силы</em></span>
        <span class="demo-slot">2 ${mini("zeus")}<em>+2 множ.</em></span>
        <span class="demo-slot">3 ${mini("morphling")}<em>копирует INT</em></span>
        <span class="demo-slot empty">4</span>
        <span class="demo-slot empty">5</span></div>`;
    }
    if (demo === "formula") {
      return `<div class="title-formula left">
        <div class="score-block power"><strong>69</strong><span>СИЛА</span></div>
        <span class="times">${icon("x", 14)}</span>
        <div class="score-block multiplier"><strong>6</strong><span>МНОЖ.</span></div>
        <span class="equals">=</span>
        <div class="total-score"><strong>414</strong><span>УРОНА</span></div></div>
        <p class="demo-note">Фулл-хаус «4 Protect 1»: 40 базы + 29 от героев = 69 силы, ×6 множитель.</p>`;
    }
    return `<div class="demo-risk">
      <span class="demo-risk-item">${icon("coins", 15)}<b>1 герой</b><em>харас +1 золото</em></span>
      <span class="demo-risk-item">${icon("swords", 15)}<b>4 героя</b><em>×1.1 к урону</em></span>
      <span class="demo-risk-item">${icon("swords", 15)}<b>5 героев</b><em>×1.25 к урону</em></span>
      <span class="demo-risk-item gold">${icon("flame", 15)}<b>Серия волн</b><em>+5% урона за волну</em></span></div>`;
  }

  function onboardingHtml() {
    const steps = onboardingSteps();
    const step = steps[UIState.onboardingStep];
    const dots = steps.map((_, i) => `<i class="${i === UIState.onboardingStep ? "on" : i < UIState.onboardingStep ? "done" : ""}"></i>`).join("");
    const last = UIState.onboardingStep === steps.length - 1;
    return `<div class="modal-backdrop onboarding" data-action="modal-backdrop"><section class="modal onboarding-modal" role="dialog" aria-modal="true">
      <button class="modal-close icon-button" data-action="onboard-close">${icon("x", 20)}</button>
      <span class="section-label mint">${icon("book", 15)}ОНБОРДИНГ · ${UIState.onboardingStep + 1} / ${steps.length}</span>
      <h2>${step.title}</h2>
      <div class="onboarding-body">
        <div class="onboarding-demo">${onboardingDemoHtml(step.demo)}</div>
        <p class="modal-description">${step.body}</p>
      </div>
      <div class="onboarding-foot">
        <div class="dots">${dots}</div>
        <div class="onboarding-actions">
          ${UIState.onboardingStep > 0 ? `<button class="secondary-button" data-action="onboard-prev">Назад</button>` : ""}
          <button class="primary-button" data-action="${last ? "onboard-close" : "onboard-next"}">${last ? "В бой" : "Дальше"} ${icon("arrow", 15)}</button>
        </div>
      </div>
    </section></div>`;
  }

  function helpModalHtml(state) {
    const steps = onboardingSteps();
    const formationMode = state.rules === "formation";
    const comboRows = formationMode
      ? Content.formations.list.map((f) => `<div><span><strong>${f.name}</strong><small>${Content.damageTypeNames[f.damageType] || f.damageType}${f.positional ? " · порядок" : ""}</small></span><span>${f.rule}</span>
          <span><b class="mint">${f.basePower}</b><span class="table-x">✕</span><b class="gold">${f.baseMult}</b></span></div>`).join("")
      + Content.bonds.list.map((b) => {
        const val = [b.power ? `+${b.power} силы` : "", b.mult ? `+${b.mult} множ.` : ""].filter(Boolean).join(", ");
        return `<div><span><strong>Связка «${b.trait}»</strong><small>складывается</small></span><span>${val || "—"}</span>
          <span><b class="gold">${val}</b></span></div>`;
      }).join("")
      : Content.combos.list.map((c) => {
        const meta = COMBO_META[c.id];
        return `<div><span><strong>${c.name}</strong><small>${meta.poker}</small></span><span>${meta.rule}</span>
          <span><b class="mint">${c.basePower}</b><span class="table-x">✕</span><b class="gold">${c.baseMult}</b></span></div>`;
      }).join("");
    return `<span class="section-label mint">${icon("book", 15)}СПРАВОЧНИК</span>
      <h2>${formationMode ? "Формации. Порядок решает." : "Покерные правила. Дотовские привычки."}</h2>
      ${formationMode ? `<p class="modal-description">Формация — одна лучшая по итоговому урону против цели: часть правил читает порядок слотов. Связки активны все сразу и складываются. Тип урона встречается с защитой башни: физический — минус броня, магический — минус сопротивление, чистый — игнорирует всё. Альтернативы и связки видны в панели справа.</p>` : `
      <p class="modal-description">Собери до ${Combat.MAX_SLOTS} героев: ранг даёт силу и собирает комбо, атрибут (цвет) собирает флеш, порядок клика — позиции. Сила × множитель = урон по башне.</p>`}
      <div class="help-steps">${steps.map((s, i) => `<div><span>0${i + 1}</span><strong>${s.title}</strong><p>${s.body}</p></div>`).join("")}</div>
      <div class="combo-table">
        <div class="table-head"><span>КОМБИНАЦИЯ</span><span>УСЛОВИЕ</span><span>СИЛА ✕ МНОЖ.</span></div>
        ${comboRows}
      </div>
      <div class="help-note">${icon("help", 17)}<p><strong>Не нравится рука?</strong> ТП-сброс (R) заменит выбранных героев, не расходуя тимфайт. Сброс с Crystal Maiden приносит +2 золота. Оверкилл — золото, точный ласт-хит — ещё +5.</p></div>`;
  }

  function collectionModalHtml(state) {
    const tab = UIState.collectionTab;
    const search = UIState.search.toLowerCase();
    const tabs = [["heroes", "Герои", Content.heroes.deckIds.length], ["items", "Предметы", Content.items.list.length], ["deck", "Колода", state.player.handUids.length + state.player.deckUids.length + state.player.discardUids.length]]
      .map(([key, label, n]) => `<button class="${tab === key ? "active" : ""}" data-action="collection-tab" data-tab="${key}">${label}<span>${n}</span></button>`).join("");
    let grid = "";
    if (tab === "items") {
      grid = Content.items.list.filter((i) => (i.name + " " + i.desc).toLowerCase().includes(search)).map((item) =>
        `<button class="collection-item" data-action="item-open" data-id="${item.id}">
          <div class="collection-item-art">${Art.itemIcon(item)}</div>
          <div><strong>${item.name}</strong><p>${esc(item.desc)}</p><small class="gold">${item.cost} G · ${RARITY_NAMES[item.rarity]}</small></div>
          ${state.player.items.includes(item.id) ? `<span class="mint">${icon("check", 15)}</span>` : ""}
        </button>`).join("");
    } else if (tab === "deck") {
      // Лаборатория: только нанятые/стартовые герои текущего забега.
      const ownedUids = [...state.player.handUids, ...state.player.deckUids, ...state.player.discardUids];
      const labMode = state.phase === "shop";
      const ownedHeroes = ownedUids
        .map((uid) => ({ uid, hero: Content.heroes.byId[state.cards[uid].heroId] }))
        .filter(({ hero }) => hero.name.toLowerCase().includes(search));
      // дедуп по герою (дублей нет, но на всякий случай)
      const seen = new Set();
      grid = ownedHeroes.filter(({ hero }) => !seen.has(hero.id) && seen.add(hero.id)).map(({ uid, hero: hr }) => {
        const where = state.player.handUids.includes(uid) ? "● В руке" : state.player.deckUids.includes(uid) ? "◈ В колоде" : "↺ В сбросе";
        const rank = heroRank(state, hr.id);
        const trained = rank !== hr.power;
        const canExile = ownedUids.length > Game.DECK_MIN && (state.run.campBoon || state.run.gold >= Game.EXILE_COST);
        const canTrain = rank < Game.TRAIN_RANK_MAX && state.run.gold >= Game.TRAIN_COST;
        return `<div class="collection-hero ${hr.attr}">
          <div class="collection-portrait">${Art.heroArt(hr)}<b>${rank}</b></div>
          <div><strong>${hr.name}${trained ? ` <span class="trained-badge">+${rank - hr.power} тренировка</span>` : ""}</strong>
            <span class="hero-attribute">${ATTR_SYMBOLS[hr.attr]} ${ATTR_NAMES[hr.attr]} · сила ${rank}</span>
            <p>${heroDesc(hr)}</p>
            <small class="gold">${where}</small>
            ${labMode ? `<div class="lab-actions">
              <button class="lab-button danger" data-action="exile" data-id="${hr.id}" ${canExile ? "" : "disabled"}
                title="${ownedUids.length <= Game.DECK_MIN ? "В колоде минимум 8 карт" : "Безвозвратное удаление из колоды"}">
                ${state.run.campBoon ? "Уволить бесплатно" : `Уволить · ${Game.EXILE_COST} G`}</button>
              <button class="lab-button" data-action="train" data-id="${hr.id}" ${canTrain ? "" : "disabled"}
                title="Постоянно +1 к рангу героя">Тренировать +1 · ${Game.TRAIN_COST} G</button>
            </div>` : ""}
          </div></div>`;
      }).join("");
    } else {
      const heroes = Content.heroes.list.filter((hr) => hr.name.toLowerCase().includes(search));
      grid = heroes.map((hr) => {
        const owned = [...state.player.handUids, ...state.player.deckUids, ...state.player.discardUids]
          .some((uid) => state.cards[uid].heroId === hr.id);
        return `<div class="collection-hero ${hr.attr}">
          <div class="collection-portrait">${Art.heroArt(hr)}<b>${hr.power}</b></div>
          <div><strong>${hr.name}</strong>
            <span class="hero-attribute">${ATTR_SYMBOLS[hr.attr]} ${ATTR_NAMES[hr.attr]}</span>
            <p>${heroDesc(hr)}</p>
            ${hr.inDeck ? "" : owned ? '<small class="mint">нанят</small>' : '<small>нанять можно в таверне (лавка)</small>'}
          </div></div>`;
      }).join("");
    }
    return `<span class="section-label mint">${icon("layers", 15)}КОЛЛЕКЦИЯ</span>
      <h2>${tab === "deck" ? (state.phase === "shop" ? "Лаборатория колоды" : "Твоя колода") : "Всё для идеального тимфайта"}</h2>
      <div class="collection-toolbar">
        <div class="tabs">${tabs}</div>
        <input aria-label="Поиск в коллекции" placeholder="Найти по имени..." value="${esc(UIState.search)}" data-action-input="search">
      </div>
      ${tab === "deck" ? `<div class="deck-summary"><span>В руке <b>${state.player.handUids.length}</b></span><span>В колоде <b>${state.player.deckUids.length}</b></span><span>В сбросе <b>${state.player.discardUids.length}</b></span></div>` : ""}
      <div class="collection-grid">${grid || '<div class="empty-search">Ничего не найдено. Попробуй другое имя.</div>'}</div>`;
  }

  function settingsModalHtml() {
    return `<span class="section-label mint">${icon("settings", 15)}НАСТРОЙКИ</span>
      <h2>Твой комфортный темп.</h2>
      <div class="setting-row"><div><strong>Звуки боя</strong><p>Короткий звуковой эффект при атаке</p></div>
        <button class="toggle ${Sfx.isMuted() ? "" : "on"}" data-action="toggle-sound" role="switch" aria-checked="${!Sfx.isMuted()}"><span></span></button></div>
      <div class="setting-row"><div><strong>Анимации</strong><p>Удары, подъём карт и эффекты урона</p></div>
        <button class="toggle ${UIState.motion ? "on" : ""}" data-action="toggle-motion" role="switch" aria-checked="${UIState.motion}"><span></span></button></div>
      <div class="settings-shortcuts"><h3>Горячие клавиши</h3>
        <p><span>Выбрать героя</span><kbd>1 – ${DeckSys.HAND_SIZE}</kbd></p>
        <p><span>Начать тимфайт</span><kbd>Enter</kbd></p>
        <p><span>ТП-сброс</span><kbd>R</kbd></p>
        <p><span>Debug-песочница</span><kbd>D</kbd></p>
        <p><span>Закрыть / снять выбор</span><kbd>Esc</kbd></p></div>
      <div class="muted-note">${icon("check", 13)} Забег автоматически сохраняется в этом браузере.</div>`;
  }

  function historyModalHtml(state) {
    return `<span class="section-label mint">${icon("history", 15)}ЖУРНАЛ БОЯ</span>
      <h2>История твоего забега</h2>
      <div class="history-summary">
        <span>Всего урона <strong>${state.stats.totalDamage.toLocaleString("ru")}</strong></span>
        <span>Лучший удар <strong>${state.stats.biggestHit.toLocaleString("ru")}</strong></span>
        <span>Импульс <strong>${state.run.momentum || 0}</strong></span></div>
      <div class="full-history">${state.log.slice().reverse().map((line, i) =>
      `<div><span>${String(state.log.length - i).padStart(2, "0")}</span><p>${esc(line)}</p></div>`).join("")}</div>`;
  }

  function newRunModalHtml() {
    const current = UIState.rulesDraft === "formation" ? "formation" : "classic";
    return `<div class="reset-icon">${icon("rotate", 28)}</div>
      <h2>Ещё один забег?</h2>
      <p class="modal-description">Текущий прогресс будет сброшен. Тот же seed — тот же забег: удачи можно проверить дважды.</p>
      <span class="section-label">ЯДРО СКОРИНГА НОВОГО ЗАБЕГА</span>
      ${rulesToggleHtml(current)}
      <input id="seed-input-modal" class="seed-modal-input" placeholder="Seed (пусто = случайный)" maxlength="12">
      <div class="modal-actions">
        <button class="secondary-button" data-action="close-modal">Продолжить текущий</button>
        <button class="primary-button" data-action="restart">Начать заново ${icon("arrow", 15)}</button>
      </div>`;
  }

  function scoreModalHtml(state) {
    const preview = computePreview(state);
    if (!preview) return "";
    return `<span class="section-label mint">${icon("zap", 15)}РАСЧЁТ ТИМФАЙТА</span>
      <h2>${preview.combo.name}</h2>
      <p class="modal-description">Порядок: комбинация → способности героев (по слотам) → предметы → ставка и импульс → модификаторы башни.</p>
      <div class="score-breakdown">${preview.steps.map((st, i) =>
      `<div><span>${st.icon || i + 1}</span><p>${esc(st.label)}</p></div>`).join("")}</div>
      <div class="breakdown-total"><span>${preview.power} силы × ${Math.round(preview.mult * 100) / 100}${preview.damage && preview.power ? ` → башне останется ${Math.max(0, preview.towerHpAfter ?? 0)} HP` : ""}</span>
        <strong>${preview.damage} <small>урона</small></strong></div>`;
  }

  function detailModalHtml(state) {
    const item = UIState.detail ? Content.items.byId[UIState.detail] : null;
    if (!item) return "";
    const synergies = Advisor.itemSynergy(item.id, state);
    const owned = state.player.items.includes(item.id);
    const inShop = state.phase === "shop";
    const sellValue = Economy.sellValue(item.id);
    return `<div class="item-detail-image">${Art.itemIcon(item)}</div>
      <span class="section-label gold">${RARITY_NAMES[item.rarity]} предмет · ${item.cost} G</span>
      <h2>${item.name}</h2>
      <p class="modal-description">${esc(item.desc)}</p>
      ${synergies.length ? `<div class="detail-synergies"><span class="section-label">ЧТО ДАСТ ТВОЕМУ ЗАБЕГУ</span>
        ${synergies.map((s) => `<div class="inspect-line">${icon("sparkles", 11)} ${esc(s)}</div>`).join("")}</div>` : ""}
      <div class="detail-tip">${icon("sparkles", 18)}<p>Предмет действует на каждый тимфайт. Его вклад виден в превью и в расчёте (кнопка с названием комбинации).</p></div>
      ${owned && inShop
      ? `<button class="secondary-button full-width" data-action="sell" data-id="${item.id}">Продать за ${sellValue} ${icon("coins", 14)}</button>`
      : owned ? '<div class="muted-note">Продажа доступна в лавке между волнами.</div>' : ""}`;
  }

  function modalBodyHtml(state) {
    switch (UIState.modal) {
      case "help": return helpModalHtml(state);
      case "collection": return collectionModalHtml(state);
      case "settings": return settingsModalHtml();
      case "history": return historyModalHtml(state);
      case "new": return newRunModalHtml();
      case "score": return scoreModalHtml(state);
      case "detail": return detailModalHtml(state);
      default: return "";
    }
  }

  // ---------- fight animation ----------

  function playFightAnimation(resolution, onDone) {
    const battlefield = document.getElementById("battlefield");
    if (battlefield && UIState.motion) {
      battlefield.classList.add("attacking");
      const burst = document.createElement("div");
      burst.className = "damage-burst";
      burst.innerHTML = resolution.blocked ? "ГЛИФ!" : `−${resolution.damage.toLocaleString("ru")}<small>УРОНА</small>`;
      battlefield.appendChild(burst);
      setTimeout(() => { burst.remove(); battlefield.classList.remove("attacking"); }, 1000);
    }
    const overlay = document.createElement("div");
    overlay.className = "fight-overlay";
    overlay.innerHTML = `
      <div class="fight-box">
        ${h("div", "fight-combo", resolution.combo.name)}
        <div class="fight-steps"></div>
        ${h("div", "fight-hint", "клик — пропустить")}
      </div>`;
    document.body.appendChild(overlay);
    const stepsEl = overlay.querySelector(".fight-steps");
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
        el.innerHTML = `<span class="step-icon">${step.icon}</span><span>${esc(step.label)}</span>`;
        stepsEl.appendChild(el);
      }, 150 + i * 280));
    });
    timers.push(setTimeout(finish, 500 + resolution.steps.length * 280 + 900));
  }

  // ---------- entry ----------

  function app() {
    return document.getElementById("app");
  }

  function render(state) {
    document.body.classList.toggle("reduced-motion", !UIState.motion);
    switch (state.phase) {
      case "title": return renderTitle(state);
      case "wave": return renderWave(state);
      case "route": return renderRoute(state);
      case "shop": return renderShop(state);
      case "victory": return renderVictory(state);
      case "gameover": return renderGameover(state);
    }
  }

  return { render, UIState, handOrder, playFightAnimation, toast };
})();
