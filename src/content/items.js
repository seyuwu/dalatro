// dotora content — items.
// Rarity: common | rare | epic (weights and prices in BALANCE.md).
// Category: power (left axis) | mult (right axis) | rule (changes the rules) |
//           economy (gold engine).
const ITEMS_DATA = [
  // ---------- common ----------
  {
    id: "battle_fury", name: "Battle Fury", cost: 7, emoji: "🌀", rarity: "common", category: "power", slotClass: "off",
    desc: "Cleave: сила самой слабой сыгранной карты учитывается дважды.",
    ability: { name: "Cleave", event: "FIGHT_SCORING", effects: [{ type: "WEAKEST_POWER_DOUBLE" }] },
  },
  {
    id: "meteor_hammer", name: "Meteor Hammer", cost: 6, emoji: "☄️", rarity: "common", category: "power", slotClass: "util",
    desc: "Осада: башня получает +50 чистого урона сверх удара (глиф блокирует всё).",
    ability: { name: "Meteor", event: "FIGHT_SCORING", effects: [{ type: "TOWER_BURN", value: 50 }] },
  },
  {
    id: "orb_corrosion", name: "Orb of Corrosion", cost: 6, emoji: "🧪", rarity: "common", category: "power", slotClass: "util",
    desc: "+3 силы; −4 к броне башни (в формациях).",
    ability: {
      name: "Corrode", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER", value: 3 }, { type: "ADD_ARMOR_PEN", value: 4 }],
    },
  },
  {
    id: "dragon_lance", name: "Dragon Lance", cost: 6, emoji: "🔱", rarity: "common", category: "power", slotClass: "off",
    desc: "Копьё длины: +3 силы за каждого соседа по слоту.",
    ability: { name: "Lance", event: "FIGHT_SCORING", effects: [{ type: "ADD_POWER_PER_NEIGHBOR", value: 3 }] },
  },
  {
    id: "drum", name: "Drum of Endurance", cost: 7, emoji: "🥁", rarity: "common", category: "mult", slotClass: "util",
    desc: "+0.25 к множителю за каждого сыгранного героя (пятёрка = +1.25).",
    ability: { name: "War Drums", event: "FIGHT_SCORING", effects: [{ type: "ADD_MULT_PER_PLAYED", value: 0.25 }] },
  },
  {
    id: "midas", name: "Hand of Midas", cost: 7, emoji: "👑", rarity: "common", category: "economy", slotClass: "util",
    desc: "Золото с оверкилла ×2.",
    ability: { name: "Transmute", event: "FIGHT_SCORING", effects: [{ type: "OVERKILL_RATE", value: 2 }] },
  },
  {
    id: "bkb", name: "Black King Bar", cost: 7, emoji: "🛡️", rarity: "common", category: "rule", slotClass: "def",
    rule: ["disarmMines", "ignoreDisarm"],
    desc: "Игнорирует модификаторы башен (Armor, Glyph, мины Techies). На Рошана не действует.",
    ability: { name: "Avatar", event: "FIGHT_SCORING", effects: [{ type: "IGNORE_TOWER_MODS" }] },
  },
  {
    id: "kaya", name: "Kaya and Sange", cost: 8, emoji: "💎", rarity: "common", category: "power", slotClass: "off",
    desc: "+10 силы и +1 к множителю.",
    ability: { name: "State", event: "FIGHT_SCORING", effects: [{ type: "ADD_POWER", value: 10 }, { type: "ADD_MULT", value: 1 }] },
  },
  {
    id: "vladmir", name: "Vladmir's Offering", cost: 8, emoji: "🩸", rarity: "common", category: "economy", slotClass: "util",
    desc: "+2 золота за каждый бой, даже проигранный.",
    ability: { name: "Vampiric Aura", event: "FIGHT_SCORING", effects: [{ type: "GOLD", value: 2 }] },
  },
  {
    id: "sentry", name: "Sentry Ward", cost: 6, emoji: "👁️", rarity: "common", category: "rule", slotClass: "def",
    rule: "disarmMines",
    desc: "Обезвреживает мины Techies: заминированные карты можно разыгрывать.",
  },

  // ---------- rare ----------
  {
    id: "daedalus", name: "Daedalus", cost: 9, emoji: "💥", rarity: "rare", category: "mult", slotClass: "off",
    desc: "25% шанс крита: ×2 к множителю.",
    ability: { name: "Crit", event: "FIGHT_SCORING", chance: 0.25, effects: [{ type: "MULT_MULT", value: 2 }] },
  },
  {
    id: "satanic", name: "Satanic", cost: 10, emoji: "😈", rarity: "rare", category: "mult", slotClass: "off",
    desc: "×1.5 к множителю, если комбо — пара или две пары.",
    ability: {
      name: "Unholy Rage", event: "FIGHT_SCORING",
      when: { any: [{ type: "COMBO_IS", value: "pair" }, { type: "COMBO_IS", value: "two_pair" }] },
      effects: [{ type: "MULT_MULT", value: 1.5 }],
    },
  },
  {
    id: "shadow_blade", name: "Shadow Blade", cost: 9, emoji: "🌑", rarity: "rare", category: "rule", slotClass: "util",
    desc: "Самая сильная сыгранная карта может считаться соседним рангом (±1, игра выберет лучшее; сила не растёт).",
    ability: { name: "Shadow Walk", event: "PRE_DETECT", effects: [{ type: "BUMP_STRONGEST_RANK", value: 1 }] },
  },
  {
    id: "heart", name: "Heart of Tarrasque", cost: 11, emoji: "❤️", rarity: "rare", category: "power", slotClass: "def",
    desc: "+10 силы и +5 за каждую разрушенную казарму — чем страшнее забег, тем толще.",
    ability: {
      name: "Tarrasque", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER", value: 10 }, { type: "ADD_POWER_PER_LOST_BARRACKS", value: 5 }],
    },
  },
  {
    id: "ethereal_blade", name: "Ethereal Blade", cost: 10, emoji: "👻", rarity: "rare", category: "mult", slotClass: "off",
    desc: "Магический урон (формации) или комбо «Стрит»/«Флеш»/«Фулл» (классика): ×1.4 множителя.",
    ability: {
      name: "Ethereal", event: "FIGHT_SCORING",
      when: { type: "DAMAGE_TYPE_IS", value: "magical" },
      effects: [{ type: "MULT_MULT", value: 1.4 }],
    },
  },
  {
    id: "mkb", name: "Monkey King Bar", cost: 10, emoji: "🐒", rarity: "rare", category: "power", slotClass: "off",
    desc: "Физический урон (формации) или малые комбо (классика): +10 силы и ×1.25.",
    ability: {
      name: "True Strike", event: "FIGHT_SCORING",
      when: { type: "DAMAGE_TYPE_IS", value: "physical" },
      effects: [{ type: "ADD_POWER", value: 10 }, { type: "MULT_MULT", value: 1.25 }],
    },
  },
  {
    id: "skadi", name: "Eye of Skadi", cost: 11, emoji: "🧊", rarity: "rare", category: "power", slotClass: "def",
    desc: "+6 силы. Ледяной шок: боссы больше не возрождаются (Aegis заблокирован).",
    ability: {
      name: "Cold Burn", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER", value: 6 }, { type: "DENY_REVIVE" }],
    },
  },
  {
    id: "desolator", name: "Desolator", cost: 9, emoji: "🗡️", rarity: "rare", category: "power", slotClass: "off",
    desc: "Коррозия: −10 к броне башни (в формациях). +6 силы в любом режиме.",
    ability: {
      name: "Corruption", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_ARMOR_PEN", value: 10 }, { type: "ADD_POWER", value: 6 }],
    },
  },
  {
    id: "pipe", name: "Pipe of Insight", cost: 8, emoji: "📕", rarity: "rare", category: "rule", slotClass: "def",
    desc: "Барьер: +1 к множителю. В формациях магический урон игнорирует сопротивление башни.",
    ability: {
      name: "Insight Barrier", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_MULT", value: 1 }, { type: "PIERCE_MR" }],
    },
  },
  {
    id: "ledger", name: "Trader's Ledger", cost: 6, emoji: "📒", rarity: "rare", category: "rule", slotClass: "util",
    rule: "freeUpgradeReroll",
    desc: "Живой ассортимент: первый реролл улучшений в каждой лавке бесплатный.",
  },
  {
    id: "refresher", name: "Refresher Orb", cost: 10, emoji: "♻️", rarity: "rare", category: "mult", slotClass: "util",
    desc: "Способности героев срабатывают дважды за бой.",
    ability: { name: "Refresh", event: "FIGHT_SCORING", effects: [{ type: "REFRESH_HERO_TRIGGERS" }] },
  },
  {
    id: "bloodstone", name: "Bloodstone", cost: 10, emoji: "🔴", rarity: "rare", category: "mult", slotClass: "util",
    desc: "+0.5 к множителю за каждую разрушенную казарму. Чем страшнее забег — тем злее камень.",
    ability: { name: "Blood Rite", event: "FIGHT_SCORING", effects: [{ type: "ADD_MULT_PER_LOST_BARRACKS", value: 0.5 }] },
  },
  {
    id: "butterfly", name: "Butterfly", cost: 8, emoji: "🦋", rarity: "rare", category: "rule", slotClass: "def",
    desc: "Самая слабая сыгранная карта может считаться соседним рангом (только для комбо). 25% шанс уклонить модификатор башни.",
    ability: { name: "Evasion", event: "PRE_DETECT", effects: [{ type: "WILD_RANK" }] },
  },
  {
    id: "manta", name: "Manta Style", cost: 10, emoji: "✨", rarity: "rare", category: "rule", slotClass: "util",
    desc: "Иллюзия сильнейшего сыгранного героя: тот же ранг и атрибут, но 50% силы. Считается для комбо и силы, абилки не активирует.",
    ability: { name: "Mirror Image", event: "PRE_DETECT", effects: [{ type: "CREATE_ILLUSION", powerRatio: 0.5 }] },
  },

  // ---------- epic ----------
  {
    id: "rapier", name: "Divine Rapier", cost: 12, emoji: "⚔️", rarity: "epic", category: "mult", slotClass: "off",
    desc: "×2 к итоговому урону. Провалишь волну — рапиру заберёт враг: твой урон по нему ×0.5, пока он её держит. Убей — вернётся.",
    ability: { name: "Divine", event: "FIGHT_SCORING", effects: [{ type: "FINAL_MULT", value: 2 }] },
  },
  {
    id: "radiance", name: "Radiance", cost: 13, emoji: "🔆", rarity: "epic", category: "power", slotClass: "off",
    desc: "+3 силы за каждого сыгранного героя. Полная пятёрка = +15.",
    ability: { name: "Immolate", event: "FIGHT_SCORING", effects: [{ type: "ADD_POWER_PER_PLAYED", value: 3 }] },
  },
  {
    id: "bloodthorn", name: "Bloodthorn", cost: 13, emoji: "🌹", rarity: "epic", category: "mult", slotClass: "off",
    desc: "Кровавая охота: 50%: ×2.2 к множителю и +10 золота. Охотится только на крупную дичь — боссы и мини-боссы.",
    ability: {
      name: "Blood Hunt", event: "FIGHT_SCORING", chance: 0.5,
      when: { any: [{ type: "IS_BOSS_WAVE" }, { type: "IS_MINIBOSS_WAVE" }] },
      effects: [{ type: "MULT_MULT", value: 2.2 }, { type: "GOLD", value: 10 }],
    },
  },
  {
    id: "octarine", name: "Octarine Core", cost: 12, emoji: "🔮", rarity: "epic", category: "mult", slotClass: "util",
    desc: "+1 к множителю за каждый твой предмет. Чем жирнее билд — тем сильнее ядро.",
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
    desc: "Скупость вознаграждается: каждый бой приносит +1 золото за каждый неиспользованный ТП-сброс волны.",
    ability: { name: "Hoard", event: "FIGHT_SCORING", effects: [{ type: "ADD_GOLD_PER_UNUSED_DISCARD", value: 1 }] },
  },
  {
    id: "assault", name: "Assault Cuirass", cost: 12, emoji: "🛡️", rarity: "epic", category: "power", slotClass: "off",
    desc: "Осада: +5 силы за каждого героя в строю (пятёрка = +25).",
    ability: { name: "Assault", event: "FIGHT_SCORING", effects: [{ type: "ADD_POWER_PER_PLAYED", value: 5 }] },
  },
  {
    id: "blink", name: "Blink Dagger", cost: 8, emoji: "💫", rarity: "rare", category: "power", slotClass: "util",
    desc: "Прыжок в прорыв: +12 силы в каждом бою.",
    ability: { name: "Blink", event: "FIGHT_SCORING", effects: [{ type: "ADD_POWER", value: 12 }] },
  },
];
