// dotora content — combos (poker hand -> Dota event), waves (towers + boss),
// and boss/wave modifiers. One modifier format for everything.
// damageType у покерных комбо — только ярлык для условий предметов
// (DAMAGE_TYPE_IS); классика не митигирует. Формации митигируют по-настоящему.
const COMBOS_DATA = [
  { id: "high_card", name: "Харас", basePower: 5, baseMult: 1, rank: 0, damageType: "physical" },
  { id: "pair", name: "Дуо на линии", basePower: 10, baseMult: 2, rank: 1, damageType: "physical" },
  { id: "two_pair", name: "Ротация", basePower: 20, baseMult: 2, rank: 2, damageType: "physical" },
  { id: "three", name: "Ганг", basePower: 30, baseMult: 3, rank: 3, damageType: "physical" },
  { id: "straight", name: "Смок на Рошана", basePower: 30, baseMult: 4, rank: 4, damageType: "magical" },
  { id: "flush", name: "Тимфайт атрибута", basePower: 35, baseMult: 4, rank: 5, damageType: "magical" },
  { id: "full_house", name: "4 Protect 1", basePower: 40, baseMult: 6, rank: 6, damageType: "pure" },
];

// Три акта × 5 волн. HP растёт ~×2.4 за акт, защита — armor +6..12 и mr +10-15%
// за акт; проклятия вшиты в волны актов 2-3 (BKB снимает). gold — базовая
// награда за зачистку (элитка ×1.5, оверкилл сверху).
const WAVES_DATA = [
  // --- АКТ 1 «На линии» ---
  { id: "t1", act: 1, name: "T1 Башня", emoji: "🗼", hp: 450, gold: 6, modifiers: [] },
  { id: "t2", act: 1, name: "T2 Башня", emoji: "🗼", hp: 850, gold: 6, modifiers: [{ id: "armor" }] },
  { id: "t3", act: 1, name: "T3 Башня", emoji: "🏯", hp: 1400, gold: 6, modifiers: [{ id: "glyph" }] },
  { id: "techies", act: 1, name: "Techies", emoji: "💣", hp: 1750, gold: 8, miniBoss: true, modifiers: [{ id: "mines" }] },
  { id: "roshan", act: 1, name: "Roshan", emoji: "👹", hp: 2800, gold: 10, isBoss: true, modifiers: [{ id: "aegis" }] },
  // --- АКТ 2 «Тёмный лес» ---
  { id: "f1", act: 2, name: "Руины", emoji: "🌲", hp: 1500, gold: 8, modifiers: [] },
  { id: "f2", act: 2, name: "Сторожевой лагерь", emoji: "⛺", hp: 2800, gold: 8, modifiers: [{ id: "armor" }] },
  { id: "f3", act: 2, name: "Цитадель", emoji: "🏯", hp: 4600, gold: 8, modifiers: [{ id: "glyph" }] },
  { id: "fmini", act: 2, name: "Сапёры", emoji: "💣", hp: 5800, gold: 10, miniBoss: true, modifiers: [{ id: "mines" }] },
  { id: "fboss", act: 2, name: "Древний Рошан", emoji: "🐲", hp: 9200, gold: 12, isBoss: true, modifiers: [{ id: "aegis" }, { id: "adaptation" }] },
  // --- АКТ 3 «Трон» ---
  { id: "p1", act: 3, name: "Пепелище", emoji: "🌑", hp: 6400, gold: 10, modifiers: [{ id: "fog" }] },
  { id: "p2", act: 3, name: "Бастион", emoji: "🗼", hp: 12000, gold: 10, modifiers: [{ id: "silence" }] },
  { id: "p3", act: 3, name: "Сердце тьмы", emoji: "🏯", hp: 19600, gold: 12, modifiers: [{ id: "glyph" }, { id: "disarm" }] },
  { id: "pmini", act: 3, name: "Шахты Трона", emoji: "💣", hp: 24400, gold: 14, miniBoss: true, modifiers: [{ id: "mines" }] },
  { id: "pfinal", act: 3, name: "Трон", emoji: "👑", hp: 38000, gold: 20, isBoss: true, modifiers: [{ id: "aegis" }, { id: "adaptation" }] },
];

const ACT_NAMES = { 1: "На линии", 2: "Тёмный лес", 3: "Трон" };

