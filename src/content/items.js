// Dalatro content — items.
// Rarity: common | rare | epic (weights and prices in BALANCE.md).
// Category: power (left axis) | mult (right axis) | rule (changes the rules) |
//           economy (gold engine).
const ITEMS_DATA = [
  // ---------- common ----------
  {
    id: "battle_fury", name: "Battle Fury", cost: 7, emoji: "🌀", rarity: "common", category: "power",
    desc: "Cleave: сила самой слабой сыгранной карты учитывается дважды.",
    ability: { name: "Cleave", event: "FIGHT_SCORING", effects: [{ type: "WEAKEST_POWER_DOUBLE" }] },
  },
  {
    id: "meteor_hammer", name: "Meteor Hammer", cost: 6, emoji: "☄️", rarity: "common", category: "power",
    desc: "+8 силы, если сыграно 3+ героев.",
    ability: { name: "Meteor", event: "FIGHT_SCORING", when: { type: "PLAYED_COUNT_ABOVE", value: 2 }, effects: [{ type: "ADD_POWER", value: 8 }] },
  },
  {
    id: "drum", name: "Drum of Endurance", cost: 7, emoji: "🥁", rarity: "common", category: "mult",
    desc: "+2 к множителю, если сыграно 4+ героев.",
    ability: { name: "War Drums", event: "FIGHT_SCORING", when: { type: "PLAYED_COUNT_ABOVE", value: 3 }, effects: [{ type: "ADD_MULT", value: 2 }] },
  },
  {
    id: "midas", name: "Hand of Midas", cost: 7, emoji: "👑", rarity: "common", category: "economy",
    desc: "Золото с оверкилла ×2.",
    ability: { name: "Transmute", event: "FIGHT_SCORING", effects: [{ type: "OVERKILL_RATE", value: 2 }] },
  },
  {
    id: "bkb", name: "Black King Bar", cost: 7, emoji: "🛡️", rarity: "common", category: "rule",
    desc: "Игнорирует модификаторы башен (Armor, Glyph, мины Techies). На Рошана не действует.",
    ability: { name: "Avatar", event: "FIGHT_SCORING", effects: [{ type: "IGNORE_TOWER_MODS" }] },
  },
  {
    id: "kaya", name: "Kaya and Sange", cost: 8, emoji: "💎", rarity: "common", category: "power",
    desc: "+10 силы и +1 к множителю.",
    ability: { name: "State", event: "FIGHT_SCORING", effects: [{ type: "ADD_POWER", value: 10 }, { type: "ADD_MULT", value: 1 }] },
  },
  {
    id: "vladmir", name: "Vladmir's Offering", cost: 8, emoji: "🩸", rarity: "common", category: "economy",
    desc: "+2 золота за каждый бой, даже проигранный.",
    ability: { name: "Vampiric Aura", event: "FIGHT_SCORING", effects: [{ type: "GOLD", value: 2 }] },
  },
  {
    id: "sentry", name: "Sentry Ward", cost: 6, emoji: "👁️", rarity: "common", category: "rule",
    desc: "Обезвреживает мины Techies: заминированные карты можно разыгрывать.",
  },

  // ---------- rare ----------
  {
    id: "daedalus", name: "Daedalus", cost: 9, emoji: "💥", rarity: "rare", category: "mult",
    desc: "25% шанс крита: ×2 к множителю.",
    ability: { name: "Crit", event: "FIGHT_SCORING", chance: 0.25, effects: [{ type: "MULT_MULT", value: 2 }] },
  },
  {
    id: "satanic", name: "Satanic", cost: 10, emoji: "😈", rarity: "rare", category: "mult",
    desc: "×1.5 к множителю, если комбо — пара или две пары.",
    ability: {
      name: "Unholy Rage", event: "FIGHT_SCORING",
      when: { any: [{ type: "COMBO_IS", value: "pair" }, { type: "COMBO_IS", value: "two_pair" }] },
      effects: [{ type: "MULT_MULT", value: 1.5 }],
    },
  },
  {
    id: "shadow_blade", name: "Shadow Blade", cost: 9, emoji: "🌑", rarity: "rare", category: "rule",
    desc: "Самая сильная сыгранная карта может считаться соседним рангом (±1, игра выберет лучшее; сила не растёт).",
    ability: { name: "Shadow Walk", event: "PRE_DETECT", effects: [{ type: "BUMP_STRONGEST_RANK", value: 1 }] },
  },
  {
    id: "heart", name: "Heart of Tarrasque", cost: 11, emoji: "❤️", rarity: "rare", category: "power",
    desc: "+25 силы.",
    ability: { name: "Tarrasque", event: "FIGHT_SCORING", effects: [{ type: "ADD_POWER", value: 25 }] },
  },
  {
    id: "refresher", name: "Refresher Orb", cost: 10, emoji: "♻️", rarity: "rare", category: "mult",
    desc: "Способности героев срабатывают дважды за бой.",
    ability: { name: "Refresh", event: "FIGHT_SCORING", effects: [{ type: "REFRESH_HERO_TRIGGERS" }] },
  },
  {
    id: "bloodstone", name: "Bloodstone", cost: 10, emoji: "🔴", rarity: "rare", category: "mult",
    desc: "+0.5 к множителю за каждую разрушенную казарму. Чем страшнее забег — тем злее камень.",
    ability: { name: "Blood Rite", event: "FIGHT_SCORING", effects: [{ type: "ADD_MULT_PER_LOST_BARRACKS", value: 0.5 }] },
  },
  {
    id: "butterfly", name: "Butterfly", cost: 8, emoji: "🦋", rarity: "rare", category: "rule",
    desc: "Самая слабая сыгранная карта может считаться соседним рангом (только для комбо). 25% шанс уклонить модификатор башни.",
    ability: { name: "Evasion", event: "PRE_DETECT", effects: [{ type: "WILD_RANK" }] },
  },
  {
    id: "manta", name: "Manta Style", cost: 10, emoji: "✨", rarity: "rare", category: "rule",
    desc: "Иллюзия сильнейшего сыгранного героя: тот же ранг и атрибут, но 50% силы. Считается для комбо и силы, абилки не активирует.",
    ability: { name: "Mirror Image", event: "PRE_DETECT", effects: [{ type: "CREATE_ILLUSION", powerRatio: 0.5 }] },
  },

  // ---------- epic ----------
  {
    id: "rapier", name: "Divine Rapier", cost: 12, emoji: "⚔️", rarity: "epic", category: "mult",
    desc: "×2 к итоговому урону. Провалишь волну — рапиру заберёт враг: твой урон по нему ×0.5, пока он её держит. Убей — вернётся.",
    ability: { name: "Divine", event: "FIGHT_SCORING", effects: [{ type: "FINAL_MULT", value: 2 }] },
  },
  {
    id: "radiance", name: "Radiance", cost: 13, emoji: "🔆", rarity: "epic", category: "power",
    desc: "+3 силы за каждого сыгранного героя. Полная пятёрка = +15.",
    ability: { name: "Immolate", event: "FIGHT_SCORING", effects: [{ type: "ADD_POWER_PER_PLAYED", value: 3 }] },
  },
  {
    id: "octarine", name: "Octarine Core", cost: 12, emoji: "🔮", rarity: "epic", category: "mult",
    desc: "+1 к множителю за каждый твой предмет. Чем жирнее билд — тем сильнее ядро.",
    ability: { name: "Cooldown Reduction", event: "FIGHT_SCORING", effects: [{ type: "ADD_MULT_PER_ITEM", value: 1 }] },
  },
];
