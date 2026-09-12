// dotora — economy: shop offers with rarity weights and lock support.
// Offers are objects: { id, locked }. Buy/sell/reroll math lives in game.js.
const Economy = (function () {
  const REROLL_COST = 2;
  const OFFER_SLOTS = 5;
  // Rarity weights per offer slot (epic stays special).
  const RARITY_WEIGHTS = { common: 62, rare: 28, epic: 10 };

  function pickRarity(state, rng) {
    // Ассортимент (#61): редкие товары чаще. Удача (Клевер/Подкова/Фортуна/
    // ласт-хиты) чуть-чуть двигает и предметы: common выгорает, rare и epic
    // подрастают. Вклад удачи ограничен, чтобы эпик не превращался в норму.
    const bias = typeof Upgrades !== "undefined" ? Upgrades.sum(state, "itemRareBias") : 0;
    const li = typeof Upgrades !== "undefined" ? Math.min(10, Upgrades.luck(state)) : 0;
    const weights = {
      common: Math.max(20, RARITY_WEIGHTS.common - 2 * bias - 1.2 * li),
      rare: RARITY_WEIGHTS.rare + 2 * bias + 0.9 * li,
      epic: RARITY_WEIGHTS.epic + 0.4 * li,
    };
    const total = weights.common + weights.rare + weights.epic;
    let roll = rng.next() * total;
    for (const rarity of ["common", "rare", "epic"]) {
      roll -= weights[rarity];
      if (roll < 0) return rarity;
    }
    return "common";
  }

  // Ранг-гейт: предметы с minRank появляются в лавке только с этого ранга
  // лиги. Ранние акты остаются обучающими, высокие — со свежим пулом.
  function rankOk(state, item) {
    return !item.minRank || (state.run.rank || 1) >= item.minRank;
  }

  // Fills up to `slots` offers from items not owned and not already offered.
  // guaranteeRarity: маршрут/элитка гарантируют товар этой редкости в лавке.
  function generateOffers(state, slots = OFFER_SLOTS, keepLocked = [], guaranteeRarity = null) {
    const rng = Rng.current();
    const offers = keepLocked.slice();
    const taken = new Set(offers.map((o) => o.id).concat(state.player.items));
    let guard = 60; // pool can be exhausted — never loop forever
    while (offers.length < slots && guard-- > 0) {
      const rarity = pickRarity(state, rng);
      const pool = Content.items.list.filter((i) => !taken.has(i.id) && rankOk(state, i) && i.rarity === rarity).map((i) => i.id);
      if (!pool.length) continue;
      const id = rng.pick(pool);
      taken.add(id);
      offers.push({ id, locked: false });
    }
    if (guaranteeRarity && !offers.some((o) => Content.items.byId[o.id].rarity === guaranteeRarity)) {
      const pool = Content.items.list
        .filter((i) => !taken.has(i.id) && rankOk(state, i) && i.rarity === guaranteeRarity)
        .map((i) => i.id);
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

  // Продажа: половина цены; маршрут «Ломбард» (run.pawnBonus) накидывает
  // сверху свой процент — пока его не потратит первая продажа.
  function sellValue(itemId, state) {
    const base = Math.floor(Content.items.byId[itemId].cost / 2);
    const bonus = state && state.run && state.run.pawnBonus ? state.run.pawnBonus : 0;
    return bonus ? Math.floor(base * (1 + bonus / 100)) : base;
  }

  return { generateOffers, sellValue, rankOk, REROLL_COST, OFFER_SLOTS };
})();