const MODIFIERS_DATA = [
  { id: "armor", name: "Armor", desc: "Первый бой волны наносит ×0.5 урона." },
  { id: "glyph", name: "Glyph", desc: "Каждый 3-й бой полностью заблокирован." },
  { id: "mines", name: "Мины", desc: "Каждый бой 2 карты руки заминированы — их нельзя разыграть. Sentry Ward или BKB обезвреживают мины." },
  { id: "aegis", name: "Aegis", desc: "Один раз возрождается с 50% HP.", hpPercent: 50 },
  // Проклятия элитных башен (BKB игнорирует всё)
  { id: "adaptation", name: "Адаптация", desc: "Одна и та же комбинация дважды подряд наносит ×0.5 урона.", curse: true },
  { id: "bastion", name: "Фортификация", desc: "Харас, Дуо и Ротация наносят ×0.5 урона.", curse: true },
  { id: "fog", name: "Туман войны", desc: "Герои ранга ≤4 не дают своей силы.", curse: true },
  { id: "silence", name: "Безмолвие", desc: "Способности героев отключены (предметы и комбинации работают).", curse: true },
  { id: "disarm", name: "Обезоруживание", desc: "В тимфайт можно взять не более 4 героев.", curse: true },
  // Мутации башен (выдаются рангами Божество+): одна волновая способность.
  { id: "regen", name: "Регенерация", desc: "Башня лечит 4% от макс. HP после каждого боя, пока волна не зачищена.", mutation: true },
  { id: "reflection", name: "Отражение", desc: "Каждый чётный бой наносит по башне ×0.75 урона.", mutation: true },
  { id: "enrage", name: "Ярость", desc: "Падая ниже 25% HP, башня раз в волну исцеляется на 10%.", mutation: true },
  { id: "thorns", name: "Шипы", desc: "Отряды из 4–5 героев наносят по башне ×0.85.", mutation: true },
  { id: "greed", name: "Жадность", desc: "Бой, не снявший 30% её текущего HP, отдаёт башне 1 золото.", mutation: true },
  // Маршрутный мод «Архивариус» (#20): анти-спам самого частого комбо забега.
  { id: "archivist", name: "Архивариус", desc: "Твоё самое частое комбо наносит ×0.75.", curse: true },
];

const CURSES = ["adaptation", "bastion", "fog", "silence", "disarm"];

// --- Развилки после лавки (спек §4, фаза E). Контент сидит на 12 примитивах:
//   hp/reward — множители башни и награды; mods — волновые модификаторы (тот же
//   пайплайн, что у ранговых мутаций); gold — немедленная дельта; shopPrice —
//   множитель цен следующей лавки; hand — слот руки на волну; fights — дельта
//   тимфайтов; itemRarity/extraRecruit — гарантии следующей лавки; gamble —
//   мгновенный бросок; power — бонус силы всем боям волны; defense — множитель
//   числовой защиты башни (формации); curse — элитке вкатывается проклятие.
// Ролл: normal + лагерь всегда, 2 слота спецвариантов по весам с фильтрами
// minAct/minRank. Всё детерминировано сидом (Rng на LEAVE_SHOP).
// Развилки переехали в src/content/routes.js (92/100 вариантов §4).


// Приоритет спецслотов: сначала «сильные» пути (strong/elite), второй слот —
// из общего пула. Реализовано весами; здесь только подсказка для баланса.
const ROUTE_SPECIAL_SLOTS = 2;

// --- Улучшения лавки (спек §5, фаза F). Отдельный слой прогресса: НЕ занимают
// слоты предметов, накопительная ценность ~1–5%. Два формата:
//   scalar — агрегируются в systems/upgrades.js (dmg/goldOnClear/goldChance/
//            sell/hand/rerollRich), одна точка интеграции на ключ;
//   ability — хук через СУЩЕСТВУЮЩУЮ триггерную систему (kind: "upgrade"),
//            условия переиспользуют engine/conditions.js.
// Редкости: common 60 / uncommon 25 / rare 10 / epic 4 / mythic 1.
// Улучшения лавки переехали в src/content/upgrades.js (48 строк пула §5).

