// Dalatro — economy: shop offers with rarity weights and lock support.
// Offers are objects: { id, locked }. Buy/sell/reroll math lives in game.js.
const Economy = (function () {
  const REROLL_COST = 2;
  const OFFER_SLOTS = 5;
  // Rarity weights per offer slot (epic stays special).
  const RARITY_WEIGHTS = { common: 62, rare: 28, epic: 10 };

  function pickRarity(state, rng) {
    // Ассортимент (#61): редкие товары чаще.
    const bias = typeof Upgrades !== "undefined" ? Upgrades.sum(state, "itemRareBias") : 0;
    const weights = {
      common: Math.max(20, RARITY_WEIGHTS.common - 2 * bias),
      rare: RARITY_WEIGHTS.rare + 2 * bias,
      epic: RARITY_WEIGHTS.epic,
    };
    const total = weights.common + weights.rare + weights.epic;
    let roll = rng.next() * total;
    for (const rarity of ["common", "rare", "epic"]) {
      roll -= weights[rarity];
      if (roll < 0) return rarity;
    }
    return "common";
  }

  // Fills up to `slots` offers from items not owned and not already offered.
  // guaranteeRarity: маршрут/элитка гарантируют товар этой редкости в лавке.
  function generateOffers(state, slots = OFFER_SLOTS, keepLocked = [], guaranteeRarity = null) {
    const rng = Rng.current();
    const offers = keepLocked.slice();
    const taken = new Set(offers.map((o) => o.id).concat(state.player.items));
    // Пыльная полка (#62): шанс гарантировать редкий товар.
    if (!guaranteeRarity) {
      const dust = typeof Upgrades !== "undefined" ? Upgrades.sum(state, "dustChance") : 0;
      if (dust && rng.chance(dust / 100)) guaranteeRarity = "rare";
    }
    let guard = 60; // pool can be exhausted — never loop forever
    while (offers.length < slots && guard-- > 0) {
      const rarity = pickRarity(state, rng);
      const pool = Content.items.list
        .map((i) => i.id)
        .filter((id) => !taken.has(id) && Content.items.byId[id].rarity === rarity);
      if (!pool.length) continue;
      const id = rng.pick(pool);
      taken.add(id);
      offers.push({ id, locked: false });
    }
    if (guaranteeRarity && !offers.some((o) => Content.items.byId[o.id].rarity === guaranteeRarity)) {
      const pool = Content.items.list
        .map((i) => i.id)
        .filter((id) => !taken.has(id) && Content.items.byId[id].rarity === guaranteeRarity);
      if (pool.length) {
        const swapIdx = offers.findIndex((o) => !o.locked);
        if (swapIdx !== -1) {
          taken.delete(offers[swapIdx].id);
          const id = rng.pick(pool);
          offers[swapIdx] = { id, locked: false };
          taken.add(id);
        }
      }
    }
    return offers;
  }

  // Продажа: половина цены, улучшение «Перепродажа» добавляет свой процент.
  function sellValue(state, itemId) {
    const item = Content.items.byId[itemId];
    let value = item.cost / 2;
    let bonusPct = 0;
    if (typeof Upgrades !== "undefined") bonusPct = Upgrades.sum(state, "sell");
    return Math.floor(value * (1 + bonusPct / 100));
  }

  return { generateOffers, sellValue, REROLL_COST, OFFER_SLOTS };
})();
