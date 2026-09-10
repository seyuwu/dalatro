// Dalatro — улучшения лавки (фаза F, спек §5). Отдельный слой прогресса,
// НЕ занимает слоты предметов. Два формата контента:
//   scalar — складываются в несколько чисел (sum(state, key)); каждая точка
//            интеграции (урон/золото/продажа/рука/реролл) читает свой ключ;
//   ability — хуки боя через обычную триггерную систему (Triggers, kind
//            "upgrade") — см. collectSources в engine/triggers.js.
//
// УДАЧА (luck): скаляр, который дают сами улучшения (Подкова/Лапка/Клевер).
// Сдвигает веса редкостей предложений к топу и добавляет слоты:
//   удача ≥3 → 3-я карточка, ≥6 → 4-я.
//
// ЗАПАСНОЙ СЛОТ — бесконечный повторяемый апгрейд (виртуальный id "hand_slot"):
// +1 карта в руке за уровень, цена ×1.8 за уровень, редкость растёт
// (эпик → мифик с 3-го уровня). Баланс: экспонента ограничивает сама,
// естественный потолок — размер колоды; на высоких рангах лига режет руку.
const Upgrades = (function () {
  const REROLL_COST = 2;
  const HAND_SLOT_ID = "hand_slot";
  const ATTR_POTION_ID = "attr_potion";
  const BASE_WEIGHTS = { common: 60, uncommon: 25, rare: 10, epic: 4, mythic: 1 };

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

  function luck(state) {
    return sum(state, "luck");
  }

  // Веса редкостей с удачей: common выгорает, топ подрастает.
  function rarityWeights(l) {
    return {
      common: Math.max(15, BASE_WEIGHTS.common - 2.5 * l),
      uncommon: BASE_WEIGHTS.uncommon + 0.5 * l,
      rare: BASE_WEIGHTS.rare + 0.8 * l,
      epic: BASE_WEIGHTS.epic + 0.7 * l,
      mythic: BASE_WEIGHTS.mythic + 0.5 * l,
    };
  }

  // Виртуальное «Зелье атрибута»: +1 заряд смены атрибута (трата в лаборатории).
  function attrPotionDef(state) {
    return {
      id: ATTR_POTION_ID,
      name: "Зелье атрибута",
      emoji: "🧪",
      repeatable: true,
      rarity: "rare",
      cost: 5,
      level: state.run.attrCharges || 0,
      desc: `+1 заряд смены атрибута героя (сейчас зарядов: ${state.run.attrCharges || 0}). Потратить в лаборатории колоды.`,
    };
  }

  // Виртуальный «Запасной слот»: уровень живёт в run.handSlots.
  function handSlotDef(state) {
    const lvl = state.run.handSlots || 0;
    return {
      id: HAND_SLOT_ID,
      name: "Запасной слот",
      emoji: "🎒",
      repeatable: true,
      rarity: lvl >= 2 ? "mythic" : "epic",
      cost: Math.round(6 * Math.pow(1.8, lvl)),
      level: lvl,
      desc: `+1 к размеру руки (сейчас +${lvl}). Следующий уровень дороже.`,
    };
  }

  // Число карточек улучшений в лавке: 2 + бонус за удачу (макс 4).
  function slotsFor(state) {
    return 2 + Math.min(2, Math.floor(luck(state) / 3));
  }

  function pickRarity(rng, weights) {
    let total = 0;
    for (const k in weights) total += weights[k];
    let roll = rng.next() * total;
    for (const rarity of ["common", "uncommon", "rare", "epic", "mythic"]) {
      roll -= weights[rarity];
      if (roll < 0) return rarity;
    }
    return "common";
  }

  // Карточки улучшений: без дублей; обычные — по одному разу за забег,
  // «Запасной слот» — повторяемый (максимум одна карточка в лавке).
  function generateOffers(state, slots) {
    const l = luck(state);
    const count = slots || slotsFor(state);
    const weights = rarityWeights(l);
    const rng = Rng.current();
    const owned = new Set(state.run.upgrades || []);
    const offers = [];
    let handSlotOffered = false;
    let guard = 60;
    while (offers.length < count && guard-- > 0) {
      const rarity = pickRarity(rng, weights);
      if (rarity === handSlotDef(state).rarity && !handSlotOffered && rng.next() < 0.35) {
        offers.push({ id: HAND_SLOT_ID });
        handSlotOffered = true;
        continue;
      }
      if (rarity === "rare" && !offers.some((o) => o.id === ATTR_POTION_ID) && rng.next() < 0.3) {
        offers.push({ id: ATTR_POTION_ID });
        continue;
      }
      const pool = Content.upgrades.list
        .filter((u) => u.rarity === rarity && !owned.has(u.id) && !offers.some((o) => o.id === u.id));
      if (!pool.length) continue;
      const u = pool[Math.floor(rng.next() * pool.length)];
      offers.push({ id: u.id });
    }
    return offers;
  }

  return { ownedDefs, sum, luck, rarityWeights, handSlotDef, attrPotionDef, generateOffers, slotsFor, REROLL_COST, HAND_SLOT_ID, ATTR_POTION_ID };
})();
