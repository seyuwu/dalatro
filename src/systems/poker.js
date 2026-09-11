// dotora — poker module. Knows nothing about Dota: takes cards with
// { power, attr } and returns the best combination contained in the set.
// All played cards still contribute their power; the combo only sets the type
// and its base power / multiplier.
const PokerSys = (function () {
  // Detection rank: wild ranks (Butterfly) and illusions (Manta) override it
  // via detectPower, while their real `power` still drives the damage sum.
  function valueOf(card) {
    return card.detectPower != null ? card.detectPower : card.power;
  }

  function countsBy(cards, key) {
    const map = new Map();
    for (const c of cards) {
      const k = key === "power" ? valueOf(c) : c[key];
      map.set(k, (map.get(k) || 0) + 1);
    }
    return map;
  }

  function hasStraight(values) {
    const distinct = Array.from(new Set(values)).sort((a, b) => a - b);
    let run = 1;
    for (let i = 1; i < distinct.length; i++) {
      run = distinct[i] === distinct[i - 1] + 1 ? run + 1 : 1;
      if (run >= 5) return true;
    }
    return false;
  }

  // Returns { type } — best combo contained in the card set (1..6 cards).
  function detectType(cards) {
    if (!cards || cards.length === 0) return null;

    const powers = countsBy(cards, "power");
    const attrs = countsBy(cards, "attr");
    const values = cards.map(valueOf);

    const hasFlush = cards.length >= 5 && Array.from(attrs.values()).some((n) => n >= 5);
    const straightOk = cards.length >= 5 && hasStraight(values);

    const hasTriple = Array.from(powers.values()).some((n) => n >= 3);
    const pairValues = Array.from(powers.values()).filter((n) => n >= 2).length;

    if (hasFlush && straightOk) return "straight_flush"; // not in slice table; falls back below
    if (hasFlush) return "flush";
    if (straightOk) return "straight";
    if (hasTriple && pairValues >= 2) return "full_house";
    if (hasTriple) return "three";
    if (pairValues >= 2) return "two_pair";
    if (pairValues >= 1) return "pair";
    return "high_card";
  }

  // Best combo for the effective card set, honoring the slice combo table.
  // straight_flush scores as flush for now (expansion point, see ROADMAP).
  function evaluate(cards) {
    let type = detectType(cards);
    if (type === "straight_flush") type = "flush";
    if (!type) return null;
    const def = Content.combos.byId[type];
    if (!def) return null;
    return { type, name: def.name, basePower: def.basePower, baseMult: def.baseMult };
  }

  return { evaluate, detectType };
})();
