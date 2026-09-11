// dotora — UI v4 ("decision" edition). Reads state, renders DOM, dispatches
// actions via data-attributes. Never a source of truth: State -> Render.
// Layout: topbar (with run meta) → [sidebar | battle scene | context] →
// bottom band (hand full-width / build) → footer.
// Центр — место принятия решения: цель + формула + приговор + CTA.
  const UI = (function () {
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
    tusk: "катится: +4 силы за каждого соседа по слоту",
    sven: "сильнейший в бою: ×1.5 множителя",
    centaur: "в слоте 1: +4 силы за каждого героя в бою",
    dawnbreaker: "+1 множитель за каждого Универсала",
    primal: "в центре пятёрки: ×2 множителя",
    terrorblade: "копирует атрибут соседа справа",
    rubick: "рядом INT-герой: +9 силы",
    kez: "средний по рангу в отряде: +10 силы",
    ancient_apparition: "на боссе: Aegis не сработает",
    kunkka: "в центре пятёрки при 4+ героях: +2 множителя",
    ursa: "сильнейший в бою: ×1.8 множителя",
    enigma: "создаёт иллюзию себя (50% силы)",
    tinker: "способности героев срабатывают дважды",
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
  const UPGRADE_RARITY_NAMES = { common: "Обычное", uncommon: "Необычное", rare: "Редкое", epic: "Эпическое", mythic: "Мифическое" };
  const SLOT_CLASS_NAMES = { off: "Атака", def: "Защита", util: "Утилита" };
  const SLOT_CLASS_ICONS = { off: "⚔", def: "🛡", util: "🔧" };

  // Короткие подписи правил лиги для пикера рангов (по id добавок).
  const RANK_MOD_LABELS = {
    mercy: "Милосердие: провал оставляет башне 70% HP",
    memory: "Память башен: тот же тип удара ×0.9",
    inflation: "Инфляция лавки: покупка в визите дороже на 1G",
    reroll3: "Реролл 3G",
    fatigue: "Усталость: каждые 5 боёв героя −1 к силе",
    unstable: "Нестабильная позиция: слот волны −40% силы",
    hand6: "Рука 6 карт",
    mutations1: "Мутации башен: 1 на волну",
    adaptive: "Адаптация мира: частое комбо ×0.85",
    antihero: "Охота на героя: фаворит −2 силы",
    capClass: "Лимит классов: ≤2 атаки / 2 защиты / 2 утилиты",
    discards2: "ТП-сбросы 2",
    tax1: "Налог зачистки −1G",
    curseChoice: "Проклятия забега: выбор в начале акта",
    mutations2: "Reality Break: 2 мутации на волну",
    fights3: "Тимфайты 3",
    reroll4: "Реролл 4G",
    tax2: "Налог зачистки −2G",
    hand5: "Рука 5 карт",
    fights2: "Тимфайты 2",
    discards1: "ТП-сброс 1",
  };

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
    journalOpen: false,
    toast: "",
    tipIndex: Math.floor(Date.now() / 86400000) % TIPS.length,
    // Ранг сложности нового забега + прогресс лиги (заполняет main.js).
    rankDraft: 1,
    unlockedRank: 1,
    unlockBanner: null, // имя открытого ранга для плашки на экране победы
    // Стартовый архетип нового забега (спек §7).
    starterDraft: "standard",
    // Фокус лаборатории колоды: train | exile | null (какую кнопку нажали в лавке).
    labFocus: null,
    // Лидерборд (фаза H): копия записей + активный вид.
    scores: [],
    scoreView: "score",
    newRecord: false,
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

  function fmt(n) {
    return Number(n).toLocaleString("ru");
  }

  function icon(name, size) {
    return Icons.icon(name, size);
  }

  function heroDesc(hero) {
    if (hero.ability) return ABILITY_TEXT[hero.id] || hero.ability.name;
    return "Без способности — играет через ранг и атрибут.";
  }

  // Скипетр «Starbreaker» (Dawnbreaker): Универсал — джокер атрибутов для
  // условий способностей и формаций. Подсказки UI читают это состояние.
  function uniWildcardOn(state) {
    const augs = state && state.run && state.run.aghanims && state.run.aghanims.dawnbreaker;
    return !!(augs && augs.scepter === "dawnbreaker_sc");
  }

  function attrOf(state, uid) {
    return Game.heroAttr(state, Content.heroes.byId[state.cards[uid].heroId].id);
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

  // Доминирующий атрибут строя — подпись в формуле урона (раньше там всегда
  // стояло «СИЛА», из-за чего универсалы вроде Dawnbreaker «считались силой»).
  function dominantAttrName(state) {
    const counts = {};
    for (const uid of state.combat.selectedUids) {
      const card = state.cards[uid];
      const hr = card && Content.heroes.byId[card.heroId];
      if (!hr) continue;
      const a = Game.heroAttr(state, hr.id);
      counts[a] = (counts[a] || 0) + 1;
    }
    const best = Object.keys(counts).sort((x, y) => counts[y] - counts[x])[0];
    return best ? ATTR_NAMES[best] : "СИЛА";
  }

  // Лучший харас из руки: какой урон нанесёт самая сильная одиночная карта.
  // Порог для состояния приговора «ЕЩЁ 1 УДАР» — только он, без субъективности.
  function computeHarass(state) {
    if (state.phase !== "wave" || state.combat.outcome || state.player.fightsLeft <= 0) return 0;
    const mined = state.combat.minedUids || [];
    let best = 0;
    for (const uid of state.player.handUids) {
      if (mined.includes(uid)) continue;
      const probe = { ...state, combat: { ...state.combat, selectedUids: [uid] } };
      const clone = Sim.simulate(probe, { type: "CONFIRM_FIGHT" });
      const res = clone && clone.combat.lastResolution;
      if (res && !res.blocked) best = Math.max(best, res.damage);
    }
    return best;
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
    const effAttr = Game.heroAttr(state, hero.id);
    const rank = heroRank(state, hero.id);
    const selectedIdx = state.combat.selectedUids.indexOf(uid);
    const selected = selectedIdx !== -1;
    const mined = (state.combat.minedUids || []).includes(uid);
    const cls = [
      "hero-card",
      effAttr,
      selected ? "selected" : "",
      mined ? "mined" : "",
    ].join(" ");
    const lvl = Game.heroLevel(state, hero.id);
    const xp = (state.run.heroXp || {})[hero.id] || 0;
    const augs = (state.run.aghanims || {})[hero.id];
    const augBadges = augs ? ["shard", "scepter"].filter((k) => augs[k]).map((k) => {
      const a = Content.aghanims.byId[augs[k]];
      return `<span class="augh-mark" data-tip>${a.emoji}<span class="pop"><strong>${a.emoji} ${a.name}</strong><p>${esc(a.desc)}</p><small>${k === "scepter" ? "Скипетр Аганима" : "Осколок Аганима"}</small></span></span>`;
    }).join("") : "";
    // Каталог аугментов героя в тултипе: сначала Осколок, потом Скипетр.
    // Серым — не куплено, светящимся — куплено. Две строки: шапка + описание.
    const augTipLines = ["shard", "scepter"].map((k) => {
      const a = Content.aghanims.forHero(hero.id, k);
      if (!a) return "";
      const owned = !!(augs && augs[k]);
      const label = k === "scepter" ? "Скипетр Аганима" : "Осколок Аганима";
      return `<div class="augh-tip ${owned ? "owned" : ""}">${a.emoji} <b>${label} · ${a.name}</b><span class="augh-desc">${esc(a.desc)}</span></div>`;
    }).join("");
    const trained = rank !== hero.power;
    const fatigue = Ranks.fatiguePenalty((state.run.heroUses || {})[hero.id]);
    const fav = Ranks.mostUsedHero(state) === hero.id && Ranks.has(state, "antihero");
    const penaltyNote = fatigue ? `усталость −${fatigue}` : "";
    const favNote = fav ? "мир охотится: −2" : "";
    return `<button class="${cls}" ${mined ? "" : `data-action="select" data-uid="${uid}"`} aria-pressed="${selected}">
      ${selected ? `<span class="selection-order">${selectedIdx + 1}${icon("check", 10)}</span>` : ""}
      ${mined ? `<span class="mine-mark" data-tip>${icon("bomb", 22)}<span class="pop"><strong>💣 Заминировано Techies</strong><p>Эта карта не играет в текущем бою.</p><small>Sentry Ward или BKB обезвреживают мины</small></span></span>` : ""}
      ${penaltyNote ? `<span class="fatigue-mark" data-tip>−${fatigue}<span class="pop"><strong>Усталость</strong><p>Каждые 5 боёв героя — −1 к силе (до −3). Дай герою отдых или уволь его.</p><small>${penaltyNote}</small></span></span>` : ""}
      <div class="hero-art">${Art.heroArt(hero)}<span class="hero-vignette"></span>
        <span class="hero-rank ${fatigue || fav ? "weakened" : ""}">${rank}</span>
        <span class="attribute-icon">${ATTR_SYMBOLS[effAttr]}</span>
        <span class="hero-name">${hero.name}</span>
      </div>
      <div class="hero-card-bottom">
        <span class="hero-attribute">${ATTR_SYMBOLS[effAttr]} ${ATTR_NAMES[effAttr]}${effAttr !== hero.attr ? " <i class=\"attr-changed\" title=\"Было: " + ATTR_NAMES[hero.attr] + "\">⇄</i>" : ""}</span>
        <span class="hero-ability">${hero.ability ? hero.ability.name : "—"}${augBadges}${lvl ? ` <span class="xp-badge" title="Опыт ${xp}: уровень ${lvl} (+${lvl} силы)">ур.${lvl}</span>` : ""}</span>
        <div class="card-foot"><span>${rank} ${icon("zap", 10)}</span><kbd>${index + 1}</kbd></div>
      </div>
      <span class="hero-tooltip">
        <strong>${hero.ability ? hero.ability.name : hero.name}</strong>
        <p>${esc(heroDesc(hero))}</p>
        ${augTipLines}
        <small>Ранг ${rank}${trained ? ` (база ${hero.power})` : ""}${penaltyNote ? ` · ${penaltyNote}` : ""}${favNote ? ` · ${favNote}` : ""}${lvl ? ` · опыт ${xp} (ур. ${lvl})` : ""} · ${effAttr === "uni"
          ? `Универсал — четвёртый цвет: связки и «4+ одного атрибута» считают его только Универсалом${uniWildcardOn(state) ? " · Starbreaker: Универсал — джокер условий" : ""}`
          : `${ATTR_NAMES[effAttr]} — 5 карт одного цвета = флеш`}</small>
      </span>
    </button>`;
  }

  // Правила текущей цели — чипы в шапке сцены (читаются перед каждым боем).
  function waveRuleChips(state) {
    const wave = state.combat.wave;
    const disarmed = state.player.items.includes("sentry") || state.player.items.includes("bkb");
    const bkb = state.player.items.includes("bkb");
    const chips = [];
    for (const m of wave.modifiers || []) {
      const def = Content.modifiers.byId[m.id];
      if (!def) continue;
      let text = "";
      let used = false;
      let danger = false;
      if (m.id === "armor") text = state.rules === "formation" ? "Укрепления: первый бой ×0.5" : "Броня: первый бой ×0.5";
      else if (m.id === "glyph") text = "Глиф: каждый 3-й бой = 0";
      else if (m.id === "mines") {
        used = disarmed;
        danger = !disarmed;
        text = disarmed ? "Мины обезврежены Sentry/BKB" : "Мины: 2 карты руки закрыты";
      } else if (m.id === "aegis") {
        used = wave.aegisUsed;
        text = wave.aegisUsed ? "Aegis потрачен" : "Aegis: возрождение с 50% HP";
      } else if (def.curse) {
        used = bkb;
        danger = !bkb;
        text = used ? `${def.name}: обезврежено BKB` : `${def.name}: ${def.desc}`;
      } else if (def.mutation) {
        // Мутации башен (ранги Божество+): BKB снимает вместе с модификаторами башни.
        danger = !bkb;
        text = bkb ? `${def.name}: обезврежено BKB` : `${def.name}: ${def.desc}`;
      } else if (def.desc) {
        text = `${def.name}: ${def.desc}`;
      }
      chips.push(`<span class="rule-chip ${used ? "done" : ""} ${danger ? "danger" : ""}">${icon("shield", 12)}<span>${text}</span></span>`);
    }
    if (state.combat.forbiddenSlot) {
      chips.push(`<span class="rule-chip danger">${icon("target", 12)}<span>Нестабильная позиция: слот ${state.combat.forbiddenSlot} — −40% силы герою</span></span>`);
    }
    const wv = state.combat.wave || {};
    if (wv.goldenSlot) chips.push(`<span class="rule-chip">${icon("sparkles", 12)}<span>Золотая клетка ${wv.goldenSlot}: +50% силы</span></span>`);
    if (wv.blockedSlot) chips.push(`<span class="rule-chip danger">${icon("x", 12)}<span>Клетка ${wv.blockedSlot} заблокирована</span></span>`);
    if (wv.banAttrs) chips.push(`<span class="rule-chip danger">${icon("x", 12)}<span>Запрещён атрибут: ${wv.banAttrs.map((a) => ATTR_NAMES[a]).join(", ")}</span></span>`);
    if (wv.bannedHeroId) chips.push(`<span class="rule-chip danger">${icon("x", 12)}<span>Отдыхает: ${Content.heroes.byId[wv.bannedHeroId].name}</span></span>`);
    if (wv.noRepeat) chips.push(`<span class="rule-chip danger">${icon("rotate", 12)}<span>Герои прошлого боя недоступны</span></span>`);
    if (wv.minFights) chips.push(`<span class="rule-chip danger">⏱<span>Победа за 1 бой — награда вполовину</span></span>`);
    if (wv.handShape) chips.push(`<span class="rule-chip danger">${icon("zap", 12)}<span>Форма руки: первые ${wv.handShape.firstN} ×${wv.handShape.firstMult}, остальные ×${wv.handShape.restMult}</span></span>`);
    if (wv.maxSlotsOverride === 6) chips.push(`<span class="rule-chip">${icon("plus", 12)}<span>Архитектор: шестой слот открыт</span></span>`);
    if (state.rules === "formation") {
      const d = Content.towerDefense.byId[wave.towerId];
      if (d && (d.armor || d.mr)) {
        const parts = [];
        if (d.armor) parts.push(`броня ${d.armor}`);
        if (d.mr) parts.push(`сопротивление ${Math.round(d.mr * 100)}%`);
        chips.push(`<span class="rule-chip ${bkb ? "done" : ""}">${icon("shield", 12)}<span>Защита: ${parts.join(" · ")}${bkb ? " — снимает BKB" : ""}</span></span>`);
      }
    }
    if (wave.elite) {
      chips.push(`<span class="rule-chip elite">${icon("sparkles", 12)}<span>Элитная добыча: золото ×1.5, эпик в лавке</span></span>`);
    }
    if ((wave.enemyItems || []).includes("rapier")) {
      chips.push(`<span class="rule-chip danger">${icon("zap", 12)}<span>Враг держит Рапиру: твой урон ×0.5</span></span>`);
    }
    if ((wave.modifiers || []).some((m) => m.id === "glyph") && state.combat.fightIndex % 3 === 2 && !bkb) {
      chips.push(`<span class="rule-chip danger pulse">${icon("skull", 12)}<span>Этот бой блокирует глиф — играй минимальный отряд</span></span>`);
    }
    return chips.join("");
  }

  function momentumInfo(state) {
    const mom = state.run.momentum || 0;
    const mult = (1 + Math.min(mom, Combat.MOMENTUM_CAP) * Combat.MOMENTUM_STEP).toFixed(2).replace(/0$/, "");
    return { mom, mult };
  }

  // Активные правила лиги в панели эффектов: проклятия забега, адаптация мира,
  // охота на героя. Только то, что реально работает прямо сейчас.
  function rankEffectsHtml(state) {
    const rows = [];
    for (const curseId of state.run.curses || []) {
      const curse = Content.rankCurses.byId[curseId];
      rows.push(`<div class="effect-row curse">${curse.emoji}<span>${curse.name}<small>${esc(curse.desc)}</small></span></div>`);
    }
    if (Ranks.has(state, "adaptive")) {
      const hunted = Ranks.mostUsedCombo(state);
      if (hunted) {
        const def = state.rules === "formation" ? Content.formations.byId[hunted.id] : Content.combos.byId[hunted.id];
        if (def) rows.push(`<div class="effect-row curse">${icon("eye", 13)}<span>Мир адаптируется<small>«${def.name}» наносит ×0.85 (${hunted.count} применений)</small></span></div>`);
      }
    }
    if (Ranks.has(state, "antihero")) {
      const fav = Ranks.mostUsedHero(state);
      if (fav) {
        const hero = Content.heroes.byId[fav];
        rows.push(`<div class="effect-row curse">${icon("target", 13)}<span>Охота на героя<small>${hero.name} −2 к силе (${(state.run.heroUses || {})[fav] || 0} боёв)</small></span></div>`);
      }
    }
    return rows.join("");
  }

  // Шаги акта: в волне «текущая» = сражаемая; в лавке/развилке пройденная
  // закрыта, а «текущая» — следующая (на границе акта весь акт закрыт).
  function actStepsHtml(state) {
    const meta = state.phase === "shop" || state.phase === "route";
    const pos = state.run.waveIndex + (meta ? 1 : 0);
    const slot = pos % 5;
    const actClosed = meta && slot === 0;
    return [1, 2, 3, 4, 5].map((n, i) => {
      const cls = i === slot && !actClosed ? "current" : i < slot || actClosed ? "complete" : "";
      const ico = i === 4 ? icon("skull", 12) : cls === "complete" ? icon("check", 11) : icon("castle", 12);
      return `<span class="${cls}">${ico}<span>${n}</span>${i < 4 ? "<i></i>" : ""}</span>`;
    }).join("");
  }

  function runPosition(state) {
    const meta = state.phase === "shop" || state.phase === "route";
    const idx = Math.min(state.run.waveIndex + (meta ? 1 : 0), Content.waves.order.length);
    return {
      act: Math.min(Math.floor(idx / 5) + 1, 3),
      wave: idx % 5 + 1,
      cleared: idx,
    };
  }

  // mode: "wave" — с ресурсами боя; "meta" — только состояние забега (лавка/развилка).
  // ---------- улучшения v2: панель и контекстные кнопки ----------

  // Дескриптор уровня: defs с levels[] описывают мутации II/III словами.
  function upDescOf(state, u) {
    const inst = Upgrades.instanceOf(state, u.id);
    return (u.levels && u.levels[inst.level - 1] && u.levels[inst.level - 1].desc) || u.desc;
  }

  // Кнопка активации: единый рендер для всех контекстов (route/shop/wave).
  function activeBtnHtml(state, u) {
    const check = Upgrades.canActivate(state, u.id);
    return `<button class="upg-active-btn" ${check.ok ? "" : "disabled"} data-action="activate-upgrade" data-upgrade="${u.id}" data-tip>
      <span>${u.emoji} ${u.name}</span><small>${Upgrades.accessLabel(u)}</small>
      <span class="pop"><strong>${u.emoji} ${u.name}</strong><p>${esc(u.desc)}</p>${check.ok ? "" : `<small>Недоступно: ${check.reason}</small>`}</span>
    </button>`;
  }

  function ownedActives(state, context, withTarget = false) {
    return Upgrades.ownedDefs(state).filter((u) => u.type === "active" && u.activation
      && u.activation.context === context && !!u.activation.target === withTarget);
  }

  // Мастер-панель в сайдбаре: что куплено, сколько зарядов/лимитов осталось.
  function upgradesPanelHtml(state) {
    const owned = Upgrades.ownedDefs(state);
    const energy = state.run.energy || 0;
    const fortune = state.run.fortune || 0;
    const rows = owned.map((u) => {
      const inst = Upgrades.instanceOf(state, u.id);
      const lvl = inst.level > 1 ? ` <b class="upg-lvl">${Upgrades.roman(inst.level)}</b>` : "";
      let status = "";
      if (u.type === "active") {
        const acc = u.activation.access || {};
        if (acc.charges != null) status = `<span class="upg-status ${inst.charges ? "" : "empty"}">⚡${inst.charges}/${acc.charges}</span>`;
        else if (acc.act != null) status = `<span class="upg-status ${inst.actUses < acc.act ? "" : "empty"}">${acc.act - inst.actUses}/${acc.act}</span>`;
        else if (acc.energy != null) status = `<span class="upg-status">⚡${acc.energy}</span>`;
      }
      return `<div class="upg-row" data-tip><span class="upg-emoji">${u.emoji}</span>
        <span class="upg-name">${u.name}${lvl}</span>${status}
        <span class="pop"><strong>${u.emoji} ${u.name}${lvl}</strong><p>${esc(upDescOf(state, u))}</p>
        <small>${u.type === "active" ? `Кнопка ${Upgrades.CONTEXT_LABELS[u.activation.context]} · ${Upgrades.accessLabel(u)}` : "Пассивное"}</small></span></div>`;
    }).join("");
    return `<section class="panel upgrades-panel">
      <div class="section-label"><span>${icon("sparkles", 13)}УЛУЧШЕНИЯ</span>${energy ? `<span class="energy-badge" data-tip>⚡ ${energy}<span class="pop side"><strong>Энергия</strong><p>Копится Конденсатором за каждые активации. Тратится Перегрузкой.</p></span></span>` : ""}</div>
      ${rows || '<div class="effect-row none">Пока ни одного — загляни в лавку</div>'}
      ${fortune ? `<div class="effect-row momentum"><span>🎰 Фортуна: ${fortune}/5 провалов до мифика в лавке</span></div>` : ""}
    </section>`;
  }

  function sidebarHtml(state, mode) {
    const waveMode = mode === "wave";
    const { mom, mult } = momentumInfo(state);
    const pos = runPosition(state);
    const fights = Ranks.fightsPerWave(state);
    const discards = Game.discardsPerWave(state);
    const journalEntries = (UIState.journalOpen ? state.log.slice(-6) : state.log.slice(-1)).slice().reverse();
    return `
    <section class="panel run-panel">
      <div class="section-label"><span>${icon("leaf", 13)}ЗАБЕГ</span><span class="wave-badge">АКТ ${pos.act} · волна ${pos.wave}/5</span></div>
      <div class="act-steps">${actStepsHtml(state)}</div>
      <div class="run-row rank-row"><span>${icon("crown", 14)}Ранг</span>${rankBadgeHtml(state, true)}</div>
      <div class="run-row"><span>${icon("coins", 14)}Золото</span><strong class="gold">${state.run.gold}<small> G</small></strong></div>
      <div class="run-row"><span>${icon("castle", 14)}Казармы</span><div class="lives">${Array.from({ length: BARRACKS }, (_, i) =>
      `<span class="${i < state.run.barracks ? "alive" : ""}" title="Казармы: ${BARRACKS} жизней забега">${icon("shield", 13)}</span>`).join("")}</div></div>
      ${waveMode ? `
      <div class="run-row"><span>${icon("swords", 14)}Тимфайты</span><div class="resource-pips">${Array.from({ length: fights }, (_, i) => `<i class="${i < state.player.fightsLeft ? "filled mint-bg" : ""}"></i>`).join("")}</div></div>
      <div class="run-row"><span>${icon("rotate", 14)}ТП-сбросы</span><div class="resource-pips">${Array.from({ length: discards }, (_, i) => `<i class="${i < state.player.discardsLeft ? "filled blue-bg" : ""}"></i>`).join("")}</div></div>` : ""}
    </section>
    <section class="panel effects-panel">
      <div class="section-label"><span>${icon("flame", 13)}ЭФФЕКТЫ</span></div>
      ${mom > 0
      ? `<div class="effect-row momentum">${icon("flame", 13)}<span>Импульс ×${mult}<small>серия ${mom} волн подряд</small></span></div>`
      : `<div class="effect-row none">Серия не начата — зачищай волны подряд</div>`}
      ${rankEffectsHtml(state)}
    </section>
    ${upgradesPanelHtml(state)}
    <section class="panel journal-panel ${UIState.journalOpen ? "open" : ""}">
      <div class="section-label"><span>${icon("history", 13)}ЖУРНАЛ</span>
        <span class="journal-tools">
          <button class="icon-button small" data-action="show-tip" title="Совет дня">${icon("sparkles", 12)}</button>
          <button class="icon-button small chevron-btn" data-action="toggle-journal" title="${UIState.journalOpen ? "Свернуть журнал" : "Развернуть журнал"}">${icon("chevron", 12)}</button>
        </span></div>
      <div class="journal-entries">${journalEntries.map((entry, i) =>
      `<div class="${i === 0 ? "latest" : ""}"><span class="log-dot"></span><p>${esc(entry)}</p></div>`).join("") || '<div class="effect-row none">Пока тихо.</div>'}</div>
      <button class="text-button" data-action="open-modal" data-modal="history">Вся история ${icon("arrow", 12)}</button>
    </section>
    <button class="combo-guide" data-action="open-modal" data-modal="help">
      <div class="guide-icon">${icon("book", 18)}</div>
      <span><strong>Знание — сила</strong><small>Что дают цифры и цвета</small></span>${icon("chevron", 15)}
    </button>`;
  }

  // ---------- battle scene (центр = решение) ----------

  // Приговор по мастер-спеку §1.2 — полный: KILL / HARASS / GLYPH OVERRIDE /
  // NORMAL (точный остаток HP цели). Производится из данных превью, без
  // субъективных формулировок.
  function verdictHtml(state, preview, harass) {
    if (!preview || state.combat.outcome) {
      return `<div class="scene-verdict idle"><b>${icon("eye", 15)} ПРИГОВОР</b><small>Выбери героев — игра скажет, падает ли башня этим ударом</small></div>`;
    }
    const hp = Math.max(0, state.combat.wave.hp);
    if (preview.blocked) {
      return `<div class="scene-verdict blocked"><b>${icon("skull", 15)} ГЛИФ: УРОН = 0</b><small>Бой заблокирован глифом — играй минимальный отряд</small></div>`;
    }
    if (preview.damage >= hp && hp > 0) {
      return `<div class="scene-verdict kill"><b>${icon("check", 15)} БАШНЯ ПАДАЕТ</b><small>${fmt(preview.damage)} урона при ${fmt(hp)} HP цели</small></div>`;
    }
    const remain = hp - preview.damage;
    if (harass >= remain && remain > 0) {
      return `<div class="scene-verdict harass"><b>${icon("zap", 15)} ДОБЬЁТ ХАРАС</b><small>Лучший харас из руки (${fmt(harass)}) добьёт остаток ${fmt(remain)} HP — не трать коммит</small></div>`;
    }
    return `<div class="scene-verdict normal"><b>${icon("target", 15)} ОСТАНЕТСЯ ${fmt(remain)} HP</b><small>Этого удара мало — добивай харасом или собирай жирнее</small></div>`;
  }

  function commitInfoHtml(state, preview) {
    const chips = [];
    // Активации «на следующий бой» — видны до клика «В бой».
    if (state.run.pendingIgnoreMods) chips.push(`<span class="commit-chip momentum">🛡️ ИГНОР</span>`);
    if (state.run.pendingForceTriggers) chips.push(`<span class="commit-chip momentum">🎯 ГАРАНТИЯ</span>`);
    if (state.run.pendingDmgPct) chips.push(`<span class="commit-chip">🔥 ВА-БАНК +${state.run.pendingDmgPct}%</span>`);
    const n = preview ? preview.playedCount || state.combat.selectedUids.length : 0;
    const tier = Combat.COMMIT_TIERS[n];
    if (tier) {
      chips.push(tier.finalMult !== 1
        ? `<span class="commit-chip">СТАВКА ×${tier.finalMult}</span>`
        : `<span class="commit-chip neutral">ХАРАС +${tier.gold}G</span>`);
    }
    const { mom, mult } = momentumInfo(state);
    if (mom > 0) {
      chips.push(`<span class="commit-chip momentum">ИМПУЛЬС ×${mult}</span>`);
    }
    return chips.length ? `<div class="commit-row">${chips.join("")}</div>` : "";
  }

  function battleSceneHtml(state, preview, harass) {
    const wave = state.combat.wave;
    const max = Game.maxSlots(state);
    const hp = Math.max(0, wave.hp);
    const hpPct = Math.max(0, Math.round((hp / wave.maxHp) * 100));
    // превью урона на полосе: мятный остаток + красный сегмент урона
    const live = preview && !preview.blocked;
    const remainPct = live ? Math.max(0, Math.round((Math.max(0, hp - preview.damage) / wave.maxHp) * 100)) : hpPct;
    const dmgPct = live ? Math.max(0, Math.min(hpPct, remainPct + Math.round((preview.damage / wave.maxHp) * 100)) - remainPct) : 0;
    const kill = live && preview.damage >= hp;
    const isBoss = !!wave.isBoss;
    const faction = isBoss || wave.miniBoss ? "БОСС АКТА" : "ПОСТРОЙКА СВЕТА";
    const slots = Array.from({ length: max }, (_, i) => {
      const uid = state.combat.selectedUids[i];
      const hero = uid ? Content.heroes.byId[state.cards[uid].heroId] : null;
      const forbidden = state.combat.forbiddenSlot === i + 1;
      if (hero) {
        return `<div class="formation-slot occupied ${forbidden ? "forbidden" : ""}" data-idx="${i}" data-tip>${Art.heroArt(hero)}
          <span class="slot-idx">${i + 1}</span><span class="slot-name">${hero.name}</span>
          <span class="pop"><strong>${hero.name}</strong><p>${esc(heroDesc(hero))}</p><small>${forbidden ? "⚠ Нестабильная позиция: −40% силы · " : ""}Слот ${i + 1} · зажми и перетащи — герой встанет на это место в бою</small></span>
        </div>`;
      }
      return `<div class="formation-slot ${forbidden ? "forbidden" : ""}" data-idx="${i}">${forbidden ? '<span class="forbidden-mark">✕</span>' : icon("plus", 14)}<span class="slot-idx">${i + 1}</span>
        ${forbidden ? '<span class="pop"><strong>Нестабильная позиция</strong><p>Герой в этом слоте волны даёт −40% силы.</p></span>' : ""}</div>`;
    }).join("");
    const combo = preview ? preview.combo : null;
    const canFight = preview && !state.combat.outcome && state.player.fightsLeft > 0;
    const canDiscard = state.combat.selectedUids.length > 0 && state.player.discardsLeft > 0 && !state.combat.outcome;
    const power = preview ? preview.power : 0;
    const mult = preview ? Math.round(preview.mult * 100) / 100 : 0;
    const damage = preview ? preview.damage : 0;
    return `<section class="battle-scene" id="battlefield">
      <div class="scene-shade"></div>
      <div class="scene-inner">
        <header class="scene-target">
          <div class="scene-emblem ${isBoss ? "boss" : ""}">${isBoss || wave.miniBoss ? icon("skull", 30) : icon("castle", 30)}</div>
          <div class="scene-title">
            <span class="section-label">${faction} · ВОЛНА ${state.run.waveIndex % 5 + 1}/5</span>
            <h2>${wave.name}${wave.miniBoss ? " — мини-босс" : ""}</h2>
          </div>
          <div class="scene-hp">
            <div class="scene-hp-num">${icon("heart", 14)}<strong>${fmt(hp)}</strong><span>/ ${fmt(wave.maxHp)}</span></div>
            <div class="health-track ${kill ? "dead" : ""}">
              <div class="hp-base" style="width:${hpPct}%"></div>
              <div class="hp-remain" style="width:${remainPct}%"></div>
              ${dmgPct > 0 ? `<div class="hp-damage" style="left:${remainPct}%;width:${dmgPct}%"></div>` : ""}
            </div>
          </div>
          <div class="scene-reward"><span>Награда</span><b>${icon("coins", 13)}${state.combat.wave.gold || Game.WAVE_CLEAR_GOLD}+</b></div>
        </header>
        <div class="rule-chips">${waveRuleChips(state)}</div>
        <div class="scene-stage">
          <div class="scene-play">
            <div class="scene-formation">
              <div class="formation-cards">${slots}</div>
              <span class="formation-note">Зажми героя и тащи —<br>порядок слотов = позиции в бою</span>
            </div>
            <button class="combo-preview" data-action="${preview ? "open-score" : "open-modal"}" ${preview ? "" : 'data-modal="help"'}>
              <span class="section-label">${combo ? (combo.tier != null ? "ТВОЯ ФОРМАЦИЯ" : "ТВОЯ КОМБИНАЦИЯ") : "ТВОЙ СЛЕДУЮЩИЙ ХОД"}</span>
              <strong>${combo ? combo.name : "Собери тимфайт"} ${icon("chevron", 14)}</strong>
              <small>${combo ? comboSubtitle(combo) : "Сила героев × множитель"}</small>
            </button>
            <div class="scene-formula">
              <div class="score-formula">
                <div class="score-block power"><strong>${power}</strong><span title="Атрибут, которых в строю больше всего — он задаёт тип урона">${dominantAttrName(state)}</span></div>
                <span class="times">${icon("x", 14)}</span>
                <div class="score-block multiplier"><strong>${mult}</strong><span>МНОЖ.</span></div>
                <span class="equals">=</span>
                <div class="total-score"><strong>${fmt(damage)}</strong><span>УРОНА</span></div>
              </div>
            </div>
          </div>
          <div class="scene-side">
            ${verdictHtml(state, preview, harass)}
            ${commitInfoHtml(state, preview)}
            <div class="action-buttons">
              <button class="primary-button attack-button" ${canFight ? "" : "disabled"} data-action="fight">${icon("swords", 17)}В бой<kbd>↵</kbd></button>
              <button class="discard-button" ${canDiscard ? "" : "disabled"} data-action="discard">${icon("rotate", 14)}ТП-сброс<kbd>R</kbd></button>
            </div>
            ${(() => {
              const acts = ownedActives(state, "wave").map((u) => activeBtnHtml(state, u)).join("");
              return acts ? `<div class="wave-actives">${acts}</div>` : "";
            })()}
          </div>
        </div>
      </div>
      <div class="arena-label"><span class="radial-dot"></span><span>ТЕРРИТОРИЯ СВЕТА</span></div>
    </section>`;
  }

  // ---------- right context panel ----------

  function activeScoreBlock(state, preview) {
    return `<div class="active-formation">
      <strong>${preview.combo.name}</strong>
      <small>${comboSubtitle(preview.combo)}</small>
      <div class="active-value"><b class="mint">${preview.power}</b><span>×</span><b class="gold">${Math.round(preview.mult * 100) / 100}</b><em>= ${fmt(preview.damage)}</em></div>
    </div>`;
  }

  function contextEmptyHtml(text) {
    return `<div class="context-empty">${icon("target", 20)}<p>${text}</p></div>`;
  }

  function formationContextHtml(state, preview) {
    const dtName = (dt) => Content.damageTypeNames[dt] || dt;
    const combo = preview ? preview.combo : null;
    // Универсал в текущем отряде — поясняем, как он считается (задача «Dawnbreaker»).
    const uniPlayed = state.combat.selectedUids.some((uid) => {
      const c = state.cards[uid];
      const hr = c ? Content.heroes.byId[c.heroId] : null;
      return !!hr && Game.heroAttr(state, hr.id) === "uni";
    });
    const uniNote = uniPlayed
      ? `<div class="combo-legend uni-note"><span>◈ Универсал — отдельный атрибут: связки и «4+ одного атрибута» считают его своим цветом${uniWildcardOn(state) ? " · Starbreaker: Универсал — джокер условий" : ""}</span></div>`
      : "";
    let active;
    if (combo) {
      const bonds = (combo.bonds || []).map((b) => {
        const val = [b.power ? `+${b.power} силы` : "", b.mult ? `+${b.mult} множ.` : ""].filter(Boolean).join(", ");
        return `<div class="bond-row"><strong>${b.trait}</strong><span>${val}</span></div>`;
      }).join("");
      active = activeScoreBlock(state, preview)
        + (bonds ? `<div class="section-label inner-label">${icon("sparkles", 12)}АКТИВНЫЕ СВЯЗКИ</div><div class="bond-rows">${bonds}</div>` : "");
    } else {
      active = contextEmptyHtml("Выбери героев — собранная формация и её связки появятся здесь.");
    }
    let alts = "";
    if (combo && combo.alternatives && combo.alternatives.length > 1) {
      const rows = combo.alternatives.slice().sort((a, b) => b.damage - a.damage).slice(0, 5).map((f) =>
        `<div class="combo-row ${f.id === combo.type ? "hit" : ""}" data-tip>
          <div class="combo-row-name"><strong>${f.name}</strong><small>${dtName(f.damageType)}${f.positional ? " · порядок" : ""}</small></div>
          <div class="combo-row-value"><b class="gold">${fmt(f.damage)}</b><span>урона</span></div>
          <span class="pop side"><strong>${f.name}</strong><p>${esc(f.rule)}</p><small>${dtName(f.damageType)} урон против защиты этой башни</small></span>
        </div>`).join("");
      alts = `<section class="panel context-inner">
        <div class="section-label"><span>${icon("swords", 13)}ПРОТИВ ЭТОЙ ЦЕЛИ</span></div>
        <div class="combo-rows">${rows}</div>
        <div class="combo-legend"><span>Базы формаций — без способностей и ставки, сравнивай их между собой</span><span>Переставляй героев — урон меняется</span></div>
      </section>`;
    }
    return `<aside class="context-panel">
      <section class="panel context-inner">
        <div class="section-label"><span>${icon("target", 13)}ТВОЯ ФОРМАЦИЯ</span></div>
        ${active}
        ${uniNote}
      </section>
      ${alts}
      <button class="context-all" data-action="open-modal" data-modal="help">${icon("book", 14)}Все формации ${icon("chevron", 13)}</button>
    </aside>`;
  }

  function comboContextHtml(state, preview) {
    const current = preview ? preview.combo.type : null;
    const ready = handComboState(state);
    const rows = Content.combos.list.map((c) => {
      const meta = COMBO_META[c.id];
      const cls = c.id === current ? "hit" : ready[c.id] ? "ready" : "";
      return `<div class="combo-row ${cls}" data-tip>
        <div class="combo-row-name"><strong>${c.name}</strong><small>${meta.poker}</small></div>
        <div class="combo-row-value"><b class="mint">${c.basePower}</b><span>×</span><b class="gold">${c.baseMult}</b></div>
        <span class="pop side"><strong>${c.name}</strong><p>${esc(meta.rule)}</p><small>${c.basePower} силы × ${c.baseMult} множитель</small></span>
      </div>`;
    }).join("");
    const active = preview
      ? activeScoreBlock(state, preview)
      : contextEmptyHtml("Выбери героев — собранная комбинация появится здесь.");
    return `<aside class="context-panel">
      <section class="panel context-inner">
        <div class="section-label"><span>${icon("zap", 13)}ТВОЯ КОМБИНАЦИЯ</span></div>
        ${active}
      </section>
      <section class="panel context-inner">
        <div class="section-label"><span>${icon("book", 13)}КОМБИНАЦИИ</span></div>
        <div class="combo-rows">${rows}</div>
        <div class="combo-legend">
          <span><i class="dot hit"></i>собрано</span>
          <span><i class="dot ready"></i>есть в руке</span>
        </div>
      </section>
      <button class="context-all" data-action="open-modal" data-modal="help">${icon("book", 14)}Справочник ${icon("chevron", 13)}</button>
    </aside>`;
  }

  function shopContextHtml(state) {
    const nextId = Content.waves.order[state.run.waveIndex + 1];
    const next = nextId ? Content.waves.byId[nextId] : null;
    const isBoss = next && (next.isBoss || next.miniBoss);
    const nextHp = next ? Math.round(next.hp * Ranks.waveHpMult(state, state.run.waveIndex + 1)) : 0;
    return `<aside class="context-panel">
      <section class="panel context-inner">
        <div class="section-label"><span>${icon("target", 13)}СЛЕДУЮЩАЯ ЦЕЛЬ</span></div>
        <div class="next-target">
          <div class="next-emblem ${isBoss ? "boss" : ""}">${isBoss ? icon("skull", 26) : icon("castle", 26)}</div>
          <strong>${next ? next.name : "Финал забега"}</strong>
          ${next ? `<div class="next-hp"><b class="mint">${fmt(nextHp)}</b><span>HP</span></div>` : ""}
          ${next ? `<small>${waveRuleText(next)}</small>` : ""}
        </div>
        <div class="effect-row none">${icon("rotate", 12)}<span>Товары обновятся, если не залочены</span></div>
      </section>
      <button class="context-all" data-action="open-modal" data-modal="help">${icon("book", 14)}Справочник ${icon("chevron", 13)}</button>
    </aside>`;
  }

  function contextPanelHtml(state, preview) {
    if (state.phase === "shop") return shopContextHtml(state);
    if (state.phase !== "wave") return "";
    return state.rules === "formation" ? formationContextHtml(state, preview) : comboContextHtml(state, preview);
  }

  // ---------- нижняя полоса: рука во всю ширину + билд в шапке полосы ----------

  function buildStripHtml(state) {
    const items = state.player.items;
    const slots = [];
    for (let i = 0; i < Game.itemCapacity(state).total; i++) {
      const id = items[i];
      if (id) {
        const item = Content.items.byId[id];
        slots.push(`<button class="build-icon ${item.rarity === "epic" ? "legendary" : ""}" data-action="item-open" data-id="${id}" data-tip>
          ${Art.itemIcon(item)}
          <span class="pop"><strong>${item.name}</strong><p>${esc(item.desc)}</p><small>Клик — полный разбор и продажа за ${Economy.sellValue(id)} G</small></span>
        </button>`);
      } else {
        slots.push(`<button class="build-icon empty" data-action="item-hint" data-tip>${icon("plus", 13)}
          <span class="pop"><strong>Пустой слот</strong><p>Новые предметы появятся в лавке после зачистки волны.</p></span>
        </button>`);
      }
    }
    return `<div class="band-build"><span class="band-label">${icon("bag", 12)}БИЛД</span><div class="build-strip ${UIState.animInv ? "" : "no-anim"}">${slots.join("")}</div></div>`;
  }

  function bottomBandHtml(state) {
    if (state.phase === "shop") {
      const items = state.player.items;
      const cap = Game.itemCapacity(state);
      const classChips = cap.perClass
        ? ["off", "def", "util"].map((cls) => {
          const used = items.filter((id) => Content.items.byId[id].slotClass === cls).length;
          return `<span class="cap-chip ${used >= cap.perClass[cls] ? "full" : ""}">${SLOT_CLASS_ICONS[cls]} ${used}/${cap.perClass[cls]}</span>`;
        }).join("")
        : "";
      const slots = [];
      for (let i = 0; i < Game.itemCapacity(state).total; i++) {
        const id = items[i];
        if (id) {
          const item = Content.items.byId[id];
          slots.push(`<button class="item-slot ${item.rarity === "epic" ? "legendary" : ""}" data-action="item-open" data-id="${id}" data-tip>
            <div class="item-art">${Art.itemIcon(item)}</div>
            <span><strong>${item.name}</strong><small>${esc(item.desc)}</small></span>
            <span class="item-slot-dot"></span>
            <span class="pop"><strong>${item.name}</strong><p>${esc(item.desc)}</p><small>${RARITY_NAMES[item.rarity]} · Клик — полный разбор и продажа за ${Economy.sellValue(id)} G</small></span>
          </button>`);
        } else {
          slots.push(`<button class="item-slot empty-slot" data-action="item-hint" data-tip><span>${icon("plus", 18)}</span><span>Слот предмета</span>
            <span class="pop"><strong>Пустой слот</strong><p>Новые предметы появятся в лавке после зачистки волны.</p></span>
          </button>`);
        }
      }
      return `<section class="bottom-band shop">
        <div class="band-top">
          <h2 class="band-hand-title">Твой билд <span>${items.length}<small>/${cap.total} слотов</small></span></h2>
          <span class="cap-chips">${classChips}</span>
          <span class="hand-instruction">Клик по предмету — разбор и продажа за половину цены</span>
          <span class="spacer"></span>
        </div>
        <div class="inventory-slots ${UIState.animInv ? "" : "no-anim"}">${slots.join("")}</div>
      </section>`;
    }
    if (state.phase !== "wave") return "";
    const order = handOrder(state);
    const sortBtn = (mode, label) =>
      `<button class="sort-button ${UIState.sort === mode ? "active" : ""}" data-action="sort" data-mode="${mode}">${label}</button>`;
    return `<section class="bottom-band">
      <div class="band-top">
        <h2 class="band-hand-title">Твоя рука <span>${state.player.handUids.length}<small> / ${DeckSys.handSize(state)}</small></span></h2>
        <span class="hand-instruction">Выбери до ${Game.maxSlots(state)} героев для тимфайта</span>
        <span class="spacer"></span>
        ${buildStripHtml(state)}
        <div class="hand-tools"><span>Сортировка</span>
          ${sortBtn("rank", `${icon("sort", 12)}Сила`)}${sortBtn("attr", "Атрибут")}${sortBtn("deal", "Раздача")}
          <button class="deck-button" data-action="open-collection-deck" title="Посмотреть колоду">${icon("layers", 16)}<span>${state.player.deckUids.length}</span></button>
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

  // ---------- пикер рангов (лига dotora) ----------

  // Все активные правила лиги для ранга N: союз добавок 1..N в человеческих подписях.
  function rankNotes(rankId) {
    const seen = new Set();
    const notes = [];
    for (let r = 1; r <= Math.min(rankId, Content.ranks.max); r++) {
      for (const note of Content.ranks.byId[r].notes) {
        if (!seen.has(note)) { seen.add(note); notes.push(note); }
      }
    }
    return notes;
  }

  function rankPickerHtml() {
    const draft = Math.min(UIState.rankDraft || 1, Content.ranks.max);
    const unlocked = Math.max(1, UIState.unlockedRank || 1);
    const medals = Content.ranks.list.map((r) => {
      const locked = r.id > unlocked;
      const cls = ["rank-medal", r.id === draft ? "active" : "", locked ? "locked" : "", r.papochka ? "papochka" : ""].join(" ");
      const title = locked
        ? `Заблокировано — победи на ранге «${Content.ranks.byId[r.id - 1].name}»`
        : `«${r.name}» · ${r.quote || ""}`;
      return `<button class="${cls}" data-action="pick-rank" data-rank="${r.id}" ${locked ? "disabled" : ""} title="${esc(title)}">
        <span class="medal-gem" style="--medal:${r.color}">${r.roman}</span>
        <span class="medal-name">${r.name}</span>
        ${locked ? '<span class="medal-lock">🔒</span>' : ""}
      </button>`;
    }).join("");
    const rank = Content.ranks.byId[draft];
    const notes = rankNotes(draft).map((n) => `<li>${n}</li>`).join("");
    const detail = `<div class="rank-detail">
      <div class="rank-detail-head">
        <span class="medal-gem big" style="--medal:${rank.color}">${rank.roman}</span>
        <div><strong>«${rank.name}»</strong><small>HP башен ×${rank.hpMult} · награда ×${rank.goldMult}</small></div>
      </div>
      <ul class="rank-notes">${notes}</ul>
    </div>`;
    return `<div class="rank-picker">${medals}</div>${detail}`;
  }

  // Бейдж ранга текущего забега (шапка + сайдбар).
  function rankBadgeHtml(state, withIcon) {
    const rank = Ranks.rankOf(state);
    return `<span class="rank-badge ${rank.papochka ? "papochka" : ""}" style="--medal:${rank.color}" title="Ранг сложности: ${rank.name}">
      ${withIcon ? '<span class="medal-gem small" style="--medal:' + rank.color + '">' + rank.roman + "</span>" : ""}${rank.name}</span>`;
  }

  // Пикер стартового архетипа (спек §7): трио задаёт направление,
  // остальная колода добирается из тематического пула по сиду.
  function starterPickerHtml() {
    const draft = UIState.starterDraft || "standard";
    return `<div class="starter-picker">${Content.archetypes.list.map((a) => {
      const active = a.id === draft;
      const trio = a.guaranteed.length
        ? a.guaranteed.map((id) => Content.heroes.byId[id].name).join(" · ")
        : "Классическая двенадцатка";
      return `<button class="starter-card ${active ? "active" : ""}" style="--accent:${a.color}" data-action="pick-starter" data-starter="${a.id}" title="«${a.name}» — ${a.quote || ""}">
        <span class="starter-emoji">${a.emoji}</span>
        <span class="starter-name">${a.name}</span>
        <small class="starter-trio">${trio}</small>
        <small class="starter-perk">${a.perk ? a.perkDesc : "без перка"}</small>
      </button>`;
    }).join("")}</div>`;
  }

  // Ядро скоринга одно — формации. Тумблер «Классика/Формации» выпилен:
  // блок на титульном экране просто объясняет правила игры.
  function rulesBlockHtml() {
    return `<div class="title-rules">
      <div class="rule-choice active-rule">
        <strong>Формации</strong>
        <small>Строй тимфайт: порядок слотов решает, связки складываются все, урон встречает броню башни.</small>
      </div>
    </div>`;
  }

  function topbarHtml(state) {
    const inModal = UIState.modal !== null;
    const inRun = state.phase !== "title";
    const formation = state.rules === "formation";
    return `<header class="topbar">
      <a class="brand" data-action="nav-play">${brandMark()}<span>dotora<span class="brand-dot">.</span></span></a>
      <div class="brand-divider"></div>
      <span class="brand-caption">DOTA В КАРТАХ.<br/>ВЕЗЕНИЕ — В ТВОИХ РУКАХ.</span>
      <nav class="main-nav">
        <button class="${!inModal ? "active" : ""}" data-action="nav-play">${icon("swords", 16)}Играть</button>
        <button class="${UIState.modal === "collection" ? "active" : ""}" data-action="open-collection">${icon("layers", 16)}Коллекция</button>
        <button class="${UIState.modal === "help" ? "active" : ""}" data-action="open-modal" data-modal="help">${icon("book", 16)}Как играть</button>
      </nav>
      ${inRun ? `<div class="run-meta">
        <span class="act-pill ${formation ? "rules-formation" : ""}" title="Ядро скоринга этого забега">${formation ? icon("target", 12) : icon("leaf", 12)} ${formation ? "ФОРМАЦИИ" : "КЛАССИКА"}</span>
        <span class="act-pill" title="${Content.actNames[state.run.act || 1] || ""}">${icon("leaf", 12)} АКТ ${state.run.act || 1}</span>
        ${rankBadgeHtml(state, true)}
        <span class="run-id">#DL–${esc(state.seedCode)}</span>
        <span class="autosave">${icon("check", 12)}Сохранено</span>
      </div>` : ""}
      <div class="header-right">
        ${inRun ? `
        <button class="subtle-button" data-action="open-modal" data-modal="new">${icon("rotate", 13)}Новый забег</button>
        <button class="icon-button" data-action="debug-toggle" title="Debug-песочница (клавиша D)">⚙</button>` : ""}
        <span class="version">BETA <span>0.8</span></span>
        <button class="icon-button" data-action="toggle-sound" title="${Sfx.isMuted() ? "Включить звук" : "Выключить звук"}">${Sfx.isMuted() ? icon("mute", 18) : icon("volume", 18)}</button>
        <button class="icon-button" data-action="open-modal" data-modal="settings" title="Настройки">${icon("settings", 18)}</button>
      </div>
    </header>`;
  }

  // ---------- screens ----------

  function renderTitle(state) {
    app().innerHTML = `
    <div class="title-screen">
      <div class="title-bg"></div>
      <div class="title-inner">
        <a class="brand big">${brandMark()}<span>dotora<span class="brand-dot">.</span></span></a>
        <p class="title-caption">DOTA В КАРТАХ.<br/>ВЕЗЕНИЕ — В ТВОИХ РУКАХ.</p>
        <div class="title-formula">
          <div class="score-block power"><strong>69</strong><span>СИЛА</span></div>
          <span class="times">${icon("x", 14)}</span>
          <div class="score-block multiplier"><strong>6</strong><span>МНОЖ.</span></div>
          <span class="equals">=</span>
          <div class="total-score"><strong>414</strong><span>УРОНА</span></div>
        </div>
        ${rulesBlockHtml()}
        <span class="section-label">СТАРТОВЫЙ ОТРЯД</span>
        ${starterPickerHtml()}
        <span class="section-label">ЛИГА dotora · РАНГ СЛОЖНОСТИ</span>
        ${rankPickerHtml()}
        <div class="seed-row">
          <input id="seed-input" placeholder="Seed (пусто = случайный)" maxlength="12">
          <button class="primary-button" data-action="start">Начать забег ${icon("arrow", 15)}</button>
        </div>
        <div class="title-links">
          <button class="subtle-button" data-action="onboard-start">${icon("book", 13)}Как играть — 5 шагов</button>
          <span class="keyboard-divider">·</span>
          <span class="title-hint">Собирай формации из героев Dota: порядок слотов решает</span>
        </div>
      </div>
    </div>
    ${overlayHtml(state)}
    ${toastHtml()}`;
  }

  // ---------- route fork: развилка после лавки (спек §4, данные из ROUTES_DATA) ----------

  const ROUTE_GROUP_FOOT = {
    core: "Честный бой",
    combat: "Риск · награда",
    economy: "Золото сейчас",
    hand: "Стиль волны",
  };

  function routeCardHtml(state, opt, route, lines, index) {
    const cls = opt.id === "camp" ? "camp" : opt.id === "normal" ? "normal" : route.group;
    return `<button class="route-card ${cls}" data-action="take-route" data-kind="${opt.id}">
      <span class="route-emoji">${route.emoji}</span>
      <strong>${route.name}</strong>
      <div class="route-lines">${lines.map((l) => `<span>${l}</span>`).join("")}</div>
      <small>${ROUTE_GROUP_FOOT[route.group] || "Путь"} <kbd>${index + 1}</kbd></small>
    </button>`;
  }

  // Строки карточки генерируются из примитивов маршрута — новый маршрут в
  // ROUTES_DATA появляется на экране без правок UI.
  function routeCardLines(opt, route, nextDef, nextHp, baseRules) {
    const lines = [];
    if (route.id === "normal") {
      lines.push(`${nextDef.name} · ${fmt(nextHp)} HP`);
      lines.push(baseRules);
      lines.push("Полный темп забега");
      return lines;
    }
    if (route.hp) lines.push(`HP ×${route.hp} → ${fmt(Math.round(nextHp * route.hp))} HP`);
    if (route.randomHp) lines.push(`HP случайно ×${route.randomHp[0]}–×${route.randomHp[1]}`);
    if (route.hpPerItem) lines.push(`+${route.hpPerItem} HP за каждый твой предмет`);
    if (route.defensePerItem) lines.push(`+${route.defensePerItem} брони за каждый твой предмет`);
    if (route.modsRandom) lines.push(`Случайных правил на бой: ${route.modsRandom}`);
    if (route.gold) lines.push(route.gold > 0 ? `Сразу +${route.gold} золота` : `Сразу ${route.gold} золота`);
    if (route.gamble) lines.push(`${Math.round(route.gamble.chance * 100)}%: +${route.gamble.win} золота, иначе пусто`);
    if (route.gambleDice) lines.push(`Кость 1–6: +${route.gambleDice.join(", ")} золота`);
    if (route.allin) lines.push(`Всё золото на стол: ${Math.round(route.allin.chance * 100)}% → ×${route.allin.mult}`);
    if (route.gambleThree) lines.push(`Три двери: +15G / редкий предмет / пусто`);
    if (route.altar) lines.push(`Жертва до 10G → эпик, +25 силы или пусто`);
    if (route.loan) lines.push(`Заём +${route.loan.gain}G → вернуть ${route.loan.repay}G`);
    if (route.powerPerGold) lines.push(`Каждые 5G казны = +1 сила бою`);
    if (route.goldAll) lines.push(`ВСЁ золото сгорает`);
    if (route.momentumBonus) lines.push(`Импульс +${route.momentumBonus} серии`);
    if (route.exchangeItem) lines.push(`Случайный предмет → предмет той же редкости`);
    if (route.pawnBonus) lines.push(`Следующая продажа +${route.pawnBonus}% цены`);
    if (route.itemGiftNow) lines.push(`${route.itemGiftNow === "epic" ? "Эпический" : "Редкий"} предмет сразу`);
    if (route.freeCommons) lines.push(`${route.freeCommons} обычных товара — бесплатно`);
    if (route.shopSlots) lines.push(route.shopSlots < 0 ? `Товаров в лавке ${route.shopSlots}` : `Товаров в лавке +${route.shopSlots}`);
    if (route.shopInflation) lines.push(`Первая покупка −2G, дальше +1G`);
    if (route.hand) lines.push(route.hand > 0 ? `+${route.hand} карты в руке на волну` : `${route.hand} карта в руке на волну`);
    if (route.fights) lines.push(route.fights > 0 ? `+${route.fights} тимфайт` : `−${-route.fights} тимфайт`);
    if (route.power) lines.push(`+${route.power} силы каждому бою`);
    if (route.itemRarity) lines.push(`В лавке ждёт ${route.itemRarity === "epic" ? "эпик" : "редкий"} товар`);
    if (route.extraRecruit) lines.push(`Таверна: +${route.extraRecruit} герой`);
    if (route.recruitDiscount) lines.push(`Рекруты за ${Math.round(route.recruitDiscount * 100)}% цены`);
    if (route.maxSlots) lines.push(route.maxSlots > 5 ? `Шестой слот формации!` : `Только ${route.maxSlots} слот${route.maxSlots === 1 ? "" : "а"} отряда`);
    if (route.handShape) lines.push(`Первые ${route.handShape.firstN} карты ×${route.handShape.firstMult}, остальные ×${route.handShape.restMult}`);
    if (route.dupeHero) lines.push(`Копия случайного героя руки — в колоду`);
    if (route.burnUnused) lines.push(`Не зачистил сразу — карта руки сгорает`);
    if (route.randomCardMult) lines.push(`Случайная карта: множитель ×0.5–×2`);
    if (route.banAttrs) lines.push(route.banAttrs === 2 ? `Два случайных атрибута под запретом` : `Случайный атрибут под запретом`);
    if (route.bannedHero) lines.push(`Самый используемый герой отдыхает`);
    if (route.noRepeat) lines.push(`Герои прошлого боя недоступны`);
    if (route.wildcardCopy) lines.push(`Слабейший копирует сильнейшего (75%)`);
    if (route.twinsBonus) lines.push(`Повтор героя в отряде: +${route.twinsBonus}% урона`);
    if (route.goldenSlot) lines.push(`Случайная позиция: стоящему +50% силы`);
    if (route.blockedSlot) lines.push(`Одна позиция строя недоступна`);
    if (route.mercyWave) lines.push(`Провал не отнимет казарму — заберёт всё золото`);
    if (route.echoFirst) lines.push(`Первый бой: способности дважды`);
    if (route.minFights) lines.push(`Победа за 1 бой → награда вполовину`);
    if (route.exileWeakestPower) lines.push(`Слабейший колоды уходит: +${route.exileWeakestPower} силы`);
    if (route.returnHero) lines.push(`Последний уволенный вернётся бесплатно`);
    if (route.secondLife) lines.push(`Раз за забег провал спасёт казарму; награды −25%`);
    if (route.sin) lines.push(`Навсегда: +${route.sin.dmg}% урона, ${route.sin.discards} ТП-сброс`);
    if (route.routeUndo) lines.push(`Путь можно один раз отменить`);
    if (route.scout) lines.push(`Покажет следующие 3 башни`);
    if (route.shopPeek) lines.push(`Покажет товары следующей лавки`);
    if (route.scanner) lines.push(`Покажет точную защиту башни`);
    if (route.curse) lines.push(`Проклятие на башне`);
    if (opt.curse) {
      const curse = Content.modifiers.byId[opt.curse];
      lines.push(`Проклятие: ${curse.name} — ${curse.desc}`);
    }
    if (route.mods) lines.push("Правила: " + route.mods.map((id) => Content.modifiers.byId[id].name).join(", "));
    if (route.modsRandom) lines.push(`Случайных правил на бой: ${route.modsRandom}`);
    if (route.reward && route.hp) lines.push(`Награда ×${route.reward}`);
    if (route.gold) lines.push(route.gold > 0 ? `Сразу +${route.gold} золота` : `Сразу ${route.gold} золота`);
    if (route.gamble) lines.push(`${Math.round(route.gamble.chance * 100)}%: +${route.gamble.win} золота, иначе пусто`);
    if (route.shopPrice) lines.push(route.shopPrice < 1
      ? `Следующая лавка −${Math.round((1 - route.shopPrice) * 100)}%`
      : `Следующая лавка +${Math.round((route.shopPrice - 1) * 100)}%`);
    if (route.hand) lines.push(route.hand > 0 ? `+${route.hand} карты в руке на волну` : `${route.hand} карта в руке на волну`);
    if (route.fights) lines.push(route.fights > 0 ? `+${route.fights} тимфайт` : `−${-route.fights} тимфайт`);
    if (route.power) lines.push(`+${route.power} силы каждому бою`);
    if (route.itemRarity) lines.push(`В лавке ждёт ${route.itemRarity === "epic" ? "эпик" : "редкий"} товар`);
    // «Подсмотр»: вскрытые жребии развилки показываются точно.
    if (route.randomHp && opt.hpMultRoll != null) lines.push(`👁️ Точный HP: ${fmt(Math.round(nextHp * route.hp * opt.hpMultRoll))}`);
    if (opt.pinnedMods) lines.push("👁️ Правила: " + opt.pinnedMods.map((id) => Content.modifiers.byId[id].name).join(", "));
    lines.push(route.desc);
    return lines;
  }

  function renderRoute(state) {
    const nextIndex = state.run.waveIndex + 1;
    const nextDef = Content.waves.byId[Content.waves.order[nextIndex]];
    const nextHp = Math.round(nextDef.hp * Ranks.waveHpMult(state, nextIndex));
    const baseRules = (nextDef.modifiers || []).map((m) => Content.modifiers.byId[m.id].name).join(" · ") || "без модификаторов";
    const cards = (state.combat.routeOptions || []).map((opt, i) => {
      const route = Content.routes.byId[opt.id];
      return routeCardHtml(state, opt, route, routeCardLines(opt, route, nextDef, nextHp, baseRules), i);
    }).join("");
    const routeBtns = ownedActives(state, "route").map((u) => activeBtnHtml(state, u)).join("");
    const dezerterOk = Upgrades.canActivate(state, "dezertir").ok;
    const replaceRow = ownedActives(state, "route", true).length ? `<div class="route-replace-row">${(state.combat.routeOptions || [])
      .filter((o) => o.id !== "normal")
      .map((o) => {
        const route = Content.routes.byId[o.id];
        return `<button class="upg-active-btn route-replace" ${dezerterOk ? "" : "disabled"} data-action="activate-upgrade" data-upgrade="dezertir" data-target="${o.id}" data-tip>
          <span>🔄 ${route.emoji} ${route.name}</span><small>заменить</small>
          <span class="pop"><strong>🏃 Дезертир</strong><p>Заменить «${route.name}» новым путём.</p>${dezerterOk ? "" : "<small>Лимит на акт исчерпан</small>"}</span>
        </button>`;
      }).join("")}</div>` : "";
    app().innerHTML = `
      ${topbarHtml(state)}
      <main class="page-shell">
        <div class="game-layout two">
          <aside class="sidebar">${sidebarHtml(state, "meta")}</aside>
          <div class="play-area">
            <section class="route-screen panel">
              <span class="section-label mint">${icon("target", 15)}РАЗВИЛКА · ВОЛНА ${nextIndex + 1} ИЗ ${Content.waves.order.length}</span>
              <h2>Куда двинемся?</h2>
              <p class="route-sub">Следующая цель: <b>${nextDef.name}</b> · ${fmt(nextHp)} HP · ${baseRules}</p>
              ${routeBtns ? `<div class="route-actives">${routeBtns}</div>` : ""}
              <div class="route-cards ${UIState.animRoute ? "" : "no-anim"}">${cards}</div>
              ${replaceRow}
            </section>
          </div>
        </div>
      </main>
      ${debugPanelHtml(state)}
      ${overlayHtml(state)}
      ${toastHtml()}
    `;
    UIState.animRoute = false;
  }

  function renderWave(state) {
    const preview = computePreview(state);
    const harass = preview ? computeHarass(state) : 0;
    app().innerHTML = `
      ${topbarHtml(state)}
      <main class="page-shell">
        <div class="game-layout">
          <aside class="sidebar">${sidebarHtml(state, "wave")}</aside>
          ${battleSceneHtml(state, preview, harass)}
          ${contextPanelHtml(state, preview)}
        </div>
        ${bottomBandHtml(state)}
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
    const inflation = Ranks.has(state, "inflation") ? (state.run.inflationBuys || 0) : 0;
    const cap = Game.itemCapacity(state);
    // Следующая цель в шапке лавки (§1.4): башню видно до выхода в бой,
    // сайдбар и шапка никогда не показывают мёртвую башню.
    const nextId = Content.waves.order[state.run.waveIndex + 1];
    const nextDef = nextId ? Content.waves.byId[nextId] : null;
    const nextHp = nextDef ? Math.round(nextDef.hp * Ranks.waveHpMult(state, state.run.waveIndex + 1)) : 0;
    const offers = state.shop.offers.map((o) => {
      const item = Content.items.byId[o.id];
      const cost = Game.itemCost(state, item.id);
      const afford = state.run.gold >= cost;
      const blocked = Game.itemBlockedReason(state, item.id);
      const blockedLabel = blocked === "full"
        ? `Слоты ${state.player.items.length}/${cap.total}`
        : blocked === "class" ? `Нет слота ${SLOT_CLASS_ICONS[item.slotClass]} ${SLOT_CLASS_NAMES[item.slotClass]}` : "";
      const itemActs = ownedActives(state, "shop", true).map((u) => {
        const ok = Upgrades.canActivate(state, u.id).ok
          && (u.effect.type !== "buyOnDebt" || !blocked);
        return `<button class="icon-button small act-btn" ${ok ? "" : "disabled"} data-action="activate-upgrade" data-upgrade="${u.id}" data-target="${item.id}" data-tip>${u.emoji}
          <span class="pop side"><strong>${u.emoji} ${u.name}</strong><p>${esc(u.desc)}</p>${ok ? "" : `<small>Недоступно: ${Upgrades.canActivate(state, u.id).reason}</small>`}</span>
        </button>`;
      }).join("");
      return `<div class="shop-card ${item.rarity === "epic" ? "legendary" : ""}" data-action="item-open" data-id="${item.id}" title="Клик — полный разбор предмета">
        <div class="shop-card-top">
          <span class="rarity">${RARITY_NAMES[item.rarity]}</span>
          <span class="item-actives">${itemActs}</span>
          <button class="icon-button small lock-btn ${o.locked ? "locked" : ""}" data-action="lock" data-id="${item.id}" data-tip>${o.locked ? "🔒" : "🔓"}
            <span class="pop side"><strong>${o.locked ? "Залочен" : "Свободен"}</strong><p>Зафиксируй товар — он сохранится при обновлении лавки, остальные слоты перевыбросятся.</p></span>
          </button>
        </div>
        <div class="shop-card-art">${Art.itemIcon(item)}</div>
        <h3>${item.name}</h3>
        <p>${esc(item.desc)}</p>
        <span class="slot-class-tag">${SLOT_CLASS_ICONS[item.slotClass]} ${SLOT_CLASS_NAMES[item.slotClass]}</span>
        ${cost !== item.cost ? `<span class="price-note">${o.free ? "🎁 Сюрприз: бесплатно" : cost < item.cost ? "голод: −20%" : `инфляция: +${inflation}G`}</span>` : ""}
        <button class="buy-button" ${afford && !blocked ? "" : "disabled"} data-action="buy" data-id="${item.id}">
          <span>${o.free ? "Забрать" : blocked && blockedLabel ? blockedLabel : afford ? "Купить" : "Дорого"}</span><span>${cost} ${icon("coins", 13)}</span>
        </button>
      </div>`;
    }).join("");
    app().innerHTML = `
      ${topbarHtml(state)}
      <main class="page-shell">
        <div class="game-layout">
          <aside class="sidebar">${sidebarHtml(state, "meta")}</aside>
          <section class="shop panel">
            <div class="shop-banner">
              <div class="shop-emblem">${icon("bag", 30)}</div>
              <div><span class="section-label gold">ЛИНИЯ ЗАЧИЩЕНА</span><h2>Тайная лавка</h2>
                <p>Хороший предмет усиливает руку. Отличный — меняет весь билд.</p>
                ${nextDef ? `<p class="shop-next">${icon("target", 12)} Дальше: <b>${nextDef.name}</b> · ${fmt(nextHp)} HP · ${waveRuleText(nextDef)}</p>` : '<p class="shop-next">Дальше: финал забега</p>'}</div>
              <span class="shop-gold">${icon("coins", 24)}${state.run.gold}</span>
            </div>
            <div class="shop-section-title"><h3>Предметы торговца</h3>
              <button class="secondary-button" data-action="reroll" ${state.run.gold >= Game.rerollCost(state) ? "" : "disabled"}>${icon("rotate", 13)}Обновить <span>${Game.rerollCost(state)} ${icon("coins", 12)}</span></button></div>
            <div class="shop-items ${UIState.animShop ? "" : "no-anim"}">${offers || '<div class="empty-shop">Всё раскуплено. Обнови товары или отправляйся в бой.</div>'}</div>
            <div class="shop-upgrades">
              <div class="shop-section-title upgrade-title"><h3>🔧 Улучшения лавки <small class="upgrade-note">не занимают слоты предметов · кнопки активируются на своих экранах</small></h3>
                <span class="luck-badge" data-tip>🍀 Удача ${Upgrades.luck(state)}<span class="pop side"><strong>Удача ${Upgrades.luck(state)}</strong><p>Копится улучшениями (Подкова, Лапка, Клевер) и Пактом с Фортуны. Жирнее редкости предложений: с удачи 3 — пятая карточка, с 6 — шестая.</p></span></span>
                <span class="upgrade-owned">${(() => {
    const counts = {};
    for (const u of Upgrades.ownedDefs(state)) counts[u.id] = (counts[u.id] || 0) + 1;
    return Object.entries(counts).map(([id, n]) => {
      const u = Content.upgrades.byId[id];
      if (!u) return "";
      const inst = Upgrades.instanceOf(state, id);
      const lvl = inst.level > 1 ? ` ${Upgrades.roman(inst.level)}` : "";
      const acc = u.type === "active"
        ? ` · осталось: ${u.activation.access.charges != null ? `⚡${inst.charges}` : `${u.activation.access.act - inst.actUses}/${u.activation.access.act}`}`
        : "";
      return `<span class="upgrade-chip" data-tip>${u.emoji}${lvl}${n > 1 ? `<b>×${n}</b>` : ""}<span class="pop"><strong>${u.emoji} ${u.name}${lvl}${n > 1 ? " ×" + n : ""}</strong><p>${esc(upDescOf(state, u))}</p><small>${acc || "пассивное"}</small></span></span>`;
    }).join("");
  })()}</span>
                  ${(state.run.handSlots || 0) ? `<span class="upgrade-chip" data-tip>🎒<span class="pop"><strong>Запасные слоты ×${state.run.handSlots}</strong><p>Рука больше на ${state.run.handSlots} карты. Следующий уровень — ${Upgrades.handSlotDef(state).cost} G.</p></span></span>` : ""}
                  ${(state.run.attrCharges || 0) ? `<span class="upgrade-chip" data-tip>🧪<span class="pop"><strong>Зелья атрибута: ${state.run.attrCharges}</strong><p>Заряды смены атрибута — трать в лаборатории колоды (кнопки ◆ ✦ ✺ ◈ у героя).</p></span></span>` : ""}
                ${ownedActives(state, "shop").filter((u) => !u.activation.target).map((u) => activeBtnHtml(state, u)).join("")}
                ${(state.run.energy || 0) ? `<span class="energy-badge" data-tip>⚡ ${state.run.energy}<span class="pop side"><strong>Энергия</strong><p>Копится Конденсатором за активации. Тратится Перегрузкой.</p></span></span>` : ""}
                <button class="secondary-button upgrade-reroll" data-action="reroll-upgrades" ${state.run.gold >= Upgrades.REROLL_COST || (Game.hasItemRule(state, "freeUpgradeReroll") && !state.run.ledgerRerollUsed) ? "" : "disabled"}>${icon("rotate", 12)}Обновить <span>${Game.hasItemRule(state, "freeUpgradeReroll") && !state.run.ledgerRerollUsed ? "0" : Upgrades.REROLL_COST} ${icon("coins", 11)}</span></button>
              </div>
              <div class="upgrade-row ${UIState.animShop ? "" : "no-anim"}">
                ${(state.shop.upgrades || []).map((o) => {
    const up = o.id === Upgrades.HAND_SLOT_ID ? Upgrades.handSlotDef(state)
      : o.id === Upgrades.ATTR_POTION_ID ? Upgrades.attrPotionDef(state)
      : o.id === Upgrades.RECHARGE_ID ? Upgrades.rechargeDef(state)
      : Content.upgrades.byId[o.id];
    const isTier = !!o.tier;
    const lvl = up.repeatable ? ` ×${(state.run.handSlots || 0) + 1}` : "";
    // Ступень уровневого дефа стоит кратно уровню (II = ×2 к цене и эффекту).
    const cost = isTier ? up.cost * o.tier : up.cost;
    const afford = state.run.gold >= cost;
    const name = isTier ? `${up.name} ${Upgrades.roman(o.tier)}` : `${up.name}${lvl}`;
    const upDesc = isTier
      ? (up.levels && up.levels[o.tier - 1] ? up.levels[o.tier - 1].desc : up.desc)
      : upDescOf(state, up);
    const accLine = up.type === "active"
      ? `<small class="upg-acc">🔘 Кнопка ${Upgrades.CONTEXT_LABELS[up.activation.context]} · ${Upgrades.accessLabel(up)}${up.activation.target === "item" ? " (на товаре)" : up.activation.target === "routeOption" ? " (на пути)" : ""}</small>`
      : "";
    return `<div class="upgrade-card ${up.rarity}" data-tip>
                  <span class="upgrade-emoji">${up.emoji}</span>
                  <div class="upgrade-info"><strong>${name}</strong><small>${esc(upDesc)}</small>${accLine}</div>
                  <button class="buy-button upgrade-buy" ${afford ? "" : "disabled"} data-action="buy-upgrade" data-id="${up.id}">
                    <span>${afford ? (isTier ? "Усилить" : "Купить") : "Дорого"}</span><span>${cost} ${icon("coins", 12)}</span>
                  </button>
                  <span class="pop"><strong>${up.emoji} ${name}</strong><p>${esc(upDesc)}</p><small>${UPGRADE_RARITY_NAMES[up.rarity]}${up.type === "active" ? ` · кнопка ${Upgrades.CONTEXT_LABELS[up.activation.context]}` : " · пассивное"} · покупается один раз за забег</small></span>
                </div>`;
  }).join("") || '<span class="muted-note">Улучшения раскуплены — приходи в следующей лавке или обнови.</span>'}
              </div>
            </div>
            ${(state.shop.aghanims || []).length ? `<div class="shop-aghanims">
              <div class="shop-section-title"><h3>🟣 Аугменты Аганима <small class="upgrade-note">осколок — 55% в каждой лавке · скипетр — гарантия после босса акта · не занимают слоты предметов</small></h3></div>
              <div class="recruit-row ${UIState.animShop ? "" : "no-anim"}">${state.shop.aghanims.map((o) => {
    const aug = Content.aghanims.forHero(o.heroId, o.kind);
    const hero = Content.heroes.byId[o.heroId];
    const afford = state.run.gold >= aug.cost;
    const kindLabel = o.kind === "scepter" ? "Скипетр Аганима" : "Осколок Аганима";
    return `<div class="recruit-card augh-card ${o.kind}" data-tip>
                  <div class="recruit-portrait">${Art.heroArt(hero)}<i class="augh-emoji">${aug.emoji}</i></div>
                  <div class="recruit-info">
                    <small class="augh-kind">${kindLabel} · ${hero.name}</small>
                    <strong>${aug.name}</strong>
                    <small>${esc(aug.desc)}</small>
                  </div>
                  <button class="buy-button recruit-buy" ${afford ? "" : "disabled"} data-action="buy-augh" data-hero="${o.heroId}" data-kind="${o.kind}">
                    <span>${afford ? "Купить" : "Дорого"}</span><span>${aug.cost} ${icon("coins", 13)}</span>
                  </button>
                  <span class="pop"><strong>${aug.emoji} ${aug.name} — ${hero.name}</strong><p>${esc(aug.desc)}</p><small>${kindLabel}: ${o.kind === "scepter" ? "меняет поведение героя" : "малое изменение паттерна"} · при увольнении героя возвращается половина цены</small></span>
                </div>`;
  }).join("")}</div>
            </div>` : ""}
            <div class="shop-lab">
              <div class="shop-lab-head">
                <h3>${icon("layers", 14)} Лаборатория колоды</h3>
                <span class="lab-shop-actions">
                  <button class="secondary-button train-button" data-action="open-training" title="Тренировка: +1 к рангу героя навсегда">🏋️ Тренировать · ${Game.TRAIN_COST} ${icon("coins", 12)}</button>
                  <button class="secondary-button exile-button" data-action="open-collection-deck" title="Безвозвратное удаление героя из колоды">${state.run.campBoon ? "Уволить бесплатно 🏕️" : `Уволить · ${Game.EXILE_COST} ${icon("coins", 12)}`}</button>
                </span>
              </div>
              <div class="recruit-row ${UIState.animLab ? "" : "no-anim"}">
                ${(state.shop.recruits || []).length ? state.shop.recruits.map((heroId) => {
      const hr = Content.heroes.byId[heroId];
      const price = Game.recruitPrice(heroId);
      const afford = state.run.gold >= price;
      return `<div class="recruit-card ${hr.attr}" data-tip>
                      <div class="recruit-portrait">${Art.heroArt(hr)}<b>${hr.power}</b></div>
                      <div class="recruit-info"><strong>${hr.name}</strong>
                        <span class="hero-attribute">${ATTR_SYMBOLS[hr.attr]} ${ATTR_NAMES[hr.attr]}</span>
                        <small>${heroDesc(hr)}</small></div>
                      <button class="buy-button recruit-buy" ${afford ? "" : "disabled"} data-action="buy-recruit" data-id="${heroId}">
                        <span>Нанять</span><span>${price} ${icon("coins", 13)}</span>
                      </button>
                      <span class="pop"><strong>${hr.name}</strong><p>${esc(heroDesc(hr))}</p><small>${ATTR_NAMES[hr.attr]}, сила ${hr.power} · попадёт в колоду</small></span>
                    </div>`;
    }).join("") : '<span class="muted-note">Таверна пуста — все ростерные герои уже у тебя.</span>'}
              </div>
              <small class="shop-hint left">Нанятые герои попадают в колоду. В коллекции (вкладка «Колода») можно тренировать героев: +1 ранг за ${Game.TRAIN_COST} 💰.</small>
            </div>
            <div class="shop-bottom">
              <span class="shop-hint-row"><kbd>1</kbd>–<kbd>5</kbd> купить <span class="keyboard-divider">·</span> <kbd>R</kbd> обновить <span class="keyboard-divider">·</span> <kbd>↵</kbd> следующая волна</span>
              <button class="primary-button" data-action="leave-shop">Следующая волна ${icon("arrow", 17)}</button>
            </div>
          </section>
          ${contextPanelHtml(state, null)}
        </div>
        ${bottomBandHtml(state)}
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

  // Лидерборд (фаза H): 4 вида из спека §8.1.
  function leaderboardHtml() {
    const list = UIState.scores || [];
    const view = UIState.scoreView || "score";
    const views = [
      ["score", "Лучший счёт"],
      ["rank", "Высший ранг"],
      ["fastest", "Быстрейшая победа"],
      ["nodeath", "Без смертей"],
    ];
    const fmtTime = (ms) => {
      const t = Math.round(ms / 1000);
      return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
    };
    let rows = [];
    if (view === "score") rows = list.slice().sort((a, b) => b.score - a.score).slice(0, 8);
    else if (view === "rank") rows = list.slice().sort((a, b) => b.rank - a.rank || b.score - a.score).slice(0, 8);
    else if (view === "fastest") rows = list.filter((e) => e.won).sort((a, b) => a.timeMs - b.timeMs).slice(0, 8);
    else if (view === "nodeath") rows = list.filter((e) => e.won && !e.deaths).sort((a, b) => b.score - a.score).slice(0, 8);
    const tabs = views.map(([key, label]) => `<button class="${view === key ? "active" : ""}" data-action="score-view" data-view="${key}">${label}</button>`).join("");
    const body = rows.length ? rows.map((e, i) => `
        <div class="score-row ${i === 0 ? "top" : ""}">
          <span class="score-pos">${i + 1}</span>
          <b class="score-num">${e.score.toLocaleString("ru")}</b>
          <span class="score-rank">${(Content.ranks.byId[e.rank] || {}).roman || e.rank}</span>
          <span class="score-waves">${e.waves}/15 волн${e.won ? " 🏆" : ""}</span>
          <span class="score-time">${fmtTime(e.timeMs)}${e.deaths ? ` · ${e.deaths} ${e.deaths === 1 ? "смерть" : "смертей"}` : " · без смертей"}</span>
          <span class="score-seed">#${esc(e.seed)}</span>
        </div>`).join("") : `<div class="score-empty">${view === "fastest" || view === "nodeath" ? "Пока нет подходящих забегов — победи!" : "Пока пусто. Первый забег — уже рекорд."}</div>`;
    return `<section class="score-board panel">
      <div class="section-label"><span>${icon("crown", 13)}ЗАЛ СЛАВЫ</span></div>
      <div class="score-tabs">${tabs}</div>
      <div class="score-rows">${body}</div>
    </section>`;
  }

  function endScreen(state, won) {
    const rank = Ranks.rankOf(state);
    const banner = won && UIState.unlockBanner
      ? `<div class="unlock-banner">${icon("crown", 18)}<span>ОТКРЫТ РАНГ <b>«${esc(UIState.unlockBanner)}»</b> — он ждёт тебя в новом забеге</span></div>`
      : "";
    app().innerHTML = `
      ${topbarHtml(state)}
      <main class="page-shell">
        <div class="game-layout two">
          <aside class="sidebar">${sidebarHtml(state, "meta")}</aside>
          <div class="play-area">
            <section class="end-screen panel">
              <div class="end-emblem">${won ? icon("crown", 64) : icon("skull", 64)}</div>
              <span class="section-label">${won ? "ДРЕВНИЙ ПАЛ" : "КРЕПОСТЬ РАЗРУШЕНА"}</span>
              <h2>${won ? "Это был легендарный забег." : "Каждый конец — новая раздача."}</h2>
              <p>${won
      ? `${Content.waves.order.length} волн, три акта. Один невероятный билд. Серия: ${state.run.momentum || 0} волн импульса.`
      : "Попробуй другой билд: ставка, импульс и контры боссов решают."}</p>
              <div class="end-rank" style="--medal:${rank.color}">
                <span class="medal-gem big ${rank.papochka ? "papochka" : ""}" style="--medal:${rank.color}">${rank.roman}</span>
                <div><small>РАНГ ЗАБЕГА</small><strong>${esc(rank.name)}</strong><em>«${esc(rank.quote || "")}»</em></div>
              </div>
              ${banner}
              <div class="end-stats">
                <div><strong>${Game.scoreOf(state).toLocaleString("ru")}</strong><span>Счёт${UIState.newRecord ? ' <b class="record-badge">🏆 рекорд</b>' : ""}</span></div>
                <div><strong>${state.run.waveIndex + (won ? 1 : 0)}</strong><span>Волн пройдено</span></div>
                <div><strong>${state.stats.totalDamage.toLocaleString("ru")}</strong><span>Всего урона</span></div>
                <div><strong>${state.stats.biggestHit.toLocaleString("ru")}</strong><span>Лучший тимфайт</span></div>
              </div>
              ${(() => { const n = (((state.run.upgradeState || {}).vozvrat || {}).charges) || 0; return n ? `<small class="end-note">Включая +${(n * 100).toLocaleString("ru")} очков за неиспользованные заряды «Второго дыхания»</small>` : ""; })()}
              ${leaderboardHtml()}
              <button class="primary-button" data-action="open-modal" data-modal="new">${icon("rotate", 16)}Ещё один забег</button>
            </section>
          </div>
        </div>
      </main>
      ${overlayHtml(state)}
      ${toastHtml()}
    `;
  }

  // ---------- overlays: outcome / modals / onboarding / toast ----------

  function outcomeModalHtml(state) {
    const outcome = state.combat.outcome;
    if (!outcome) return "";
    const res = state.combat.lastResolution;
    if (outcome === "cleared") {
      const mom = state.run.momentum || 0;
      // Лига Титанов: после босса акта — выбор проклятия забега вместо кнопки лавки.
      if (state.run.pendingCurse) {
        const cards = state.run.pendingCurse.map((curseId) => {
          const curse = Content.rankCurses.byId[curseId];
          return `<button class="curse-card" data-action="choose-curse" data-curse="${curseId}">
            <span class="curse-emoji">${curse.emoji}</span>
            <strong>${curse.name}</strong>
            <p>${esc(curse.desc)}</p>
          </button>`;
        }).join("");
        return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true">
          <div class="outcome-emblem lose">${icon("skull", 44)}</div>
          <span class="section-label lose-text">ЛИГА ТИТАНОВ · АКТ ${state.run.act} ПРОЙДЕН</span>
          <h2>Выбери свою боль</h2>
          <p class="modal-description">Проклятие забега остаётся до конца. Отказаться нельзя.</p>
          <div class="curse-cards">${cards}</div>
        </section></div>`;
      }
      return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true">
        <div class="outcome-emblem win">${icon("check", 44)}</div>
        <span class="section-label mint">ВОЛНА ЗАЧИЩЕНА</span>
        <h2>${state.combat.wave.isBoss ? (state.run.waveIndex >= Content.waves.order.length - 1 ? "Трон пал!" : "Акт пройден!") : "Башня пала."}</h2>
        <div class="outcome-rows">
          <div><span>Зачистка</span><b>${icon("coins", 13)}+${state.combat.wave.gold || Game.WAVE_CLEAR_GOLD}</b></div>
          ${state.combat.wave.isBoss && state.run.waveIndex < Content.waves.order.length - 1 ? `<div><span>Акт пройден</span><b>${icon("coins", 13)}+10 · ${icon("shield", 13)}+1 казарма</b></div>` : ""}
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
      ${(() => {
        const ok = (state.run.upgrades || []).includes("peresdacha") && Upgrades.canActivate(state, "peresdacha").ok;
        return ok ? `<button class="secondary-button full-width" data-action="retry-free" data-upgrade="peresdacha" data-tip>🕯️ Пересдача — казарма цела<span class="pop"><strong>🕯️ Пересдача</strong><p>Переиграть волну, не теряя казарму и смерть в зачёте.</p></span></button>` : "";
      })()}
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
    const focusCls = UIState.labFocus === "train" ? "focus-train" : UIState.labFocus === "exile" ? "focus-exile" : "";
    // Модалка уже открыта (смена отряда/ранга в «Ещё один забег» и т.п.):
    // полный ререндер пересоздаёт DOM — не проигрывать появление заново,
    // иначе окно мигает при каждом клике.
    const keep = document.querySelector(".modal-backdrop") ? " no-anim" : "";
    return `<div class="modal-backdrop${keep}" data-action="modal-backdrop"><section class="modal ${wide} ${focusCls}" role="dialog" aria-modal="true">
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
    const comboRows = Content.formations.list.map((f) => `<div><span><strong>${f.name}</strong><small>${Content.damageTypeNames[f.damageType] || f.damageType}${f.positional ? " · порядок" : ""}</small></span><span>${f.rule}</span>
          <span><b class="mint">${f.basePower}</b><span class="table-x">✕</span><b class="gold">${f.baseMult}</b></span></div>`).join("")
      + Content.bonds.list.map((b) => {
        const val = [b.power ? `+${b.power} силы` : "", b.mult ? `+${b.mult} множ.` : ""].filter(Boolean).join(", ");
        return `<div><span><strong>Связка «${b.trait}»</strong><small>складывается</small></span><span>${val || "—"}</span>
          <span><b class="gold">${val}</b></span></div>`;
      }).join("");
    return `<span class="section-label mint">${icon("book", 15)}СПРАВОЧНИК</span>
      <h2>Формации. Порядок решает.</h2>
      <p class="modal-description">Формация — одна лучшая по итоговому урону против цели: часть правил читает порядок слотов. Связки активны все сразу и складываются. Тип урона встречается с защитой башни: физический — минус броня, магический — минус сопротивление, чистый — игнорирует всё. Альтернативы и связки видны в панели справа.</p>
      <div class="help-steps">${steps.map((s, i) => `<div><span>0${i + 1}</span><strong>${s.title}</strong><p>${s.body}</p></div>`).join("")}</div>
      <div class="combo-table">
        <div class="table-head"><span>КОМБИНАЦИЯ</span><span>УСЛОВИЕ</span><span>СИЛА ✕ МНОЖ.</span></div>
        ${comboRows}
      </div>
      <div class="help-note">${icon("help", 17)}<p><strong>Не нравится рука?</strong> ТП-сброс (R) заменит выбранных героев, не расходуя тимфайт. Сброс с Crystal Maiden приносит +2 золота. Оверкилл — золото, точный ласт-хит — ещё +5.</p></div>
      <span class="section-label mint">${icon("book", 15)}СЛОВАРЬ</span>
      <div class="glossary">
        <div><strong>Кэрри</strong><p>Главный герой отряда — самый сильный. В «4 Protect 1» он стоит в центре, а четыре героя-свиты его прикрывают.</p></div>
        <div><strong>Свита</strong><p>Четыре героя вокруг кэрри. Им не нужно быть сильными — они дают формацию, связки и свои способности.</p></div>
        <div><strong>Слот / позиция</strong><p>Порядок, в котором ты выбрал героев: первый выбранный — слот 1. Часть формаций и способностей читает позицию: «Фронт» — слоты 1–2, «Тыл» — два последних, «Клин» — центр строя.</p></div>
        <div><strong>Фронт / Тыл</strong><p>Связки: «Фронт» — два Силовика в первых слотах (+сила), «Тыл» — два Интеллекта в последних (+множитель).</p></div>
        <div><strong>Ганг</strong><p>Связка за пару героев одинакового ранга: сходили вдвоём на одного — получи +силы.</p></div>
        <div><strong>Цепочка</strong><p>Связка за три ранга подряд (например 4-5-6) в любой позиции строя.</p></div>
        <div><strong>Флеш («Тимфайт атрибута»)</strong><p>Пять героев одного цвета-атрибута. Даёт большой бонус и тип урона по доминирующему атрибуту отряда.</p></div>
        <div><strong>Тимвайп</strong><p>«Убийство всей команды». Формация-топ: полная пятёрка с пятью рангами подряд и тремя атрибутами.</p></div>
        <div><strong>Тип урона</strong><p>Физический — режется бронёй, магический — сопротивлением, чистый — игнорирует всё. Смотри «Следующую цель»: против брони бери чистый или магический, против сопротивления — физический.</p></div>
        <div><strong>Ставка</strong><p>Сколько героев отправил в бой: 1 — харас (+1 золото), 4 — ×1.1 к урону, 5 — ×1.25. Больше героев — больше урона, но рука пустеет.</p></div>
        <div><strong>Импульс</strong><p>Серия зачищенных волн подряд: +5% урона за каждую. Провал сбрасывает серию.</p></div>
      </div>
      <span class="section-label mint">${icon("crown", 15)}ЛИГА dotora · РАНГИ</span>
      <p class="modal-description">Ранг задаётся перед забегом. Правила наслаиваются: ранг N держит всё, что дали ранги 1..N. Победа на ранге открывает следующий.</p>
      <div class="combo-table rank-table">
        <div class="table-head"><span>РАНГ</span><span>ПРАВИЛА ЛИГИ</span><span>HP ✕ НАГРАДА</span></div>
        ${Content.ranks.list.map((r) => `<div><span><strong>${r.roman} · ${r.name}</strong><small>${esc(r.quote || "")}</small></span><span>${rankNotes(r.id).length ? esc(rankNotes(r.id).join(" · ")) : "обычная игра"}</span>
          <span><b class="gold">×${r.hpMult}</b><span class="table-x">·</span><b class="mint">×${r.goldMult}</b></span></div>`).join("")}
      </div>`;
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
            <span class="hero-attribute">${ATTR_SYMBOLS[Game.heroAttr(state, hr.id)]} ${ATTR_NAMES[Game.heroAttr(state, hr.id)]}${Game.heroAttr(state, hr.id) !== hr.attr ? " (зелье)" : ""} · сила ${rank}${(state.run.heroXp || {})[hr.id] ? ` · опыт ${(state.run.heroXp || {})[hr.id]} (ур. ${Game.heroLevel(state, hr.id)})` : ""}</span>
            <p>${heroDesc(hr)}</p>
            <small class="gold">${where}</small>
            <small class="augh-lab">${["shard", "scepter"].map((k) => {
      const a = Content.aghanims.forHero(hr.id, k);
      if (!a) return "";
      const owned = !!((state.run.aghanims || {})[hr.id] || {})[k];
      const label = k === "scepter" ? "Скипетр Аганима" : "Осколок Аганима";
      return `<span class="augh-tip ${owned ? "owned" : ""}">${a.emoji} <b>${label} · ${a.name}</b><span class="augh-desc">${esc(a.desc)}</span></span>`;
    }).filter(Boolean).join("")}</small>
            ${labMode ? `<div class="attr-change-row">${["str", "agi", "int", "uni"].map((a) => {
      const cur = Game.heroAttr(state, hr.id);
      const has = (state.run.attrCharges || 0) > 0;
      return `<button class="attr-change ${a} ${cur === a ? "current" : ""}" data-action="change-attr" data-id="${hr.id}" data-attr="${a}"
                ${!has || cur === a ? "disabled" : ""} title="Сменить атрибут на ${ATTR_NAMES[a]} (1 заряд зелья)">${ATTR_SYMBOLS[a]}</button>`;
    }).join("")}${(state.run.attrCharges || 0) === 0 ? '<small class="attr-hint">нет зарядов — купи «Зелье атрибута» в лавке</small>' : ""}</div>` : ""}
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
      ${state.phase === "shop" && UIState.labFocus === "train" ? `<div class="lab-focus-banner train">🏋️ Режим тренировки: +1 к рангу героя за ${Game.TRAIN_COST} G — навсегда, влияет на силу в бою.</div>` : ""}
      ${state.phase === "shop" && UIState.labFocus === "exile" ? `<div class="lab-focus-banner exile">⚔️ Режим увольнения: герой покинет колоду${state.run.campBoon ? " бесплатно (привал лагеря)" : ` за ${Game.EXILE_COST} G`}.</div>` : ""}
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
        <p><span>Лавка: купить / обновить / дальше</span><kbd>1–5 · R · ↵</kbd></p>
        <p><span>Развилка: выбрать тропу</span><kbd>1 – 3</kbd></p>
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
    return `<div class="reset-icon">${icon("rotate", 28)}</div>
      <h2>Ещё один забег?</h2>
      <p class="modal-description">Текущий прогресс будет сброшен. Тот же seed — тот же забег: удачи можно проверить дважды.</p>
      <span class="section-label">СТАРТОВЫЙ ОТРЯД</span>
      ${starterPickerHtml()}
      <span class="section-label">РАНГ СЛОЖНОСТИ</span>
      ${rankPickerHtml()}
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

  // Пикер сброса «Второго дыхания»: клик по карте возвращает её в руку.
  function discardPickerHtml(state) {
    const uids = (state.player.discardUids || []).filter((uid) => state.cards[uid]);
    return `<span class="section-label mint">♻️ ВТОРОЕ ДЫХАНИЕ</span>
      <h2>Кого вернуть в руку?</h2>
      <p class="modal-description">Карта вернётся из сброса — спишется один заряд.</p>
      ${uids.length ? `<div class="recruit-row">${uids.map((uid) => {
        const hero = Content.heroes.byId[state.cards[uid].heroId];
        return `<div class="recruit-card ${Game.heroAttr(state, hero.id) !== hero.attr ? Game.heroAttr(state, hero.id) : hero.attr}" data-action="pick-discard" data-uid="${uid}" role="button" data-tip>
          <div class="recruit-portrait">${Art.heroArt(hero)}<b>${hero.power}</b></div>
          <div class="recruit-info"><strong>${hero.name}</strong>
            <span class="hero-attribute">${ATTR_SYMBOLS[Game.heroAttr(state, hero.id)]} ${ATTR_NAMES[Game.heroAttr(state, hero.id)]}</span>
            <small>${esc(heroDesc(hero))}</small></div>
        </div>`;
      }).join("")}</div>` : '<div class="muted-note">Сброс пуст — заряд останется при тебе.</div>'}`;
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
      case "discard-pick": return discardPickerHtml(state);
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
      // Крупный красный «КРИТ!» поверх урона: шанс-эффекты должны быть явно
      // подтверждены после боя (ПА, Daedalus, Bloodthorn).
      if ((resolution.crits || []).length) {
        const crit = document.createElement("div");
        crit.className = "crit-burst";
        crit.innerHTML = `КРИТ!<small>${esc(resolution.crits.join(" · "))}</small>`;
        battlefield.appendChild(crit);
        setTimeout(() => crit.remove(), 1400);
      }
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
      }, 80 + i * 140));
    });
    timers.push(setTimeout(finish, 300 + resolution.steps.length * 140 + 500));
  }

  // ---------- entry ----------

  function app() {
    return document.getElementById("app");
  }

  function render(state) {
    document.body.classList.toggle("reduced-motion", !UIState.motion);
    // Покупки в лавке не должны поднимать скролл наверх: запоминаем позиции
    // прокручиваемых контейнеров и возвращаем их после перерисовки.
    const prevShop = document.querySelector(".shop");
    const shopScroll = prevShop ? prevShop.scrollTop : 0;
    const prevModal = document.querySelector(".modal");
    const modalScroll = prevModal ? prevModal.scrollTop : 0;
    switch (state.phase) {
      case "title": renderTitle(state); break;
      case "wave": renderWave(state); break;
      case "route": renderRoute(state); break;
      case "shop": renderShop(state); break;
      case "victory": renderVictory(state); break;
      case "gameover": renderGameover(state); break;
    }
    const shop = document.querySelector(".shop");
    if (shop && shopScroll) shop.scrollTop = shopScroll;
    const modal = document.querySelector(".modal");
    if (modal && modalScroll) modal.scrollTop = modalScroll;
  }

  return { render, UIState, handOrder, playFightAnimation, toast, tipText: (i) => TIPS[i % TIPS.length].t + " " + TIPS[i % TIPS.length].p };
})();
