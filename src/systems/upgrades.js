// dotora — улучшения лавки v2. Отдельный слой прогресса, НЕ занимает слоты
// предметов. Улучшения продают КОНТРОЛЬ (кнопки, заряды, гарантии, правила),
// а не проценты — сила остаётся у героев и предметов.
//
// Форматы контента:
//   scalar — плоские агрегаты (sum по ключу × уровень инстанса);
//   ability — боевые хуки через триггерную систему (kind: "upgrade");
//   type:"active" — кнопка: activation { context, access, target? } + effect;
//   react — вне-боевые слушатели событий движка (WAVE_FAILED, UPGRADE_ACTIVATED);
//   onBuy — флаги, выставляемые при покупке (Последний билет).
//
// ДУБЛИКАТЫ ЗАПРЕЩЕНЫ: купленное не предлагается. Повторяемость дают
// виртуальные карточки (Запасной слот, Зелье, Розетка) и ступени уровней
// (defs с levels[] — следующий уровень как отдельная карточка).
//
// УДАЧА (luck): скаляры Подкова/Лапка/Клевер + копилка «Пакта с Фортуны»
// (run.fortune). Сдвигает веса редкостей и добавляет слоты: ≥3 → 5-я, ≥6 → 6-я.
const Upgrades = (function () {
  const REROLL_COST = 1;
  const HAND_SLOT_ID = "hand_slot";
  const ATTR_POTION_ID = "attr_potion";
  const RECHARGE_ID = "recharge";
  const ENERGY_CAP = 6;
  const BASE_WEIGHTS = { common: 60, uncommon: 25, rare: 10, epic: 4, mythic: 1 };
  const ROMAN = ["I", "II", "III", "IV", "V"];
  const CONTEXT_LABELS = { route: "на развилке", shop: "в лавке", wave: "в бою", failed: "при провале", any: "везде" };

  // --- инстансы: состояние купленного улучшения (только счётчики) ---
  function instanceOf(state, id) {
    state.run.upgradeState = state.run.upgradeState || {};
    if (!state.run.upgradeState[id]) {
      const def = Content.upgrades.byId[id];
      const acc = def && def.activation && def.activation.access ? def.activation.access : {};
      state.run.upgradeState[id] = { level: 1, charges: acc.charges || 0, actUses: 0 };
    }
    return state.run.upgradeState[id];
  }

  function ownedDefs(state) {
    return (state.run.upgrades || [])
      .map((id) => Content.upgrades.byId[id])
      .filter(Boolean);
  }

  // Сумма скаляра по купленным улучшениям (× уровень инстанса).
  function sum(state, key) {
    let total = 0;
    for (const u of ownedDefs(state)) {
      if (u.scalar && u.scalar[key]) total += u.scalar[key] * instanceOf(state, u.id).level;
    }
    return total;
  }

  function luck(state) {
    let l = sum(state, "luck");
    // Осколок «Shuriken Toss» (Bounty): удача копится ласт-хитами в heroCharges.
    const charges = state.run && state.run.heroCharges;
    if (charges) for (const h of Object.values(charges)) l += h.luck || 0;
    // Пакт с Фортуны: провалы копят удачу (см. react FORTUNE в движке).
    l += (state.run && state.run.fortune) || 0;
    return l;
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

  // Виртуальные повторяемые карточки.
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

  function rechargeDef(state) {
    return {
      id: RECHARGE_ID,
      name: "Розетка",
      emoji: "🔌",
      repeatable: true,
      rarity: "uncommon",
      cost: 5,
      desc: "Все твои активные улучшения получают +1 заряд.",
    };
  }

  // Число карточек улучшений в лавке: база 4, удача добавляет до 6,
  // маршруты (Распродажа) могут уменьшать.
  function slotsFor(state) {
    return Math.max(1, 4 + Math.min(2, Math.floor(luck(state) / 3)) + (state.run.upgradeSlotsDelta || 0));
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

  // Карточки улучшений: БЕЗ дубликатов (купленное не предлагается), кроме
  // следующей ступени уровневых дефов. Опция consumeGuarantee съедает
  // run.pendingUpgradeRarity (Инсайдер/Пакт с Фортуны) — только на полной
  // перегенерации полки, чтобы замена одного слота не сжигала гарантию.
  function generateOffers(state, slots, exclude, opts) {
    const l = luck(state);
    const count = slots || slotsFor(state);
    const weights = rarityWeights(l);
    const rng = Rng.current();
    const consumeGuarantee = !!(opts && opts.consumeGuarantee);
    const guarantee = state.run.pendingUpgradeRarity || null;
    if (consumeGuarantee) state.run.pendingUpgradeRarity = null;
    let guaranteed = false;
    const taken = new Set((exclude || []).map((o) => o.id || o));
    const owned = new Set(state.run.upgrades || []);
    const offers = [];
    let handSlotOffered = taken.has(HAND_SLOT_ID);
    let potionOffered = taken.has(ATTR_POTION_ID);
    let rechargeOffered = taken.has(RECHARGE_ID);
    const hasActives = ownedDefs(state).some((u) => u.type === "active");
    const nextTier = (u) => {
      const lvl = instanceOf(state, u.id).level;
      return u.levels && lvl < u.levels.length ? lvl + 1 : null;
    };
    const eligible = (u) => {
      if (taken.has(u.id) || offers.some((o) => o.id === u.id)) return false;
      if (!owned.has(u.id)) return true;
      return nextTier(u) != null; // купленное — только следующей ступенью
    };
    const offerDef = (u) => {
      const tier = nextTier(u);
      offers.push(tier ? { id: u.id, tier } : { id: u.id });
    };
    const virtualForRarity = (rarity) => {
      if (rarity === handSlotDef(state).rarity && !handSlotOffered && rng.next() < 0.35) {
        offers.push({ id: HAND_SLOT_ID });
        handSlotOffered = true;
        return true;
      }
      if (rarity === "rare" && !potionOffered && rng.next() < 0.3) {
        offers.push({ id: ATTR_POTION_ID });
        potionOffered = true;
        return true;
      }
      if (rarity === "uncommon" && hasActives && !rechargeOffered && rng.next() < 0.3) {
        offers.push({ id: RECHARGE_ID });
        rechargeOffered = true;
        return true;
      }
      return false;
    };
    let guard = 60;
    while (offers.length < count && guard-- > 0) {
      const rarity = guarantee && !guaranteed ? guarantee : pickRarity(rng, weights);
      if (!guarantee || guaranteed) {
        if (virtualForRarity(rarity)) continue;
      }
      const pool = Content.upgrades.list.filter((u) => u.rarity === rarity && eligible(u));
      if (!pool.length) { guaranteed = true; continue; }
      offerDef(pool[Math.floor(rng.next() * pool.length)]);
      guaranteed = true;
    }
    // Полка вырождалась бы в пустоту — добираем ступенями/виртуальными без
    // учёта редкости (практически недостижимо при пуле 30+).
    guard = 40;
    while (offers.length < count && guard-- > 0) {
      if (hasActives && !rechargeOffered) {
        offers.push({ id: RECHARGE_ID });
        rechargeOffered = true;
        continue;
      }
      if (!handSlotOffered) { offers.push({ id: HAND_SLOT_ID }); handSlotOffered = true; continue; }
      if (!potionOffered) { offers.push({ id: ATTR_POTION_ID }); potionOffered = true; continue; }
      const pool = Content.upgrades.list.filter((u) => eligible(u));
      if (!pool.length) break;
      offerDef(pool[Math.floor(rng.next() * pool.length)]);
    }
    return offers;
  }

  // --- активации ---

  // Контекст экрана: где сейчас находится игрок.
  function contextOf(state) {
    if (state.phase === "route") return "route";
    if (state.phase === "shop") return "shop";
    if (state.phase === "wave") return state.combat.outcome === "failed" ? "failed" : "wave";
    return "none";
  }

  function canActivate(state, id) {
    const def = Content.upgrades.byId[id];
    if (!def || def.type !== "active" || !def.activation) return { ok: false, reason: "Пассивное улучшение" };
    const ctx = contextOf(state);
    const act = def.activation;
    if (act.context !== "any" && act.context !== ctx) {
      return { ok: false, reason: `Только ${CONTEXT_LABELS[act.context] || act.context}` };
    }
    const inst = instanceOf(state, id);
    const acc = act.access || {};
    if (acc.charges != null && inst.charges <= 0) return { ok: false, reason: "Нет зарядов" };
    if (acc.act != null && inst.actUses >= acc.act) return { ok: false, reason: "Лимит на акт исчерпан" };
    if (acc.energy != null && (state.run.energy || 0) < acc.energy) return { ok: false, reason: `Нужно ${acc.energy}⚡` };
    // Спец-валидация Обходчика: босса пропустить нельзя.
    if (def.effect && def.effect.type === "skipBattle") {
      const nextDef = Content.waves.byId[Content.waves.order[(state.run.waveIndex || 0) + 1]];
      if (nextDef && (nextDef.isBoss || nextDef.miniBoss)) return { ok: false, reason: "Босса не пропустить" };
    }
    // Сюрприз: нужен свободный товар для бесплатной полки.
    if (def.effect && def.effect.type === "freeItemOffer") {
      const taken = new Set([...(state.shop.offers || []).map((o) => o.id), ...(state.player.items || [])]);
      const pool = Content.items.list.filter((i) => i.rarity === "common" && !taken.has(i.id));
      if (!pool.length) return { ok: false, reason: "Торговцу нечего предложить" };
    }
    return { ok: true };
  }

  // Списание ресурса активации. Для effect "pickDiscard" списывается движком
  // в PICK_DISCARD (после выбора карты).
  function spendActivation(state, id) {
    const def = Content.upgrades.byId[id];
    const inst = instanceOf(state, id);
    const acc = def && def.activation && def.activation.access ? def.activation.access : {};
    if (acc.charges != null) inst.charges = Math.max(0, inst.charges - 1);
    if (acc.act != null) inst.actUses += 1;
    if (acc.energy != null) state.run.energy = Math.max(0, (state.run.energy || 0) - acc.energy);
    if (acc.once) inst.used = true;
  }

  // Подпись для UI: сколько и как часто можно нажать.
  function accessLabel(def) {
    const a = def.activation;
    if (!a) return "";
    const acc = a.access || {};
    if (acc.charges != null) return `${acc.charges} зар. за забег`;
    if (acc.act != null) return `${acc.act} за акт`;
    if (acc.energy != null) return `${acc.energy}⚡ энергии`;
    if (acc.once) return "один раз";
    return "";
  }

  function roman(level) {
    return ROMAN[level - 1] || String(level);
  }

  return {
    ownedDefs, sum, luck, rarityWeights, handSlotDef, attrPotionDef, rechargeDef,
    generateOffers, slotsFor, instanceOf, contextOf, canActivate, spendActivation,
    accessLabel, roman,
    REROLL_COST, HAND_SLOT_ID, ATTR_POTION_ID, RECHARGE_ID, ENERGY_CAP, CONTEXT_LABELS,
  };
})();
