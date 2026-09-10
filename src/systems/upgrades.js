// Dalatro — улучшения лавки (фаза F, спек §5). Отдельный слой прогресса,
// НЕ занимает слоты предметов. Два формата контента:
//   scalar — складываются в несколько чисел (sum(state, key)); каждая точка
//            интеграции (урон/золото/продажа/рука/реролл) читает свой ключ;
//   ability — хуки боя через обычную триггерную систему (Triggers, kind
//            "upgrade") — см. collectSources в engine/triggers.js.
const Upgrades = (function () {
  const SLOTS_PER_SHOP = 2;
  // Редкости §5.1: common 60 / uncommon 25 / rare 10 / epic 4 / mythic 1.
  const RARITY_WEIGHTS = { common: 60, uncommon: 25, rare: 10, epic: 4, mythic: 1 };

  function ownedDefs(state) {
    return (state.run.upgrades || [])
      .map((id) => Content.upgrades.byId[id])
      .filter(Boolean);
  }

  // Сумма скаляра по всем купленным улучшениям.
  function sum(state, key) {
    let total = 0;
    for (const u of ownedDefs(state)) {
      if (u.scalar && u.scalar[key]) total += u.scalar[key];
    }
    return total;
  }

  function pickRarity(rng) {
    const total = 100;
    let roll = rng.next() * total;
    for (const rarity of ["common", "uncommon", "rare", "epic", "mythic"]) {
      roll -= RARITY_WEIGHTS[rarity];
      if (roll < 0) return rarity;
    }
    return "common";
  }

  // 2 карточки улучшений на лавку: без дублей и уже купленных. Ролл по сиду.
  function generateOffers(state, slots = SLOTS_PER_SHOP) {
    const rng = Rng.current();
    const owned = new Set(state.run.upgrades || []);
    const offers = [];
    let guard = 40;
    while (offers.length < slots && guard-- > 0) {
      const rarity = pickRarity(rng);
      const pool = Content.upgrades.list
        .filter((u) => !owned.has(u.id) && !offers.some((o) => o.id === u.id) && u.rarity === rarity);
      if (!pool.length) continue;
      const u = pool[Math.floor(rng.next() * pool.length)];
      offers.push({ id: u.id, cost: u.cost });
    }
    return offers;
  }

  return { ownedDefs, sum, generateOffers, SLOTS_PER_SHOP };
})();
