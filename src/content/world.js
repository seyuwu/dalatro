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
  { id: "roshan", name: "Roshan", emoji: "👹", hp: 1600, isBoss: true, modifiers: [{ id: "aegis" }] },
];

const MODIFIERS_DATA = [
  { id: "armor", name: "Armor", desc: "Первый бой волны наносит ×0.5 урона." },
  { id: "glyph", name: "Glyph", desc: "Каждый 3-й бой полностью заблокирован." },
  { id: "aegis", name: "Aegis", desc: "Один раз возрождается с 50% HP.", hpPercent: 50 },
];
