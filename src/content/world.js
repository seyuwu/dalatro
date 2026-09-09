// Dalatro content — combos (poker hand -> Dota event), waves (towers + boss),
// and boss/wave modifiers. One modifier format for everything.
const COMBOS_DATA = [
  { id: "high_card", name: "Харас", basePower: 5, baseMult: 1, rank: 0 },
  { id: "pair", name: "Дуо на линии", basePower: 10, baseMult: 2, rank: 1 },
  { id: "two_pair", name: "Ротация", basePower: 20, baseMult: 2, rank: 2 },
  { id: "three", name: "Ганг", basePower: 30, baseMult: 3, rank: 3 },
  { id: "straight", name: "Смок на Рошана", basePower: 30, baseMult: 4, rank: 4 },
  { id: "flush", name: "Тимфайт атрибута", basePower: 35, baseMult: 4, rank: 5 },
  { id: "full_house", name: "4 Protect 1", basePower: 40, baseMult: 6, rank: 6 },
];

const WAVES_DATA = [
  { id: "t1", name: "T1 Башня", emoji: "🗼", hp: 300, modifiers: [] },
  { id: "t2", name: "T2 Башня", emoji: "🗼", hp: 550, modifiers: [{ id: "armor" }] },
  { id: "t3", name: "T3 Башня", emoji: "🏯", hp: 800, modifiers: [{ id: "glyph" }] },
  { id: "techies", name: "Techies", emoji: "💣", hp: 1000, miniBoss: true, modifiers: [{ id: "mines" }] },
  { id: "roshan", name: "Roshan", emoji: "👹", hp: 1600, isBoss: true, modifiers: [{ id: "aegis" }] },
];

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
  { id: "skirmish", name: "Харас", tier: 0, basePower: 6, baseMult: 1, damageType: "physical", rule: "1 герой в бою", gold: 1, when: { type: "PLAYED_COUNT_IS", value: 1 } },
  { id: "duel", name: "Дуэль на линии", tier: 1, basePower: 12, baseMult: 1.5, damageType: "physical", rule: "2 героя", when: { type: "PLAYED_COUNT_IS", value: 2 } },
  // Фолбэк: любой отряд 3+ всегда что-то наносит (аналог «старшей карты»).
  { id: "squad", name: "Отряд", tier: 1, basePower: 14, baseMult: 1.5, damageType: "physical", rule: "3+ героя без выраженной формации", when: { type: "PLAYED_COUNT_ABOVE", value: 2 } },
  { id: "triangle", name: "Треугольник", tier: 2, basePower: 18, baseMult: 2, damageType: "magical", rule: "3+ героя, минимум 3 разных атрибута", when: { all: [{ type: "PLAYED_COUNT_ABOVE", value: 2 }, { type: "DISTINCT_ATTRIBUTES_ABOVE", value: 2 }] } },
  { id: "wall", name: "Стена", tier: 2, positional: true, basePower: 20, baseMult: 2, damageType: "physical", rule: "3+ героя, слоты 1–2 — Сила ранга ≥6", when: { all: [{ type: "PLAYED_COUNT_ABOVE", value: 2 }, { type: "FRONT_IS", attr: "str", minPower: 6 }] } },
  { id: "wedge", name: "Клин", tier: 3, positional: true, basePower: 18, baseMult: 2.25, damageType: "pure", rule: "3+ героя, сильнейший стоит в центре (не на фланге)", when: { all: [{ type: "PLAYED_COUNT_ABOVE", value: 2 }, { type: "PEAK_IN_CENTER" }] } },
  { id: "ramp", name: "Рампа", tier: 3, positional: true, basePower: 18, baseMult: 2.25, damageType: "physical", rule: "3+ героя, ранги строго растут от слота 1 к последнему", when: { all: [{ type: "PLAYED_COUNT_ABOVE", value: 2 }, { type: "RANKS_ASCENDING" }] } },
  { id: "phalanx", name: "Фаланга", tier: 3, basePower: 24, baseMult: 2.5, damageType: "byAttribute", rule: "4+ героя одного атрибута", when: { all: [{ type: "PLAYED_COUNT_ABOVE", value: 3 }, { type: "SAME_ATTRIBUTE_COUNT_ABOVE", value: 3 }] } },
  // margin 4, а не 3 — ручка из §10: при margin 3 формация перехватывает почти
  // любую руку с пиком в центре и убивает A/B-тест гипотезы.
  { id: "protect", name: "4 Protect 1", tier: 5, positional: true, basePower: 26, baseMult: 3.5, damageType: "pure", rule: "5 героев, кэрри в центре и на +4 ранга выше остальных", when: { all: [{ type: "PLAYED_COUNT_IS", value: 5 }, { type: "CARRY_PROTECTED", margin: 4 }] } },
  { id: "teamwipe", name: "Тимвайп", tier: 5, basePower: 28, baseMult: 4, damageType: "magical", rule: "5 героев, 5 рангов подряд и 3+ атрибута", when: { all: [{ type: "PLAYED_COUNT_IS", value: 5 }, { type: "RANK_RUN", value: 5 }, { type: "DISTINCT_ATTRIBUTES_ABOVE", value: 2 }] } },
];

// Связки — пороги признаков, все активные складываются. Одна ступень на связку,
// без ролей (роли вернутся после разметки hero.roles, ROADMAP акт 3).
const BONDS_DATA = [
  { id: "str2", trait: "Сила", when: { type: "COUNT_ATTR", attr: "str", min: 2 }, power: 6, mult: 0 },
  { id: "agi2", trait: "Ловкость", when: { type: "COUNT_ATTR", attr: "agi", min: 2 }, power: 5, mult: 0.25 },
  { id: "int2", trait: "Интеллект", when: { type: "COUNT_ATTR", attr: "int", min: 2 }, power: 0, mult: 0.5 },
  { id: "gang2", trait: "Ганг", when: { type: "SAME_RANK_GROUP", size: 2 }, power: 8, mult: 0 },
  { id: "chain3", trait: "Цепочка", when: { type: "RANK_RUN", value: 3 }, power: 8, mult: 0 },
  { id: "front", trait: "Фронт", when: { type: "FRONT_IS", attr: "str", minPower: 5 }, power: 5, mult: 0 },
  { id: "back", trait: "Тыл", when: { type: "BACK_IS", attr: "int", minPower: 0 }, power: 0, mult: 0.25 },
];

// Третья ось: числовая защита башен. physical −armor (плоско, но не больше
// половины удара), magical ×(1−mr), pure игнорирует. BKB обнуляет (как проклятия).
const TOWER_DEFENSE = {
  t1: { armor: 0, mr: 0 },
  t2: { armor: 10, mr: 0 },
  t3: { armor: 18, mr: 0.25 },
  techies: { armor: 8, mr: 0 },
  roshan: { armor: 34, mr: 0.35 },
};

const DAMAGE_TYPE_NAMES = { physical: "физический", magical: "магический", pure: "чистый" };
