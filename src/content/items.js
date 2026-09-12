// dotora content — items.
// Rarity: common | rare | epic (weights and prices in BALANCE.md).
// Category: power (left axis) | mult (right axis) | rule (changes the rules) |
//           economy (gold engine).
const ITEMS_DATA = [
  // ---------- common ----------
  {
    id: "battle_fury", name: "Battle Fury", cost: 7, emoji: "🌀", rarity: "common", category: "power", slotClass: "off",
    desc: "Клеев: сила слабейшего героя отряда засчитывается в общий удар дважды.",
    ability: { name: "Cleave", event: "FIGHT_SCORING", effects: [{ type: "WEAKEST_POWER_DOUBLE" }] },
  },
  {
    id: "meteor_hammer", name: "Meteor Hammer", cost: 6, emoji: "☄️", rarity: "common", category: "power", slotClass: "util",
    desc: "Осада: в каждом бою башня получает ещё +50 урона прямо по HP, мимо брони. Если башня блокирует удар глифом, прибавка блокируется вместе с ним.",
    ability: { name: "Meteor", event: "FIGHT_SCORING", effects: [{ type: "TOWER_BURN", value: 50 }] },
  },
  {
    id: "orb_corrosion", name: "Orb of Corrosion", cost: 6, emoji: "🧪", rarity: "common", category: "power", slotClass: "util",
    desc: "+3 силы и −4 к броне башни.",
    ability: {
      name: "Corrode", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER", value: 3 }, { type: "ADD_ARMOR_PEN", value: 4 }],
    },
  },
  {
    id: "dragon_lance", name: "Dragon Lance", cost: 6, emoji: "🔱", rarity: "common", category: "power", slotClass: "off",
    desc: "Копьё тянется по строю: +3 силы за каждую пару героев, стоящих рядом. Из плотной пятёрки — +12, одиночке бесполезно.",
    ability: { name: "Lance", event: "FIGHT_SCORING", effects: [{ type: "ADD_POWER_PER_NEIGHBOR", value: 3 }] },
  },
  {
    id: "drum", name: "Drum of Endurance", cost: 7, emoji: "🥁", rarity: "common", category: "mult", slotClass: "util",
    desc: "+0.25 к множителю за каждого героя в отряде. Полная пятёрка — +1.25.",
    ability: { name: "War Drums", event: "FIGHT_SCORING", effects: [{ type: "ADD_MULT_PER_PLAYED", value: 0.25 }] },
  },
  {
    id: "midas", name: "Hand of Midas", cost: 7, emoji: "👑", rarity: "common", category: "economy", slotClass: "util",
    desc: "Золото за оверкилл удваивается.",
    ability: { name: "Transmute", event: "FIGHT_SCORING", effects: [{ type: "OVERKILL_RATE", value: 2 }] },
  },
  {
    id: "bkb", name: "Black King Bar", cost: 7, emoji: "🛡️", rarity: "common", category: "rule", slotClass: "def",
    rule: ["disarmMines", "ignoreDisarm"],
    desc: "Игнорирует правила башни: её броню, глиф, мины и проклятия. Не действует на боссах Рошана.",
    ability: { name: "Avatar", event: "FIGHT_SCORING", effects: [{ type: "IGNORE_TOWER_MODS" }] },
  },
  {
    id: "kaya", name: "Kaya and Sange", cost: 8, emoji: "💎", rarity: "common", category: "power", slotClass: "off",
    desc: "+10 силы и +1 к множителю.",
    ability: { name: "State", event: "FIGHT_SCORING", effects: [{ type: "ADD_POWER", value: 10 }, { type: "ADD_MULT", value: 1 }] },
  },
  {
    id: "vladmir", name: "Vladmir's Offering", cost: 8, emoji: "🩸", rarity: "common", category: "economy", slotClass: "util",
    desc: "+2 золота за каждый бой — даже проигранный.",
    ability: { name: "Vampiric Aura", event: "FIGHT_SCORING", effects: [{ type: "GOLD", value: 2 }] },
  },
  {
    id: "sentry", name: "Sentry Ward", cost: 6, emoji: "👁️", rarity: "common", category: "rule", slotClass: "def",
    rule: "disarmMines",
    desc: "Мины Techies делают карты руки неиграбельными. С этой вардой заминированные карты играют как обычно.",
  },

  // ---------- rare ----------
  {
    id: "daedalus", name: "Daedalus", cost: 9, emoji: "💥", rarity: "rare", category: "mult", slotClass: "off",
    desc: "25% шанс крита: ×2 к множителю.",
    ability: { name: "Crit", event: "FIGHT_SCORING", chance: 0.25, effects: [{ type: "MULT_MULT", value: 2 }] },
  },
  {
    id: "satanic", name: "Satanic", cost: 10, emoji: "😈", rarity: "rare", category: "mult", slotClass: "off",
    desc: "×1.5 к множителю, если собрана пара или две пары.",
    ability: {
      name: "Unholy Rage", event: "FIGHT_SCORING",
      when: { any: [{ type: "COMBO_IS", value: "pair" }, { type: "COMBO_IS", value: "two_pair" }] },
      effects: [{ type: "MULT_MULT", value: 1.5 }],
    },
  },
  {
    id: "shadow_blade", name: "Shadow Blade", cost: 9, emoji: "🌑", rarity: "rare", category: "rule", slotClass: "util",
    desc: "Самый сильный герой боя для сбора комбо может считаться на 1 сильнее или слабее — игра возьмёт выгодный вариант. Реальный урон не меняется.",
    ability: { name: "Shadow Walk", event: "PRE_DETECT", effects: [{ type: "BUMP_STRONGEST_RANK", value: 1 }] },
  },
  {
    id: "heart", name: "Heart of Tarrasque", cost: 11, emoji: "❤️", rarity: "rare", category: "power", slotClass: "def",
    desc: "+10 силы и ещё +5 за каждую потерянную казарму.",
    ability: {
      name: "Tarrasque", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER", value: 10 }, { type: "ADD_POWER_PER_LOST_BARRACKS", value: 5 }],
    },
  },
  {
    id: "ethereal_blade", name: "Ethereal Blade", cost: 10, emoji: "👻", rarity: "rare", category: "mult", slotClass: "off",
    desc: "×1.4 к множителю, если тип урона отряда — магический. Тип урона показан в формуле боя и задаётся собранной формацией.",
    ability: {
      name: "Ethereal", event: "FIGHT_SCORING",
      when: { type: "DAMAGE_TYPE_IS", value: "magical" },
      effects: [{ type: "MULT_MULT", value: 1.4 }],
    },
  },
  {
    id: "mkb", name: "Monkey King Bar", cost: 10, emoji: "🐒", rarity: "rare", category: "power", slotClass: "off",
    desc: "+10 силы и ×1.25 к множителю, если тип урона отряда — физический. Тип урона показан в формуле боя и задаётся собранной формацией.",
    ability: {
      name: "True Strike", event: "FIGHT_SCORING",
      when: { type: "DAMAGE_TYPE_IS", value: "physical" },
      effects: [{ type: "ADD_POWER", value: 10 }, { type: "MULT_MULT", value: 1.25 }],
    },
  },
  {
    id: "skadi", name: "Eye of Skadi", cost: 11, emoji: "🧊", rarity: "rare", category: "power", slotClass: "def",
    desc: "+6 силы. Ледяной шок: боссы больше не возрождаются — Aegis заблокирован.",
    ability: {
      name: "Cold Burn", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER", value: 6 }, { type: "DENY_REVIVE" }],
    },
  },
  {
    id: "desolator", name: "Desolator", cost: 9, emoji: "🗡️", rarity: "rare", category: "power", slotClass: "off",
    desc: "+6 силы и −10 к броне башни.",
    ability: {
      name: "Corruption", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_ARMOR_PEN", value: 10 }, { type: "ADD_POWER", value: 6 }],
    },
  },
  {
    id: "pipe", name: "Pipe of Insight", cost: 8, emoji: "📕", rarity: "rare", category: "rule", slotClass: "def",
    desc: "+1 к множителю, и твой удар игнорирует сопротивление магии башни. Ценно против башен с магическим сопротивлением (высокие ранги).",
    ability: {
      name: "Insight Barrier", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_MULT", value: 1 }, { type: "PIERCE_MR" }],
    },
  },
  {
    id: "ledger", name: "Trader's Ledger", cost: 6, emoji: "📒", rarity: "rare", category: "rule", slotClass: "util",
    rule: "freeUpgradeReroll",
    desc: "Живой ассортимент: первое обновление полки улучшений в каждой лавке — бесплатно.",
  },
  {
    id: "refresher", name: "Refresher Orb", cost: 10, emoji: "♻️", rarity: "rare", category: "mult", slotClass: "util",
    desc: "Способности героев срабатывают дважды за бой.",
    ability: { name: "Refresh", event: "FIGHT_SCORING", effects: [{ type: "REFRESH_HERO_TRIGGERS" }] },
  },
  {
    id: "bloodstone", name: "Bloodstone", cost: 10, emoji: "🔴", rarity: "rare", category: "mult", slotClass: "util",
    desc: "+0.5 к множителю за каждую потерянную казарму. Чем страшнее забег — тем злее камень.",
    ability: { name: "Blood Rite", event: "FIGHT_SCORING", effects: [{ type: "ADD_MULT_PER_LOST_BARRACKS", value: 0.5 }] },
  },
  {
    id: "butterfly", name: "Butterfly", cost: 8, emoji: "🦋", rarity: "rare", category: "rule", slotClass: "def",
    desc: "Слабейший герой для сбора комбо может считаться на 1 сильнее или слабее — игра возьмёт выгодный вариант (урон не меняется). Плюс 25% шанс игнорировать правило башни в первом бою волны.",
    ability: { name: "Evasion", event: "PRE_DETECT", effects: [{ type: "WILD_RANK" }] },
  },
  {
    id: "manta", name: "Manta Style", cost: 10, emoji: "✨", rarity: "rare", category: "rule", slotClass: "util",
    desc: "В бою добавляет к отряду иллюзию сильнейшего героя: для сбора комбо она равна ему (тот же атрибут и сила), в урон кладёт половину его силы. Способность иллюзии не срабатывает.",
    ability: { name: "Mirror Image", event: "PRE_DETECT", effects: [{ type: "CREATE_ILLUSION", powerRatio: 0.5 }] },
  },

  // ---------- epic ----------
  {
    id: "rapier", name: "Divine Rapier", cost: 12, emoji: "⚔️", rarity: "epic", category: "mult", slotClass: "off",
    desc: "×2 к итоговому урону. Проиграешь волну — рапира перейдёт башне, и твой урон по ней упадёт вдвое. Снесёшь — вернётся.",
    ability: { name: "Divine", event: "FIGHT_SCORING", effects: [{ type: "FINAL_MULT", value: 2 }] },
  },
  {
    id: "radiance", name: "Radiance", cost: 13, emoji: "🔆", rarity: "epic", category: "power", slotClass: "off",
    desc: "+3 силы за каждого героя в отряде. Полная пятёрка — +15.",
    ability: { name: "Immolate", event: "FIGHT_SCORING", effects: [{ type: "ADD_POWER_PER_PLAYED", value: 3 }] },
  },
  {
    id: "bloodthorn", name: "Bloodthorn", cost: 13, emoji: "🌹", rarity: "epic", category: "mult", slotClass: "off",
    desc: "Кровавая охота: 50% шанс на ×2.2 к множителю и +10 золота. Работает только на боссов и мини-боссов.",
    ability: {
      name: "Blood Hunt", event: "FIGHT_SCORING", chance: 0.5,
      when: { any: [{ type: "IS_BOSS_WAVE" }, { type: "IS_MINIBOSS_WAVE" }] },
      effects: [{ type: "MULT_MULT", value: 2.2 }, { type: "GOLD", value: 10 }],
    },
  },
  {
    id: "octarine", name: "Octarine Core", cost: 12, emoji: "🔮", rarity: "epic", category: "mult", slotClass: "util",
    desc: "+1 к множителю за каждый предмет в билде. Чем толще билд — тем сильнее ядро.",
    ability: { name: "Cooldown Reduction", event: "FIGHT_SCORING", effects: [{ type: "ADD_MULT_PER_ITEM", value: 1 }] },
  },
  {
    id: "tempest_double", name: "Tempest Double", cost: 12, emoji: "👥", rarity: "epic", category: "mult", slotClass: "util",
    desc: "Двойник: в первом бою каждой волны способности героев срабатывают дважды.",
    ability: {
      name: "Tempest Double", event: "FIGHT_SCORING",
      when: { type: "FIGHT_FIRST" },
      effects: [{ type: "REFRESH_HERO_TRIGGERS" }],
    },
  },
  {
    id: "misers_chest", name: "Miser's Chest", cost: 12, emoji: "💰", rarity: "epic", category: "economy", slotClass: "util",
    desc: "Скупость вознаграждается: +1 золото за каждый неиспользованный сброс волны (сбросы — общий запас на волну) — начисляется в каждом бою.",
    ability: { name: "Hoard", event: "FIGHT_SCORING", effects: [{ type: "ADD_GOLD_PER_UNUSED_DISCARD", value: 1 }] },
  },
  {
    id: "assault", name: "Assault Cuirass", cost: 12, emoji: "🛡️", rarity: "epic", category: "power", slotClass: "off",
    desc: "Осада: +5 силы за каждого героя в отряде. Полная пятёрка — +25.",
    ability: { name: "Assault", event: "FIGHT_SCORING", effects: [{ type: "ADD_POWER_PER_PLAYED", value: 5 }] },
  },
  {
    id: "blink", name: "Blink Dagger", cost: 8, emoji: "💫", rarity: "rare", category: "power", slotClass: "util",
    desc: "Прыжок в прорыв: +12 силы в каждом бою.",
    ability: { name: "Blink", event: "FIGHT_SCORING", effects: [{ type: "ADD_POWER", value: 12 }] },
  },

  // ---------- rare: лига III+ (ранг-гейт: свежий пул для лейта) ----------
  // RoR2 «Crowbar»: бонус по полной цели.
  {
    id: "siege_ram", name: "Таран", cost: 9, emoji: "🐏", rarity: "rare", category: "power", slotClass: "off", minRank: 3,
    desc: "+12 силы, пока у башни больше 70% HP. Начало боя — его час.",
    ability: {
      name: "Ram", event: "FIGHT_SCORING",
      when: { type: "TOWER_HP_ABOVE", pct: 70 },
      effects: [{ type: "ADD_POWER", value: 12 }],
    },
  },
  // RoR2 «57 Leaf Clover» + связка с удачей: ласт-хиты кормят удачу.
  {
    id: "rabbit_foot", name: "Заячья лапка", cost: 8, emoji: "🐇", rarity: "rare", category: "rule", slotClass: "util", minRank: 4,
    desc: "Добьёшь башню ровно в ноль — +1 удачи до конца забега (максимум +3). Удача делает редкие и эпические товары в лавках чуть чаще.",
    ability: { name: "Lucky Foot", event: "FIGHT_SCORING", effects: [{ type: "ADD_LUCK_ON_LAST_HIT", cap: 3 }] },
  },
  // Balatro «Ramen»/StS «Ink Bottle»: плата сбросами → множитель.
  {
    id: "witch_cauldron", name: "Котелок ведьмы", cost: 10, emoji: "🍲", rarity: "rare", category: "mult", slotClass: "util", minRank: 3,
    desc: "+0.25 к множителю за каждый потраченный сброс волны (сбросы — общий запас на волну). Три потраченных — +0.75.",
    ability: { name: "Brew", event: "FIGHT_SCORING", effects: [{ type: "ADD_MULT_PER_USED_DISCARD", value: 0.25 }] },
  },
  // Hearthstone «Bloodmage Thalnos»: трупы в сбросе — сила.
  {
    id: "bone_urn", name: "Костяная урна", cost: 9, emoji: "⚱️", rarity: "rare", category: "power", slotClass: "util", minRank: 3,
    desc: "+2 силы за каждого героя в сбросе — туда попадают отыгранные и сброшенные (до +10).",
    ability: { name: "Bone Harvest", event: "FIGHT_SCORING", effects: [{ type: "ADD_POWER_PER_DISCARD", value: 2, cap: 5 }] },
  },
  // StS «Kunai/Shuriken»: перестановки строя точат клинок.
  {
    id: "whetstone", name: "Точильный камень", cost: 8, emoji: "🪨", rarity: "rare", category: "power", slotClass: "off", minRank: 3,
    desc: "Каждая перестановка героев в строю (перетаскивание) за волну: +2 силы, до +6. Таскай строй — камень точит.",
    ability: { name: "Whet", event: "FIGHT_SCORING", effects: [{ type: "ADD_POWER_PER_FORMATION_MOVE", value: 2, cap: 6 }] },
  },
  // Dota «Tome of Knowledge»: зачистка = опыт.
  {
    id: "tome_of_knowledge", name: "Том знаний", cost: 8, emoji: "📗", rarity: "rare", category: "economy", slotClass: "util", minRank: 3,
    desc: "Герои боя получают +1 опыт за каждую зачистку волны. Каждые 5 опыта — уровень героя: +1 к его силе (до +3).",
    ability: { name: "Study", event: "FIGHT_SCORING", effects: [{ type: "GRANT_XP_ON_CLEAR", value: 1 }] },
  },
  // StS «Cursed Key» без проклятья: ядро рероллов — сила.
  {
    id: "dynamo_coil", name: "Динамо-катушка", cost: 8, emoji: "🔋", rarity: "rare", category: "power", slotClass: "util", minRank: 4,
    desc: "Каждое обновление лавки копит заряд (до 3). В бою: +3 силы за каждый накопленный заряд, после боя заряды тратятся. Обновил лавку — бей сильнее.",
    ability: {
      name: "Overcharge", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_PER_REROLL_CHARGE", value: 3 }, { type: "CONSUME_REROLL_CHARGES", amount: 99 }],
    },
  },
  // StS «Tungsten Rod»-семья экономии: награда за дисциплину сбросов.
  {
    id: "customs_seal", name: "Таможенная печать", cost: 8, emoji: "🧾", rarity: "rare", category: "economy", slotClass: "util", minRank: 3,
    desc: "+5 золота за бой, если за волну не потратил ни одного сброса (сбросы — общий запас на волну).",
    ability: {
      name: "Sealed Purse", event: "FIGHT_SCORING",
      when: { type: "DISCARDS_UNUSED" },
      effects: [{ type: "GOLD", value: 5 }],
    },
  },
  // RoR2 «Warbanner»: темп первой атаки.
  {
    id: "war_horn", name: "Штурмовой рог", cost: 8, emoji: "📢", rarity: "rare", category: "power", slotClass: "off", minRank: 3,
    desc: "В первом бою волны +15 силы.",
    ability: {
      name: "Charge!", event: "FIGHT_SCORING",
      when: { type: "FIGHT_FIRST" },
      effects: [{ type: "ADD_POWER", value: 15 }],
    },
  },
  // Контра проклятию «Адаптация мира»: повтор комбо — твой козырь.
  {
    id: "phylactery", name: "Филактерия", cost: 10, emoji: "📿", rarity: "rare", category: "mult", slotClass: "util", minRank: 4,
    desc: "Повторяешь комбо прошлого боя — +0.6 к множителю. Работает и сквозь правила башен, наказывающие за повторы.",
    ability: {
      name: "Ritual", event: "FIGHT_SCORING",
      when: { type: "COMBO_SAME_AS_LAST" },
      effects: [{ type: "ADD_MULT", value: 0.6 }],
    },
  },
  // Attribute-stick (семья Balatro «Fibonacci»): Ловкость платит.
  {
    id: "moon_shard", name: "Осколок луны", cost: 10, emoji: "🌙", rarity: "rare", category: "power", slotClass: "off", minRank: 4,
    desc: "+3 силы за каждого героя-ловкача в бою.",
    ability: { name: "Moonlight", event: "FIGHT_SCORING", effects: [{ type: "ADD_POWER_PER_ATTRIBUTE", attr: "agi", value: 3 }] },
  },
  // Balatro «Half Joker»: малый отряд — жирный множитель.
  {
    id: "duelist_blade", name: "Клинок дуэлянта", cost: 10, emoji: "🗡️", rarity: "rare", category: "mult", slotClass: "off", minRank: 3,
    desc: "Идёшь в бой вдвоём или одним — ×1.3 к множителю.",
    ability: {
      name: "Duel", event: "FIGHT_SCORING",
      when: { type: "PLAYED_COUNT_BELOW", value: 3 },
      effects: [{ type: "MULT_MULT", value: 1.3 }],
    },
  },

  // ---------- epic: лига IV+ (ранг-гейт) ----------
  // Balatro «Supernova/Satellite» + Zeus-симиртет: разнообразие комбо множится.
  {
    id: "astrolabe", name: "Астролябия", cost: 12, emoji: "🔭", rarity: "epic", category: "mult", slotClass: "util", minRank: 4,
    desc: "+0.25 к множителю за каждый новый тип комбо за забег (до +1.5). Вариативность — валюта.",
    ability: { name: "Star Chart", event: "FIGHT_SCORING", effects: [{ type: "ADD_MULT_PER_DISTINCT_COMBO", value: 0.25, cap: 6 }] },
  },
  // Осадный инструмент: каждая зачистка ослабляет следующую башню.
  {
    id: "seismic_charge", name: "Сейсмический заряд", cost: 12, emoji: "🧨", rarity: "epic", category: "rule", slotClass: "util", minRank: 4,
    desc: "После каждой зачистки следующая башня встречает тебя с −20% HP (эффект не складывается).",
    ability: { name: "Aftershock", event: "FIGHT_SCORING", effects: [{ type: "SET_NEXT_WAVE_PCT", value: 20 }] },
  },
  // Balatro «Mime»-билдараунд: соло-рейд.
  {
    id: "solo_crest", name: "Герб одиночки", cost: 12, emoji: "🎖️", rarity: "epic", category: "mult", slotClass: "off", minRank: 5,
    desc: "Идёшь в бой ровно одним героем — его способность срабатывает дважды.",
    ability: {
      name: "Lone Wolf", event: "FIGHT_SCORING",
      when: { type: "PLAYED_COUNT_IS", value: 1 },
      effects: [{ type: "REFRESH_HERO_TRIGGERS" }],
    },
  },
  // Comeback-эпик (Hades-keepake/Dio-семья): плата за боль — сила.
  {
    id: "phoenix_feather", name: "Перо Феникса", cost: 12, emoji: "🪶", rarity: "epic", category: "mult", slotClass: "def", minRank: 4,
    desc: "Провалил волну (потерял казарму) — все бои до следующей зачистки бьют ×1.35. Падение — только разгон.",
    ability: {
      name: "Rebirth", event: "FIGHT_SCORING",
      when: { type: "AFTER_FAILURE" },
      effects: [{ type: "MULT_MULT", value: 1.35 }],
    },
  },
  // XP-система как ось билда.
  {
    id: "mentors_crown", name: "Корона наставника", cost: 12, emoji: "👑", rarity: "epic", category: "power", slotClass: "util", minRank: 5,
    desc: "+5 силы за каждого героя с уровнем опыта в бою (уровень растёт от боёв и тренировки героя за золото).",
    ability: { name: "Mentorship", event: "FIGHT_SCORING", effects: [{ type: "ADD_POWER_PER_LEVELED_HERO", value: 5 }] },
  },
  // Антитанк-эпик против поздних защит башен.
  {
    id: "armor_splitter", name: "Расщепитель брони", cost: 12, emoji: "🪓", rarity: "epic", category: "power", slotClass: "off", minRank: 6,
    desc: "−12 к броне башни, и твой удар игнорирует её сопротивление магии. Броня — не приговор.",
    ability: {
      name: "Split", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_ARMOR_PEN", value: 12 }, { type: "PIERCE_MR" }],
    },
  },
  // Награда за чистоту тактики: не повторяйся.
  {
    id: "chameleon_prism", name: "Призма хамелеона", cost: 12, emoji: "🦎", rarity: "epic", category: "mult", slotClass: "util", minRank: 4,
    desc: "Комбо отличается от прошлого боя — +0.8 к множителю. Импровизируй.",
    ability: {
      name: "Mimicry", event: "FIGHT_SCORING",
      when: { type: "COMBO_DIFFERENT_FROM_LAST" },
      effects: [{ type: "ADD_MULT", value: 0.8 }],
    },
  },
  // Экономический эпик: оверкил и ласт-хиты превращаются в доход.
  {
    id: "butchers_charm", name: "Талисман мясника", cost: 13, emoji: "🔪", rarity: "epic", category: "economy", slotClass: "util", minRank: 4,
    desc: "Золото с оверкилла ×3, точный ласт-хит приносит +3 золота.",
    ability: {
      name: "Cleave Gold", event: "FIGHT_SCORING",
      effects: [{ type: "OVERKILL_RATE", value: 3 }, { type: "LAST_HIT_GOLD", value: 3 }],
    },
  },

  // ---------- Fun-билды (docs/PROPOSALS_FUN_BUILDS.md §0.2) ----------
  {
    id: "baron_scepter", name: "Скипетр Барона", cost: 13, emoji: "👑", rarity: "epic", category: "mult", slotClass: "off", minRank: 4,
    desc: "Барон: за каждого героя ранга 12, оставшегося в руке во время боя, — ×1.35 к множителю (максимум ×2.7).",
    ability: { name: "Baron", event: "ON_HELD", effects: [{ type: "MULT_PER_HELD_RANK", rank: 12, value: 1.35, cap: 2.7 }] },
  },
  {
    id: "ripe_banana", name: "Спелый банан", cost: 12, emoji: "🍌", rarity: "epic", category: "mult", slotClass: "off",
    desc: "×3 к множителю. После каждой зачистки волны 30% шанс, что банан сгниёт и исчезнет навсегда.",
    ability: { name: "Potassium", event: "FIGHT_SCORING", effects: [{ type: "MULT_MULT", value: 3 }] },
    react: [{ event: "WAVE_CLEARED", effects: [{ type: "DESTROY_SELF_CHANCE", chance: 0.3 }] }],
  },
  {
    id: "three_stars", name: "Три звезды", cost: 12, emoji: "⭐", rarity: "epic", category: "power", slotClass: "off", minRank: 4,
    desc: "Star Up: 3+ героя одного ранга в отряде — каждый из группы получает +50% своей силы.",
    ability: {
      name: "Star Up", event: "FIGHT_SCORING",
      when: { type: "SAME_RANK_GROUP", size: 3 },
      effects: [{ type: "BUFF_RANK_GROUP", size: 3, pct: 50 }],
    },
  },
  {
    id: "heresy", name: "Еретик", cost: 13, emoji: "📜", rarity: "epic", category: "rule", slotClass: "util", minRank: 4,
    rule: "heresy",
    desc: "Правило переписано: Фаланга собирается от 3 героев одного атрибута, Треугольник — от 2 разных атрибутов.",
  },
  {
    id: "polaroid", name: "Полароид", cost: 9, emoji: "🖼️", rarity: "rare", category: "mult", slotClass: "off", minRank: 3,
    desc: "Snapshot: если первый герой строя имеет ранг 10+ — ×2 к множителю. Кого показать первым — решает бой.",
    ability: {
      name: "Snapshot", event: "FIGHT_SCORING",
      when: { type: "FIRST_CARD_RANK_ABOVE", value: 10 },
      effects: [{ type: "MULT_MULT", value: 2 }],
    },
  },
  {
    id: "demon_form", name: "Демоническая форма", cost: 12, emoji: "😈", rarity: "epic", category: "power", slotClass: "off", minRank: 4,
    desc: "Демон: каждый бой волны даёт следующему бою этой волны +4 силы (бои 2/3/4: +4/+8/+12).",
    ability: { name: "Demon", event: "FIGHT_SCORING", effects: [{ type: "WAVE_RAMP_POWER", value: 4 }] },
  },
  {
    id: "one_armed_bandit", name: "Однорукий бандит", cost: 10, emoji: "🎰", rarity: "rare", category: "rule", slotClass: "util", minRank: 3,
    desc: "30% шанс на джекпот: весь отряд считается рангом 7 для сбора комбо. Барабаны крутятся каждый бой.",
    ability: { name: "Jackpot", event: "PRE_DETECT", chance: 0.3, effects: [{ type: "SET_ALL_RANKS", value: 7 }] },
  },
  {
    id: "mantra", name: "Мантра", cost: 12, emoji: "🧘", rarity: "epic", category: "mult", slotClass: "util", minRank: 4,
    desc: "Divinity: 3 боя подряд одной и той же формации — следующий бой бьёт ×1.75.",
    ability: {
      name: "Divinity", event: "FIGHT_SCORING",
      when: { type: "FORMATION_STREAK_ABOVE", value: 2 },
      effects: [{ type: "MULT_MULT", value: 1.75 }],
    },
  },
  {
    id: "small_blades", name: "Мелкие клинки", cost: 9, emoji: "🔪", rarity: "rare", category: "power", slotClass: "off", minRank: 3,
    desc: "Шивы: +5 силы за каждого героя отряда рангом 4 и ниже. Мелочь тоже колет.",
    ability: { name: "Shivs", event: "FIGHT_SCORING", effects: [{ type: "ADD_POWER_PER_WEAK_RANK", value: 5 }] },
  },
  {
    id: "siege_axe", name: "Осадный колун", cost: 12, emoji: "🪓", rarity: "epic", category: "power", slotClass: "off", minRank: 5,
    desc: "Reverse Siege: броня башни не вычитается из удара, а прибавляется к нему. Против бронированных башен — годзилла.",
    ability: { name: "Reverse Siege", event: "FIGHT_SCORING", effects: [{ type: "ARMOR_FEED" }] },
  },
  {
    id: "rat_mandate", name: "Крысиный ультиматум", cost: 14, emoji: "🐀", rarity: "epic", category: "rule", slotClass: "util", minRank: 5,
    desc: "Split Push: бьёшь 1–2 героями — башня теряет ещё 8% своего maxHp (не больше 600). Победа без боя.",
    ability: {
      name: "Split Push", event: "FIGHT_SCORING",
      when: { type: "PLAYED_COUNT_BELOW", value: 3 },
      effects: [{ type: "TOWER_PCT_BURN", pct: 8, capFlat: 600 }],
    },
  },
  {
    id: "venom_funnel", name: "Воронка яда", cost: 10, emoji: "🧪", rarity: "rare", category: "power", slotClass: "util", minRank: 3,
    desc: "Осадный урон (яд, метеор) больше не тратится за бой — копится до конца волны. Яд не смывается.",
    ability: { name: "Funnel", event: "FIGHT_SCORING", effects: [{ type: "PERSISTENT_BURN" }] },
  },
];
