// Dalatro — economy: shop offers with rarity weights and lock support.
// Offers are objects: { id, locked }. Buy/sell/reroll math lives in game.js.
const Economy = (function () {
  const REROLL_COST = 2;
  const OFFER_SLOTS = 5;
  // Rarity weights per offer slot (epic stays special).
  const RARITY_WEIGHTS = { common: 62, rare: 28, epic: 10 };

  function pickRarity(rng) {
    const total = RARITY_WEIGHTS.common + RARITY_WEIGHTS.rare + RARITY_WEIGHTS.epic;
    let roll = rng.next() * total;
    for (const rarity of ["common", "rare", "epic"]) {
      roll -= RARITY_WEIGHTS[rarity];
      if (roll < 0) return rarity;
    }
    return "common";
  }

  // Fills up to `slots` offers from items not owned and not already offered.
  // guaranteeEpic: элитная башня — в лавке будет хотя бы один эпик.
  function generateOffers(state, slots = OFFER_SLOTS, keepLocked = [], guaranteeEpic = false) {
    const rng = Rng.current();
    const offers = keepLocked.slice();
    const taken = new Set(offers.map((o) => o.id).concat(state.player.items));
    let guard = 60; // pool can be exhausted — never loop forever
    while (offers.length < slots && guard-- > 0) {
      const rarity = pickRarity(rng);
      const pool = Content.items.list
        .map((i) => i.id)
        .filter((id) => !taken.has(id) && Content.items.byId[id].rarity === rarity);
      if (!pool.length) continue;
      const id = rng.pick(pool);
      taken.add(id);
      offers.push({ id, locked: false });
    }
    if (guaranteeEpic && !offers.some((o) => Content.items.byId[o.id].rarity === "epic")) {
      const epics = Content.items.list
        .map((i) => i.id)
        .filter((id) => !taken.has(id) && Content.items.byId[id].rarity === "epic");
      if (epics.length) {
        const swapIdx = offers.findIndex((o) => !o.locked);
        if (swapIdx !== -1) {
          taken.delete(offers[swapIdx].id);
          const id = rng.pick(epics);
          offers[swapIdx] = { id, locked: false };
          taken.add(id);
        }
      }
    }
    return offers;
  }

  function sellValue(itemId) {
    const item = Content.items.byId[itemId];
    return Math.floor(item.cost / 2);
  }

  return { generateOffers, sellValue, REROLL_COST, OFFER_SLOTS };
})();
