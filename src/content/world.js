// Dalatro content — combos (poker hand -> Dota event), waves (towers + boss),
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
  { id: "f1", act: 2, name: "Руины", emoji: "🌲", hp: 1100, gold: 8, modifiers: [] },
  { id: "f2", act: 2, name: "Сторожевой лагерь", emoji: "⛺", hp: 2050, gold: 8, modifiers: [{ id: "armor" }] },
  { id: "f3", act: 2, name: "Цитадель", emoji: "🏯", hp: 3400, gold: 8, modifiers: [{ id: "glyph" }] },
  { id: "fmini", act: 2, name: "Сапёры", emoji: "💣", hp: 4200, gold: 10, miniBoss: true, modifiers: [{ id: "mines" }] },
  { id: "fboss", act: 2, name: "Древний Рошан", emoji: "🐲", hp: 6700, gold: 12, isBoss: true, modifiers: [{ id: "aegis" }, { id: "adaptation" }] },
  // --- АКТ 3 «Трон» ---
  { id: "p1", act: 3, name: "Пепелище", emoji: "🌑", hp: 2650, gold: 10, modifiers: [{ id: "fog" }] },
  { id: "p2", act: 3, name: "Бастион", emoji: "🗼", hp: 4900, gold: 10, modifiers: [{ id: "silence" }] },
  { id: "p3", act: 3, name: "Сердце тьмы", emoji: "🏯", hp: 8150, gold: 12, modifiers: [{ id: "glyph" }, { id: "disarm" }] },
  { id: "pmini", act: 3, name: "Шахты Трона", emoji: "💣", hp: 10100, gold: 14, miniBoss: true, modifiers: [{ id: "mines" }] },
  { id: "pfinal", act: 3, name: "Трон", emoji: "👑", hp: 16100, gold: 20, isBoss: true, modifiers: [{ id: "aegis" }, { id: "adaptation" }] },
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
];

const CURSES = ["adaptation", "bastion", "fog", "silence", "disarm"];

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
  { id: "wall", name: "Стена", tier: 2, positional: true, basePower: 18, baseMult: 1.9, damageType: "physical", rule: "3+ героя, слоты 1–2 — Сила ранга ≥6", when: { all: [{ type: "PLAYED_COUNT_ABOVE", value: 2 }, { type: "FRONT_IS", attr: "str", minPower: 6 }] } },
  { id: "wedge", name: "Клин", tier: 3, positional: true, basePower: 16, baseMult: 2.1, damageType: "pure", rule: "3+ героя, сильнейший стоит в центре (не на фланге)", when: { all: [{ type: "PLAYED_COUNT_ABOVE", value: 2 }, { type: "PEAK_IN_CENTER" }] } },
  { id: "ramp", name: "Рампа", tier: 3, positional: true, basePower: 16, baseMult: 2.1, damageType: "physical", rule: "3+ героя, ранги строго растут от слота 1 к последнему", when: { all: [{ type: "PLAYED_COUNT_ABOVE", value: 2 }, { type: "RANKS_ASCENDING" }] } },
  { id: "phalanx", name: "Фаланга", tier: 3, basePower: 20, baseMult: 2.2, damageType: "byAttribute", rule: "4+ героя одного атрибута", when: { all: [{ type: "PLAYED_COUNT_ABOVE", value: 3 }, { type: "SAME_ATTRIBUTE_COUNT_ABOVE", value: 3 }] } },
  // margin 4, а не 3 — ручка из §10: при margin 3 формация перехватывает почти
  // любую руку с пиком в центре и убивает A/B-тест гипотезы.
  { id: "protect", name: "4 Protect 1", tier: 5, positional: true, basePower: 23, baseMult: 3.0, damageType: "pure", rule: "5 героев, кэрри в центре и на +4 ранга выше остальных", when: { all: [{ type: "PLAYED_COUNT_IS", value: 5 }, { type: "CARRY_PROTECTED", margin: 4 }] } },
  { id: "teamwipe", name: "Тимвайп", tier: 5, basePower: 23, baseMult: 3.4, damageType: "magical", rule: "5 героев, 5 рангов подряд и 3+ атрибута", when: { all: [{ type: "PLAYED_COUNT_IS", value: 5 }, { type: "RANK_RUN", value: 5 }, { type: "DISTINCT_ATTRIBUTES_ABOVE", value: 2 }] } },
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
  f3: { armor: 34, mr: 0.4 },
  fmini: { armor: 18, mr: 0 },
  fboss: { armor: 50, mr: 0.45 },
  // Акт 3
  p1: { armor: 14, mr: 0.1 },
  p2: { armor: 32, mr: 0.15 },
  p3: { armor: 44, mr: 0.5 },
  pmini: { armor: 24, mr: 0 },
  pfinal: { armor: 56, mr: 0.6 },
};

const DAMAGE_TYPE_NAMES = { physical: "физический", magical: "магический", pure: "чистый" };
