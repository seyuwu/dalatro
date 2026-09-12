// dotora content — heroes.
// Card = hero + a mechanical rule (trigger), never just a skin.
// The full 44-card grid (11 ranks 2–12 × 4 attributes) exists here: heroes with
// inDeck:true form the starting 12; the rest are recruited in the shop.
// Every hero has an ability; new rules lean on rank/attr/slot/count conditions
// so they read the same in both scoring modes (classic и formation).
//
// Power 2..12 (12 = Aegis-tier). attr: str | agi | int | uni.
const HEROES_DATA = [
  // --- Starting deck (12) ---
  {
    id: "tusk", name: "Tusk", attr: "str", power: 3, inDeck: true,
    ability: {
      name: "Snowball", event: "ON_PLAY",
      effects: [{ type: "ADD_POWER_PER_NEIGHBOR", value: 4 }],
    },
  },
  {
    id: "axe", name: "Axe", attr: "str", power: 5, inDeck: true,
    ability: {
      name: "Counter Helix", event: "COMBO_DETECTED",
      when: { type: "COMBO_IS", value: "three" },
      effects: [{ type: "ADD_POWER", value: 10 }],
    },
  },
  {
    id: "pudge", name: "Pudge", attr: "str", power: 7, inDeck: true,
    ability: {
      name: "Meathook", event: "ON_DISCARD", chance: 0.5,
      effects: [{ type: "RETURN_TO_HAND" }],
    },
  },
  {
    id: "sven", name: "Sven", attr: "str", power: 8, inDeck: true,
    ability: {
      name: "God's Strength", event: "FIGHT_SCORING",
      when: { type: "IS_HIGHEST_RANK" },
      effects: [{ type: "MULT_MULT", value: 1.5 }],
    },
  },
  {
    id: "centaur", name: "Centaur Warrunner", attr: "str", power: 10, inDeck: true,
    ability: {
      name: "Trample", event: "ON_PLAY",
      when: { type: "SLOT_IS", value: 0 },
      effects: [{ type: "ADD_POWER_PER_PLAYED", value: 4 }],
    },
  },

  {
    id: "morphling", name: "Morphling", attr: "agi", power: 5, inDeck: true,
    ability: {
      name: "Morph", event: "PRE_DETECT",
      effects: [{ type: "COPY_ATTRIBUTE", target: "left_neighbor" }],
    },
  },
  {
    id: "juggernaut", name: "Juggernaut", attr: "agi", power: 7, inDeck: true,
    ability: {
      name: "Escort", event: "FIGHT_SCORING",
      when: { type: "STRONGEST_IS_AHEAD" },
      effects: [{ type: "ADD_MULT", value: 1 }],
    },
  },
  {
    id: "pa", name: "Phantom Assassin", attr: "agi", power: 9, inDeck: true,
    ability: {
      name: "Coup de Grace", event: "COMBO_DETECTED",
      when: { type: "COMBO_MIN", value: "pair" }, chance: 0.5,
      effects: [{ type: "MULT_MULT", value: 2 }],
    },
  },

  {
    id: "cm", name: "Crystal Maiden", attr: "int", power: 2, inDeck: true,
    ability: {
      name: "Frostbite", event: "ON_DISCARD",
      effects: [{ type: "GOLD", value: 2 }],
    },
  },
  {
    id: "zeus", name: "Zeus", attr: "int", power: 5, inDeck: true,
    ability: {
      name: "Static Field", event: "ON_PLAY",
      // Текст способности и онбординг обещают «рядом INT-герой» — условие
      // выровнено с текстом (было EXISTS_ATTRIBUTE: любой INT в строю).
      when: { type: "NEIGHBOR_ATTR_IS", value: "int" },
      effects: [{ type: "ADD_MULT", value: 2 }],
    },
  },

  {
    id: "dawnbreaker", name: "Dawnbreaker", attr: "uni", power: 9, inDeck: true,
    ability: {
      name: "Fire Ring", event: "FIGHT_SCORING",
      when: { type: "SLOT_IS", value: 3 },
      effects: [{ type: "ADD_MULT_PER_ATTRIBUTE", attr: "uni", value: 1 }],
    },
  },
  {
    id: "primal", name: "Primal Beast", attr: "uni", power: 11, inDeck: true,
    ability: {
      name: "Pulverize", event: "FIGHT_SCORING",
      when: { all: [{ type: "SLOT_IS", value: 2 }, { type: "PLAYED_COUNT_IS", value: 5 }] },
      effects: [{ type: "MULT_MULT", value: 2 }],
    },
  },

  // --- Ростер таверны (32): рекрутируются в лавке, способности v0.4 ---
  { id: "undying", name: "Undying", attr: "str", power: 2, inDeck: false,
    ability: {
      name: "Risen Legion", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_PER_NEIGHBOR_ATTR", attr: "str", value: 4 }],
    } },
  { id: "ogre_magi", name: "Ogre Magi", attr: "str", power: 4, inDeck: false,
    ability: {
      name: "Multicast", event: "FIGHT_SCORING", chance: 0.25,
      effects: [{ type: "ADD_MULT", value: 3 }],
    } },
  { id: "legion", name: "Legion Commander", attr: "str", power: 6, inDeck: false,
    ability: {
      name: "Moment of Courage", event: "ON_PLAY",
      when: { type: "SLOT_IS", value: 1 },
      effects: [{ type: "ADD_POWER", value: 10 }],
    } },
  { id: "huskar", name: "Huskar", attr: "str", power: 9, inDeck: false,
    ability: {
      name: "Berserker's Blood", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_PER_LOST_BARRACKS", value: 3 }],
    } },
  { id: "tidehunter", name: "Tidehunter", attr: "str", power: 11, inDeck: false,
    ability: {
      name: "Anchor Smash", event: "FIGHT_SCORING",
      when: { type: "SLOT_IS", value: 3 },
      effects: [{ type: "ADD_POWER", value: 10 }],
    } },
  {
    id: "kunkka", name: "Kunkka", attr: "str", power: 12, inDeck: false,
    ability: {
      name: "Ghostship", event: "ON_PLAY",
      when: { all: [{ type: "SLOT_IS", value: 2 }, { type: "PLAYED_COUNT_ABOVE", value: 3 }] },
      effects: [{ type: "ADD_MULT", value: 2 }],
    } },

  { id: "meepo", name: "Meepo", attr: "agi", power: 2, inDeck: false,
    ability: {
      name: "Poof", event: "ON_PLAY",
      // «Poof» — прыжок к соседу: только позиционный сосед с AGI: раньше
      // EXISTS_ATTRIBUTE стрелял от любого AGI в строю.
      when: { type: "NEIGHBOR_ATTR_IS", value: "agi" },
      effects: [{ type: "ADD_POWER", value: 6 }],
    } },
  { id: "bounty", name: "Bounty Hunter", attr: "agi", power: 3, inDeck: false,
    ability: {
      name: "Track", event: "FIGHT_SCORING",
      effects: [{ type: "LAST_HIT_GOLD", value: 8 }],
    } },
  { id: "slark", name: "Slark", attr: "agi", power: 4, inDeck: false,
    ability: {
      name: "Essence Shift", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_PER_USED_DISCARD" }],
    } },
  { id: "phantom_lancer", name: "Phantom Lancer", attr: "agi", power: 6, inDeck: false,
    ability: {
      name: "Spirit Lance", event: "ON_PLAY",
      when: { type: "SLOT_IS", value: 1 },
      effects: [{ type: "ADD_POWER", value: 7 }],
    } },
  { id: "anti_mage", name: "Anti-Mage", attr: "agi", power: 8, inDeck: false,
    ability: {
      name: "Mana Break", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_PER_EMPTY_SLOT", value: 4 }],
    } },
  { id: "faceless", name: "Faceless Void", attr: "agi", power: 10, inDeck: false,
    ability: {
      name: "Chronosphere", event: "FIGHT_SCORING",
      when: { type: "IS_BOSS_WAVE" },
      effects: [{ type: "ADD_MULT", value: 2 }],
    } },
  {
    id: "terrorblade", name: "Terrorblade", attr: "agi", power: 11, inDeck: false,
    ability: {
      name: "Soul Mirror", event: "PRE_DETECT",
      effects: [{ type: "COPY_ATTRIBUTE", target: "right_neighbor" }],
    } },
  {
    id: "ursa", name: "Ursa", attr: "agi", power: 12, inDeck: false,
    ability: {
      name: "Enrage", event: "FIGHT_SCORING",
      when: { type: "IS_HIGHEST_RANK" },
      effects: [{ type: "MULT_MULT", value: 1.8 }],
    } },

  { id: "oracle", name: "Oracle", attr: "int", power: 3, inDeck: false,
    ability: {
      name: "False Promise", event: "FIGHT_SCORING",
      when: { type: "IS_LOWEST_RANK" },
      effects: [{ type: "ADD_POWER", value: 10 }],
    } },
  { id: "skywrath", name: "Skywrath Mage", attr: "int", power: 4, inDeck: false,
    ability: {
      name: "Mystic Flare", event: "FIGHT_SCORING",
      when: { type: "PLAYED_COUNT_IS", value: 1 },
      effects: [{ type: "MULT_MULT", value: 2 }],
    } },
  { id: "lina", name: "Lina", attr: "int", power: 6, inDeck: false,
    ability: {
      name: "Laguna Blade", event: "FIGHT_SCORING",
      when: { type: "PLAYED_COUNT_BELOW", value: 3 },
      effects: [{ type: "ADD_POWER", value: 20 }],
    } },
  { id: "rubick", name: "Rubick", attr: "int", power: 7, inDeck: false,
    ability: {
      name: "Fade Bolt", event: "ON_PLAY",
      when: { type: "NEIGHBOR_ATTR_IS", value: "int" },
      effects: [{ type: "ADD_POWER", value: 9 }],
    } },
  { id: "invoker", name: "Invoker", attr: "int", power: 8, inDeck: false,
    ability: {
      name: "Invoke", event: "FIGHT_SCORING",
      when: { type: "DISTINCT_ATTRIBUTES_ABOVE", value: 2 },
      effects: [{ type: "ADD_MULT", value: 3 }],
    } },
  { id: "storm_spirit", name: "Storm Spirit", attr: "int", power: 9, inDeck: false,
    ability: {
      name: "Electric Swing", event: "ON_PLAY",
      when: { type: "NEIGHBOR_RANK_ABOVE" },
      effects: [{ type: "ADD_POWER", value: 9 }],
    } },
  { id: "outworld", name: "Outworld Destroyer", attr: "int", power: 10, inDeck: false,
    ability: {
      name: "Astral Imprisonment", event: "ON_PLAY",
      when: { type: "SLOT_IS", value: 3 },
      effects: [{ type: "ADD_POWER", value: 12 }],
    } },
  {
    id: "ancient_apparition", name: "Ancient Apparition", attr: "int", power: 11, inDeck: false,
    ability: {
      name: "Ice Blast", event: "FIGHT_SCORING",
      when: { type: "IS_BOSS_WAVE" },
      effects: [{ type: "DENY_REVIVE" }],
    } },
  {
    id: "enigma", name: "Enigma", attr: "int", power: 12, inDeck: false,
    ability: {
      name: "Eidolon", event: "PRE_DETECT",
      effects: [{ type: "CREATE_ILLUSION", powerRatio: 0.5 }],
    } },

  { id: "io", name: "Io", attr: "uni", power: 2, inDeck: false,
    ability: {
      name: "Tether Pull", event: "FIGHT_SCORING",
      when: { type: "NEIGHBOR_ATTR_IS", value: "str" },
      effects: [{ type: "ADD_MULT", value: 1 }],
    } },
  { id: "muerta", name: "Muerta", attr: "uni", power: 3, inDeck: false,
    ability: {
      name: "Pallbearer", event: "FIGHT_SCORING",
      when: { type: "SLOT_IS_LAST" },
      effects: [{ type: "ADD_MULT", value: 1 }, { type: "LAST_HIT_GOLD", value: 4 }],
    } },
  { id: "marci", name: "Marci", attr: "uni", power: 4, inDeck: false,
    ability: {
      name: "Sidekick", event: "ON_PLAY",
      when: { type: "NEIGHBOR_ATTR_DIFFERS" },
      effects: [{ type: "ADD_POWER", value: 8 }],
    } },
  { id: "snapfire", name: "Snapfire", attr: "uni", power: 5, inDeck: false,
    ability: {
      name: "Gobble & Shoot", event: "ON_PLAY",
      when: { type: "SLOT_IS_LAST" },
      effects: [{ type: "ADD_MULT", value: 1 }],
    } },
  { id: "void_spirit", name: "Void Spirit", attr: "uni", power: 6, inDeck: false,
    ability: {
      name: "Prism Line", event: "FIGHT_SCORING",
      when: { type: "NO_ADJACENT_SAME_ATTR" },
      effects: [{ type: "ADD_MULT", value: 2 }],
    } },
  {
    id: "kez", name: "Kez", attr: "uni", power: 7, inDeck: false,
    ability: {
      name: "Echo Slash", event: "FIGHT_SCORING",
      when: { all: [
        { type: "PLAYED_COUNT_ABOVE", value: 1 },
        { not: { any: [{ type: "IS_HIGHEST_RANK" }, { type: "IS_LOWEST_RANK" }] } },
      ] },
      effects: [{ type: "ADD_POWER", value: 10 }],
    } },
  { id: "beastmaster", name: "Beastmaster", attr: "uni", power: 8, inDeck: false,
    ability: {
      name: "Primal Roar", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_PER_SAME_RANK", value: 5 }],
    } },
  { id: "tiny", name: "Tiny", attr: "uni", power: 10, inDeck: false,
    ability: {
      name: "Rock Slide", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_EDGES", pct: 25 }],
    } },
  {
    id: "tinker", name: "Tinker", attr: "uni", power: 12, inDeck: false,
    ability: {
      name: "Rearm", event: "FIGHT_SCORING",
      effects: [{ type: "REFRESH_HERO_TRIGGERS" }],
    } },

  // ===== Легенды таверны (вне сетки 11×4): рекрут ×2 цены, максимум 2 за забег =====
  // docs/PROPOSALS_FUN_BUILDS.md §0.1 — фановые архетипы сообществ.
  {
    id: "venomancer", name: "Venomancer", attr: "agi", power: 5, inDeck: false, legend: true, emoji: "🐍",
    ability: {
      name: "Poison Nova", event: "FIGHT_SCORING",
      effects: [{ type: "TOWER_BURN", value: 7 }],
    } },
  {
    id: "wraith_king", name: "Wraith King", attr: "uni", power: 6, inDeck: false, legend: true, emoji: "👑",
    ability: {
      name: "Wraithfire", event: "FIGHT_SCORING",
      effects: [{ type: "GAIN_RANK_PER_FIGHT", value: 1, cap: 12 }],
    } },
  {
    id: "magnus", name: "Magnus", attr: "str", power: 8, inDeck: false, legend: true, emoji: "🦏",
    ability: {
      name: "Reverse Polarity", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_NEIGHBOR_PCT", pct: 35 }],
    } },
  {
    id: "techies", name: "Techies", attr: "int", power: 4, inDeck: false, legend: true, emoji: "💣",
    ability: {
      name: "Suicide", event: "FIGHT_SCORING",
      effects: [{ type: "FAIL_BURN_PCT", pct: 10 }],
    } },
  {
    id: "silencer", name: "Silencer", attr: "int", power: 6, inDeck: false, legend: true, emoji: "🤐",
    ability: {
      name: "Last Word", event: "ON_HELD",
      effects: [{ type: "ADD_POWER_PER_HELD", value: 2 }],
    } },
  {
    id: "chaos_knight", name: "Chaos Knight", attr: "str", power: 10, inDeck: false, legend: true, emoji: "🎲",
    ability: {
      name: "Chaos Bolt", event: "FIGHT_SCORING",
      effects: [{ type: "CHAOS_BOLT", mult: 2, power: 16 }],
    } },
  {
    id: "pugna", name: "Pugna", attr: "int", power: 7, inDeck: false, legend: true, emoji: "👁️",
    ability: {
      name: "Nether Ward", event: "FIGHT_SCORING",
      effects: [{ type: "HEAL_TO_DAMAGE" }],
    } },
];
