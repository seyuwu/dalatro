// PROTOTYPE v2 — контент системы скоринга «Формация + Связки + Броня».
// Формат близок к COMBOS_DATA: переезд в src — миграция данных, а не движка.
//
// Отличия от v1 (решение по итогам ревью 2026-09-09, docs/REDESIGN_ANTI_BALATRO.md §12):
//   — убран «Гранд-финал» (нереализуем: нужно 5 разных ролей, а ролей в данных нет);
//   — связки урезаны до 7 и все — без ролей: ROLE_FALLBACK создавал фейковую
//     глубину (Инициация = вторая Сила, Кэрри = вторая Ловкость);
//   — матрица контрпика удалена (заморожена до акта 2);
//   — числа связок станут финальными только после разметки ролей и
//     перекалибровки предметов: пол урона относительно старой системы вырос.
//
//   1. ФОРМАЦИЯ — одна лучшая по ИТОГОВОМУ урону: база силы/множителя + ТИП УРОНА.
//                 Часть правил читает ПОРЯДОК слотов (покер его игнорирует).
//   2. СВЯЗКИ   — складываются ВСЕ активные (в покере выигрывает одна рука).
//   3. БРОНЯ    — physical −armor, magical ×(1−mr), pure игнорирует. Третья ось.

const FORMATIONS_DATA = [
  {
    id: "skirmish", name: "Харас", tier: 0, basePower: 6, baseMult: 1, damageType: "physical",
    rule: "1 герой в бою", gold: 1,
    when: { type: "PLAYED_COUNT_IS", value: 1 },
  },
  {
    id: "duel", name: "Дуэль на линии", tier: 1, basePower: 12, baseMult: 1.5, damageType: "physical",
    rule: "2 героя",
    when: { type: "PLAYED_COUNT_IS", value: 2 },
  },
  {
    // Фолбэк: любой отряд 3+ всегда что-то наносит (аналог «старшей карты»).
    id: "squad", name: "Отряд", tier: 1, basePower: 14, baseMult: 1.5, damageType: "physical",
    rule: "3+ героя без выраженной формации",
    when: { type: "PLAYED_COUNT_ABOVE", value: 2 },
  },
  {
    id: "triangle", name: "Треугольник", tier: 2, basePower: 18, baseMult: 2, damageType: "magical",
    rule: "3+ героя, минимум 3 разных атрибута",
    when: { all: [{ type: "PLAYED_COUNT_ABOVE", value: 2 }, { type: "DISTINCT_ATTRIBUTES_ABOVE", value: 2 }] },
  },
  {
    id: "wall", name: "Стена", tier: 2, positional: true, basePower: 20, baseMult: 2, damageType: "physical",
    rule: "3+ героя, слоты 1–2 — Сила ранга ≥6",
    when: { all: [{ type: "PLAYED_COUNT_ABOVE", value: 2 }, { type: "FRONT_IS", attr: "str", minPower: 6 }] },
  },
  {
    id: "wedge", name: "Клин", tier: 3, positional: true, basePower: 18, baseMult: 2.25, damageType: "pure",
    rule: "3+ героя, сильнейший стоит в центре (не на фланге)",
    when: { all: [{ type: "PLAYED_COUNT_ABOVE", value: 2 }, { type: "PEAK_IN_CENTER" }] },
  },
  {
    id: "ramp", name: "Рампа", tier: 3, positional: true, basePower: 18, baseMult: 2.25, damageType: "physical",
    rule: "3+ героя, ранги строго растут от слота 1 к последнему",
    when: { all: [{ type: "PLAYED_COUNT_ABOVE", value: 2 }, { type: "RANKS_ASCENDING" }] },
  },
  {
    id: "phalanx", name: "Фаланга", tier: 3, basePower: 24, baseMult: 2.5, damageType: "byAttribute",
    rule: "4+ героя одного атрибута",
    when: { all: [{ type: "PLAYED_COUNT_ABOVE", value: 3 }, { type: "SAME_ATTRIBUTE_COUNT_ABOVE", value: 3 }] },
  },
  {
    // margin 4, а не 3: ручка из §10 доки. При margin 3 формация перехватывает
    // почти любую руку с пиком в центре (8 против среднего 5 уже проходит) и
    // убивает A/B-тест гипотезы «игрок переставляет ради формаций».
    id: "protect", name: "4 Protect 1", tier: 5, positional: true, basePower: 26, baseMult: 3.5, damageType: "pure",
    rule: "5 героев, кэрри в центре и на +4 ранга выше остальных",
    when: { all: [{ type: "PLAYED_COUNT_IS", value: 5 }, { type: "CARRY_PROTECTED", margin: 4 }] },
  },
  {
    id: "teamwipe", name: "Тимвайп", tier: 5, basePower: 28, baseMult: 4, damageType: "magical",
    rule: "5 героев, 5 рангов подряд и 3+ атрибута",
    when: { all: [
      { type: "PLAYED_COUNT_IS", value: 5 },
      { type: "RANK_RUN", value: 5 },
      { type: "DISTINCT_ATTRIBUTES_ABOVE", value: 2 },
    ] },
  },
];

// Связки — пороги признаков, все активные складываются. v2: одна ступень на
// связку, семь штук, никаких ролей. Роли вернутся отдельным слоем, когда
// hero.roles будет размечен руками (ROADMAP, «Акт 3 — теги, роли»).
const BONDS_DATA = [
  { id: "str2", trait: "Сила", when: { type: "COUNT_ATTR", attr: "str", min: 2 }, power: 6, mult: 0 },
  { id: "agi2", trait: "Ловкость", when: { type: "COUNT_ATTR", attr: "agi", min: 2 }, power: 5, mult: 0.25 },
  { id: "int2", trait: "Интеллект", when: { type: "COUNT_ATTR", attr: "int", min: 2 }, power: 0, mult: 0.5 },
  { id: "gang2", trait: "Ганг", when: { type: "SAME_RANK_GROUP", size: 2 }, power: 8, mult: 0 },
  { id: "chain3", trait: "Цепочка", when: { type: "RANK_RUN", value: 3 }, power: 8, mult: 0 },
  { id: "front", trait: "Фронт", when: { type: "FRONT_IS", attr: "str", minPower: 5 }, power: 5, mult: 0 },
  { id: "back", trait: "Тыл", when: { type: "BACK_IS", attr: "int", minPower: 0 }, power: 0, mult: 0.25 },
];

// Защита башен — третья ось. Броня съедает не больше половины удара,
// иначе харас и мелкие руки обнуляются (анти-цель «не наказывать»).
const TOWER_DEFENSE = {
  t1: { armor: 0, mr: 0 },
  t2: { armor: 10, mr: 0 },
  t3: { armor: 18, mr: 0.25 },
  techies: { armor: 8, mr: 0 },
  roshan: { armor: 34, mr: 0.35 },
};
