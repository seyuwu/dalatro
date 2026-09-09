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

  // --- Future roster: grid 10 × 4, waiting for Act 2+ content ---
  { id: "undying", name: "Undying", attr: "str", power: 2, inDeck: false, ability: null },
  { id: "ogre_magi", name: "Ogre Magi", attr: "str", power: 4, inDeck: false, ability: null },
  { id: "legion", name: "Legion Commander", attr: "str", power: 6, inDeck: false, ability: null },
  { id: "huskar", name: "Huskar", attr: "str", power: 9, inDeck: false, ability: null },
  { id: "tidehunter", name: "Tidehunter", attr: "str", power: 11, inDeck: false, ability: null },

  { id: "meepo", name: "Meepo", attr: "agi", power: 2, inDeck: false, ability: null },
  { id: "bounty", name: "Bounty Hunter", attr: "agi", power: 3, inDeck: false, ability: null },
  { id: "slark", name: "Slark", attr: "agi", power: 4, inDeck: false, ability: null },
  { id: "phantom_lancer", name: "Phantom Lancer", attr: "agi", power: 6, inDeck: false, ability: null },
  { id: "anti_mage", name: "Anti-Mage", attr: "agi", power: 8, inDeck: false, ability: null },
  { id: "faceless", name: "Faceless Void", attr: "agi", power: 10, inDeck: false, ability: null },
  { id: "terrorblade", name: "Terrorblade", attr: "agi", power: 11, inDeck: false, ability: null },

  { id: "oracle", name: "Oracle", attr: "int", power: 3, inDeck: false, ability: null },
  { id: "skywrath", name: "Skywrath Mage", attr: "int", power: 4, inDeck: false, ability: null },
  { id: "lina", name: "Lina", attr: "int", power: 6, inDeck: false, ability: null },
  { id: "rubick", name: "Rubick", attr: "int", power: 7, inDeck: false, ability: null },
  { id: "invoker", name: "Invoker", attr: "int", power: 8, inDeck: false, ability: null },
  { id: "storm_spirit", name: "Storm Spirit", attr: "int", power: 9, inDeck: false, ability: null },
  { id: "outworld", name: "Outworld Destroyer", attr: "int", power: 10, inDeck: false, ability: null },
  { id: "ancient_apparition", name: "Ancient Apparition", attr: "int", power: 11, inDeck: false, ability: null },

  { id: "io", name: "Io", attr: "uni", power: 2, inDeck: false, ability: null },
  { id: "muerta", name: "Muerta", attr: "uni", power: 3, inDeck: false, ability: null },
  { id: "marci", name: "Marci", attr: "uni", power: 4, inDeck: false, ability: null },
  { id: "snapfire", name: "Snapfire", attr: "uni", power: 5, inDeck: false, ability: null },
  { id: "void_spirit", name: "Void Spirit", attr: "uni", power: 6, inDeck: false, ability: null },
  { id: "kez", name: "Kez", attr: "uni", power: 7, inDeck: false, ability: null },
  { id: "beastmaster", name: "Beastmaster", attr: "uni", power: 8, inDeck: false, ability: null },
  { id: "tiny", name: "Tiny", attr: "uni", power: 10, inDeck: false, ability: null },
];
