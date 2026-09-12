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
    levels: [{ desc: "+1 сброс за волну." }, { desc: "+2 сброса за волну — эффект и цена вдвое." }],
    desc: "+1 сброс за волну." }, // #4
  { id: "koshelek", name: "Кошелёк", emoji: "👛", rarity: "common", cost: 2,
    scalar: { goldPerAct: 5 },
    levels: [{ desc: "+5 золота при переходе в новый акт." }, { desc: "+10 золота при переходе в новый акт — эффект и цена вдвое." }],
    desc: "+5 золота при переходе в новый акт." }, // #51
  { id: "boyevoy_opyt", name: "Боевой опыт", emoji: "📜", rarity: "uncommon", cost: 3,
    scalar: { winMilestoneGold: 3 },
    levels: [{ desc: "Каждая 5-я зачистка за забег: +3 золота." }, { desc: "Каждая 5-я зачистка за забег: +6 золота — эффект и цена вдвое." }],
    desc: "Каждая 5-я зачистка за забег: +3 золота." }, // #72
  { id: "svobodnaya_kletka", name: "Свободная клетка", emoji: "⬜", rarity: "uncommon", cost: 3,
    ability: { name: "Свободная клетка", event: "FIGHT_SCORING",
      when: { type: "PLAYED_COUNT_ABOVE", value: 0 },
      effects: [{ type: "ADD_POWER_PER_EMPTY_SLOT", value: 3 }] },
    desc: "+3 силы за каждую пустую позицию в отряде — путь билда «малым составом»." }, // #38
  { id: "iskra", name: "Искра", emoji: "⚡", rarity: "common", cost: 2,
    ability: { name: "Искра", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_RANDOM_CARD", value: 2 }] },
    desc: "Каждый бой случайный герой отряда получает +2 силы." }, // #92
  { id: "tochnyy_raschet", name: "Точный расчёт", emoji: "🎯", rarity: "rare", cost: 4,
    ability: { name: "Точный расчёт", event: "FIGHT_SCORING",
      effects: [{ type: "LAST_HIT_GOLD", value: 3 }] },
    desc: "Точный ласт-хит приносит +3 золота." }, // #18
  { id: "trenzal", name: "Тренировочный зал", emoji: "🏋️", rarity: "uncommon", cost: 3,
    scalar: { xpStartBonus: 3 },
    levels: [{ desc: "Нанятые герои начинают с +3 опыта." }, { desc: "Нанятые герои начинают с +6 опыта — эффект и цена вдвое." }],
    desc: "Нанятые герои начинают с +3 опыта." }, // #23
  { id: "vdohn", name: "Вдохновение", emoji: "🎭", rarity: "rare", cost: 4,
    scalar: { inspireXp: 2 }, desc: "Близкая победа — точный ласт-хит или оверкилл меньше 10% — даёт героям боя +2 опыта." }, // #30
  { id: "assortiment", name: "Хороший ассортимент", emoji: "🛍️", rarity: "rare", cost: 4,
    scalar: { itemRareBias: 2 }, desc: "Редкие предметы в лавке выпадают заметно чаще." }, // #61
  { id: "podkova", name: "Подкова", emoji: "🧲", rarity: "common", cost: 3,
    scalar: { luck: 1 },
    levels: [{ desc: "+1 удача: полки улучшений становятся богаче." }, { desc: "+2 удачи: полки улучшений становятся богаче — эффект и цена вдвое." }],
    desc: "+1 удача: полки улучшений становятся богаче." },
  { id: "krolichya_lapka", name: "Кроличья лапка", emoji: "🐇", rarity: "rare", cost: 5,
    scalar: { luck: 2 }, desc: "+2 удачи: редкие и эпические улучшения выпадают заметно чаще." },
  { id: "klever", name: "Четырёхлистный клевер", emoji: "🍀", rarity: "mythic", cost: 8,
    scalar: { luck: 3 }, desc: "+3 удачи. Топовые улучшения почти в кармане." },

  // ===== АКТИВКИ — РАЗВИЛКА =====
  { id: "kartograf", name: "Картограф", emoji: "🗺️", rarity: "uncommon", cost: 3,
    type: "active",
    activation: { context: "route", access: { act: 2 } },
    effect: { type: "rerollRoute" },
    desc: "Кнопка на развилке: перебросить все пути заново. 2 раза за акт." },
  { id: "dezertir", name: "Дезертир", emoji: "🏃", rarity: "rare", cost: 5,
    type: "active",
    activation: { context: "route", access: { act: 1 }, target: "routeOption" },
    effect: { type: "replaceRouteOption" },
    desc: "Кнопка на карточке пути: заменить этот путь другим. 1 раз за акт." },
  { id: "podsmotr", name: "Подсмотр", emoji: "👁️", rarity: "uncommon", cost: 3,
    type: "active",
    activation: { context: "route", access: { charges: 2 } },
    effect: { type: "revealRoutes" },
    desc: "Кнопка на развилке: вскрыть скрытые пути — точные HP и их правила. 2 заряда на забег." },

  // ===== АКТИВКИ — ЛАВКА =====
  { id: "torgash", name: "Торгаш", emoji: "🤝", rarity: "common", cost: 2,
    type: "active",
    activation: { context: "shop", access: { act: 1 }, target: "item" },
    effect: { type: "discountItem", value: 30 },
    desc: "Кнопка на товаре: сбить цену на 30%. 1 раз за акт." },
  { id: "magnit", name: "Магнит", emoji: "🧲", rarity: "uncommon", cost: 3,
    type: "active",
    activation: { context: "shop", access: { act: 1 } },
    effect: { type: "guaranteeItemRarity", value: "rare" },
    desc: "Кнопка в лавке: в следующей лавке гарантированно будет редкий предмет. 1 раз за акт." },
  { id: "insider", name: "Инсайдер", emoji: "🕵️", rarity: "uncommon", cost: 3,
    type: "active",
    activation: { context: "shop", access: { charges: 2 } },
    effect: { type: "guaranteeUpgradeRarity", value: "rare" },
    desc: "Кнопка в лавке: в следующей полке улучшений будет редкое или лучше. 2 заряда на забег." },
  { id: "surprise", name: "Сюрприз", emoji: "🎁", rarity: "uncommon", cost: 3,
    type: "active",
    activation: { context: "shop", access: { act: 1 } },
    effect: { type: "freeItemOffer" },
    desc: "Кнопка в лавке: торговец выставит бесплатный предмет прямо сейчас. 1 раз за акт." },
  { id: "v_dolg", name: "В долг", emoji: "💳", rarity: "rare", cost: 5,
    type: "active",
    activation: { context: "shop", access: { act: 1 }, target: "item" },
    effect: { type: "buyOnDebt" },
    desc: "Кнопка на товаре: взять без денег, а после следующей зачистки заплатить на 25% больше. 1 раз за акт." },
  { id: "obhodchik", name: "Обходчик", emoji: "🏕️", rarity: "epic", cost: 7,
    type: "active",
    activation: { context: "shop", access: { act: 1 } },
    effect: { type: "skipBattle" },
    desc: "Кнопка в лавке: пропустить следующую волну — без боя и без награды. 1 раз за акт." },

  // ===== АКТИВКИ — БОЙ =====
  { id: "vozvrat", name: "Второе дыхание", emoji: "♻️", rarity: "common", cost: 2,
    type: "active",
    activation: { context: "wave", access: { charges: 2 } },
    effect: { type: "pickDiscard" },
    desc: "Кнопка в бою: вернуть карту из сброса в руку. 2 заряда на забег." },
  { id: "ignor", name: "Игнор", emoji: "🛡️", rarity: "rare", cost: 5,
    type: "active",
    activation: { context: "wave", access: { charges: 2 } },
    effect: { type: "ignoreTowerMods" },
    desc: "Кнопка в бою: следующий бой игнорирует правила башни — глиф, броню, проклятия. 2 заряда на забег." },
  { id: "schastlivy", name: "Счастливый случай", emoji: "🎲", rarity: "rare", cost: 5,
    type: "active",
    activation: { context: "wave", access: { charges: 1 } },
    effect: { type: "forceHeroTriggers" },
    desc: "Кнопка в бою: в следующем бою способности героев сработают гарантированно. 1 заряд на забег." },
  { id: "vabank", name: "Ва-банк", emoji: "🔥", rarity: "epic", cost: 7,
    type: "active",
    activation: { context: "wave", access: { act: 1 } },
    effect: { type: "vaBank", value: 20 },
    desc: "Кнопка в бою: +20% урона в следующем бою. Проиграешь волну — потеряешь вторую казарму. 1 раз за акт." },
  { id: "peresdacha", name: "Пересдача", emoji: "🕯️", rarity: "epic", cost: 7,
    type: "active",
    activation: { context: "failed", access: { act: 1 } },
    effect: { type: "freeRetry" },
    desc: "Кнопка на экране провала: переиграть волну, сохранив казарму. 1 раз за акт." },

  // ===== ENGINE — улучшения, играющие с другими улучшениями =====
  { id: "kondensator", name: "Конденсатор", emoji: "🔋", rarity: "rare", cost: 5,
    react: [{ event: "UPGRADE_ACTIVATED", effects: [{ type: "ENERGY", value: 1 }] }],
    desc: "Каждая активация любого улучшения даёт +1⚡ энергии (максимум 6)." },
  { id: "peregruzka", name: "Перегрузка", emoji: "⚡", rarity: "epic", cost: 7,
    type: "active",
    activation: { context: "any", access: { energy: 2 } },
    effect: { type: "doubleNext" },
    desc: "Потратить 2⚡ — следующая активация улучшения сработает дважды." },
  { id: "katalizator", name: "Катализатор", emoji: "🧠", rarity: "epic", cost: 7,
    type: "active",
    activation: { context: "any", access: { act: 1 } },
    effect: { type: "resetActLimits" },
    desc: "Кнопка где угодно: сбросить все лимиты «за акт» у купленных активок. 1 раз за акт." },

  // ===== РЕАКТИВКИ И МИФИКИ =====
  { id: "optimist", name: "Оптимист", emoji: "🎲", rarity: "uncommon", cost: 3,
    react: [{ event: "WAVE_FAILED", effects: [{ type: "GOLD_FLAT", value: 4 }] }],
    desc: "Проигранная волна приносит +4 золота на восстановление." },
  { id: "posledniy_bilet", name: "Последний билет", emoji: "☠️", rarity: "mythic", cost: 9,
    onBuy: { flags: { extraLife: true }, log: "Последний билет: спасение забега заряжено. Один раз казарма не уйдёт в минус." },
    desc: "Раз за забег провал, обнуляющий казармы, оставит одну. Без штрафов." },
  { id: "pakt_fortunes", name: "Пакт Фортуны", emoji: "🎰", rarity: "mythic", cost: 9,
    react: [{ event: "WAVE_FAILED", effects: [{ type: "FORTUNE" }] }],
    desc: "Каждый провал даёт +1 удачу. На 5-й удаче в лавке ждёт мифическое улучшение." },

  // ===== ДОЛГАЯ ИГРА: скейлинг собранного билда =====
  { id: "sakvoyazh", name: "Саквояж", emoji: "🎒", rarity: "epic", cost: 7,
    scalar: { itemSlotBonus: 1 },
    levels: [{ desc: "+1 слот для предметов (всего до 8)." }, { desc: "+2 слота для предметов — эффект вдвое (всего до 8)." }],
    desc: "+1 слот для предметов (всего до 8)." },
  { id: "ladon", name: "Широкая ладонь", emoji: "🖐️", rarity: "uncommon", cost: 4,
    scalar: { handSizeBonus: 1 },
    levels: [{ desc: "+1 слот руки." }, { desc: "+2 слота руки — эффект и цена вдвое." }],
    desc: "+1 слот руки." },
  { id: "askesis", name: "Аскеза", emoji: "🪶", rarity: "rare", cost: 4,
    scalar: { handSizeBonus: -1, fightsBonus: 1 },
    desc: "−1 слот руки, зато +1 бой за волну. Маленькая рука — формации собирать проще." },
  { id: "talisman", name: "Талисман отряда", emoji: "🧿", rarity: "epic", cost: 8,
    scalar: { heroRankBonus: 1 },
    desc: "Все герои: +1 к силе. Разовая инвестиция в весь ростер." },
  { id: "nastavnik", name: "Наставник", emoji: "📖", rarity: "uncommon", cost: 4,
    scalar: { xpGainBonus: 1 },
    desc: "Герои, сходившие в бой, получают +1 опыт." },

  // ===== Fun-билды (docs/PROPOSALS_FUN_BUILDS.md §0.3) =====
  { id: "planetarium", name: "Планетарий", emoji: "🔭", rarity: "rare", cost: 5,
    type: "active",
    activation: { context: "shop", access: { charges: 3 } },
    effect: { type: "boostFormation", value: 0.15 },
    desc: "Кнопка в лавке: твоя самая частая формация за забег получает +0.15 к множителю навсегда. 3 заряда." },
  { id: "trade_magic", name: "Торговая магия", emoji: "🛍️", rarity: "uncommon", cost: 4,
    react: [{ event: "SHOP_REROLLED", effects: [{ type: "RANDOM_HERO_RANK_UP", value: 1, cap: 12 }] }],
    desc: "Каждое обновление лавки: случайный герой колоды навсегда +1 к силе." },
  { id: "blood_oath", name: "Кровная клятва", emoji: "🩸", rarity: "mythic", cost: 9,
    react: [{ event: "WAVE_FAILED", effects: [{ type: "ALL_HEROES_RANK_UP", value: 1, cap: 12 }] }],
    desc: "Провал волны: весь ростер навсегда +1 к силе. Боль — это опыт." },
];