// --- Формации и связки: альтернативное ядро скоринга (state.rules = "formation").
// Классика ("classic") эти таблицы не читает. Дизайн и миграция —
// docs/REDESIGN_ANTI_BALATRO.md §12–13; правило выбора формации — максимум
// итогового урона, ничья — позиционная. Часть формаций читает ПОРЯДОК слотов.
const FORMATIONS_DATA = [
  { id: "skirmish", name: "Харас", tier: 0, basePower: 5, baseMult: 1, damageType: "physical", rule: "1 герой в бою", gold: 1, when: { type: "PLAYED_COUNT_IS", value: 1 } },
  { id: "duel", name: "Дуэль на линии", tier: 1, basePower: 10, baseMult: 1.4, damageType: "physical", rule: "2 героя", when: { type: "PLAYED_COUNT_IS", value: 2 } },
  // Фолбэк: любой отряд 3+ всегда что-то наносит (аналог «старшей карты»).
  { id: "squad", name: "Отряд", tier: 1, basePower: 12, baseMult: 1.4, damageType: "physical", rule: "3+ героя без выраженной формации", when: { type: "PLAYED_COUNT_ABOVE", value: 2 } },
  { id: "triangle", name: "Треугольник", tier: 2, basePower: 16, baseMult: 1.9, damageType: "magical", rule: "3+ героя, минимум 3 разных атрибута", when: { all: [{ type: "PLAYED_COUNT_ABOVE", value: 2 }, { type: "DISTINCT_ATTRIBUTES_ABOVE", value: 2 }] } },
  { id: "wall", name: "Стена", tier: 2, positional: true, basePower: 18, baseMult: 1.9, damageType: "physical", rule: "3+ героя: в слотах 1–2 два Силовика ранга 6+", when: { all: [{ type: "PLAYED_COUNT_ABOVE", value: 2 }, { type: "FRONT_IS", attr: "str", minPower: 6 }] } },
  { id: "wedge", name: "Клин", tier: 3, positional: true, basePower: 16, baseMult: 2.1, damageType: "pure", rule: "3+ героя: самый сильный стоит в центре строя", when: { all: [{ type: "PLAYED_COUNT_ABOVE", value: 2 }, { type: "PEAK_IN_CENTER" }] } },
  { id: "ramp", name: "Рампа", tier: 3, positional: true, basePower: 16, baseMult: 2.1, damageType: "physical", rule: "3+ героя: ранги строго растут от слота 1 к последнему", when: { all: [{ type: "PLAYED_COUNT_ABOVE", value: 2 }, { type: "RANKS_ASCENDING" }] } },
  { id: "phalanx", name: "Фаланга", tier: 3, basePower: 20, baseMult: 2.2, damageType: "byAttribute", rule: "4+ героя одного атрибута", when: { all: [{ type: "PLAYED_COUNT_ABOVE", value: 3 }, { type: "SAME_ATTRIBUTE_COUNT_ABOVE", value: 3 }] } },
  // margin 4, а не 3 — ручка из §10: при margin 3 формация перехватывает почти
  // любую руку с пиком в центре и убивает A/B-тест гипотезы.
  { id: "protect", name: "4 Protect 1", tier: 5, positional: true, basePower: 23, baseMult: 3.0, damageType: "pure", rule: "5 героев: кэрри в слоте 3 и на 4+ ранга сильнее КАЖДОГО из свиты", when: { all: [{ type: "PLAYED_COUNT_IS", value: 5 }, { type: "CARRY_PROTECTED", margin: 4 }] } },
  { id: "teamwipe", name: "Тимвайп", tier: 5, basePower: 23, baseMult: 3.4, damageType: "magical", rule: "5 героев: пять рангов подряд и 3 разных атрибута", when: { all: [{ type: "PLAYED_COUNT_IS", value: 5 }, { type: "RANK_RUN", value: 5 }, { type: "DISTINCT_ATTRIBUTES_ABOVE", value: 2 }] } },
];

// Связки — пороги признаков, все активные складываются. Одна ступень на связку,
// без ролей (роли вернутся после разметки hero.roles, ROADMAP акт 3).
const BONDS_DATA = [
  { id: "str2", trait: "Сила", when: { type: "COUNT_ATTR", attr: "str", min: 2 }, power: 5, mult: 0 },
  { id: "agi2", trait: "Ловкость", when: { type: "COUNT_ATTR", attr: "agi", min: 2 }, power: 4, mult: 0.2 },
  { id: "int2", trait: "Интеллект", when: { type: "COUNT_ATTR", attr: "int", min: 2 }, power: 0, mult: 0.4 },
  { id: "gang2", trait: "Ганг", when: { type: "SAME_RANK_GROUP", size: 2 }, power: 6, mult: 0 },
  { id: "chain3", trait: "Цепочка", when: { type: "RANK_RUN", value: 3 }, power: 6, mult: 0 },
  { id: "front", trait: "Фронт", when: { type: "FRONT_IS", attr: "str", minPower: 5 }, power: 4, mult: 0 },
  { id: "back", trait: "Тыл", when: { type: "BACK_IS", attr: "int", minPower: 0 }, power: 0, mult: 0.2 },
];

