// Dalatro — content registry. The engine only ever talks to Content.
const Content = (function () {
  function byId(list) {
    const map = {};
    for (const entry of list) map[entry.id] = entry;
    return map;
  }

  const heroes = { list: HEROES_DATA, byId: byId(HEROES_DATA) };
  heroes.deckIds = HEROES_DATA.filter((h) => h.inDeck).map((h) => h.id);
  heroes.startingIds = heroes.deckIds; // legacy alias

  const items = { list: ITEMS_DATA, byId: byId(ITEMS_DATA) };
  items.rarities = ["common", "rare", "epic"];
  const combos = { list: COMBOS_DATA, byId: byId(COMBOS_DATA) };
  const waves = { list: WAVES_DATA, byId: byId(WAVES_DATA), order: WAVES_DATA.map((w) => w.id) };
  const modifiers = { list: MODIFIERS_DATA, byId: byId(MODIFIERS_DATA) };
  const curses = CURSES.filter((id) => modifiers.byId[id]);
  // Альтернативное ядро скоринга (state.rules = "formation").
  const formations = { list: FORMATIONS_DATA, byId: byId(FORMATIONS_DATA) };
  const bonds = { list: BONDS_DATA, byId: byId(BONDS_DATA) };
  const towerDefense = { byId: TOWER_DEFENSE };

  const attrNames = { str: "Сила", agi: "Ловкость", int: "Интеллект", uni: "Универсал" };
  const attrShort = { str: "STR", agi: "AGI", int: "INT", uni: "UNI" };

  return { heroes, items, combos, waves, modifiers, curses, formations, bonds, towerDefense, damageTypeNames: DAMAGE_TYPE_NAMES, actNames: ACT_NAMES, attrNames, attrShort };
})();
