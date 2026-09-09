// Dalatro content — heroes.
// Card = hero + a mechanical rule (trigger), never just a skin.
// The full 40-slot grid (10 ranks × 4 attributes) exists here: heroes with
// inDeck:true form the starting 12, the rest are ready for future shop
// recruitment / acts (see ROADMAP.md). Non-starting heroes have no abilities yet.
//
// Power 2..11 (11 = Aegis-tier). attr: str | agi | int | uni.
const HEROES_DATA = [
  // --- Starting deck (12) ---
  { id: "tusk", name: "Tusk", attr: "str", power: 3, inDeck: true, ability: null },
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
  { id: "sven", name: "Sven", attr: "str", power: 8, inDeck: true, ability: null },
  { id: "centaur", name: "Centaur Warrunner", attr: "str", power: 10, inDeck: true, ability: null },

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
      name: "Blade Fury", event: "ON_PLAY",
      when: { type: "SLOT_IS", value: 0 },
      effects: [{ type: "ADD_POWER", value: 8 }],
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
      when: { type: "EXISTS_ATTRIBUTE", value: "int" },
      effects: [{ type: "ADD_MULT", value: 2 }],
    },
  },

  { id: "dawnbreaker", name: "Dawnbreaker", attr: "uni", power: 9, inDeck: true, ability: null },
  { id: "primal", name: "Primal Beast", attr: "uni", power: 11, inDeck: true, ability: null },

  // --- Ростер таверны (28): рекрутируются в лавке, способности v0.4 ---
  { id: "undying", name: "Undying", attr: "str", power: 2, inDeck: false,
    ability: {
      name: "Decay", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_PER_DISCARD", value: 2, cap: 12 }],
    } },
  { id: "ogre_magi", name: "Ogre Magi", attr: "str", power: 4, inDeck: false,
    ability: {
      name: "Multicast", event: "FIGHT_SCORING", chance: 0.25,
      effects: [{ type: "ADD_MULT", value: 3 }],
    } },
  { id: "legion", name: "Legion Commander", attr: "str", power: 6, inDeck: false,
    ability: {
      name: "Duel", event: "FIGHT_SCORING",
      when: { type: "COMBO_MIN", value: "pair" },
      effects: [{ type: "ADD_POWER", value: 12 }],
    } },
  { id: "huskar", name: "Huskar", attr: "str", power: 9, inDeck: false,
    ability: {
      name: "Berserker's Blood", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_PER_LOST_BARRACKS", value: 3 }],
    } },
  { id: "tidehunter", name: "Tidehunter", attr: "str", power: 11, inDeck: false,
    ability: {
      name: "Kraken Shell", event: "FIGHT_SCORING",
      when: { type: "PLAYED_COUNT_ABOVE", value: 4 },
      effects: [{ type: "ADD_MULT", value: 2 }],
    } },

  { id: "meepo", name: "Meepo", attr: "agi", power: 2, inDeck: false,
    ability: {
      name: "Poof", event: "ON_PLAY",
      when: { type: "EXISTS_ATTRIBUTE", value: "agi" },
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
      name: "Precision Aura", event: "FIGHT_SCORING",
      when: { type: "ALL_ATTRIBUTES", value: "agi" },
      effects: [{ type: "ADD_MULT", value: 3 }],
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
  { id: "terrorblade", name: "Terrorblade", attr: "agi", power: 11, inDeck: false, ability: null },

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
  { id: "rubick", name: "Rubick", attr: "int", power: 7, inDeck: false, ability: null },
  { id: "invoker", name: "Invoker", attr: "int", power: 8, inDeck: false,
    ability: {
      name: "Invoke", event: "FIGHT_SCORING",
      when: { type: "DISTINCT_ATTRIBUTES_ABOVE", value: 2 },
      effects: [{ type: "ADD_MULT", value: 3 }],
    } },
  { id: "storm_spirit", name: "Storm Spirit", attr: "int", power: 9, inDeck: false,
    ability: {
      name: "Ball Lightning", event: "ON_PLAY",
      when: { type: "SLOT_IS", value: 0 },
      effects: [{ type: "ADD_POWER", value: 9 }],
    } },
  { id: "outworld", name: "Outworld Destroyer", attr: "int", power: 10, inDeck: false,
    ability: {
      name: "Sanity's Eclipse", event: "FIGHT_SCORING",
      when: { type: "DISTINCT_ATTRIBUTES_ABOVE", value: 2 },
      effects: [{ type: "ADD_POWER", value: 12 }],
    } },
  { id: "ancient_apparition", name: "Ancient Apparition", attr: "int", power: 11, inDeck: false, ability: null },

  { id: "io", name: "Io", attr: "uni", power: 2, inDeck: false,
    ability: {
      name: "Tether", event: "FIGHT_SCORING",
      when: { type: "EXISTS_ATTRIBUTE", value: "str" },
      effects: [{ type: "ADD_POWER", value: 6 }],
    } },
  { id: "muerta", name: "Muerta", attr: "uni", power: 3, inDeck: false,
    ability: {
      name: "Dead Shot", event: "ON_PLAY",
      when: { type: "SLOT_IS", value: 2 },
      effects: [{ type: "ADD_POWER", value: 8 }],
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
      name: "Dissimilate", event: "FIGHT_SCORING",
      when: { type: "IS_HIGHEST_RANK" },
      effects: [{ type: "ADD_POWER", value: 8 }],
    } },
  { id: "kez", name: "Kez", attr: "uni", power: 7, inDeck: false, ability: null },
  { id: "beastmaster", name: "Beastmaster", attr: "uni", power: 8, inDeck: false,
    ability: {
      name: "Primal Roar", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_PER_SAME_RANK", value: 5 }],
    } },
  { id: "tiny", name: "Tiny", attr: "uni", power: 10, inDeck: false,
    ability: {
      name: "Grow", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_PER_PLAYED", value: 3 }],
    } },
];