// Третья ось: числовая защита башен. physical −armor (плоско, но не больше
// половины удара), magical ×(1−mr), pure игнорирует. BKB обнуляет (как проклятия).
const TOWER_DEFENSE = {
  t1: { armor: 0, mr: 0 },
  t2: { armor: 14, mr: 0 },
  t3: { armor: 28, mr: 0.3 },
  techies: { armor: 12, mr: 0 },
  roshan: { armor: 44, mr: 0.4 },
  // Акт 2
  f1: { armor: 8, mr: 0 },
  f2: { armor: 20, mr: 0 },
  f3: { armor: 38, mr: 0.4 },
  fmini: { armor: 18, mr: 0 },
  fboss: { armor: 54, mr: 0.5 },
  // Акт 3
  p1: { armor: 20, mr: 0.15 },
  p2: { armor: 40, mr: 0.2 },
  p3: { armor: 52, mr: 0.55 },
  pmini: { armor: 30, mr: 0 },
  pfinal: { armor: 64, mr: 0.65 },
};

const DAMAGE_TYPE_NAMES = { physical: "физический", magical: "магический", pure: "чистый" };

// --- Ранги сложности (лига dotora): Рекрут → ... → Титаны → Папочка.
// Ранг N = союз добавок рангов 1..N (правила наслаиваются). hpMult/goldMult —
// абсолютные множители ранга (не накапливаются): HP башен и награда за зачистку.
const RANKS_DATA = [
  { id: 1, name: "Рекрут", roman: "I", hpMult: 1.0, goldMult: 1.0, quote: "Мир терпит ошибки", color: "#97a39b", adds: ["mercy"], notes: ["Милосердие: после провала башня восстанавливает 70% HP"] },
  { id: 2, name: "Рыцарь", roman: "II", hpMult: 1.08, goldMult: 1.06, quote: "Мир начинает сопротивляться", color: "#7fb069", adds: ["memory"], notes: ["Память башен: тот же тип удара, что в прошлом бою — ×0.9"] },
  { id: 3, name: "Герой", roman: "III", hpMult: 1.18, goldMult: 1.14, quote: "Ресурсы имеют цену", color: "#5a9dd6", adds: ["inflation", "reroll3"], notes: ["Инфляция лавки: каждая покупка в визите дороже на 1G", "Реролл стоит 3G"] },
  { id: 4, name: "Легенда", roman: "IV", hpMult: 1.3, goldMult: 1.23, quote: "Нельзя полагаться на одного героя", color: "#a678e0", adds: ["fatigue"], notes: ["Усталость: каждые 5 боёв героя — −1 к его силе (до −3)"] },
  { id: 5, name: "Властелин", roman: "V", hpMult: 1.45, goldMult: 1.34, quote: "Позиция имеет значение", color: "#d8b24f", adds: ["unstable"], notes: ["Нестабильная позиция: каждая волна выбирает слот с −40% силы"] },
  { id: 6, name: "Божество", roman: "VI", hpMult: 1.65, goldMult: 1.49, quote: "Каждая башня уникальна", color: "#64d8ce", adds: ["hand6", "mutations1"], notes: ["Рука 6 карт вместо 7", "Мутации башен: 1 случайная способность на волну"] },
  { id: 7, name: "Титан", roman: "VII", hpMult: 1.7, goldMult: 1.68, quote: "Враг изучает тебя", color: "#e0684e", adds: ["adaptive", "antihero", "capClass"], notes: ["Адаптация мира: твоё самое частое комбо наносит ×0.85", "Охота на героя: самый используемый герой −2 к силе", "Лимит классов: не больше 2 атак / 2 защит / 2 утилит"] },
  { id: 8, name: "Титан 10+", roman: "VIII", hpMult: 1.9, goldMult: 1.9, quote: "Ты платишь за всё", color: "#e25f43", adds: ["discards2", "tax1"], notes: ["ТП-сбросов 2 за волну", "Налог: зачистка приносит −1G"] },
  { id: 9, name: "Титан 100+", roman: "IX", hpMult: 2.15, goldMult: 2.2, quote: "Ты сам выбираешь свою боль", color: "#e4573d", adds: ["curseChoice"], notes: ["Проклятия забега: в начале каждого акта выбираешь 1 из 3"] },
  { id: 10, name: "Титан 1 000+", roman: "X", hpMult: 2.45, goldMult: 2.58, quote: "Правила больше не гарантированы", color: "#e84f36", adds: ["mutations2"], notes: ["Reality Break: 2 мутации башен на каждую волну"] },
  { id: 11, name: "Титан 10 000+", roman: "XI", hpMult: 2.8, goldMult: 3.03, quote: "Всё против тебя", color: "#ec472f", adds: ["fights3"], notes: ["Тимфайтов 3 за волну"] },
  { id: 12, name: "Титан 100 000+", roman: "XII", hpMult: 3.2, goldMult: 3.55, quote: "Последние стены", color: "#f03f28", adds: ["reroll4", "tax2"], notes: ["Реролл стоит 4G", "Налог: зачистка приносит −2G"] },
  { id: 13, name: "Титан 1 000 000+", roman: "XIII", hpMult: 3.7, goldMult: 4.15, quote: "Предел. Дальше — только он", color: "#f43722", adds: ["hand5"], notes: ["Рука 5 карт"] },
  { id: 14, name: "Папочка", roman: "XIV", hpMult: 4.5, goldMult: 5.13, quote: "Он всё видел. Он всё помнит.", color: "#ffb03a", papochka: true, adds: ["fights2", "discards1"], notes: ["Тимфайтов 2, ТП-сбросов 1", "Трон становится Папочкой. Он всё видел."] },
];

