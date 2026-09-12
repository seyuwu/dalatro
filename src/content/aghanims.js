// dotora content — Aghanim's Scepter & Shard (docs/AGHANIMS.md).
// Герой-персональные аугменты: shard 🔹 — маленькое изменение паттерна,
// scepter 🔮 — изменение поведения героя. Не занимают слоты предметов,
// покупаются в лавке на конкретного героя ростера (1+1 на героя).
// Формы:
//   ability / abilities — доп. триггеры (kind "aghanim", после базовой способности);
//   override: true      — заменяет базовую способность героя;
//   preFlag             — правило боя, применяется до триггеров (без порядка слотов).
// Экипировка живёт в state.run.aghanims = { [heroId]: { scepter, shard } }.
const AGHANIMS_DATA = [
  // ===== Пилот (шаг 2): Dawnbreaker, Tidehunter, Huskar, Ursa, PL, Tiny =====

  // --- Dawnbreaker ---
  {
    id: "dawnbreaker_sc", heroId: "dawnbreaker", kind: "scepter", name: "Starbreaker", cost: 10, emoji: "🔮",
    preFlag: { uniWildcard: true },
    desc: "Универсалы в отряде считаются джокерами атрибутов для всех условий способностей.",
  },
  {
    id: "dawnbreaker_sh", heroId: "dawnbreaker", kind: "shard", name: "Celestial Hammer", cost: 3, emoji: "🔹",
    desc: "Если других Универсалов в отряде нет — Dawnbreaker +5 силы.",
    ability: {
      name: "Celestial Hammer", event: "FIGHT_SCORING",
      when: { not: { type: "EXISTS_ATTRIBUTE", value: "uni" } },
      effects: [{ type: "ADD_POWER", value: 5 }],
    },
  },

  // --- Tidehunter ---
  {
    id: "tidehunter_sc", heroId: "tidehunter", kind: "scepter", name: "Ravage", cost: 10, emoji: "🔮", override: true,
    desc: "Anchor Smash заменён: полная пятёрка — способности всех героев срабатывают дважды.",
    ability: {
      name: "Ravage", event: "FIGHT_SCORING",
      when: { type: "PLAYED_COUNT_IS", value: 5 },
      effects: [{ type: "REFRESH_HERO_TRIGGERS" }],
    },
  },
  {
    id: "tidehunter_sh", heroId: "tidehunter", kind: "shard", name: "Kelp Vise", cost: 3, emoji: "🔹",
    desc: "В отряде ровно 4 героя — Tidehunter +6 силы: страховка за сорвавшуюся пятёрку.",
    ability: {
      name: "Kelp Vise", event: "FIGHT_SCORING",
      when: { type: "PLAYED_COUNT_IS", value: 4 },
      effects: [{ type: "ADD_POWER", value: 6 }],
    },
  },

  // --- Huskar ---
  {
    id: "huskar_sc", heroId: "huskar", kind: "scepter", name: "Burn the Racks", cost: 10, emoji: "🔮",
    desc: "Казармы = опыт: зачистка волны с потерянной казармой даёт героям боя +1 опыта.",
    ability: {
      name: "Burn the Racks", event: "FIGHT_SCORING",
      effects: [{ type: "GRANT_XP_ON_CLEAR", value: 1 }],
    },
  },
  {
    id: "huskar_sh", heroId: "huskar", kind: "shard", name: "Inner Fire", cost: 3, emoji: "🔹",
    desc: "Башня ниже половины HP — Huskar +5 силы.",
    ability: {
      name: "Inner Fire", event: "FIGHT_SCORING",
      when: { type: "TOWER_HP_BELOW", pct: 50 },
      effects: [{ type: "ADD_POWER", value: 5 }],
    },
  },

  // --- Ursa ---
  {
    id: "ursa_sc", heroId: "ursa", kind: "scepter", name: "Overpower", cost: 10, emoji: "🔮", override: true,
    desc: "Fury Swipes заменён: Ursa свирепствует ×1.8, будучи сильнейшим в отряде или в одиночном рейде.",
    ability: {
      name: "Enrage", event: "FIGHT_SCORING",
      when: { any: [{ type: "IS_HIGHEST_RANK" }, { type: "PLAYED_COUNT_IS", value: 1 }] },
      effects: [{ type: "MULT_MULT", value: 1.8 }],
    },
  },
  {
    id: "ursa_sh", heroId: "ursa", kind: "shard", name: "Earthshock", cost: 3, emoji: "🔹",
    desc: "Свирепость мимо (Ursa не сильнейший и не соло) — Ursa +6 силы (утешительный удар).",
    ability: {
      name: "Earthshock", event: "FIGHT_SCORING",
      when: { all: [{ not: { type: "IS_HIGHEST_RANK" } }, { not: { type: "PLAYED_COUNT_IS", value: 1 } }] },
      effects: [{ type: "ADD_POWER", value: 6 }],
    },
  },

  // --- Phantom Lancer ---
  {
    id: "phantom_lancer_sc", heroId: "phantom_lancer", kind: "scepter", name: "Doppelganger", cost: 10, emoji: "🔮", override: true,
    desc: "Spirit Lance заменён: +1 к множителю за каждого Ловкого в отряде; полностью Ловкий отряд даёт ещё +1.",
    abilities: [
      { name: "Doppelganger", event: "FIGHT_SCORING",
        effects: [{ type: "ADD_MULT_PER_ATTRIBUTE", attr: "agi", value: 1 }] },
      { name: "Doppelganger", event: "FIGHT_SCORING",
        when: { type: "ALL_ATTRIBUTES", value: "agi" },
        effects: [{ type: "ADD_MULT", value: 1 }] },
    ],
  },
  {
    id: "phantom_lancer_sh", heroId: "phantom_lancer", kind: "shard", name: "Phantom Rush", cost: 3, emoji: "🔹",
    desc: "Иллюзия из Manta Style считается Ловкой — участвует во флеше и в условиях способностей.",
    ability: {
      name: "Phantom Rush", event: "PRE_DETECT",
      effects: [{ type: "ILLUSION_ATTR", attr: "agi" }],
    },
  },

  // --- Tiny ---
  {
    id: "tiny_sc", heroId: "tiny", kind: "scepter", name: "Avalanche", cost: 10, emoji: "🔮",
    desc: "Tiny растёт: каждый сброс волны даёт ему +1 к силе — навсегда (максимум +3).",
    ability: {
      name: "Avalanche", event: "FIGHT_SCORING",
      effects: [{ type: "GAIN_RANK_PER_USED_DISCARD", value: 1, cap: 3 }],
    },
  },
  {
    id: "tiny_sh", heroId: "tiny", kind: "shard", name: "Toss", cost: 3, emoji: "🔹",
    desc: "Tiny подбрасывает слабейшего героя: +50% его силы к удару.",
    ability: {
      name: "Toss", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_WEAKEST", pct: 50 }],
    },
  },

  // ===== Полный реестр (шаг 3): остальные 23 героя =====

  // --- Sven (str 8) ---
  {
    id: "sven_sc", heroId: "sven", kind: "scepter", name: "Warcry", cost: 10, emoji: "🔮",
    desc: "Чистая рука: за бой не потрачено ни одного сброса — Sven +8 силы (God's Strength работает как обычно).",
    ability: {
      name: "Warcry", event: "FIGHT_SCORING",
      when: { type: "DISCARDS_UNUSED" },
      effects: [{ type: "ADD_POWER", value: 8 }],
    },
  },
  {
    id: "sven_sh", heroId: "sven", kind: "shard", name: "Great Cleave", cost: 3, emoji: "🔹",
    desc: "Сосед по слоту Сила — оба получают +3 силы.",
    ability: {
      name: "Great Cleave", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_PER_NEIGHBOR_ATTR", attr: "str", value: 3, includeSelf: true }],
    },
  },

  // --- Centaur (str 10) ---
  {
    id: "centaur_sc", heroId: "centaur", kind: "scepter", name: "Retaliate", cost: 10, emoji: "🔮",
    desc: "Trample срабатывает в любом слоте, но считает только героев позади него.",
    ability: {
      name: "Retaliate", event: "FIGHT_SCORING",
      when: { not: { type: "SLOT_IS", value: 0 } },
      effects: [{ type: "ADD_POWER_PER_PLAYED_AFTER", value: 4 }],
    },
  },
  {
    id: "centaur_sh", heroId: "centaur", kind: "shard", name: "Hoof Stomp", cost: 3, emoji: "🔹",
    desc: "Полная пятёрка — Trample бьёт +6 за героя (вместо +4).",
    ability: {
      name: "Hoof Stomp", event: "FIGHT_SCORING",
      when: { type: "PLAYED_COUNT_IS", value: 5 },
      effects: [{ type: "ADD_POWER_PER_PLAYED", value: 2 }],
    },
  },

  // --- Morphling (agi 5) ---
  {
    id: "morphling_sc", heroId: "morphling", kind: "scepter", name: "Attribute Shift", cost: 10, emoji: "🔮",
    desc: "Morphling помнит родной атрибут: пока скопирован чужой, карта считается двумя атрибутами сразу.",
    ability: { name: "Attribute Shift", event: "PRE_DETECT", effects: [{ type: "KEEP_NATIVE_ATTR" }] },
  },
  {
    id: "morphling_sh", heroId: "morphling", kind: "shard", name: "Waveform", cost: 3, emoji: "🔹",
    desc: "Если слева пусто, Morphling копирует атрибут правого соседа.",
    ability: { name: "Waveform", event: "PRE_DETECT", effects: [{ type: "COPY_ATTRIBUTE_FALLBACK" }] },
  },

  // --- Primal Beast (uni 11) ---
  {
    id: "primal_sc", heroId: "primal", kind: "scepter", name: "Uproot", cost: 10, emoji: "🔮", override: true,
    desc: "Pulverize привязан к позиции: в одном из трёх средних слотов при 4+ героях — ×2.",
    ability: {
      name: "Pulverize", event: "FIGHT_SCORING",
      when: { all: [{ any: [{ type: "SLOT_IS", value: 1 }, { type: "SLOT_IS", value: 2 }, { type: "SLOT_IS", value: 3 }] }, { type: "PLAYED_COUNT_ABOVE", value: 3 }] },
      effects: [{ type: "MULT_MULT", value: 2 }],
    },
  },
  {
    id: "primal_sh", heroId: "primal", kind: "shard", name: "Onslaught", cost: 3, emoji: "🔹",
    desc: "Бой без сбросов — Primal Beast +5 силы.",
    ability: {
      name: "Onslaught", event: "FIGHT_SCORING",
      when: { type: "DISCARDS_UNUSED" },
      effects: [{ type: "ADD_POWER", value: 5 }],
    },
  },

  // --- Undying (str 2) ---
  {
    id: "undying_sc", heroId: "undying", kind: "scepter", name: "Soul Rip", cost: 10, emoji: "🔮",
    desc: "Каждый сброс волны даёт Undying заряд. В бою заряды тратятся: +3 силы за каждый.",
    abilities: [
      { name: "Soul Rip", event: "ON_ANY_DISCARD", effects: [{ type: "ADD_CHARGE", value: 1 }] },
      { name: "Soul Rip", event: "FIGHT_SCORING", effects: [{ type: "SPEND_CHARGES_POWER", value: 3 }] },
    ],
  },
  {
    id: "undying_sh", heroId: "undying", kind: "shard", name: "Tombstone", cost: 3, emoji: "🔹",
    desc: "Использованные в бою сбросы дают Undying ещё +2 силы каждый.",
    ability: {
      name: "Tombstone", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_PER_USED_DISCARD", value: 2 }],
    },
  },

  // --- Meepo (agi 2) ---
  {
    id: "meepo_sc", heroId: "meepo", kind: "scepter", name: "Divided We Stand", cost: 10, emoji: "🔮", override: true,
    desc: "Poof заменён: +6 силы за каждого Ловкого в отряде, включая себя.",
    ability: {
      name: "Poof", event: "ON_PLAY",
      effects: [{ type: "ADD_POWER_PER_ATTRIBUTE", attr: "agi", value: 6 }],
    },
  },
  {
    id: "meepo_sh", heroId: "meepo", kind: "shard", name: "Earthbind", cost: 3, emoji: "🔹",
    desc: "Сосед по слоту Ловкий — оба получают +3 силы.",
    ability: {
      name: "Earthbind", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_PER_NEIGHBOR_ATTR", attr: "agi", value: 3, includeSelf: true }],
    },
  },

  // --- Bounty Hunter (agi 3) ---
  {
    id: "bounty_sc", heroId: "bounty", kind: "scepter", name: "Jinada", cost: 10, emoji: "🔮",
    desc: "Точный ласт-хит вернёт 1 сброс на следующую волну.",
    ability: {
      name: "Jinada", event: "FIGHT_SCORING",
      effects: [{ type: "REFUND_DISCARD", value: 1 }],
    },
  },
  {
    id: "bounty_sh", heroId: "bounty", kind: "shard", name: "Shuriken Toss", cost: 3, emoji: "🔹",
    desc: "Каждый точный ласт-хит: +1 удача до конца забега (максимум +3).",
    ability: {
      name: "Shuriken Toss", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_LUCK_ON_LAST_HIT", cap: 3 }],
    },
  },

  // --- Faceless Void (agi 10) ---
  {
    id: "faceless_sc", heroId: "faceless", kind: "scepter", name: "Time Lock", cost: 10, emoji: "🔮", override: true,
    desc: "Chronosphere бьёт и по мини-боссам, и запирает Aegis: +2 к множителю, босс больше не возродится.",
    ability: {
      name: "Chronosphere", event: "FIGHT_SCORING",
      when: { any: [{ type: "IS_BOSS_WAVE" }, { type: "IS_MINIBOSS_WAVE" }] },
      effects: [{ type: "ADD_MULT", value: 2 }, { type: "DENY_REVIVE" }],
    },
  },
  {
    id: "faceless_sh", heroId: "faceless", kind: "shard", name: "Time Dilation", cost: 3, emoji: "🔹",
    desc: "После проваленной волны Void даёт +1 к множителю — и на обычных башнях тоже.",
    ability: {
      name: "Time Dilation", event: "FIGHT_SCORING",
      when: { type: "AFTER_FAILURE" },
      effects: [{ type: "ADD_MULT", value: 1 }],
    },
  },

  // --- Terrorblade (agi 11) ---
  {
    id: "terrorblade_sc", heroId: "terrorblade", kind: "scepter", name: "Reflection", cost: 10, emoji: "🔮",
    desc: "Для комбо Terrorblade считается с силой правого соседа (своя сила не меняется) — собирает пары из «непарных» рук.",
    ability: { name: "Reflection", event: "PRE_DETECT", effects: [{ type: "MIRROR_RANK" }] },
  },
  {
    id: "terrorblade_sh", heroId: "terrorblade", kind: "shard", name: "Soul Siphon", cost: 3, emoji: "🔹",
    desc: "Правый сосед Ловкий — Terrorblade +4 силы.",
    ability: {
      name: "Soul Siphon", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_PER_NEIGHBOR_ATTR", attr: "agi", value: 4, includeSelf: false }],
    },
  },

  // --- Oracle (int 3) ---
  {
    id: "oracle_sc", heroId: "oracle", kind: "scepter", name: "Fortune's End", cost: 10, emoji: "🔮", override: true,
    desc: "False Promise заменён: вместо +10 силы Oracle даёт ×1.6 множителя, оставаясь слабейшим.",
    ability: {
      name: "False Promise", event: "FIGHT_SCORING",
      when: { type: "IS_LOWEST_RANK" },
      effects: [{ type: "MULT_MULT", value: 1.6 }],
    },
  },
  {
    id: "oracle_sh", heroId: "oracle", kind: "shard", name: "Fate Seal", cost: 3, emoji: "🔹",
    desc: "В отряде есть герой той же силы, что Oracle, — Oracle и каждый тёзка получают +4 силы.",
    ability: {
      name: "Fate Seal", event: "FIGHT_SCORING",
      when: { type: "SAME_RANK_GROUP", size: 2 },
      effects: [{ type: "ADD_POWER_PER_SAME_RANK", value: 4 }, { type: "ADD_POWER", value: 4 }],
    },
  },

  // --- Skywrath Mage (int 4) ---
  {
    id: "skywrath_sc", heroId: "skywrath", kind: "scepter", name: "Ancient Seal", cost: 10, emoji: "🔮",
    desc: "При ровно двух героях в отряде: ×1.4 (в соло ×2 остаётся).",
    ability: {
      name: "Ancient Seal", event: "FIGHT_SCORING",
      when: { type: "PLAYED_COUNT_IS", value: 2 },
      effects: [{ type: "MULT_MULT", value: 1.4 }],
    },
  },
  {
    id: "skywrath_sh", heroId: "skywrath", kind: "shard", name: "Concussive Blast", cost: 3, emoji: "🔹",
    desc: "Соло-бой: Skywrath +5 силы сверх ×2.",
    ability: {
      name: "Concussive Blast", event: "FIGHT_SCORING",
      when: { type: "PLAYED_COUNT_IS", value: 1 },
      effects: [{ type: "ADD_POWER", value: 5 }],
    },
  },

  // --- Lina (int 6) ---
  {
    id: "lina_sc", heroId: "lina", kind: "scepter", name: "Fiery Soul", cost: 10, emoji: "🔮",
    desc: "Каждый использованный в бою сброс даёт Lina +5 силы.",
    ability: {
      name: "Fiery Soul", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_PER_USED_DISCARD", value: 5 }],
    },
  },
  {
    id: "lina_sh", heroId: "lina", kind: "shard", name: "Dragon Slave", cost: 3, emoji: "🔹",
    desc: "3+ героя Интеллекта в отряде — Lina +4 силы.",
    ability: {
      name: "Dragon Slave", event: "FIGHT_SCORING",
      when: { type: "SAME_ATTRIBUTE_COUNT_ABOVE", value: 2 },
      effects: [{ type: "ADD_POWER", value: 4 }],
    },
  },

  // --- Storm Spirit (int 9) ---
  {
    id: "storm_spirit_sc", heroId: "storm_spirit", kind: "scepter", name: "Overload", cost: 10, emoji: "🔮",
    desc: "Electric Swing срабатывает на любом слоте, где Storm не стоял в прошлом бою: +9 силы за ротацию.",
    ability: {
      name: "Overload", event: "ON_PLAY",
      when: { type: "SLOT_CHANGED" },
      effects: [{ type: "ADD_POWER", value: 9 }],
    },
  },
  {
    id: "storm_spirit_sh", heroId: "storm_spirit", kind: "shard", name: "Static Remnant", cost: 3, emoji: "🔹",
    desc: "Storm не в первом слоте — герой слева даёт +4 силы.",
    ability: {
      name: "Static Remnant", event: "FIGHT_SCORING",
      when: { all: [{ not: { type: "SLOT_IS", value: 0 } }, { type: "SLOT_LEFT_EXISTS" }] },
      effects: [{ type: "ADD_POWER", value: 4 }],
    },
  },

  // --- Outworld Destroyer (int 10) ---
  {
    id: "outworld_sc", heroId: "outworld", kind: "scepter", name: "Sanity Overload", cost: 10, emoji: "🔮",
    desc: "Каждый атрибут сверх третьего в отряде: ещё +6 силы и +0.5 к множителю (Astral Imprisonment работает как обычно).",
    ability: {
      name: "Sanity Overload", event: "FIGHT_SCORING",
      when: { type: "DISTINCT_ATTRIBUTES_ABOVE", value: 2 },
      effects: [{ type: "ADD_POWER_PER_EXTRA_DISTINCT", value: 6, extraMult: 0.5 }],
    },
  },
  {
    id: "outworld_sh", heroId: "outworld", kind: "shard", name: "Essence Flux", cost: 3, emoji: "🔹",
    desc: "Универсалы идут в зачёт атрибутов для Sanity Overload: 2 атрибута + Универсал = 3.",
    preFlag: { uniDistinct: true },
  },

  // --- Ancient Apparition (int 11) ---
  {
    id: "aa_sc", heroId: "ancient_apparition", kind: "scepter", name: "Shatter", cost: 10, emoji: "🔮",
    desc: "Зачистка волны с AA в отряде: следующая башня акта начинается с −10% HP — копится до −30%.",
    ability: {
      name: "Shatter", event: "FIGHT_SCORING",
      effects: [{ type: "SET_NEXT_WAVE_PCT", value: 10 }],
    },
  },
  {
    id: "aa_sh", heroId: "ancient_apparition", kind: "shard", name: "Chilling Touch", cost: 3, emoji: "🔹",
    desc: "Башня выше 80% HP — AA +6 силы.",
    ability: {
      name: "Chilling Touch", event: "FIGHT_SCORING",
      when: { type: "TOWER_HP_ABOVE", pct: 80 },
      effects: [{ type: "ADD_POWER", value: 6 }],
    },
  },

  // --- Enigma (int 12) ---
  {
    id: "enigma_sc", heroId: "enigma", kind: "scepter", name: "Demonic Conversion", cost: 10, emoji: "🔮", override: true,
    desc: "Eidolon: для комбо иллюзия Энигмы считается с его полной силой — бьёт по-прежнему половиной.",
    ability: {
      name: "Eidolon", event: "PRE_DETECT",
      effects: [{ type: "CREATE_ILLUSION", powerRatio: 0.5, fullRank: true }],
    },
  },
  {
    id: "enigma_sh", heroId: "enigma", kind: "shard", name: "Malefice", cost: 3, emoji: "🔹",
    desc: "Иллюзия Энигмы получает 75% силы вместо 50%.",
    ability: { name: "Malefice", event: "PRE_DETECT", effects: [{ type: "ILLUSION_RATIO", value: 0.75 }] },
  },

  // --- Io (uni 2) ---
  {
    id: "io_sc", heroId: "io", kind: "scepter", name: "Relocate", cost: 10, emoji: "🔮",
    desc: "Tether Pull привязывается к соседям: +6 силы за каждого Сильного соседа по слоту.",
    ability: {
      name: "Relocate", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_PER_NEIGHBOR_ATTR", attr: "str", value: 6, includeSelf: false }],
    },
  },
  {
    id: "io_sh", heroId: "io", kind: "shard", name: "Spirits", cost: 3, emoji: "🔹",
    desc: "Другой Универсал в отряде — Io +6 силы.",
    ability: {
      name: "Spirits", event: "FIGHT_SCORING",
      when: { type: "EXISTS_ATTRIBUTE", value: "uni" },
      effects: [{ type: "ADD_POWER", value: 6 }],
    },
  },

  // --- Muerta (uni 3) ---
  {
    id: "muerta_sc", heroId: "muerta", kind: "scepter", name: "The Calling", cost: 10, emoji: "🔮",
    desc: "Пока Muerta в отряде, последняя карта боя даёт +20% своей силы.",
    ability: {
      name: "The Calling", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_LAST_CARD", pct: 20 }],
    },
  },
  {
    id: "muerta_sh", heroId: "muerta", kind: "shard", name: "Dead Shot+", cost: 3, emoji: "🔹", override: true,
    desc: "Dead Shot срабатывает и на третьем, и на последнем слоте: +8 силы.",
    ability: {
      name: "Dead Shot", event: "ON_PLAY",
      when: { any: [{ type: "SLOT_IS", value: 2 }, { type: "SLOT_IS_LAST" }] },
      effects: [{ type: "ADD_POWER", value: 8 }],
    },
  },

  // --- Marci (uni 4) ---
  {
    id: "marci_sc", heroId: "marci", kind: "scepter", name: "Rebound", cost: 10, emoji: "🔮",
    desc: "Оба соседа другого атрибута: Marci +12 силы и +1 к множителю (обычные +8 остаются).",
    ability: {
      name: "Rebound", event: "FIGHT_SCORING",
      when: { type: "BOTH_NEIGHBORS_DIFFER" },
      effects: [{ type: "ADD_POWER", value: 12 }, { type: "ADD_MULT", value: 1 }],
    },
  },
  {
    id: "marci_sh", heroId: "marci", kind: "shard", name: "Companion Run", cost: 3, emoji: "🔹",
    desc: "Оба соседа — того же атрибута, что Marci: +6 силы.",
    ability: {
      name: "Companion Run", event: "FIGHT_SCORING",
      when: { type: "BOTH_NEIGHBORS_SAME" },
      effects: [{ type: "ADD_POWER", value: 6 }],
    },
  },

  // --- Snapfire (uni 5) ---
  {
    id: "snapfire_sc", heroId: "snapfire", kind: "scepter", name: "Lil' Shredder", cost: 10, emoji: "🔮",
    desc: "Каждый использованный в бою сброс: Snapfire +0.5 к множителю.",
    ability: {
      name: "Lil' Shredder", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_MULT_PER_USED_DISCARD", value: 0.5 }],
    },
  },
  {
    id: "snapfire_sh", heroId: "snapfire", kind: "shard", name: "Cookie", cost: 3, emoji: "🔹",
    desc: "Snapfire не на последнем слоте — сосед справа даёт +4 силы.",
    ability: {
      name: "Cookie", event: "FIGHT_SCORING",
      when: { all: [{ not: { type: "SLOT_IS_LAST" } }, { type: "SLOT_RIGHT_EXISTS" }] },
      effects: [{ type: "ADD_POWER", value: 4 }],
    },
  },

  // --- Void Spirit (uni 6) ---
  {
    id: "void_spirit_sc", heroId: "void_spirit", kind: "scepter", name: "Ascended Charge", cost: 10, emoji: "🔮", override: true,
    desc: "Prism Line заменён: Void Spirit +8 силы, когда он сильнейший в отряде, а с уровнем — всегда.",
    ability: {
      name: "Dissimilate", event: "FIGHT_SCORING",
      when: { any: [{ type: "IS_HIGHEST_RANK" }, { type: "HERO_LEVEL_ABOVE", value: 0 }] },
      effects: [{ type: "ADD_POWER", value: 8 }],
    },
  },
  {
    id: "void_spirit_sh", heroId: "void_spirit", kind: "shard", name: "Resonant Pulse", cost: 3, emoji: "🔹",
    desc: "Соседи по слоту Универсалы (и сам Void Spirit) получают +2 силы каждый.",
    ability: {
      name: "Resonant Pulse", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_PER_NEIGHBOR_ATTR", attr: "uni", value: 2, includeSelf: true }],
    },
  },

  // --- Kez (uni 7) ---
  {
    id: "kez_sc", heroId: "kez", kind: "scepter", name: "Raptor Dance", cost: 10, emoji: "🔮",
    desc: "Kez в середине отряда: +1 к множителю. Echo Slash работает как раньше.",
    ability: {
      name: "Raptor Dance", event: "FIGHT_SCORING",
      when: { type: "IS_MIDDLE_SLOT" },
      effects: [{ type: "ADD_MULT", value: 1 }],
    },
  },
  {
    id: "kez_sh", heroId: "kez", kind: "shard", name: "Falcon Rush", cost: 3, emoji: "🔹",
    desc: "Полная пятёрка — Kez +4 силы.",
    ability: {
      name: "Falcon Rush", event: "FIGHT_SCORING",
      when: { type: "PLAYED_COUNT_IS", value: 5 },
      effects: [{ type: "ADD_POWER", value: 4 }],
    },
  },

  // --- Beastmaster (uni 8) ---
  {
    id: "beastmaster_sc", heroId: "beastmaster", kind: "scepter", name: "Call of the Wild", cost: 10, emoji: "🔮",
    desc: "+2 силы за каждого героя с силой ±1 от силы Beastmaster.",
    ability: {
      name: "Call of the Wild", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_PER_SAME_RANK", value: 2, tolerance: 1 }],
    },
  },
  {
    id: "beastmaster_sh", heroId: "beastmaster", kind: "shard", name: "Wild Axes", cost: 3, emoji: "🔹",
    desc: "В отряде есть пара героев одной силы — Beastmaster +4 силы.",
    ability: {
      name: "Wild Axes", event: "FIGHT_SCORING",
      when: { type: "SAME_RANK_GROUP", size: 2 },
      effects: [{ type: "ADD_POWER", value: 4 }],
    },
  },

  // ===== Текстовые дизайны матрицы (батч 3): 15 героев =====

  // --- Phantom Assassin (agi 9) ---
  {
    id: "pa_sc", heroId: "pa", kind: "scepter", name: "Echo Strike", cost: 10, emoji: "🔮",
    desc: "Если в бою сработал крит — башня получает ещё +30% урона сверх удара.",
    ability: {
      name: "Echo Strike", event: "FIGHT_SCORING",
      effects: [{ type: "ARM_ECHO_ON_CRIT", pct: 30 }],
    },
  },
  {
    id: "pa_sh", heroId: "pa", kind: "shard", name: "Blur", cost: 3, emoji: "🔹",
    desc: "За волну была хоть одна перестановка — PA +4 силы.",
    ability: {
      name: "Blur", event: "FIGHT_SCORING",
      when: { type: "MOVES_ABOVE", value: 0 },
      effects: [{ type: "ADD_POWER", value: 4 }],
    },
  },

  // --- Zeus (int 5) ---
  {
    id: "zeus_sc", heroId: "zeus", kind: "scepter", name: "Thundergod's Circuit", cost: 10, emoji: "🔮",
    desc: "Цепь грома: +1 к множителю за каждый тип комбо за забег (максимум +3).",
    ability: {
      name: "Thundergod's Circuit", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_MULT_PER_DISTINCT_COMBO", value: 1, cap: 3 }],
    },
  },
  {
    id: "zeus_sh", heroId: "zeus", kind: "shard", name: "Arc Surge", cost: 3, emoji: "🔹",
    desc: "Комбо отличается от предыдущего боя — Zeus +4 силы.",
    ability: {
      name: "Arc Surge", event: "FIGHT_SCORING",
      when: { type: "COMBO_DIFFERENT_FROM_LAST" },
      effects: [{ type: "ADD_POWER", value: 4 }],
    },
  },

  // --- Crystal Maiden (int 2) ---
  {
    id: "cm_sc", heroId: "cm", kind: "scepter", name: "Arcane Reserve", cost: 10, emoji: "🔮",
    desc: "Неиспользованные сбросы волны копятся в Mana Reserve (до 3). В первом бою волны CM получает +3 силы за каждый накопленный сброс.",
    ability: {
      name: "Arcane Reserve", event: "FIGHT_SCORING",
      when: { type: "FIGHT_FIRST" },
      effects: [{ type: "SPEND_MANA_RESERVE", value: 3 }],
    },
  },
  {
    id: "cm_sh", heroId: "cm", kind: "shard", name: "Frostbite Memory", cost: 3, emoji: "🔹",
    desc: "Каждый использованный в бою сброс приносит +1 золота.",
    ability: {
      name: "Frostbite Memory", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_GOLD_PER_USED_DISCARD", value: 1 }],
    },
  },

  // --- Tinker (uni 12) ---
  {
    id: "tinker_sc", heroId: "tinker", kind: "scepter", name: "Rearm Protocol", cost: 10, emoji: "🔮", override: true,
    desc: "Rearm заменён: способности срабатывают дважды, пока накоплено 2 обновления лавки (тратит их).",
    ability: {
      name: "Rearm Protocol", event: "FIGHT_SCORING",
      when: { type: "REROLL_CHARGES_ABOVE", value: 1 },
      effects: [{ type: "REFRESH_HERO_TRIGGERS" }, { type: "CONSUME_REROLL_CHARGES", amount: 2 }],
    },
  },
  {
    id: "tinker_sh", heroId: "tinker", kind: "shard", name: "Heat Sink", cost: 3, emoji: "🔹",
    desc: "Каждое накопленное обновление лавки даёт Tinker +2 силы (ядро не тратится).",
    ability: {
      name: "Heat Sink", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_PER_REROLL_CHARGE", value: 2 }],
    },
  },

  // --- Invoker (int 8) ---
  {
    id: "invoker_sc", heroId: "invoker", kind: "scepter", name: "Invoke Mastery", cost: 10, emoji: "🔮",
    desc: "Бой с 3+ атрибутами даёт Spell Fragment (до 3): 3 фрагмента — Invoke усиливается ×1.5.",
    abilities: [
      { name: "Invoke Mastery", event: "FIGHT_SCORING",
        when: { type: "DISTINCT_ATTRIBUTES_ABOVE", value: 2 },
        effects: [{ type: "ADD_CHARGE", value: 1, cap: 3 }] },
      { name: "Invoke Mastery", event: "FIGHT_SCORING",
        when: { type: "CHARGES_ABOVE", value: 2 },
        effects: [{ type: "SPEND_CHARGES_MULT", mult: 1.5, amount: 3 }] },
    ],
  },
  {
    id: "invoker_sh", heroId: "invoker", kind: "shard", name: "Quick Cast", cost: 3, emoji: "🔹",
    desc: "Первый бой волны: Invoke +1 к множителю.",
    ability: {
      name: "Quick Cast", event: "FIGHT_SCORING",
      when: { type: "FIGHT_FIRST" },
      effects: [{ type: "ADD_MULT", value: 1 }],
    },
  },

  // --- Pudge (str 7) ---
  {
    id: "pudge_sc", heroId: "pudge", kind: "scepter", name: "Flesh Heap", cost: 10, emoji: "🔮",
    desc: "Каждая перестановка строя добавляет Pudge +2 силы (максимум +8).",
    ability: {
      name: "Flesh Heap", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_PER_FORMATION_MOVE", value: 2, cap: 8, consume: true }],
    },
  },
  {
    id: "pudge_sh", heroId: "pudge", kind: "shard", name: "Meat Hook", cost: 3, emoji: "🔹",
    desc: "Крюк тянет строй: каждый сосед по слоту даёт +3 силы.",
    ability: {
      name: "Meat Hook", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_PER_NEIGHBOR", value: 3 }],
    },
  },

  // --- Axe (str 5) ---
  {
    id: "axe_sc", heroId: "axe", kind: "scepter", name: "Counter Helix+", cost: 10, emoji: "🔮",
    desc: "Перестановки и сбросы за волну заряжают Helix: 2+ действий — Axe +8 силы.",
    ability: {
      name: "Counter Helix+", event: "FIGHT_SCORING",
      when: { type: "FORMATION_ACTIONS_ABOVE", value: 2 },
      effects: [{ type: "ADD_POWER", value: 8 }],
    },
  },
  {
    id: "axe_sh", heroId: "axe", kind: "shard", name: "Berserker", cost: 3, emoji: "🔹",
    desc: "Axe в середине отряда — Helix крутится быстрее: +4 силы.",
    ability: {
      name: "Berserker", event: "FIGHT_SCORING",
      when: { type: "IS_MIDDLE_SLOT" },
      effects: [{ type: "ADD_POWER", value: 4 }],
    },
  },

  // --- Juggernaut (agi 7) ---
  {
    id: "jugg_sc", heroId: "juggernaut", kind: "scepter", name: "Blade Dance", cost: 10, emoji: "🔮",
    desc: "Серия одинаковых комбо подряд: +1 к множителю за каждый повтор (максимум +3).",
    ability: {
      name: "Blade Dance", event: "FIGHT_SCORING",
      when: { type: "COMBO_SAME_AS_LAST" },
      effects: [{ type: "ADD_MULT_PER_COMBO_STREAK", value: 1, cap: 3 }],
    },
  },
  {
    id: "jugg_sh", heroId: "juggernaut", kind: "shard", name: "Blade Step", cost: 3, emoji: "🔹",
    desc: "За волну была перестановка — Juggernaut +4 силы.",
    ability: {
      name: "Blade Step", event: "FIGHT_SCORING",
      when: { type: "MOVES_ABOVE", value: 0 },
      effects: [{ type: "ADD_POWER", value: 4 }],
    },
  },

  // --- Slark (agi 4) ---
  {
    id: "slark_sc", heroId: "slark", kind: "scepter", name: "Essence Shift+", cost: 10, emoji: "🔮",
    desc: "Slark крадёт атрибут соседа слева: считается двумя атрибутами сразу.",
    ability: { name: "Essence Shift+", event: "PRE_DETECT", effects: [{ type: "STEAL_ATTR" }] },
  },
  {
    id: "slark_sh", heroId: "slark", kind: "shard", name: "Pounce", cost: 3, emoji: "🔹",
    desc: "Slark встал не на тот слот, что в прошлом бою: +5 силы.",
    ability: {
      name: "Pounce", event: "FIGHT_SCORING",
      when: { type: "SLOT_CHANGED" },
      effects: [{ type: "ADD_POWER", value: 5 }],
    },
  },

  // --- Anti-Mage (agi 8) ---
  {
    id: "anti_mage_sc", heroId: "anti_mage", kind: "scepter", name: "Mana Break+", cost: 10, emoji: "🔮", override: true,
    desc: "Mana Break заменён: новое комбо — пустые слоты дают по +8 силы, повтор прошлого — по +3.",
    abilities: [
      { name: "Mana Break", event: "FIGHT_SCORING",
        when: { type: "COMBO_DIFFERENT_FROM_LAST" },
        effects: [{ type: "ADD_POWER_PER_EMPTY_SLOT", value: 8 }] },
      { name: "Mana Break", event: "FIGHT_SCORING",
        when: { type: "COMBO_SAME_AS_LAST" },
        effects: [{ type: "ADD_POWER_PER_EMPTY_SLOT", value: 3 }] },
    ],
  },
  {
    id: "anti_mage_sh", heroId: "anti_mage", kind: "shard", name: "Blink", cost: 3, emoji: "🔹",
    desc: "За волну была перестановка — Anti-Mage +1 к множителю.",
    ability: {
      name: "Blink", event: "FIGHT_SCORING",
      when: { type: "MOVES_ABOVE", value: 0 },
      effects: [{ type: "ADD_MULT", value: 1 }],
    },
  },

  // --- Legion Commander (str 6) ---
  {
    id: "legion_sc", heroId: "legion", kind: "scepter", name: "Duel+", cost: 10, emoji: "🔮",
    desc: "Точный ласт-хит даёт стек (до 6). Каждый стек — +2 силы.",
    abilities: [
      { name: "Duel+", event: "FIGHT_SCORING", effects: [{ type: "GAIN_CHARGE_ON_LAST_HIT", cap: 6 }] },
      { name: "Duel+", event: "FIGHT_SCORING", effects: [{ type: "ADD_POWER_PER_CHARGE", value: 2 }] },
    ],
  },
  {
    id: "legion_sh", heroId: "legion", kind: "shard", name: "Press the Attack", cost: 3, emoji: "🔹",
    desc: "Каждый герой с уровнем в отряде — Legion +2 силы.",
    ability: {
      name: "Press the Attack", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_PER_LEVELED_HERO", value: 2 }],
    },
  },

  // --- Rubick (int 7) ---
  {
    id: "rubick_sc", heroId: "rubick", kind: "scepter", name: "Grand Magus", cost: 10, emoji: "🔮",
    desc: "Rubick ворует магию: +3 силы за каждую чужую способность, сработавшую в этом бою (максимум +12).",
    ability: {
      name: "Grand Magus", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_PER_TRIGGERED_HEROES", value: 3, cap: 12 }],
    },
  },
  {
    id: "rubick_sh", heroId: "rubick", kind: "shard", name: "Fade Bolt+", cost: 3, emoji: "🔹",
    desc: "Комбо отличается от предыдущего боя — Rubick +1 к множителю.",
    ability: {
      name: "Fade Bolt+", event: "FIGHT_SCORING",
      when: { type: "COMBO_DIFFERENT_FROM_LAST" },
      effects: [{ type: "ADD_MULT", value: 1 }],
    },
  },

  // --- Ogre Magi (str 4) ---
  {
    id: "ogre_sc", heroId: "ogre_magi", kind: "scepter", name: "Multicast+", cost: 10, emoji: "🔮",
    desc: "35% шанс: удар повторится и добавит +20% урона.",
    ability: {
      name: "Multicast+", event: "FIGHT_SCORING",
      effects: [{ type: "SET_ECHO_POWER", pct: 20, chance: 35 }],
    },
  },
  {
    id: "ogre_sh", heroId: "ogre_magi", kind: "shard", name: "Fireblast", cost: 3, emoji: "🔹",
    desc: "На боссах и мини-боссах Ogre +5 силы.",
    ability: {
      name: "Fireblast", event: "FIGHT_SCORING",
      when: { any: [{ type: "IS_BOSS_WAVE" }, { type: "IS_MINIBOSS_WAVE" }] },
      effects: [{ type: "ADD_POWER", value: 5 }],
    },
  },

  // --- Kunkka (str 12) ---
  {
    id: "kunkka_sc", heroId: "kunkka", kind: "scepter", name: "Torrent Combo", cost: 10, emoji: "🔮",
    desc: "Цепь прилива: +5 силы за каждый тип комбо за забег (максимум +15).",
    ability: {
      name: "Torrent Combo", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_PER_DISTINCT_COMBO", value: 5, cap: 15 }],
    },
  },
  {
    id: "kunkka_sh", heroId: "kunkka", kind: "shard", name: "Tidebringer", cost: 3, emoji: "🔹",
    desc: "Kunkka сильнейший в отряде: +6 силы.",
    ability: {
      name: "Tidebringer", event: "FIGHT_SCORING",
      when: { type: "IS_HIGHEST_RANK" },
      effects: [{ type: "ADD_POWER", value: 6 }],
    },
  },

  // --- Tusk (str 3) ---
  {
    id: "tusk_sc", heroId: "tusk", kind: "scepter", name: "Walrus Chain", cost: 10, emoji: "🔮",
    desc: "В бою сработал крит — цепь передаётся: Tusk +6 силы. Любой крит зажигает цепь.",
    ability: {
      name: "Walrus Chain", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_IF_CRIT", value: 6 }],
    },
  },
  {
    id: "tusk_sh", heroId: "tusk", kind: "shard", name: "Snowball+", cost: 3, emoji: "🔹",
    desc: "За волну была перестановка — Tusk +4 силы.",
    ability: {
      name: "Snowball+", event: "FIGHT_SCORING",
      when: { type: "MOVES_ABOVE", value: 0 },
      effects: [{ type: "ADD_POWER", value: 4 }],
    },
  },
];
