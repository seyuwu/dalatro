// dotora — tutorial: интерактивный онбординг первого запуска. Принцип:
// одна строка на подсказку, объяснение в момент действия, ноль «лекций».
// Режим проведения: на каждом шаге заблокирован весь экран, кроме цели
// шага (4 шторы вокруг неё); следующее наступает само от действия игрока.
// Слой живёт вне #app (перерендеры не стирают), факты — в localStorage
// "dotora_tut_v1" (JSON: { main, shop, route, mines, flash }). Точка входа
// одна: ui.js в конце render() зовёт Tutorial.observe(state). // TUTORIAL
//
// Главный сценарий (идёт один раз, на первой волне):
//   build     — титул: «выбери билд», кликабельны только стартеры
//   start     — «начать забег», кликабельна строка сида с кнопкой
//   enemy     — затемнение: «вот твой враг» + что такое тимфайты (попытки
//               на башню), клик в любом месте продолжает
//   hand      — строка над рукой, кликабельны только карты руки
//   num1      — спотлайт ВЫБРАННОЙ КАРТОЧКИ (кольцо), при этом дырка — вся
//               рука: цифра = сила (складывается в удар), цвет фона =
//               атрибут (материал комбо/связок), а второго героя надо
//               реально выбрать. Без автозакрытия: уходит по второму герою
//               или «не сейчас»
//   starHint  — пульс на карте Dawnbreaker, кликабельна только она
//   move      — «зажми и тащи», кликабельны строй (и рука, пока герой один)
//   ability   — показывается, когда способность звезды ВИДНА в превью боя
//               («+N к множителю — это она», кольцо на блоке «МНОЖ»); экран
//               заблокирован, авто-макс 7с, есть «не сейчас»
//   fight     — кликабельна только кнопка «В бой»
//   postwait  — пауза на боевую анимацию/модалку исхода
//   fights    — «тимфайты — попытки на башню: бей и добивай, урон остаётся»
//               (открытая записка: «не сейчас» или сброс игрока → tp)
//   tp        — «R — новая рука, тимфайт не тратится» (открытая записка)
//
// Подсказки первого раза (живут и после сценария, помечаются показом):
//   shop/route/mines — записка-пилюля сверху; flash — «3 одного цвета — до
//   флеша один шаг». Записки ничего не блокируют.
(function () {
  "use strict";

  const KEY = "dotora_tut_v1";
  const ANIM_WAIT_MS = 2600; // дольше самой долгой боевой анимации

  const ATTR = {
    str: { sym: "◆", name: "Сила", color: "#d58b76" },
    agi: { sym: "✦", name: "Ловкость", color: "#acc778" },
    int: { sym: "✺", name: "Интеллект", color: "#85b6d7" },
    uni: { sym: "◈", name: "Универсал", color: "#b5a1cf" },
  };

  // Человекочитаемые эффекты для карточки способности звезды, если это не
  // Dawnbreaker (у той — авторский текст по факту срабатывания).
  const EFFECT_COPY = {
    ADD_POWER: (v) => `+${v} силы`,
    ADD_MULT: (v) => `+${v} к множителю`,
    MULT_MULT: (v) => `×${v} к множителю`,
    FINAL_MULT: (v) => `×${v} к финальному урону`,
    GOLD: (v) => `+${v} золота`,
    WEAKEST_POWER_DOUBLE: () => "слабейший в отряде бьёт ×2",
    REFRESH_HERO_TRIGGERS: () => "способности отряда срабатывают дважды",
  };
  const COMBO_NAMES = { high_card: "Харас", pair: "Дуо на линии", two_pair: "Ротация", three: "Ганг", straight: "Смок на Рошана", flush: "Командный флеш", full_house: "4 Protect 1" };
  const WHEN_COPY = {
    COMBO_IS: (v) => `комбо «${COMBO_NAMES[v] || v}»`,
    COMBO_MIN: (v) => `комбо ранга ${v}+`,
    SLOT_IS: (v) => `слот ${v}`,
    PLAYED_COUNT_IS: (v) => `отряд ровно из ${v}`,
    PLAYED_COUNT_ABOVE: (v) => `в отряде больше ${v}`,
    POWER_ABOVE: (v) => `сила выше ${v}`,
    EXISTS_ATTRIBUTE: (v) => `рядом есть ${ATTR[v] ? ATTR[v].name : v}`,
    NEIGHBOR_ATTR_IS: (v) => `сосед — ${ATTR[v] ? ATTR[v].name : v}`,
    TAG_IS: (v) => `свойство «${v}»`,
    HAS_ITEM: (v) => `предмет «${v}»`,
  };

  const FIGHT_BEATS = ["hand", "num1", "starHint", "move", "ability", "fight", "waitfight"];

  let armed = false;        // первый observe прошёл: решено, показывать ли
  let active = false;       // главный сценарий в работе
  let notesOn = false;      // подсказки первого раза включены
  let step = "build";
  let layer = null;
  let paintedKey = null;
  let prev = null;
  let lastState = null;
  let pendingPost = null;   // { wave, at } — бой сыгран, ждём конца анимации
  let postTimer = null;
  let autoTimer = null;     // автозакрытие карточки (hover ставит на паузу)
  let currentNote = null;   // { id, emoji, text } — записка первого раза
  let settleToken = 0;      // отменяет прошлый burst перекрасок при новой карточке

  // Первая отрисовка карточки почти всегда обгоняет раскладку: шрифты и
  // картинки с CDN доезжают позже и сдвигают контент под фиксированной
  // карточкой. Resize/scroll этих сдвигов не ловят, рендеров в это время
  // нет — догоняем серией перекрасок вслед за загрузкой.
  function armSettlePaints() {
    if (typeof setTimeout !== "function") return; // тестовая песочница без таймеров
    const token = ++settleToken;
    [250, 700, 1600, 3000].forEach((ms) => {
      setTimeout(() => { if (token === settleToken) paint(); }, ms);
    });
  }

  // ---------- storage ----------

  function data() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      if (raw.startsWith("{")) return JSON.parse(raw);
      return { main: raw }; // старые строковые значения ("done"/"skip"/"seen")
    } catch (e) { return null; }
  }
  function mark(patch) {
    const d = data() || {};
    try { localStorage.setItem(KEY, JSON.stringify({ ...d, ...patch })); } catch (e) { /* приватный режим */ }
  }

  // ---------- каркас слоя ----------

  function ensureLayer() {
    if (layer) return layer;
    layer = document.createElement("div");
    layer.id = "tut-layer";
    document.body.appendChild(layer);
    // Слушатели — один раз на сессию: dropLayer() убирает слой, но не их,
    // и без флага каждый новый слой добавлял бы дубликаты.
    if (!window.__tutPaintBound) {
      window.__tutPaintBound = true;
      // Каждое внешнее событие (рендер экрана, resize, scroll, полная загрузка)
      // перезапускает серию догоняющих перекрасок: шрифты и картинки с CDN
      // сдвигают контент после отрисовки карточки, и одиночной подгонки мало.
      const repaint = () => { paint(); armSettlePaints(); };
      window.addEventListener("resize", repaint);
      window.addEventListener("scroll", repaint, true);
      window.addEventListener("load", repaint);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(repaint);
      // Клик «В бой» на одноимённом шаге прячет карточку сразу: бой
      // перерисовывает экран только после анимации (~2.6с), и без этого
      // карточка висит поверх боя всё это время.
      document.addEventListener("click", (e) => {
        if (!active || step !== "fight") return;
        if (e.target && e.target.closest && e.target.closest(".attack-button")) {
          enter("waitfight");
          paint();
        }
      }, true);
    }
    return layer;
  }

  function dropLayer() {
    if (layer) { layer.remove(); layer = null; }
    paintedKey = null;
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
  }

  // ---------- сигналы состояния ----------

  function heroOf(state, uid) {
    const c = state.cards && state.cards[uid];
    return c ? Content.heroes.byId[c.heroId] : null;
  }
  function handHas(state, heroId) {
    return state.player.handUids.some((uid) => {
      const h = heroOf(state, uid);
      return !!h && h.id === heroId;
    });
  }
  function handUidOf(state, heroId) {
    return state.player.handUids.find((uid) => {
      const h = heroOf(state, uid);
      return !!h && h.id === heroId;
    }) || null;
  }
  function handTopAttr(state) {
    const counts = {};
    for (const uid of state.player.handUids) {
      const h = heroOf(state, uid);
      if (!h) continue;
      const a = typeof Game !== "undefined" && Game.heroAttr ? Game.heroAttr(state, h.id) : h.attr;
      counts[a] = (counts[a] || 0) + 1;
    }
    const best = Object.keys(counts).sort((x, y) => counts[y] - counts[x])[0];
    return best ? { attr: best, n: counts[best] } : null;
  }

  function signals(state) {
    const wave = state.combat.wave;
    return {
      phase: state.phase,
      wave: state.run ? state.run.waveIndex : 0,
      sel: (state.combat.selectedUids || []).slice(),
      fights: state.player ? state.player.fightsLeft : 0,
      discards: state.player ? state.player.discardsLeft : 0,
      outcome: state.combat.outcome || null,
      dbInHand: handHas(state, "dawnbreaker"),
      mined: !!(wave && (wave.modifiers || []).some((m) => m.id === "mines")),
      fightOverlay: !!document.querySelector(".fight-overlay"),
      starter: (() => {
        try {
          const ui = window.__dalatro && window.__dalatro.UI;
          return ui ? (ui.UIState.starterDraft || null) : null;
        } catch (e) { return null; }
      })(),
      // Счётчик кликов по карточкам билда: «Классика» активна по умолчанию,
      // клик по ней не меняет starterDraft — без счётчика шаг «build» не сдвинется.
      starterPicks: (() => {
        try {
          const ui = window.__dalatro && window.__dalatro.UI;
          return ui ? (ui.UIState.starterPicks || 0) : 0;
        } catch (e) { return 0; }
      })(),
    };
  }

  function sameSet(a, b) {
    if (a.length !== b.length) return false;
    const x = a.slice().sort();
    const y = b.slice().sort();
    return x.every((v, i) => v === y[i]);
  }

  // Звезда сценария: Dawnbreaker, если взята; иначе первый выбранный с абилкой.
  function starOf(state) {
    const sel = state.combat.selectedUids || [];
    const db = sel.find((uid) => {
      const h = heroOf(state, uid);
      return !!h && h.id === "dawnbreaker";
    });
    if (db) return db;
    return sel.find((uid) => {
      const h = heroOf(state, uid);
      return !!h && !!h.ability;
    }) || sel[0] || null;
  }

  // Шаг способности звезды в живом превью боя (UIState.lastResolution ставит
  // renderWave до вызова observe — данные всегда свежие).
  function starPreviewStep(state) {
    const star = starOf(state);
    if (!star) return null;
    const hero = heroOf(state, star);
    const uiState = window.__dalatro && window.__dalatro.UI && window.__dalatro.UI.UIState;
    const res = uiState && uiState.lastResolution;
    if (!hero || !hero.ability || !res || !res.steps) return null;
    return res.steps.find((st) => String(st.label || "").startsWith(hero.name + ":")) || null;
  }

  function condCopy(when) {
    if (!when) return "";
    if (when.all) return when.all.map(condCopy).filter(Boolean).join(" и ");
    if (when.any) return "один из: " + when.any.map(condCopy).filter(Boolean).join(" / ");
    if (when.not) {
      const inner = condCopy(when.not);
      return inner ? "не " + inner : "";
    }
    const fn = WHEN_COPY[when.type];
    return fn ? fn(when.value) : "";
  }

  function esc(s) { return String(s).replace(/"/g, "&quot;").replace(/</g, "&lt;"); }
  function fmt(n) { return Number(n || 0).toLocaleString("ru"); }

  // ---------- шаги главного сценария ----------

  function handNext(state) {
    const sel = state.combat.selectedUids || [];
    const dbPicked = sel.some((uid) => {
      const h = heroOf(state, uid);
      return !!h && h.id === "dawnbreaker";
    });
    return state.combat.selectedUids.length && handHas(state, "dawnbreaker") && !dbPicked ? "starHint" : "move";
  }

  function stepDef(state) {
    const star = starOf(state);
    const starHero = star ? heroOf(state, star) : null;
    const wave = state.combat.wave || {};
    const fights = (typeof Ranks !== "undefined" && Ranks.fightsPerWave ? Ranks.fightsPerWave(state) : 4);

    switch (step) {
      case "build":
        return {
          target: () => document.querySelector(".starter-picker"),
          place: "right", mode: "spot",
          title: "Выбери начальный билд",
          body: "Стиль задаст колоду и перк забега.",
        };
      case "start":
        return {
          target: () => document.querySelector(".seed-row"),
          place: "top", mode: "spot", later: true, next: "prestart",
          title: "Начать забег",
          body: "Колода соберётся сама. Сид — по желанию.",
        };
      case "enemy":
        return {
          target: () => document.querySelector(".scene-target"),
          place: "center", mode: "dark", clickAnywhere: true, next: "hand",
          title: "Вот твой враг",
          body: `<b>${esc(wave.name || "Башня Света")}</b> · ${fmt(wave.hp)} HP. <b>Боёв: ${fights}</b> — столько попыток свалить её. Не уложился — теряешь казарму, это жизнь забега.`,
          foot: "клик — продолжить",
        };
      case "hand":
        return {
          target: () => document.querySelector(".hero-hand"),
          place: "top", mode: "spot",
          title: "Собери отряд",
          body: "Кликай героев — до 5 в строй. Порядок = позиции.",
        };
      case "num1": {
        const uid = (state.combat.selectedUids || [])[0];
        const hero = uid ? heroOf(state, uid) : null;
        if (!hero) return null; // выделение сняли — observe вернёт шаг к руке
        const attrId = (typeof Game !== "undefined" && Game.heroAttr) ? Game.heroAttr(state, hero.id) : hero.attr;
        const a = ATTR[attrId] || ATTR.uni;
        return {
          // Дырка — вся рука: шаг просит взять ВТОРОГО героя, значит кликабельны
          // все карты. Спотлайт-кольцо при этом держится на выбранной карточке.
          target: () => document.querySelector(".hero-hand"),
          ring: () => document.querySelector(".hero-hand .hero-card.selected")
            || document.querySelector(".formation-slot.occupied"),
          place: "top", mode: "spot", later: true,
          next: () => handNext(state),
          // Три строки вместо простыни: крупная цифра, атрибут её цветом, смысл.
          num: true,
          title: `<b>${heroRankOf(state, hero)}</b> — сила героя`,
          body: `<span class="tut-attr" style="color:${a.color}">${a.sym} ${a.name}</span> — атрибут героя` +
            `<div class="tut-line">Атрибуты влияют на <b>комбо и связки</b>.</div>` +
            `<div class="tut-line action">Возьми второго героя — продолжим.</div>`,
        };
      }
      case "starHint": {
        const uid = handUidOf(state, "dawnbreaker");
        return {
          target: () => uid ? document.querySelector(`.hero-hand .hero-card[data-uid="${uid}"]`) : null,
          place: "top", mode: "pulse", later: true, next: "move",
          title: "У Dawnbreaker способность",
          body: "Возьми — увидишь её в деле.",
        };
      }
      case "move": {
        const nm = starHero ? starHero.name : "героя";
        const enough = (state.combat.selectedUids || []).length >= 2;
        return {
          target: () => enough
            ? document.querySelector(".formation-cards")
            : document.querySelector(".hero-hand"),
          place: enough ? "right" : "top", mode: "spot", later: true, next: "ability",
          title: enough ? `Перетащи «${nm}»` : "Возьми ещё героя",
          body: enough
            ? "Зажми карту в строю и тащи — позиции меняют бой."
            : "Для перестановки нужно минимум двое в строю.",
        };
      }
      case "ability": {
        const fired = starPreviewStep(state);
        if (!fired) return null; // ждём, когда способность реально видна в превью
        const m = String(fired.label).match(/([+\-]?\d+(?:\.\d+)?)\s*(?:к множ|×)/i);
        const bonus = m ? m[1] : null; // знак уже в номере («+1»), плюс спереди не нужен
        const body = bonus
          ? `Видишь <b>${esc(bonus)} к множителю</b> в формуле? Это её способность — сработала сама.`
          : `${esc(fired.label)} — это её способность, сработала сама.`;
        return {
          // Реплика про множитель обязана ПОКАЗЫВАТЬ множитель: кольцо — точно
          // на блоке «МНОЖ», карточка под формулой. Иначе подсвечена вся
          // формула разом, и где множитель — не понятно.
          target: () => bonus
            ? (document.querySelector(".scene-formula .score-block.multiplier")
              || document.querySelector(".scene-formula"))
            : document.querySelector(".scene-formula"),
          place: "bottom", mode: "spot", auto: 7000, later: true, next: "fight",
          title: heroTitle(state, star),
          body,
        };
      }
      case "fight":
        return {
          target: () => document.querySelector(".attack-button"),
          place: "left", mode: "spot", later: true, next: "waitfight",
          title: "В бой",
          body: "Сила × множитель = урон. Приговор уже виден справа.",
        };
      case "waitfight":
        return null; // «не сейчас» на «В бой»: молча ждём настоящий бой
      case "postwait":
        return null; // пауза: бой анимируется или открыт исход волны
      case "fights":
        return {
          target: () => rowByText(/Бои/),
          fallback: () => document.querySelector(".run-panel"),
          place: "right", mode: "note-side", auto: 9000, next: "tp", later: true, open: true,
          title: "Бои — попытки на башню",
          body: `На волну даётся <b>${fights} боя</b> — столько попыток свалить башню. Осталось: <b>${Math.max(0, state.player.fightsLeft)}</b>. Урон башня помнит: снял половину этим боем — следующим добивай остаток. Потратишь все бои зря — башня устоит, и ты потеряешь казарму (жизнь забега).`,
        };
      case "tp":
        return {
          target: () => document.querySelector(".discard-button"),
          fallback: () => rowByText(/Сброс/),
          place: "top", mode: "note-side", auto: 9000,
          next: "done", later: true, open: true,
          title: "Сброс (R)",
          body: `Плохая рука — жми R: сменятся все карты, а бой не потратится. Сбросов за волну: <b>${Math.max(0, state.player.discardsLeft)}</b>.`,
        };
      default:
        return null;
    }
  }

  function heroRankOf(state, hero) {
    try { return Game.rankOf(state, hero.id); } catch (e) { return hero.power; }
  }
  function heroTitle(state, uid) {
    const hero = heroOf(state, uid);
    if (!hero) return "Способность";
    return hero.ability ? hero.ability.name : hero.name;
  }

  function rowByText(re) {
    const rows = document.querySelectorAll(".run-panel .run-row");
    for (const r of rows) if (re.test(r.textContent || "")) return r;
    return null;
  }

  // ---------- отрисовка ----------

  function paint() {
    if (!layer) return;
    const state = lastState;
    if (!state) return;
    const def = active ? stepDef(state) : null;
    // Шаг «ability» без видимой способности (def === null) легально достигается
    // («не сейчас» на move при молчащем билде) и без карточки не имеет ни
    // таймера, ни кнопки — зависание. Переводим сценарий на «В бой».
    if (active && !def && step === "ability") { enter("fight"); paint(); return; }
    if (def) {
      const target = def.target ? def.target() : null;
      const rect = target && target.getBoundingClientRect ? target.getBoundingClientRect() : null;
      const visible = rect && rect.width > 0 && rect.height > 0;
      // Отдельный спотлайт (def.ring): кольцо на выбранной карте при дырке на
      // всю руку. Без def.ring кольцо живёт на самой цели, как раньше.
      const ringEl = def.ring ? def.ring() : null;
      const ringRect = ringEl && ringEl.getBoundingClientRect ? ringEl.getBoundingClientRect() : null;
      const ringVisible = ringRect && ringRect.width > 0 && ringRect.height > 0;
      const key = [step, def.title, visible ? "t" : "n", ringVisible ? "t" : "n", state.combat.selectedUids.length].join("|");
      if (key !== paintedKey) {
        paintedKey = key;
        layer.innerHTML = cardHtml(def, visible);
        bindCard(def);
        armSettlePaints();
      }
      place(rect, visible, def, ringRect, ringVisible);
      return;
    }
    if (currentNote) {
      const key = "note:" + currentNote.id;
      if (key !== paintedKey) {
        paintedKey = key;
        layer.innerHTML = noteHtml(currentNote);
        const el = layer.querySelector(".tut-note");
        if (el) {
          el.addEventListener("click", () => { currentNote = null; paint(); });
          if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
          autoTimer = setTimeout(() => { currentNote = null; paint(); }, 5200);
        }
      }
      return;
    }
    // Слой пустеет по факту содержимого, а не по paintedKey: enter() обнуляет
    // ключ при смене шага, и после него ветка с paintedKey уже не сработала бы —
    // карточка предыдущего шага оставалась висеть до следующей карточки.
    if (layer.innerHTML !== "") { layer.innerHTML = ""; paintedKey = null; }
  }

  function cardHtml(def, hasTarget) {
    const shades = shadesHtml(def, hasTarget);
    const hole = (def.mode === "spot" || def.clickAnywhere) && hasTarget ? `<div class="tut-ring"></div>` : "";
    const pulse = def.mode === "pulse" && hasTarget ? `<div class="tut-pulse"></div>` : "";
    // Каждый шаг: слева явная кнопка «Пропустить обучение», справа — «не сейчас»
    // (если шаг можно отложить) или подпись-подсказка. Авто-шагам («способность
    // звезды», волновые записки) — подпись «клик — продолжить»: карточка
    // закрывается ЛКМ в любом месте или исчезает по таймеру сама.
    const autoNote = def.auto && def.later ? `<span class="tut-caption">клик — продолжить</span>` : "";
    const later = def.later
      ? `<span class="tut-foot-right">${autoNote}<button class="tut-later">не сейчас</button></span>`
      : `<span class="tut-caption">${def.foot || ""}</span>`;
    // Прозрачный ловец кликов на весь экран: ЛКМ где угодно закрывает карточку
    // и ведёт сценарий дальше (самый верх слоя, но под карточкой).
    const catcher = def.auto ? `<div class="tut-catch"></div>` : "";
    return `${shades}${hole}${pulse}${catcher}
      <aside class="tut-card${def.num ? " num" : ""}">
        <header class="tut-head">
          <span class="tut-kicker">ОБУЧЕНИЕ</span>
        </header>
        <h3>${def.title}</h3>
        <p>${def.body}</p>
        <footer class="tut-foot">
          <button class="tut-skip">Пропустить обучение</button>
          ${later}
        </footer>
      </aside>`;
  }

  // Четыре шторы вокруг цели: весь экран заблокирован, кликабельна только цель.
  // open: true — шаг информационный, экран не блокируем. clickAnywhere — шторы
  // сами продолжают сценарий по клику; если цель есть, режем под неё «дырку» —
  // реплика «вот твой враг» с чёрным экраном вместо врага бессмысленна. Сплошная
  // штора остаётся только для шага без цели.
  function shadesHtml(def, hasTarget) {
    const cls = def.clickAnywhere ? "tut-shade click" : "tut-shade";
    if (!hasTarget) {
      const full = def.clickAnywhere || def.mode === "dark";
      return full ? `<div class="${cls}" data-shade="0"></div>` : "";
    }
    if (def.open) return ""; // открытый шаг: играем дальше, карточка уйдёт сама
    return `<div class="${cls}" data-shade="0"></div><div class="${cls}" data-shade="1"></div><div class="${cls}" data-shade="2"></div><div class="${cls}" data-shade="3"></div>`;
  }

  function noteHtml(note) {
    return `<button class="tut-note">${note.emoji} <span>${note.text}</span></button>`;
  }

  function bindCard(def) {
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    const card = layer.querySelector(".tut-card");
    const go = () => advance(typeof def.next === "function" ? def.next(lastState) : def.next);
    if (def.auto) {
      // Информационный шаг: ЛКМ в любом месте (ловец под карточкой, сама
      // карточка, шторы) — закрыть и продолжить сценарий.
      layer.querySelectorAll(".tut-catch, .tut-shade").forEach((el) => el.addEventListener("click", go));
      if (card) card.addEventListener("click", go);
    } else if (def.clickAnywhere) {
      layer.querySelectorAll(".tut-shade").forEach((el) => el.addEventListener("click", go));
      if (card) card.addEventListener("click", go);
    } else {
      // Шторка блокирует экран, и новичок тычет в видимые мимо цели кнопки —
      // молчаливый клик читается как «сломалось». Отзываемся тряской карточки.
      layer.querySelectorAll(".tut-shade").forEach((el) => el.addEventListener("click", () => {
        if (card) { card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake"); }
      }));
    }
    const skip = layer.querySelector(".tut-skip");
    if (skip) skip.addEventListener("click", (e) => { e.stopPropagation(); finish("skip"); });
    const later = layer.querySelector(".tut-later");
    if (later) later.addEventListener("click", (e) => { e.stopPropagation(); advance(typeof def.next === "function" ? def.next(lastState) : def.next); });
    if (def.auto && card) {
      // Автозакрытие нельзя «ставить на паузу» фактом наведения: карточка,
      // всплывшая под неподвижным курсор (только что нажали «В бой»), иначе
      // зависает до первого движения мыши. Отсчёт всегда идёт; движение мыши
      // над карточкой перезапускает его — активное чтение продлевает жизнь.
      const armAuto = () => { if (autoTimer) clearTimeout(autoTimer); autoTimer = setTimeout(go, def.auto); };
      armAuto();
      card.addEventListener("pointermove", armAuto);
      // Страховка: если таймер где-то потерялся, возвращаем его в течение секунды.
      const watchdog = setInterval(() => {
        if (!document.contains(card)) { clearInterval(watchdog); return; }
        if (!autoTimer) armAuto();
      }, 1000);
    }
  }

  function place(rect, visible, def, ringRect, ringVisible) {
    const card = layer.querySelector(".tut-card");
    if (!card) return;
    const w = card.offsetWidth || 300;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const ch = card.offsetHeight || 120;
    const pad = 14;
    // Широкая цель (строка стартеров, рука): боковая карточка прижимается к
    // краю экрана и повисает в отрыве от цели — предпочитаем верх/низ по центру.
    const wide = visible && rect.width > vw * 0.55;

    // Кандидаты позиции: предпочитаемая сторона, её зеркальный флип, право,
    // лево, центр. Первый, который не пересекает цель и влезает в экран, — наш.
    const cands = [];
    if (def.place === "center" || !visible) {
      cands.push([(vw - w) / 2, vh * 0.42 - 50]);
    } else if (def.place === "right") {
      if (wide) {
        cands.push([rect.left + rect.width / 2 - w / 2, rect.bottom + pad]);
        cands.push([rect.left + rect.width / 2 - w / 2, rect.top - pad - ch]);
      }
      cands.push([rect.right + pad, rect.top + rect.height / 2 - ch / 2]);
      cands.push([rect.left - w - pad, rect.top + rect.height / 2 - ch / 2]);
      cands.push([rect.left + rect.width / 2 - w / 2, rect.bottom + pad]);
    } else if (def.place === "left") {
      if (wide) {
        cands.push([rect.left + rect.width / 2 - w / 2, rect.bottom + pad]);
        cands.push([rect.left + rect.width / 2 - w / 2, rect.top - pad - ch]);
      }
      cands.push([rect.left - w - pad, rect.top + rect.height / 2 - ch / 2]);
      cands.push([rect.right + pad, rect.top + rect.height / 2 - ch / 2]);
      cands.push([rect.left + rect.width / 2 - w / 2, rect.bottom + pad]);
    } else if (def.place === "top") {
      cands.push([rect.left + rect.width / 2 - w / 2, rect.top - pad - ch]);
      cands.push([rect.left + rect.width / 2 - w / 2, rect.bottom + pad]);
      cands.push([rect.right + pad, rect.top + rect.height / 2 - ch / 2]);
      cands.push([rect.left - w - pad, rect.top + rect.height / 2 - ch / 2]);
    } else {
      cands.push([rect.left + rect.width / 2 - w / 2, rect.bottom + pad]);
      cands.push([rect.left + rect.width / 2 - w / 2, rect.top - pad - ch]);
      cands.push([rect.right + pad, rect.top + rect.height / 2 - ch / 2]);
      cands.push([rect.left - w - pad, rect.top + rect.height / 2 - ch / 2]);
    }
    const fits = (l, t) => l >= 8 && t >= 8 && l + w <= vw - 8 && t + ch <= vh - 8
      && !(visible && l < rect.right + 4 && l + w > rect.left - 4 && t < rect.bottom + 4 && t + ch > rect.top - 4);
    let pick = cands[0];
    for (const c of cands) {
      const l = Math.max(12, Math.min(c[0], vw - w - 12));
      const t = Math.max(12, Math.min(c[1], vh - ch - 12));
      if (fits(l, t)) { pick = [l, t]; break; }
    }
    const left = Math.max(12, Math.min(pick[0], vw - w - 12));
    const top = Math.max(12, Math.min(pick[1], vh - ch - 12));
    card.style.left = Math.round(left) + "px";
    card.style.top = Math.round(top) + "px";

    // Шторы: 4 панели вокруг цели (или сплошная для clickAnywhere).
    const shades = layer.querySelectorAll(".tut-shade");
    if (shades.length === 1) {
      shades[0].style.left = "0";
      shades[0].style.top = "0";
      shades[0].style.width = vw + "px";
      shades[0].style.height = vh + "px";
    } else if (shades.length === 4 && visible) {
      const g = 7;
      const t = Math.max(0, rect.top - g);
      const b = Math.min(vh, rect.bottom + g);
      const l = Math.max(0, rect.left - g);
      const r = Math.min(vw, rect.right + g);
      const geom = [
        [0, 0, vw, t],          // сверху
        [0, b, vw, vh - b],     // снизу
        [0, t, l, b - t],       // слева
        [r, t, vw - r, b - t],  // справа
      ];
      shades.forEach((el, i) => {
        const [x, y, wd, ht] = geom[i];
        el.style.left = x + "px";
        el.style.top = y + "px";
        el.style.width = Math.max(0, wd) + "px";
        el.style.height = Math.max(0, ht) + "px";
      });
    }

    const ring = layer.querySelector(".tut-ring");
    if (ring) {
      const rr = (def.ring && ringVisible) ? ringRect : rect;
      if (rr && rr.width > 0 && rr.height > 0) {
        const g = 7;
        ring.style.display = "";
        ring.style.left = (rr.left - g) + "px";
        ring.style.top = (rr.top - g) + "px";
        ring.style.width = (rr.width + g * 2) + "px";
        ring.style.height = (rr.height + g * 2) + "px";
      } else ring.style.display = "none";
    }
    const pulse = layer.querySelector(".tut-pulse");
    if (pulse) {
      if (visible) {
        pulse.style.left = (rect.left - 4) + "px";
        pulse.style.top = (rect.top - 4) + "px";
        pulse.style.width = (rect.width + 8) + "px";
        pulse.style.height = (rect.height + 8) + "px";
      } else pulse.style.display = "none";
    }
  }

  // ---------- машина главного сценария ----------

  function enter(next) {
    step = next;
    paintedKey = null;
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
  }

  function advance(next) {
    if (next === null || next === "done") { finish("done"); return; }
    if (!next) { hideLayerNow(); return; } // шаг без следующего — просто прячем карточку
    enter(next);
    if (step === "prestart") hideLayerNow();
    paint();
  }

  function hideLayerNow() {
    if (layer) layer.innerHTML = "";
    paintedKey = null;
  }

  function finish(kind) {
    if (postTimer) { clearTimeout(postTimer); postTimer = null; }
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    active = false;
    step = "done";
    pendingPost = null;
    currentNote = null;
    dropLayer();
    if (kind === "done") {
      mark({ main: "done" }); // notesOn остаётся: подсказки первого раза продолжают
      try {
        const ui = window.__dalatro && window.__dalatro.UI;
        if (ui && ui.toast && lastState) ui.toast(lastState, "Онбординг окончен. «Как играть» — всегда в сайдбаре.");
      } catch (e) { /* без тоста */ }
    } else {
      notesOn = false; // «пропустить» гасит и подсказки первого раза
      mark({ main: "skip" });
    }
  }

  function arm() {
    armed = true;
    const d = data();
    if (d && d.main === "done") {
      // Сценарий уже пройден, но подсказки первого раза (мины, лавка,
      // развилка) живут и дальше — помечаются индивидуальными ключами.
      notesOn = true;
      return;
    }
    if (d && d.main) return; // «пропустить» гасит и подсказки первого раза
    // Сценарий — только для первого запуска: восстановленный сейв значит,
    // что игрок уже в деле. Молча помечаем, чтобы не выскакивал среди забега.
    if (lastState.phase !== "title") { mark({ main: "skip" }); return; }
    active = true;
    notesOn = true;
    ensureLayer();
    step = "build";
  }

  // ---------- подсказки первого раза ----------

  function showNote(id, emoji, text) {
    const d = data() || {};
    if (d[id]) return;
    if (currentNote) return; // одна записка за раз — другую покажем на следующем рендере
    if (active && step !== "done" && step !== "prestart") return; // карточка главного сценария важнее
    mark({ [id]: true });
    currentNote = { id, emoji, text };
    ensureLayer();
    paintedKey = null;
    paint();
  }

  function observeNotes(state, sig) {
    if (!notesOn) return;
    if (sig.phase === "shop") { showNote("shop", "🛒", "Предметы — в слоты билда. Герои из таверны — в колоду."); return; }
    if (sig.phase === "route") { showNote("route", "🧭", "Развилка: риск = награда. Выбирай путь."); return; }
    if (sig.phase === "wave" && sig.mined) { showNote("mines", "💣", "Рука заминирована: эти карты не играют. Sentry Ward или BKB обезвреживают мины."); return; }
    // flash: цвет собирается сам — говорим только после первого боя. Термин —
    // по ядру забега: в формациях аналог флеша называется «Фаланга».
    if (sig.phase === "wave" && !sig.outcome && pendingPostEver) {
      const top = handTopAttr(state);
      if (top && top.n >= 3) {
        const a = ATTR[top.attr];
        const goal = state.rules === "formation"
          ? "один шаг до «Фаланги» — она собирается от 4 героев одного атрибута"
          : "один шаг до флеша";
        showNote("flash", a.sym, `<b style='color:${a.color}'>${top.n} ${a.name.toLowerCase()}</b> в руке — ${goal}.`);
      }
    }
  }

  let pendingPostEver = false;

  function wakePost() {
    postTimer = null;
    if (!active || step !== "postwait" || !lastState) return;
    const sig = signals(lastState);
    if (sig.phase === "wave" && !sig.outcome && !sig.fightOverlay) enter("fights");
    paint();
  }

  function observe(state) {
    lastState = state;
    if (!armed) arm();
    const sig = signals(state);
    const p = prev;
    prev = sig;

    if (active) {
      // Титул: выбрал билд (любой, даже уже активный) → подсказка на «Начать
      // забег»; забег начался → реплика про врага; возврат на титул посреди
      // сценария («Новый забег») → сценарий начинается заново.
      if (step === "build" && p && sig.starterPicks !== p.starterPicks) enter("start");
      if (!["build", "prestart", "start"].includes(step) && sig.phase === "title") enter("build");
      if (["build", "prestart", "start"].includes(step) && sig.phase !== "title") enter("enemy");

      // Бой сыгран из любого боевого шага — все подсказки гаснут, ждём конца анимации.
      if (p && sig.fights < p.fights && FIGHT_BEATS.includes(step)) {
        pendingPost = { wave: sig.wave, at: Date.now() };
        pendingPostEver = true;
        enter("postwait");
        if (postTimer) clearTimeout(postTimer);
        postTimer = setTimeout(wakePost, ANIM_WAIT_MS);
      }

      if (step === "hand" && p && sig.sel.length > p.sel.length) enter("num1");
      if (step === "num1" && p && sig.sel.length >= 2) enter(handNext(state));
      if (step === "num1" && p && sig.sel.length === 0 && p.sel.length > 0) enter("hand");
      if (step === "starHint") {
        const dbPicked = sig.sel.some((uid) => {
          const h = heroOf(state, uid);
          return !!h && h.id === "dawnbreaker";
        });
        if (dbPicked || !sig.dbInHand || sig.sel.length >= 5) enter("move");
      }
      if (step === "move" && p) {
        const reordered = sig.sel.length > 0 && sig.sel.length === p.sel.length
          && sig.sel.join("|") !== p.sel.join("|") && sameSet(sig.sel, p.sel);
        if (reordered) enter("ability");
        else if (sig.sel.length === 0 && p.sel.length > 0) enter("hand");
      }
      if ((step === "ability" || step === "fight") && p && sig.sel.length === 0 && p.sel.length > 0) enter("hand");

      // Пост-бой: та же волна после анимации или новая волна с полным запасом.
      if (step === "postwait" && pendingPost && sig.phase === "wave" && !sig.outcome && !sig.fightOverlay) {
        const newWave = sig.wave !== pendingPost.wave;
        if (newWave || Date.now() - pendingPost.at > ANIM_WAIT_MS - 400) enter("fights");
      }
      // Конец забега — глобальный выход из сценария, важнее любых шагов.
      if (sig.phase === "victory" || sig.phase === "gameover") { finish("skip"); paint(); return; }

      // Башня пала этим боем: волна сменилась исходом/лавкой. Без этого сценарий
      // навсегда застревает в невидимом postwait; но и высаживать «Бои» поверх
      // лавки нельзя — волновые подсказки кончились вместе с волной.
      if (step === "postwait" && pendingPost && sig.phase !== "wave") {
        pendingPost = null;
        finish("done");
        return;
      }
      // Финальные подсказки («Бои», «Сброс») живут только внутри волны:
      // башня пала — онбординг кончен, как бы игрок ни продолжал;
      // потрачен бой при живой башне — «Бои» с устаревшим счётом уступает
      // место сбросу; потрачен сброс — обе больше не нужны.
      if ((step === "fights" || step === "tp") && p && sig.phase !== "wave") { finish("done"); return; }
      if (step === "fights" && p && sig.fights < p.fights) enter("tp");
      if ((step === "fights" || step === "tp") && p && sig.discards < p.discards) { finish("done"); return; }
    }

    observeNotes(state, sig);
    armSettlePaints(); // рендер мог сдвинуть раскладку — догоняем серией
    paint();
  }

  // Для отладки в консоли: Tutorial.reset() — показать обучение заново.
  window.Tutorial = {
    observe,
    reset() { try { localStorage.removeItem(KEY); } catch (e) {} armed = false; active = false; notesOn = false; currentNote = null; dropLayer(); },
  };
})();