// Проклятия забега (Титан 100+): игрок выбирает 1 из 3 в начале каждого акта.
// Минус и компенсация зашиты в описание; эффекты — по id в game.js/combat.js.
const RANK_CURSES_DATA = [
  { id: "blood", name: "Кровоток", emoji: "🩸", desc: "Зачистки дают ×0.75 золота, но весь урон ×1.15." },
  { id: "web", name: "Паутина", emoji: "🕸", desc: "−1 ТП-сброс за волну, зато зачистки дают ×1.2 золота." },
  { id: "hunger", name: "Голод", emoji: "☠", desc: "−1 тимфайт за волну, зато товары в лавке дешевле на 20%." },
  { id: "time", name: "Время", emoji: "⏳", desc: "Реролл дороже на 2G, зато +1 ТП-сброс за волну." },
  { id: "chaos", name: "Хаос", emoji: "🎲", desc: "Каждая волна получает +1 случайную мутацию, зачистки ×1.15 золота." },
];

// --- Стартовые архетипы (спек §7): выбор задаёт НАПРАВЛЕНИЕ, не запирает игру.
// Гарантированное трио + 9 карт из широкого тематического пула (ролл по сиду,
// 9 из 16 → тысячи составов: старт каждый забег реально разный). Перк —
// микроскопический, эффекты по id в game.js/combat.js. «standard» — классическая
// колода без перка (дефолт: старые сиды и A/B-бот играют ровно как раньше).
const ARCHETYPES_DATA = [
  {
    id: "standard", name: "Стандарт", emoji: "🎯", quote: "Классические двенадцать", color: "#97a39b",
    guaranteed: [], fill: [], perk: null, perkDesc: "Без перка — базовая колода стартовой двенадцатки",
  },
  {
    id: "assault", name: "Штурм", emoji: "⚔", quote: "Ломай быстрее, чем чинят", color: "#d8b24f",
    guaranteed: ["juggernaut", "axe", "centaur"],
    fill: ["tusk", "pudge", "sven", "morphling", "pa", "bounty", "dawnbreaker", "primal", "slark", "tiny",
      "meepo", "anti_mage", "legion", "huskar", "marci", "void_spirit"],
    perk: "gold1", perkDesc: "+1G начального золота",
  },
  {
    id: "control", name: "Контроль", emoji: "❄", quote: "Мир замедляется — ты нет", color: "#5a9dd6",
    guaranteed: ["zeus", "cm", "morphling"],
    fill: ["tusk", "axe", "pudge", "sven", "centaur", "juggernaut", "pa", "dawnbreaker", "primal",
      "rubick", "oracle", "ogre_magi", "io", "muerta", "void_spirit", "kez"],
    perk: "tp1", perkDesc: "+1 ТП-сброс в акте 1",
  },
  {
    id: "crit", name: "Крит", emoji: "💀", quote: "Один удар. Одна ошибка врага", color: "#e0684e",
    guaranteed: ["pa", "sven", "dawnbreaker"],
    fill: ["tusk", "axe", "pudge", "juggernaut", "morphling", "centaur", "bounty", "cm", "zeus", "primal",
      "legion", "anti_mage", "phantom_lancer", "marci", "kez", "void_spirit"],
    perk: "lasthit2", perkDesc: "+2G за точный ласт-хит",
  },
  {
    id: "arcane", name: "Магия", emoji: "✨", quote: "Формула боя написана заранее", color: "#a678e0",
    guaranteed: ["zeus", "cm", "primal"],
    fill: ["tusk", "axe", "pudge", "sven", "morphling", "juggernaut", "pa", "dawnbreaker",
      "rubick", "invoker", "lina", "skywrath", "oracle", "storm_spirit", "outworld", "snapfire"],
    perk: "freeroll1", perkDesc: "Первый реролл каждой лавки бесплатен",
  },
];
