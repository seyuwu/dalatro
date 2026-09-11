// dotora content — улучшения лавки v2. Отдельный слой прогресса: НЕ занимают
// слоты предметов. Правило пула: карточка проходит, если её эффект игрок
// ЧУВСТВУЕТ за один акт — гарантированное событие, кнопка или правило.
// Никаких лотерей до ~25% и никаких голых «+1–2%».
//
// Форматы:
//   scalar — плоские агрегаты (systems/upgrades.js, sum × уровень);
//   ability — боевые хуки через триггерную систему (kind: "upgrade");
//   type:"active" — кнопка: activation { context, access, target? } + effect
//            (примитивы применяет движок в ACTIVATE_UPGRADE);
//   react — слушатели вне-боевых событий движка (WAVE_FAILED, UPGRADE_ACTIVATED);
//   onBuy — флаги при покупке.
//   levels: [{desc}, ...] — ступени скалярных дефов: уровень N даёт scalar × N
//            и стоит cost × N; ступень II приходит отдельной карточкой «Усилить».
//
// Контексты кнопок: route (экран развилки), shop (лавка), wave (экран волны,
// рядом с «В бой»), failed (модалка провала — кнопка у «Новая попытка»), any.
const UPGRADES_DATA = [
  // ===== ПАССИВКИ-ПРАВИЛА (плоские и гарантированные) =====
  { id: "chistyy_dabor", name: "Чистый добор", emoji: "♻️", rarity: "common", cost: 2,
    scalar: { discardsBonus: 1 },
    levels: [{ desc: "+1 ТП-сброс за волну." }, { desc: "+2 ТП-сброса за волну (эффект ×2, цена ×2)." }],
    desc: "+1 ТП-сброс за волну." }, // #4
  { id: "koshelek", name: "Кошелёк", emoji: "👛", rarity: "common", cost: 2,
    scalar: { goldPerAct: 5 },
    levels: [{ desc: "+5 золота при переходе в новый акт." }, { desc: "+10 золота при переходе в новый акт (эффект ×2, цена ×2)." }],
    desc: "+5 золота при переходе в новый акт." }, // #51
  { id: "boyevoy_opyt", name: "Боевой опыт", emoji: "📜", rarity: "uncommon", cost: 3,
    scalar: { winMilestoneGold: 3 },
    levels: [{ desc: "Каждая 5-я зачистка за забег: +3 золота." }, { desc: "Каждая 5-я зачистка за забег: +6 золота (эффект ×2, цена ×2)." }],
    desc: "Каждая 5-я зачистка за забег: +3 золота." }, // #72
  { id: "svobodnaya_kletka", name: "Свободная клетка", emoji: "⬜", rarity: "uncommon", cost: 3,
    ability: { name: "Свободная клетка", event: "FIGHT_SCORING",
      when: { type: "PLAYED_COUNT_ABOVE", value: 0 },
      effects: [{ type: "ADD_POWER_PER_EMPTY_SLOT", value: 3 }] },
    desc: "+3 силы за каждую пустую позицию. Билд «малым составом»." }, // #38
  { id: "iskra", name: "Искра", emoji: "⚡", rarity: "common", cost: 2,
    ability: { name: "Искра", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_RANDOM_CARD", value: 2 }] },
    desc: "Каждый бой случайный герой получает +2 силы." }, // #92
  { id: "tochnyy_raschet", name: "Точный расчёт", emoji: "🎯", rarity: "rare", cost: 4,
    ability: { name: "Точный расчёт", event: "FIGHT_SCORING",
      effects: [{ type: "LAST_HIT_GOLD", value: 3 }] },
    desc: "Точный ласт-хит приносит +3 золота." }, // #18
  { id: "trenzal", name: "Тренировочный зал", emoji: "🏋️", rarity: "uncommon", cost: 3,
    scalar: { xpStartBonus: 3 },
    levels: [{ desc: "Нанятые герои начинают с +3 опыта." }, { desc: "Нанятые герои начинают с +6 опыта (эффект ×2, цена ×2)." }],
    desc: "Нанятые герои начинают с +3 опыта." }, // #23
  { id: "vdohn", name: "Вдохновение", emoji: "🎭", rarity: "rare", cost: 4,
    scalar: { inspireXp: 2 }, desc: "Близкая победа (точный ласт-хит или оверкилл <10%) даёт героям боя +2 опыта." }, // #30
  { id: "assortiment", name: "Хороший ассортимент", emoji: "🛍️", rarity: "rare", cost: 4,
    scalar: { itemRareBias: 2 }, desc: "Редкие товары в лавке выпадают заметно чаще." }, // #61
  { id: "podkova", name: "Подкова", emoji: "🧲", rarity: "common", cost: 3,
    scalar: { luck: 1 },
    levels: [{ desc: "+1 удача: улучшения в лавках выпадают жирнее." }, { desc: "+2 удачи: улучшения в лавках выпадают жирнее (эффект ×2, цена ×2)." }],
    desc: "+1 удача: улучшения в лавках выпадают жирнее." },
  { id: "krolichya_lapka", name: "Кроличья лапка", emoji: "🐇", rarity: "rare", cost: 5,
    scalar: { luck: 2 }, desc: "+2 удачи: редкие и эпические улучшения заметно чаще." },
  { id: "klever", name: "Четырёхлистный клевер", emoji: "🍀", rarity: "mythic", cost: 8,
    scalar: { luck: 3 }, desc: "+3 удачи. Топовые улучшения почти ваши." },

  // ===== АКТИВКИ — РАЗВИЛКА =====
  { id: "kartograf", name: "Картограф", emoji: "🗺️", rarity: "uncommon", cost: 3,
    type: "active",
    activation: { context: "route", access: { act: 2 } },
    effect: { type: "rerollRoute" },
    desc: "Кнопка на развилке: перевыбросить все пути. 2 раза за акт." },
  { id: "dezertir", name: "Дезертир", emoji: "🏃", rarity: "rare", cost: 5,
    type: "active",
    activation: { context: "route", access: { act: 1 }, target: "routeOption" },
    effect: { type: "replaceRouteOption" },
    desc: "Кнопка на карточке пути: заменить этот путь новым. 1 раз за акт." },
  { id: "podsmotr", name: "Подсмотр", emoji: "👁️", rarity: "uncommon", cost: 3,
    type: "active",
    activation: { context: "route", access: { charges: 2 } },
    effect: { type: "revealRoutes" },
    desc: "Кнопка на развилке: вскрыть скрытые жребии — точные HP и будущие правила. 2 заряда за забег." },

  // ===== АКТИВКИ — ЛАВКА =====
  { id: "torgash", name: "Торгаш", emoji: "🤝", rarity: "common", cost: 2,
    type: "active",
    activation: { context: "shop", access: { act: 1 }, target: "item" },
    effect: { type: "discountItem", value: 30 },
    desc: "Кнопка на товаре: −30% к его цене. 1 раз за акт." },
  { id: "magnit", name: "Магнит", emoji: "🧲", rarity: "uncommon", cost: 3,
    type: "active",
    activation: { context: "shop", access: { act: 1 } },
    effect: { type: "guaranteeItemRarity", value: "rare" },
    desc: "Кнопка в лавке: в следующей лавке гарантированно будет редкий товар. 1 раз за акт." },
  { id: "insider", name: "Инсайдер", emoji: "🕵️", rarity: "uncommon", cost: 3,
    type: "active",
    activation: { context: "shop", access: { charges: 2 } },
    effect: { type: "guaranteeUpgradeRarity", value: "rare" },
    desc: "Кнопка в лавке: следующая полка улучшений гарантированно содержит rare+. 2 заряда за забег." },
  { id: "surprise", name: "Сюрприз", emoji: "🎁", rarity: "uncommon", cost: 3,
    type: "active",
    activation: { context: "shop", access: { act: 1 } },
    effect: { type: "freeItemOffer" },
    desc: "Кнопка в лавке: торговец выставляет бесплатный товар прямо сейчас. 1 раз за акт." },
  { id: "v_dolg", name: "В долг", emoji: "💳", rarity: "rare", cost: 5,
    type: "active",
    activation: { context: "shop", access: { act: 1 }, target: "item" },
    effect: { type: "buyOnDebt" },
    desc: "Кнопка на товаре: купить без золота — заплатишь +25% после следующей зачистки. 1 раз за акт." },
  { id: "obhodchik", name: "Обходчик", emoji: "🏕️", rarity: "epic", cost: 7,
    type: "active",
    activation: { context: "shop", access: { act: 1 } },
    effect: { type: "skipBattle" },
    desc: "Кнопка в лавке: следующая волна пропускается без боя и без награды. 1 раз за акт." },

  // ===== АКТИВКИ — БОЙ =====
  { id: "vozvrat", name: "Второе дыхание", emoji: "♻️", rarity: "common", cost: 2,
    type: "active",
    activation: { context: "wave", access: { charges: 2 } },
    effect: { type: "pickDiscard" },
    desc: "Кнопка в бою: вернуть карту из сброса в руку. 2 заряда за забег." },
  { id: "ignor", name: "Игнор", emoji: "🛡️", rarity: "rare", cost: 5,
    type: "active",
    activation: { context: "wave", access: { charges: 2 } },
    effect: { type: "ignoreTowerMods" },
    desc: "Кнопка в бою: следующий бой игнорирует правила башни (глиф, броня, проклятия). 2 заряда за забег." },
  { id: "schastlivy", name: "Счастливый случай", emoji: "🎲", rarity: "rare", cost: 5,
    type: "active",
    activation: { context: "wave", access: { charges: 1 } },
    effect: { type: "forceHeroTriggers" },
    desc: "Кнопка в бою: в следующем бою способности героев срабатывают гарантированно. 1 заряд за забег." },
  { id: "vabank", name: "Ва-банк", emoji: "🔥", rarity: "epic", cost: 7,
    type: "active",
    activation: { context: "wave", access: { act: 1 } },
    effect: { type: "vaBank", value: 20 },
    desc: "Кнопка в бою: следующий бой +20% урона. Провал волны отнимет вторую казарму. 1 раз за акт." },
  { id: "peresdacha", name: "Пересдача", emoji: "🕯️", rarity: "epic", cost: 7,
    type: "active",
    activation: { context: "failed", access: { act: 1 } },
    effect: { type: "freeRetry" },
    desc: "Кнопка на экране провала: переиграть волну, не теряя казарму. 1 раз за акт." },

  // ===== ENGINE — улучшения, играющие с другими улучшениями =====
  { id: "kondensator", name: "Конденсатор", emoji: "🔋", rarity: "rare", cost: 5,
    react: [{ event: "UPGRADE_ACTIVATED", effects: [{ type: "ENERGY", value: 1 }] }],
    desc: "Каждая активация любого улучшения даёт +1⚡ энергии (кап 6)." },
  { id: "peregruzka", name: "Перегрузка", emoji: "⚡", rarity: "epic", cost: 7,
    type: "active",
    activation: { context: "any", access: { energy: 2 } },
    effect: { type: "doubleNext" },
    desc: "Потратить 2⚡: следующая активация улучшения срабатывает дважды." },
  { id: "katalizator", name: "Катализатор", emoji: "🧠", rarity: "epic", cost: 7,
    type: "active",
    activation: { context: "any", access: { act: 1 } },
    effect: { type: "resetActLimits" },
    desc: "Кнопка где угодно: все лимиты «за акт» у твоих активок сбрасываются. 1 раз за акт." },

  // ===== РЕАКТИВКИ И МИФИКИ =====
  { id: "optimist", name: "Оптимист", emoji: "🎲", rarity: "uncommon", cost: 3,
    react: [{ event: "WAVE_FAILED", effects: [{ type: "GOLD_FLAT", value: 4 }] }],
    desc: "Провал волны: +4 золота на восстановление." },
  { id: "posledniy_bilet", name: "Последний билет", emoji: "☠️", rarity: "mythic", cost: 9,
    onBuy: { flags: { extraLife: true }, log: "Последний билет: спасение забега заряжено. Один раз казарма не уйдёт в минус." },
    desc: "Раз за забег провал, обнуляющий казармы, оставляет одну. Без штрафов." },
  { id: "pakt_fortunes", name: "Пакт с Фортуны", emoji: "🎰", rarity: "mythic", cost: 9,
    react: [{ event: "WAVE_FAILED", effects: [{ type: "FORTUNE" }] }],
    desc: "Каждый провал: +1 удача (копится с Подковой). На 5-й удаче в лавке ждёт мифическое улучшение." },

  // ===== ДОЛГАЯ ИГРА: скейлинг собранного билда =====
  { id: "sakvoyazh", name: "Саквояж", emoji: "🎒", rarity: "epic", cost: 7,
    scalar: { itemSlotBonus: 1 },
    levels: [{ desc: "+1 слот предмета (всего до 8)." }, { desc: "+2 слота предметов (эффект ×2, всего до 8)." }],
    desc: "+1 слот предмета (всего до 8)." },
  { id: "ladon", name: "Широкая ладонь", emoji: "🖐️", rarity: "uncommon", cost: 4,
    scalar: { handSizeBonus: 1 },
    levels: [{ desc: "+1 слот руки." }, { desc: "+2 слота руки (эффект ×2, цена ×2)." }],
    desc: "+1 слот руки." },
  { id: "askesis", name: "Аскеза", emoji: "🪶", rarity: "rare", cost: 4,
    scalar: { handSizeBonus: -1, fightsBonus: 1 },
    desc: "−1 слот руки, зато +1 тимфайт за волну. Маленькая рука — формации точнее." },
  { id: "talisman", name: "Талисман отряда", emoji: "🧿", rarity: "epic", cost: 8,
    scalar: { heroRankBonus: 1 },
    desc: "Все герои: +1 к рангу. Разовая инвестиция в весь ростер." },
  { id: "nastavnik", name: "Наставник", emoji: "📖", rarity: "uncommon", cost: 4,
    scalar: { xpGainBonus: 1 },
    desc: "Герои в бою получают +1 опыта за бой." },
];
