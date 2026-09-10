// Dalatro — game state + action dispatch.
// EVERYTHING that mutates state goes through dispatch(). UI never edits state,
// content never edits state: State -> Action -> Engine -> Events/Effects -> State.
const Game = (function () {
  const FIGHTS_PER_WAVE = 4;
  const DISCARDS_PER_WAVE = 3;
  const WAVE_CLEAR_GOLD = 6;
  const BARRACKS_MAX = 2; // жизни забега: одна ошибка — полколоды, вторая — конец
  const EXILE_COST = 4;
  // XP героев (спек §7.2): бой +1, добивший бой +2; каждый уровень = +1 сила.
  const XP_PER_LEVEL = 5;
  const XP_LEVEL_CAP = 3;
  const TRAIN_COST = 5;
  const TRAIN_RANK_MAX = 12;
  const DECK_MIN = 8;

  function createInitialState(seedCode) {
    return {
      seedCode: seedCode || "",
      phase: "title",
      run: { act: 1, waveIndex: 0, barracks: 2, gold: 4, momentum: 0, ranks: {}, campBoon: false, rank: 1, heroUses: {}, comboUses: {}, curses: [], pendingCurse: null, inflationBuys: 0, archetype: null, freeRerollUsed: false, pendingShopPrice: null, pendingItemRarity: null, pendingExtraRecruit: 0, pendingRoute: null, shopPriceMult: 1, waveHandBonus: 0, upgrades: [], skipNextBattle: false, handSlots: 0, attrCharges: 0, heroAttrs: {}, heroXp: {}, shopRerolls: 0, deathsCount: 0, startedAt: 0, shopBuys: 0, loyaltyUsed: false, brokeUsed: false, afterBoss: false, failedLastWave: false, winCount: 0, upgradePurchases: 0, pendingHandBonus: 0, debtGold: 0, sinDmg: 0, sinDiscards: 0, pawnBonus: 0, exiledHeroes: [], extraLife: false, lifePenalty: 1, routeInflation: false, shopSlotsDelta: 0, upgradeSlotsDelta: 0 },
      player: { deckUids: [], handUids: [], discardUids: [], items: [], fightsLeft: 0, discardsLeft: 0 },
      cards: {},
      combat: { wave: null, fightIndex: 0, selectedUids: [], outcome: null, lastResolution: null, scoring: null, minedUids: [], lastComboType: null, campTaken: false, forbiddenSlot: null, routeOptions: [] },
      shop: { offers: [], recruits: [] },
      log: [],
      stats: { totalDamage: 0, biggestHit: 0 },
      // Ядро скоринга: "classic" (покерные комбо) | "formation" (формации+связки+броня).
      rules: "classic",
      simulate: false,
    };
  }

  // Ранг героя с учётом тренировки в лаборатории колоды, усталости и охоты
  // на героя (ранги Легенда/Титан). Это ЭФФЕКТИВНАЯ сила — она и в бою, и на карте.
  // Эффективный атрибут героя: «Зелье атрибута» меняет его навсегда в рамках
  // забега (флеши, связки формаций и условия способностей читают через это).
  function heroAttr(state, heroId) {
    const override = state.run.heroAttrs && state.run.heroAttrs[heroId];
    return override || Content.heroes.byId[heroId].attr;
  }

  // Уровень героя по опыту (0..3), +1 сила за уровень.
  function heroLevel(state, heroId) {
    const xp = (state.run.heroXp && state.run.heroXp[heroId]) || 0;
    return Math.min(XP_LEVEL_CAP, Math.floor(xp / XP_PER_LEVEL));
  }

  function rankOf(state, heroId) {
    const overrides = state.run.ranks || {};
    const base = overrides[heroId] != null ? overrides[heroId] : Content.heroes.byId[heroId].power;
    return Math.max(1, base - Ranks.heroPenalty(state, heroId) + heroLevel(state, heroId));
  }

  // Перк стартового архетипа (run.archetype), null для «Стандарта»/старых сейвов.
  function archPerk(state) {
    const a = state.run.archetype && Content.archetypes.byId[state.run.archetype];
    return a ? a.perk : null;
  }

  // ТП-сбросы за волну: правила лиги + перк «Контроль» (+1 в акте 1).
  function discardsPerWave(state) {
    const base = Ranks.discardsPerWave(state) + Upgrades.sum(state, "discardsBonus") + (state.run.sinDiscards || 0);
    return archPerk(state) === "tp1" && (state.run.act || 1) === 1 ? base + 1 : base;
  }

  // Колода старта: гарантированное трио архетипа + 9 карт из тематического пула
  // (детерминированный ролл по сиду). «Стандарт» — прежняя стартовая двенадцатка.
  function starterDeckIds(starterId, rng) {
    const a = Content.archetypes.byId[starterId];
    if (!a || !a.guaranteed.length) return Content.heroes.startingIds;
    const pool = a.fill.slice();
    const picks = [];
    while (picks.length < 9 && pool.length) {
      picks.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]);
    }
    return a.guaranteed.concat(picks);
  }

  // Обезоруживание: проклятие элитки режет слоты до 4 (BKB снимает).
  function maxSlots(state) {
    const wave = state.combat.wave;
    // Маршрут «Архитектор»/«Одинокий волк»/«Заблокированная клетка».
    if (wave && wave.maxSlotsOverride) return Math.min(wave.maxSlotsOverride, Combat.MAX_SLOTS);
    if (wave && wave.blockedSlot) return Math.min(wave.blockedSlot - 1, Combat.MAX_SLOTS);
    if (wave && (wave.modifiers || []).some((m) => m.id === "disarm") && !state.player.items.includes("bkb")) {
      return 4;
    }
    return Combat.MAX_SLOTS;
  }

  // Лимит предметов (спек §6.2): 6 всего всегда; класс-лимиты 2/2/2 — только
  // с ранга Титан (мод capClass), чтобы сложность докручивала правило.
  const ITEM_CAPACITY = { total: 6, perClass: { off: 2, def: 2, util: 2 } };

  function itemCapacity(state) {
    if (!Ranks.has(state, "capClass")) return { total: ITEM_CAPACITY.total, perClass: null };
    return { total: ITEM_CAPACITY.total, perClass: { ...ITEM_CAPACITY.perClass } };
  }

  function classFull(state, cap, slotClass) {
    return !!cap.perClass &&
      state.player.items.filter((id) => Content.items.byId[id].slotClass === slotClass).length >= cap.perClass[slotClass];
  }

  // Причина, по которой предмет нельзя купить (null — можно): для UI лавки.
  function itemBlockedReason(state, itemId) {
    const item = Content.items.byId[itemId];
    if (!item || state.player.items.includes(itemId)) return "owned";
    const cap = itemCapacity(state);
    if (state.player.items.length >= cap.total) return "full";
    if (classFull(state, cap, item.slotClass)) return "class";
    return null;
  }

  function log(state, text) {
    state.log.push(text);
    if (state.log.length > 300) state.log.shift();
  }

  function setupWave(state, waveIndex, routeOpt) {
    const def = Content.waves.byId[Content.waves.order[waveIndex]];
    // Параметры маршрута (фаза E): примитивы развилки поверх базовой волны.
    const route = routeOpt ? Content.routes.byId[routeOpt.id] : null;
    const elite = !!(route && route.curse);
    let hp = Math.round(def.hp * Ranks.waveHpMult(state, waveIndex) * (route && route.hp ? route.hp : 1) * ((routeOpt && routeOpt.hpMultRoll) || 1));
    if (route && route.hpPerItem) hp += route.hpPerItem * state.player.items.length;
    state.run.act = def.act || (Math.floor(waveIndex / 5) + 1);
    state.combat.wave = {
      towerId: def.id,
      name: def.name,
      emoji: def.emoji,
      isBoss: !!def.isBoss,
      miniBoss: !!def.miniBoss,
      elite,
      routeName: route ? route.name : null,
      hp,
      maxHp: hp,
      rewardMult: (route && route.reward ? route.reward : 1) * (state.run.lifePenalty || 1),
      powerBonus: (route && route.power ? route.power : 0)
        + (route && route.powerPerGold ? Math.floor((state.run.gold || 0) * route.powerPerGold) : 0)
        + ((routeOpt && routeOpt.goldPower) || 0),
      defenseMult: route && route.defense ? route.defense : 1,
      hpPerItem: route && route.hpPerItem ? route.hpPerItem : 0,
      defensePerItem: route && route.defensePerItem ? route.defensePerItem : 0,
      maxSlotsOverride: route && route.maxSlots ? route.maxSlots : null,
      handShape: route && route.handShape ? route.handShape : null,
      twinsBonus: route && route.twinsBonus ? route.twinsBonus : 0,
      noRepeat: !!(route && route.noRepeat),
      wildcardCopy: !!(route && route.wildcardCopy),
      randomCardMult: !!(route && route.randomCardMult),
      banAttrs: (routeOpt && routeOpt.banAttrs) || null,
      bannedHeroId: (routeOpt && routeOpt.bannedHeroId) || null,
      goldenSlot: (routeOpt && routeOpt.goldenSlot) || null,
      blockedSlot: (routeOpt && routeOpt.blockedSlot) || null,
      heroAscend: !!(route && route.heroAscend),
      burnUnused: !!(route && route.burnUnused),
      floatingHands: !!(route && route.floatingHands),
      mercyWave: !!(route && route.mercyWave),
      echoFirst: !!(route && route.echoFirst),
      minFights: route && route.minFights ? route.minFights : 0,
      fightsTotal: 0, // заполнится ниже после fightsLeft
      lastFightHeroes: [],
      modifiers: (def.modifiers || []).map((m) => ({ id: m.id }))
        .concat(elite && routeOpt.curse ? [{ id: routeOpt.curse }] : [])
        .concat((route && route.mods) ? route.mods.map((id) => ({ id })) : []),
      enemyItems: [],
      aegisUsed: false,
      enraged: false,
      regenTotal: 0,
    };
    // Папочка (ранг XIV): Трон здоровается лично.
    if (Ranks.rankOf(state).papochka && def.isBoss && waveIndex >= Content.waves.order.length - 1) {
      state.combat.wave.name = "ПАПОЧКА";
      state.combat.wave.emoji = "👨";
    }
    // Мутации башен (Божество+): случайные способности волны, детерминированные сидом.
    const mutations = Ranks.rollMutations(Ranks.mutationsPerWave(state));
    for (const id of mutations) state.combat.wave.modifiers.push({ id, rolled: true });
    // Аномалия/Папочка-маршрут: маршрут докидывает свои случайные правила.
    if (route && route.modsRandom) {
      for (const id of Ranks.rollMutations(route.modsRandom)) state.combat.wave.modifiers.push({ id, rolled: true });
    }
    // Нестабильная позиция (Властелин+): один слот волны с −40% силы.
    state.combat.forbiddenSlot = Ranks.has(state, "unstable") ? Rng.current().int(1, 5) : null;
    state.combat.fightIndex = 0;
    state.combat.selectedUids = [];
    state.combat.outcome = null;
    state.combat.lastComboType = null;
    state.combat.campTaken = false;
    state.run.campBoon = false;
    state.combat.route = null;
    // Примитивы на волну: рука и тимфайты с дельтой маршрута.
    state.run.waveHandBonus = (route && route.hand ? route.hand : 0) + (state.run.pendingHandBonus || 0);
    state.run.pendingHandBonus = 0;
    state.player.fightsLeft = Ranks.fightsPerWave(state) + (route && route.fights ? route.fights : 0);
    state.combat.wave.fightsTotal = state.player.fightsLeft;
    state.player.discardsLeft = discardsPerWave(state);
    DeckSys.resetAll(state, Rng.current());
    DeckSys.draw(state, Rng.current());
    assignMines(state);
    const routeNote = route && route.hp ? ` (${route.name}: HP ×${route.hp})` : "";
    log(state, elite
      ? `— Элитная волна (акт ${state.run.act}): ${def.name} — ${hp} HP (${Content.modifiers.byId[routeOpt.curse].name}!)`
      : `— Акт ${state.run.act}, волна ${waveIndex % 5 + 1}: ${def.name} — ${def.hp} HP${routeNote}`);
    if (mutations.length) log(state, `Мутации башни: ${mutations.map((id) => Content.modifiers.byId[id].name).join(", ")}`);
    if (state.combat.forbiddenSlot) log(state, `Нестабильная позиция: слот ${state.combat.forbiddenSlot} даёт −40% силы`);
  }

  // Цена предмета: ранговые эффекты (голод −20%, инфляция +1G за покупку)
  // и множитель маршрута (Осадная/Жадность/Распродажа).
  function itemCost(state, itemId) {
    const item = Content.items.byId[itemId];
    let cost = Ranks.hasCurse(state, "hunger") ? Math.floor(item.cost * 0.8) : item.cost;
    if (Ranks.has(state, "inflation")) cost += state.run.inflationBuys || 0;
    let mult = state.run.shopPriceMult != null ? state.run.shopPriceMult : 1;
    // Торг: помеченный оффер со скидкой.
    const offer = (state.shop.offers || []).find((o) => o.id === itemId);
    if (offer && offer.sale) mult *= 1 - offer.sale / 100;
    cost = Math.round(cost * mult);
    if (offer && offer.sale >= 100) return 0; // уценка хлама: бесплатно
    if (mult === 0) return 0; // банкротство: вся лавка бесплатна
    // Инфляция-маршрут (#27): первая покупка дешевле, остальные дорожают.
    if (state.run.routeInflation) cost += (state.run.shopBuys || 0) - 1;
    cost = Math.max(1, cost);
    // Налоговый вычет: первая покупка после босса акта.
    if (state.run.afterBoss && Upgrades.sum(state, "postBossDiscount")) cost = Math.max(1, cost - 1);
    // Лояльность: после трёх покупок следующий товар дешевле (раз за визит).
    if ((state.run.shopBuys || 0) >= 3 && !state.run.loyaltyUsed && Upgrades.sum(state, "shopLoyalty")) cost = Math.max(1, cost - 1);
    return cost;
  }

  // Цена реролла: правила лиги + улучшение «Сбережения» при 15+ золоте.
  function rerollCost(state) {
    let cost = Ranks.rerollCost(state);
    const rich = Upgrades.sum(state, "rerollRich");
    if (rich && state.run.gold > 15) cost = Math.max(1, cost - rich);
    const rerolls = state.run.shopRerolls || 0;
    const first = Upgrades.sum(state, "firstRerollOff");
    if (first && rerolls === 0) cost = Math.max(1, cost - first);
    const third = Upgrades.sum(state, "thirdRerollOff");
    if (third && rerolls > 0 && rerolls % 3 === 2) cost = Math.max(1, cost - third);
    return cost;
  }

  // Таверна: 2 рекрута из ещё не нанятых героев ростера.
  function pickRecruits(state) {
    const owned = new Set([...state.player.handUids, ...state.player.deckUids, ...state.player.discardUids].map((uid) => state.cards[uid].heroId));
    const pool = Content.heroes.list.filter((h) => !h.inDeck && !owned.has(h.id)).map((h) => h.id);
    const rng = Rng.current();
    const recruits = [];
    const copy = pool.slice();
    while (recruits.length < 2 && copy.length) {
      recruits.push(copy.splice(Math.floor(rng.next() * copy.length), 1)[0]);
    }
    return recruits;
  }

  function recruitPrice(heroId) {
    return 4 + Math.floor(Content.heroes.byId[heroId].power / 2);
  }

  function returnRapierIfHeld(state) {
    if (state.combat.wave.enemyItems.includes("rapier")) {
      state.combat.wave.enemyItems = state.combat.wave.enemyItems.filter((id) => id !== "rapier");
      state.player.items.push("rapier");
      log(state, "Divine Rapier возвращается к тебе!");
    }
  }

  // Мины Techies: на каждый бой минируются 2 случайные карты руки — их нельзя
  // разыграть. Sentry Ward / BKB обезвреживают. Перевыбирается на каждый бой
  // (после добора руки), сбрасывается, когда волна решена.
  function assignMines(state) {
    const wave = state.combat.wave;
    const hasMines = !!wave && (wave.modifiers || []).some((m) => m.id === "mines");
    const disarmed = state.player.items.includes("sentry") || state.player.items.includes("bkb");
    if (!hasMines || disarmed || state.combat.outcome || state.simulate) {
      state.combat.minedUids = [];
      return;
    }
    const pool = state.player.handUids.slice();
    const mines = [];
    while (mines.length < 2 && pool.length) {
      mines.push(pool.splice(Math.floor(Rng.current().next() * pool.length), 1)[0]);
    }
    state.combat.minedUids = mines;
  }

  // Ролл развилки: normal + лагерь (если ещё не зачищен) + 2 спецварианта по
  // весам с фильтрами акт/ранг. Проклятие элитки кидается здесь же.
  function rollRouteOptions(state, nextIndex) {
    const nextDef = Content.waves.byId[Content.waves.order[nextIndex]];
    const act = nextDef.act || (Math.floor(nextIndex / 5) + 1);
    const options = [{ id: "normal" }];
    // Боссов и мини-боссов («БОСС АКТА») лагерем не пропускаем — привал только
    // перед обычными волнами.
    if (!state.combat.campTaken && !nextDef.isBoss && !nextDef.miniBoss) options.push({ id: "camp" });
    const rng = Rng.current();
    const rank = state.run.rank || 1;
    const pool = Content.routes.list.filter((r) => r.weight > 0 && (r.minAct || 1) <= act && (r.minRank || 1) <= rank);
    const specials = [];
    let guard = 24;
    while (specials.length < ROUTE_SPECIAL_SLOTS && guard-- > 0) {
      const avail = pool.filter((r) => !specials.some((p) => p.id === r.id));
      if (!avail.length) break;
      const total = avail.reduce((a, r) => a + r.weight, 0);
      let roll = rng.next() * total;
      let chosen = avail[avail.length - 1];
      for (const r of avail) {
        roll -= r.weight;
        if (roll < 0) { chosen = r; break; }
      }
      const opt = { id: chosen.id };
      if (chosen.curse) opt.curse = Content.curses[Math.floor(rng.next() * Content.curses.length)];
      specials.push(opt);
    }
    return options.concat(specials);
  }

  function dispatch(state, action) {
    const s = state;
    switch (action.type) {
      case "START_RUN": {
        const code = Rng.normalizeSeedCode(action.seedCode) || Rng.randomSeedCode();
        const fresh = createInitialState(code);
        fresh.rules = action.rules === "formation" ? "formation" : "classic";
        fresh.run.rank = Math.min(14, Math.max(1, action.rank || 1));
        const starter = Content.archetypes.byId[action.starterId] || Content.archetypes.byId.standard;
        fresh.run.archetype = starter.id;
        fresh.phase = "wave";
        fresh.run.startedAt = Date.now();
        Rng.setActive(Rng.create(code));
        DeckSys.createFromHeroes(fresh, starterDeckIds(starter.id, Rng.current()));
        // Перк «Штурм»: +1G начального золота.
        if (starter.perk === "gold1") fresh.run.gold += 1;
        setupWave(fresh, 0);
        log(fresh, `Забег начат. Seed: DALATRO-${code}${fresh.rules === "formation" ? " · режим формаций" : ""} · ранг «${Ranks.rankOf(fresh).name}»${starter.id !== "standard" ? ` · отряд «${starter.name}»` : ""}`);
        return fresh;
      }

      case "SELECT_CARD": {
        if (s.phase !== "wave" || s.combat.outcome) return s;
        const uid = action.uid;
        const idx = s.combat.selectedUids.indexOf(uid);
        if (idx !== -1) {
          s.combat.selectedUids.splice(idx, 1);
        } else if (
          s.combat.selectedUids.length < maxSlots(s) &&
          s.player.handUids.includes(uid) &&
          !(s.combat.minedUids || []).includes(uid)
        ) {
          // Маршрутные запреты: атрибут, персона, повтор прошлой пачки.
          const wave = s.combat.wave;
          const heroId = s.cards[uid].heroId;
          if (wave && wave.banAttrs && wave.banAttrs.includes(Game.heroAttr(s, heroId))) return s;
          if (wave && wave.bannedHeroId && wave.bannedHeroId === heroId) return s;
          if (wave && wave.noRepeat && (wave.lastFightHeroes || []).includes(heroId)) return s;
          s.combat.selectedUids.push(uid);
        }
        return s;
      }

      case "CONFIRM_FIGHT": {
        if (s.phase !== "wave" || s.combat.outcome || s.player.fightsLeft <= 0) return s;
        if (!s.combat.selectedUids.length || s.combat.selectedUids.length > maxSlots(s)) return s;
        const resolution = Combat.resolveFight(s);
        log(s, `Бой #${s.combat.fightIndex}: ${resolution.combo.name} → ${resolution.damage} урона${(resolution.crits || []).length ? ` · КРИТ! (${resolution.crits.join(", ")})` : ""}`);
        for (const st of resolution.steps) if (st.icon === "🌱") log(s, st.label);
        if (resolution.killed) {
          s.combat.outcome = "cleared";
          s.run.momentum = Math.min((s.run.momentum || 0) + 1, Combat.MOMENTUM_CAP);
          s.combat.campTaken = false;
          const baseGold = s.combat.wave.gold || WAVE_CLEAR_GOLD;
          const rewardMult = s.combat.wave.rewardMult || 1;
          let clearGold = baseGold * rewardMult;
          clearGold *= Ranks.goldMult(s) * Ranks.curseGoldMult(s);
          clearGold = Math.round(clearGold);
          const tax = Ranks.taxPerWave(s);
          if (tax) clearGold = Math.max(0, clearGold - tax);
          // Улучшения лавки: плоское золото и шанс «Мелочи».
          s.run.failedLastWave = false;
          // Бонус за скорость: каждый неиспользованный тимфайт — +1 золото.
          const leftoverFights = s.player.fightsLeft;
          if (leftoverFights > 0) {
            clearGold += leftoverFights;
            log(s, `Бонус скорости: +${leftoverFights}G за ${leftoverFights} неиспользованн${leftoverFights === 1 ? "ый тимфайт" : "ых тимфайта"}`);
          }
          const streakGold = Upgrades.sum(s, "streakGold");
          if (streakGold && (s.run.momentum || 0) >= 2) clearGold = Math.round(clearGold * (1 + streakGold / 100));
          s.run.winCount = (s.run.winCount || 0) + 1;
          const milestone = Upgrades.sum(s, "winMilestoneGold");
          if (milestone && s.run.winCount % 5 === 0) {
            clearGold += milestone;
            log(s, `Боевой опыт: ${s.run.winCount}-я зачистка +${milestone} золота`);
          }
          const goldFlat = Upgrades.sum(s, "goldOnClear");
          if (goldFlat) clearGold += goldFlat;
          // Долг/лихва: возврат после зачистки.
          if (s.run.debtGold) {
            const pay = Math.min(s.run.debtGold, clearGold);
            clearGold -= pay;
            s.run.debtGold -= pay;
            log(s, `Долг выплачен: −${pay}G${s.run.debtGold ? ` (осталось ${s.run.debtGold}G)` : ""}`);
          }
          // Время (#94): победа слишком быстро — награда режется.
          const waveRef = s.combat.wave;
          if (waveRef.minFights) {
            const used = waveRef.fightsTotal - s.player.fightsLeft;
            if (used < waveRef.minFights) {
              clearGold = Math.round(clearGold * 0.5);
              log(s, `Время: победа за ${used} бой — награда вполовину`);
            }
          }
          const goldChance = Upgrades.sum(s, "goldChance");
          let luckyGold = 0;
          if (goldChance && Rng.current().chance(goldChance / 100)) {
            clearGold += 1;
            luckyGold = 1;
          }
          s.run.gold += clearGold;
          const drawChance = Upgrades.sum(s, "extraDrawChance");
          if (drawChance && Rng.current().chance(drawChance / 100)) {
            s.run.pendingHandBonus = (s.run.pendingHandBonus || 0) + 1;
            log(s, "Быстрый добор: следующая волна с +1 картой в руке");
          }
          log(s, `Волна зачищена! +${clearGold} золота${rewardMult !== 1 ? ` (награда маршрута ×${rewardMult})` : ""}${tax ? ` (налог −${tax}G)` : ""}${goldFlat ? ` (улучшение +${goldFlat}G)` : ""}${luckyGold ? " (Мелочь +1G)" : ""}. Импульс: ${s.run.momentum} волн подряд`);
          returnRapierIfHeld(s);
          if (s.combat.wave.isBoss) {
            if (s.run.waveIndex >= Content.waves.order.length - 1) {
              s.phase = "victory";
              log(s, "ТРОН ПАЛ. ТИ ВЗЯТ!");
            } else {
              // Акт пройден: премия за переход — золото и восстановление казармы.
              s.run.gold += 10;
              s.run.barracks = Math.min(BARRACKS_MAX, s.run.barracks + 1);
              const perAct = Upgrades.sum(s, "goldPerAct");
              if (perAct) s.run.gold += perAct;
              s.run.afterBoss = true;
              log(s, `АКТ ${s.run.act} ПРОЙДЕН! +10 золота${perAct ? ` (+${perAct} за кошелёк)` : ""}, +1 казарма (восстановление)`);
              // Лига Титанов: перед новым актом игрок выбирает проклятие забега.
              if (Ranks.has(s, "curseChoice")) {
                s.run.pendingCurse = Ranks.rollCurseChoices();
                log(s, "Лига Титанов: выбери проклятие забега — оно останется до конца.");
              }
            }
          }
        } else if (s.player.fightsLeft <= 0) {
          s.combat.outcome = "failed";
        } else {
          // Горящая карта (#44): волна не зачищена сразу — карта руки сгорает.
          if (s.combat.wave.burnUnused && s.player.handUids.length) {
            const uid = s.player.handUids[Math.floor(Rng.current().next() * s.player.handUids.length)];
            const heroId = s.cards[uid].heroId;
            delete s.cards[uid];
            s.player.handUids.splice(s.player.handUids.indexOf(uid), 1);
            s.combat.selectedUids = s.combat.selectedUids.filter((u) => u !== uid);
            log(s, `Горящая карта: ${Content.heroes.byId[heroId].name} сгорела дотла`);
          }
          assignMines(s); // рука добралась — свежие мины на следующий бой
        }
        return s;
      }

      case "DISCARD": {
        if (s.phase !== "wave" || s.combat.outcome || s.player.discardsLeft <= 0) return s;
        const uids = action.uids.filter((uid) => s.player.handUids.includes(uid));
        if (!uids.length) return s;
        for (const uid of uids) {
          const card = s.cards[uid];
          const hero = Content.heroes.byId[card.heroId];
          const fakeCard = { uid, heroId: card.heroId, power: hero.power, attr: hero.attr, illusion: false, slotIndex: 0 };
          const discardCtx = { returnToHand: false };
          const fakeResolution = { steps: [] };
          Triggers.runEvent(s, null, "ON_DISCARD", { playedCards: [fakeCard], onlyKinds: ["hero"], discardCtx }, fakeResolution);
          fakeResolution.steps.forEach((st) => log(s, st.label));
          if (!discardCtx.returnToHand) {
            DeckSys.moveToDiscard(s, [uid]);
          }
        }
        s.combat.selectedUids = s.combat.selectedUids.filter((uid) => !uids.includes(uid));
        s.player.discardsLeft -= 1;
        DeckSys.draw(s, Rng.current());
        assignMines(s);
        return s;
      }

      case "ENTER_SHOP": {
        if (s.phase !== "wave" || s.combat.outcome !== "cleared" || s.run.pendingCurse) return s;
        s.phase = "shop";
        s.run.inflationBuys = 0;
        s.run.freeRerollUsed = false;
        // Гарантии маршрута (Чёрный рынок/элитка — редкость; Таверна — рекрут)
        // и ценовой множитель (Осадная/Жадность/Распродажа) — одноразовые.
        const guaranteeRarity = s.run.pendingItemRarity || null;
        s.run.pendingItemRarity = null;
        s.run.pendingExtraRecruit = 0;
        s.run.shopPriceMult = s.run.pendingShopPrice != null ? s.run.pendingShopPrice : 1;
        s.run.pendingShopPrice = null;
        s.run.routeInflation = s.run.routeInflation || false;
        const slots = Math.max(1, Economy.OFFER_SLOTS + (s.run.shopSlotsDelta || 0));
        if (s.run.nextShopOffers && s.run.nextShopOffers.length) {
          s.shop.offers = s.run.nextShopOffers;
          s.run.nextShopOffers = null;
        } else {
          s.shop.offers = Economy.generateOffers(s, slots, [], guaranteeRarity);
        }
        // Уценка хлама (#33): до N обычных товаров бесплатно.
        const freeCommons = s.run.pendingFreeCommons || 0;
        if (freeCommons) {
          let left = freeCommons;
          for (const o of s.shop.offers) {
            if (left <= 0) break;
            if (Content.items.byId[o.id].rarity === "common" && !o.sale) { o.sale = 100; left -= 1; }
          }
        }
        s.run.pendingFreeCommons = 0;
        s.shop.recruits = pickRecruits(s);
        s.shop.upgrades = Upgrades.generateOffers(s);
        s.run.shopRerolls = 0;
        s.run.shopBuys = 0;
        s.run.loyaltyUsed = false;
        s.run.brokeUsed = false;
        // Маленькая удача (#100): лавка может встретить золотом.
        const coinChance = Upgrades.sum(s, "shopCoinChance");
        if (coinChance && Rng.current().chance(coinChance / 100)) {
          s.run.gold += 2;
          log(s, "Маленькая удача: лавка подкинула +2 золота");
        }
        // Торг (#54): случайный товар со скидкой.
        const discountPct = Upgrades.sum(s, "itemDiscountPct");
        if (discountPct && s.shop.offers.length) {
          s.shop.offers[Math.floor(Rng.current().next() * s.shop.offers.length)].sale = discountPct;
        }
        // Тайный ящик (#65): лишний товар.
        const secret = Upgrades.sum(s, "secretSlotChance");
        if (secret && Rng.current().chance(secret / 100)) {
          s.shop.offers = s.shop.offers.concat(Economy.generateOffers(s, 1, s.shop.offers));
          log(s, "Тайный ящик: у торговца нашёлся лишний товар");
        }
        return s;
      }

      case "BUY_UPGRADE": {
        if (s.phase !== "shop") return s;
        const offerIdx = (s.shop.upgrades || []).findIndex((o) => o.id === action.upgradeId);
        if (offerIdx === -1) return s;
        // «Запасной слот» — виртуальный повторяемый апгрейд: уровень в run.handSlots.
        const isHandSlot = action.upgradeId === Upgrades.HAND_SLOT_ID;
        const isAttrPotion = action.upgradeId === Upgrades.ATTR_POTION_ID;
        const up = isHandSlot ? Upgrades.handSlotDef(s) : isAttrPotion ? Upgrades.attrPotionDef(s) : Content.upgrades.byId[action.upgradeId];
        if (!up) return s;
        if (!isHandSlot && !isAttrPotion && (s.run.upgrades || []).includes(up.id)) return s;
        let finalCost = up.cost;
        s.run.upgradePurchases = (s.run.upgradePurchases || 0) + 1;
        const amulet = Upgrades.sum(s, "upgradeLoyalty");
        if (amulet && s.run.upgradePurchases % 5 === 0) {
          finalCost = Math.max(1, finalCost - 1);
          log(s, "Старый амулет: пятая покупка улучшения дешевле");
        }
        if (s.run.gold < finalCost) return s;
        s.run.gold -= finalCost;
        if (isHandSlot) {
          s.run.handSlots = (s.run.handSlots || 0) + 1;
          log(s, `Запасной слот ×${s.run.handSlots}: рука больше на ${s.run.handSlots} (−${finalCost} золота)`);
        } else if (isAttrPotion) {
          s.run.attrCharges = (s.run.attrCharges || 0) + 1;
          log(s, `Зелье атрибута: +1 заряд смены атрибута (−${finalCost} золота). Потрать в лаборатории колоды.`);
        } else {
          s.run.upgrades = s.run.upgrades || [];
          s.run.upgrades.push(up.id);
          log(s, `Улучшение куплено: ${up.emoji} «${up.name}» (−${finalCost} золота)`);
        }
        s.shop.upgrades.splice(offerIdx, 1);
        // Купил — слот сразу заполняется новым случайным предложением.
        const refill = Upgrades.generateOffers(s, 1, s.shop.upgrades);
        if (refill.length) s.shop.upgrades.push(refill[0]);
        return s;
      }

      // Обновление предложений улучшений (фидбек): 1G.
      case "REROLL_UPGRADES": {
        if (s.phase !== "shop") return s;
        if (s.run.gold < Upgrades.REROLL_COST) return s;
        s.run.gold -= Upgrades.REROLL_COST;
        s.shop.upgrades = Upgrades.generateOffers(s);
        return s;
      }

      case "BUY_ITEM": {
        if (s.phase !== "shop") return s;
        const item = Content.items.byId[action.itemId];
        const offerIdx = s.shop.offers.findIndex((o) => o.id === action.itemId);
        if (!item || offerIdx === -1) return s;
        if (itemBlockedReason(s, action.itemId)) return s;
        const cost = itemCost(s, action.itemId);
        if (s.run.gold < cost) return s;
        s.run.gold -= cost;
        s.player.items.push(action.itemId);
        s.shop.offers.splice(offerIdx, 1);
        if (Ranks.has(s, "inflation")) s.run.inflationBuys += 1;
        s.run.shopBuys = (s.run.shopBuys || 0) + 1;
        if (s.run.afterBoss && Upgrades.sum(s, "postBossDiscount")) s.run.afterBoss = false;
        if ((s.run.shopBuys || 0) >= 3 && !s.run.loyaltyUsed && Upgrades.sum(s, "shopLoyalty")) s.run.loyaltyUsed = true;
        const refundChance = Upgrades.sum(s, "purchaseRefundChance");
        if (refundChance && Rng.current().chance(refundChance / 100)) {
          s.run.gold += 1;
          log(s, "Монетка: 1 золото вернулась после покупки");
        }
        if (s.run.gold === 0 && !s.run.brokeUsed && Upgrades.sum(s, "brokeBonus")) {
          s.run.brokeUsed = true;
          s.run.gold = 1;
          log(s, "Резервный фонд: кошелёк пуст — вам дадут 1 золото");
        }
        log(s, `Куплено: ${item.name} (−${cost} золота${cost !== item.cost ? `, база ${item.cost}` : ""})${s.player.items.length >= itemCapacity(s).total ? " · слоты предметов заполнены" : ""}`);
        return s;
      }

      case "LOCK_OFFER": {
        if (s.phase !== "shop") return s;
        const offer = s.shop.offers.find((o) => o.id === action.itemId);
        if (!offer) return s;
        offer.locked = !offer.locked;
        return s;
      }

      case "SELL_ITEM": {
        if (s.phase !== "shop") return s;
        const idx = s.player.items.indexOf(action.itemId);
        if (idx === -1) return s;
        const item = Content.items.byId[action.itemId];
        const value = Economy.sellValue(s, action.itemId);
        s.player.items.splice(idx, 1);
        s.run.gold += value;
        log(s, `Продано: ${item.name} (+${value} золота)`);
        return s;
      }

      case "REROLL_SHOP": {
        let cost = rerollCost(s);
        // Перк «Магия»: первый реролл каждой лавки бесплатен.
        const freeReroll = archPerk(s) === "freeroll1" && !s.run.freeRerollUsed;
        if (freeReroll) cost = 0;
        if (s.phase !== "shop" || s.run.gold < cost) return s;
        s.run.shopRerolls = (s.run.shopRerolls || 0) + 1;
        if (freeReroll) {
          s.run.freeRerollUsed = true;
          log(s, "Магия: первый реролл лавки бесплатен");
        } else {
          s.run.gold -= cost;
        }
        const locked = s.shop.offers.filter((o) => o.locked);
        s.shop.offers = Economy.generateOffers(s, Economy.OFFER_SLOTS, locked);
        s.shop.recruits = pickRecruits(s);
        return s;
      }

      // Лига Титанов: выбор проклятия забега после босса акта. Пока не выбрано —
      // лавка закрыта.
      case "CHOOSE_CURSE": {
        if (!s.run.pendingCurse || !s.run.pendingCurse.includes(action.curseId)) return s;
        s.run.curses.push(action.curseId);
        s.run.pendingCurse = null;
        const curse = Content.rankCurses.byId[action.curseId];
        log(s, `Проклятие забега: ${curse.emoji} «${curse.name}» — ${curse.desc}`);
        return s;
      }

      case "LEAVE_SHOP": {
        if (s.phase !== "shop") return s;
        s.run.shopPriceMult = 1; // ценовой множитель действует только на эту лавку
        // Лагерь: следующий бой реально пропускается (спек §2) — волна
        // пролистывается без награды и без импульса, лавки за неё нет.
        if (s.run.skipNextBattle) {
          s.run.skipNextBattle = false;
          const skipIndex = s.run.waveIndex + 1;
          const skipDef = Content.waves.byId[Content.waves.order[skipIndex]];
          if (skipDef && (skipDef.isBoss || skipDef.miniBoss)) {
            log(s, `Лагерь не может пропустить «${skipDef.name}» — придётся бить.`);
          } else if (skipDef) {
            log(s, `Лагерь: волна «${skipDef.name}» пропущена без боя.`);
            s.run.waveIndex = skipIndex;
            s.combat.routeOptions = [];
            const after = Content.waves.byId[Content.waves.order[skipIndex + 1]];
            if (after && !after.isBoss) {
              s.combat.routeOptions = rollRouteOptions(s, skipIndex + 1);
              s.phase = "route";
              return s;
            }
            if (after) {
              s.phase = "wave";
              s.run.waveIndex = skipIndex + 1;
              setupWave(s, skipIndex + 1, null);
              return s;
            }
            s.phase = "victory"; // пропущена последняя волна (защита, недостижимо)
            return s;
          }
        }
        const nextIndex = s.run.waveIndex + 1;
        const nextDef = Content.waves.byId[Content.waves.order[nextIndex]];
        if (!nextDef) return s;
        if (nextDef.isBoss) {
          // перед боссом развилки нет — только его башня
          s.phase = "wave";
          s.run.waveIndex = nextIndex;
          s.combat.routeOptions = [];
          setupWave(s, nextIndex, null);
          return s;
        }
        // Развилка: коревые пути + ролл спецвариантов по весам (сид-детерминизм).
        s.combat.routeOptions = rollRouteOptions(s, nextIndex);
        s.phase = "route";
        return s;
      }

      case "TAKE_ROUTE": {
        if (s.phase !== "route" || !s.combat.routeOptions.length) return s;
        const opt = s.combat.routeOptions.find((o) => o.id === action.kind);
        if (!opt) return s;
        const route = Content.routes.byId[opt.id];
        const nextIndex = s.run.waveIndex + 1;
        if (opt.id === "camp") {
          if (s.combat.campTaken) return s;
          const campTarget = Content.waves.byId[Content.waves.order[nextIndex]];
          if (campTarget && (campTarget.isBoss || campTarget.miniBoss)) return s;
          s.run.gold += 6;
          s.run.barracks = Math.min(BARRACKS_MAX, s.run.barracks + 1);
          s.run.campBoon = true;
          s.combat.campTaken = true;
          s.run.skipNextBattle = true; // после лавки следующая волна листается без боя
          s.combat.route = null;
          s.combat.routeOptions = [];
          s.phase = "shop";
          log(s, "Крип-лагерь зачищен без боя: +6 золота, привал (+1 казарма), бесплатное увольнение. Следующая волна будет пропущена.");
          return s;
        }
        // Немедленные эффекты маршрута.
        const rng = Rng.current();
        if (route.gold) {
          s.run.gold = Math.max(0, s.run.gold + route.gold);
          log(s, `${route.name}: ${route.gold > 0 ? "+" : ""}${route.gold} золота`);
        }
        if (route.gamble) {
          const won = rng.chance(route.gamble.chance);
          if (won) {
            s.run.gold += route.gamble.win;
            log(s, `${route.name}: повезло — +${route.gamble.win} золота!`);
          } else {
            log(s, `${route.name}: не повезло, пусто.`);
          }
        }
        if (route.gambleDice) {
          const roll = rng.int(1, 6);
          const win = route.gambleDice[roll - 1];
          s.run.gold += win;
          log(s, `${route.name}: кость показала ${roll} — +${win} золота`);
        }
        if (route.allin) {
          const stake = s.run.gold;
          if (stake > 0) {
            if (rng.chance(route.allin.chance)) {
              s.run.gold = Math.round(stake * route.allin.mult);
              log(s, `${route.name}: ва-банк сыграл! ${stake} → ${s.run.gold} золота`);
            } else {
              s.run.gold = 0;
              log(s, `${route.name}: всё поставленное сгорело (−${stake}G)`);
            }
          } else log(s, `${route.name}: ставить нечего`);
        }
        if (route.gambleThree) {
          const roll = rng.int(1, 3);
          if (roll === 1) { s.run.gold += 15; log(s, `${route.name}: дверь с золотом — +15G`); }
          else if (roll === 2) {
            const pool = Content.items.list.filter((i) => i.rarity === "rare" && !s.player.items.includes(i.id));
            if (pool.length && s.player.items.length < itemCapacity(s).total) {
              const item = pool[Math.floor(rng.next() * pool.length)];
              s.player.items.push(item.id);
              log(s, `${route.name}: дверь с предметом — ${item.name}!`);
            } else { s.run.gold += 15; log(s, `${route.name}: предмет не влез — компенсация +15G`); }
          } else log(s, `${route.name}: пустая дверь`);
        }
        if (route.altar) {
          const sacrifice = Math.min(10, s.run.gold);
          s.run.gold -= sacrifice;
          const roll = rng.int(1, 3);
          if (roll === 1) {
            const epics = Content.items.list.filter((i) => i.rarity === "epic" && !s.player.items.includes(i.id));
            if (epics.length && s.player.items.length < itemCapacity(s).total) {
              const item = epics[Math.floor(rng.next() * epics.length)];
              s.player.items.push(item.id);
              log(s, `${route.name}: алтарь принял ${sacrifice}G и отдал ${item.name}!`);
            } else { s.run.gold += sacrifice; log(s, `${route.name}: алтарю нечего дать — жертва возвращена`); }
          } else if (roll === 2) {
            routeOpt.goldPower = (routeOpt.goldPower || 0) + 25;
            log(s, `${route.name}: алтарь благословил отряд — +25 силы бою`);
          } else log(s, `${route.name}: алтарь промолчал (−${sacrifice}G)`);
        }
        if (route.loan) {
          s.run.gold += route.loan.gain;
          s.run.debtGold = (s.run.debtGold || 0) + route.loan.repay;
          log(s, `${route.name}: заём +${route.loan.gain}G — возврат ${route.loan.repay}G после следующей зачистки`);
        }
        if (route.powerPerGold) {
          routeOpt.goldPower = (routeOpt.goldPower || 0) + Math.floor((s.run.gold || 0) * route.powerPerGold);
          if (routeOpt.goldPower) log(s, `${route.name}: богатство куёт силу — +${routeOpt.goldPower} бою`);
        }
        if (route.goldAll) { s.run.gold = 0; log(s, `${route.name}: кошелёк опустошён до дна`); }
        if (route.momentumBonus) {
          s.run.momentum = Math.min(Combat.MOMENTUM_CAP, (s.run.momentum || 0) + route.momentumBonus);
          log(s, `${route.name}: импульс разогнан до ${s.run.momentum}`);
        }
        if (route.exchangeItem && s.player.items.length) {
          const giveIdx = Math.floor(rng.next() * s.player.items.length);
          const give = s.player.items[giveIdx];
          const sameRarity = Content.items.list.filter((i) => i.rarity === Content.items.byId[give].rarity && i.id !== give && !s.player.items.includes(i.id));
          if (sameRarity.length) {
            const get = sameRarity[Math.floor(rng.next() * sameRarity.length)];
            s.player.items[giveIdx] = get.id;
            log(s, `${route.name}: ${Content.items.byId[give].name} → ${get.name}`);
          } else log(s, `${route.name}: обменять не на что`);
        } else if (route.exchangeItem) log(s, `${route.name}: предметов нет — обмен отменён`);
        if (route.pawnBonus) { s.run.pawnBonus = route.pawnBonus; log(s, `${route.name}: ломбард прибавил +${route.pawnBonus}% к следующей продаже`); }
        if (route.dupeHero && s.player.handUids.length) {
          const uid = s.player.handUids[Math.floor(rng.next() * s.player.handUids.length)];
          const heroId = s.cards[uid].heroId;
          DeckSys.addHero(s, heroId);
          log(s, `${route.name}: ${Content.heroes.byId[heroId].name} теперь и в колоде дважды!`);
        }
        if (route.exileWeakestPower) {
          const all = [...s.player.deckUids, ...s.player.discardUids];
          if (all.length) {
            let weakest = all[0];
            for (const uid of all) if (Content.heroes.byId[s.cards[uid].heroId].power < Content.heroes.byId[s.cards[weakest].heroId].power) weakest = uid;
            const heroId = s.cards[weakest].heroId;
            delete s.cards[weakest];
            s.player.deckUids = s.player.deckUids.filter((u) => u !== weakest);
            s.player.discardUids = s.player.discardUids.filter((u) => u !== weakest);
            routeOpt.goldPower = (routeOpt.goldPower || 0) + route.exileWeakestPower;
            log(s, `${route.name}: ${Content.heroes.byId[heroId].name} ушёл — +${route.exileWeakestPower} силы бою`);
          } else log(s, `${route.name}: жертвовать некем`);
        }
        if (route.returnHero && (s.run.exiledHeroes || []).length) {
          const back = s.run.exiledHeroes.pop();
          DeckSys.addHero(s, back);
          log(s, `${route.name}: ${Content.heroes.byId[back].name} вернулся в колоду!`);
        } else if (route.returnHero) log(s, `${route.name}: изгнанных героев нет`);
        if (route.sin) {
          s.run.sinDmg = (s.run.sinDmg || 0) + route.sin.dmg;
          s.run.sinDiscards = (s.run.sinDiscards || 0) + route.sin.discards;
          log(s, `${route.name}: грех принят — +${route.sin.dmg}% урона, ${route.sin.discards} ТП-сброс за волну, навсегда`);
        }
        if (route.routeUndo) s.run.routeUndo = true;
        // Роллы для волны: запреты, клетки, случайный HP, охотник на героя.
        if (route.banAttrs) {
          const attrs = ["str", "agi", "int"].slice();
          opt.banAttrs = [];
          for (let i = 0; i < route.banAttrs; i++) opt.banAttrs.push(attrs.splice(Math.floor(rng.next() * attrs.length), 1)[0]);
          log(s, `${route.name}: запрещён атрибут ${opt.banAttrs.map((a) => Content.attrNames[a]).join(" и ")}`);
        }
        if (route.bannedHero) {
          const fav = Ranks.mostUsedHero(s);
          if (fav) { opt.bannedHeroId = fav; log(s, `${route.name}: ${Content.heroes.byId[fav].name} отдыхает этот бой`); }
        }
        if (route.goldenSlot) opt.goldenSlot = rng.int(1, 5);
        if (route.blockedSlot) opt.blockedSlot = rng.int(2, 5);
        if (route.randomHp) routeOpt.hpMultRoll = route.randomHp[0] + rng.next() * (route.randomHp[1] - route.randomHp[0]);
        if (route.handSlots) s.run.handSlots = (s.run.handSlots || 0) + route.handSlots;
        if (route.debtGold) s.run.debtGold = (s.run.debtGold || 0) + route.debtGold;
        if (route.secondLife) { s.run.extraLife = true; s.run.lifePenalty = 0.75; log(s, `${route.name}: вторая жизнь готова. Награды забега −25%`); }
        if (route.scout) {
          const ahead = [1, 2, 3].map((k) => Content.waves.byId[Content.waves.order[nextIndex + k]]).filter(Boolean);
          log(s, `${route.name}: дальше — ${ahead.map((d) => `${d.name} (${d.hp} HP)`).join(" → ")}`);
        }
        if (route.scanner) {
          const def = Content.towerDefense.byId[Content.waves.order[nextIndex]];
          const parts = [];
          if (def && def.armor) parts.push(`броня ${def.armor}`);
          if (def && def.mr) parts.push(`сопротивление ${Math.round(def.mr * 100)}%`);
          log(s, `${route.name}: ${parts.length ? parts.join(", ") : "у башни нет защиты"}`);
        }
        if (route.shopPeek) {
          s.run.nextShopOffers = Economy.generateOffers(s, Economy.OFFER_SLOTS);
          log(s, `${route.name}: товары следующей лавки подсмотрены (${s.run.nextShopOffers.map((o) => Content.items.byId[o.id].name).join(", ")})`);
        }
        if (route.shopInflation) s.run.routeInflation = true;
        if (route.shopSlots) s.run.shopSlotsDelta = (s.run.shopSlotsDelta || 0) + route.shopSlots;
        if (route.upgradeSlots) s.run.upgradeSlotsDelta = (s.run.upgradeSlotsDelta || 0) + route.upgradeSlots;
        // Одноразовые гарантии следующей лавки.
        s.run.pendingShopPrice = route.shopPrice !== undefined ? route.shopPrice : null;
        s.run.pendingItemRarity = route.itemRarity || null;
        s.run.pendingExtraRecruit = route.extraRecruit || 0;
        s.run.pendingRecruitDiscount = route.recruitDiscount || null;
        s.run.pendingFreeCommons = route.freeCommons || 0;
        s.combat.routeOptions = [];
        s.phase = "wave";
        s.run.waveIndex = nextIndex;
        setupWave(s, nextIndex, opt);
        return s;
      }

      case "BUY_RECRUIT": {
        if (s.phase !== "shop") return s;
        const heroId = action.heroId;
        if (!s.shop.recruits || !s.shop.recruits.includes(heroId)) return s;
        const price = recruitPrice(heroId);
        if (s.run.gold < price) return s;
        s.run.gold -= price;
        s.shop.recruits = s.shop.recruits.filter((id) => id !== heroId);
        DeckSys.addHero(s, heroId);
        const start_xp = Upgrades.sum(s, "xpStartBonus");
        if (start_xp) {
          s.run.heroXp = s.run.heroXp || {};
          s.run.heroXp[heroId] = (s.run.heroXp[heroId] || 0) + start_xp;
          log(s, `Тренировочный зал: ${Content.heroes.byId[heroId].name} начинает с ${start_xp} опыта`);
        }
        log(s, `${Content.heroes.byId[heroId].name} нанят в таверне (−${price} золота)`);
        return s;
      }

      case "EXILE_HERO": {
        if (s.phase !== "shop") return s;
        const heroId = action.heroId;
        const free = !!s.run.campBoon;
        if (!free && s.run.gold < EXILE_COST) return s;
        const total = s.player.handUids.length + s.player.deckUids.length + s.player.discardUids.length;
        if (total <= DECK_MIN) return s;
        const piles = [s.player.handUids, s.player.deckUids, s.player.discardUids];
        let removed = false;
        for (const pile of piles) {
          const idx = pile.findIndex((uid) => s.cards[uid].heroId === heroId);
          if (idx !== -1) {
            delete s.cards[pile[idx]];
            pile.splice(idx, 1);
            removed = true;
            break;
          }
        }
        if (!removed) return s;
        s.run.exiledHeroes = s.run.exiledHeroes || [];
        s.run.exiledHeroes.push(heroId);
        s.combat.selectedUids = s.combat.selectedUids.filter((uid) => s.cards[uid]);
        if (!free) s.run.gold -= EXILE_COST;
        s.run.campBoon = false;
        log(s, `${Content.heroes.byId[heroId].name} покинул колоду${free ? " (бесплатно — привал крип-лагеря)" : ` (−${EXILE_COST} золота)`}`);
        return s;
      }

      case "TRAIN_HERO": {
        if (s.phase !== "shop") return s;
        const heroId = action.heroId;
        const owned = [...s.player.handUids, ...s.player.deckUids, ...s.player.discardUids]
          .some((uid) => s.cards[uid].heroId === heroId);
        if (!owned || s.run.gold < TRAIN_COST) return s;
        const current = rankOf(s, heroId);
        if (current >= TRAIN_RANK_MAX) return s;
        s.run.gold -= TRAIN_COST;
        s.run.ranks = s.run.ranks || {};
        s.run.ranks[heroId] = current + 1;
        log(s, `Тренировка: ${Content.heroes.byId[heroId].name} → ранг ${current + 1}`);
        return s;
      }

      // Зелье атрибута: трата заряда на смену атрибута героя.
      case "CHANGE_ATTR": {
        if (!s.run.attrCharges) return s;
        const heroId = action.heroId;
        const attr = action.attr;
        if (!["str", "agi", "int", "uni"].includes(attr)) return s;
        const owned = [...s.player.handUids, ...s.player.deckUids, ...s.player.discardUids]
          .some((uid) => s.cards[uid].heroId === heroId);
        if (!owned || Game.heroAttr(s, heroId) === attr) return s;
        s.run.attrCharges -= 1;
        s.run.heroAttrs = s.run.heroAttrs || {};
        s.run.heroAttrs[heroId] = attr;
        log(s, `${Content.heroes.byId[heroId].name} меняет атрибут: ${Content.attrNames[attr]}`);
        return s;
      }

      case "RETRY_WAVE": {
        if (s.phase !== "wave" || s.combat.outcome !== "failed") return s;
        s.run.deathsCount = (s.run.deathsCount || 0) + 1;
        const mercy = s.combat.wave && s.combat.wave.mercyWave;
        if (mercy) {
          // Последний шанс (#89): казарма цела, но золото сгорает.
          s.run.gold = 0;
          s.combat.wave.mercyWave = false;
          log(s, "Последний шанс: казарма уцелела, но золото сгорело дотла");
        }
        if (!mercy) s.run.barracks -= 1;
        if ((s.run.momentum || 0) > 0) log(s, "Импульс сброшен: серия волн прервана.");
        s.run.momentum = 0;
        if (!mercy) log(s, `Казарма потеряна! Осталось: ${s.run.barracks}`);
        if (s.run.barracks <= 0) {
          if (s.run.extraLife) {
            s.run.extraLife = false;
            s.run.barracks = 1;
            log(s, "Вторая жизнь: казарма восстановлена! Награды забега уже урезаны.");
          } else {
            s.phase = "gameover";
            log(s, "Трон разрушен. Забег окончен.");
            return s;
          }
        }
        if (s.player.items.includes("rapier")) {
          s.player.items = s.player.items.filter((id) => id !== "rapier");
          s.combat.wave.enemyItems.push("rapier");
          log(s, "Divine Rapier у врага! Твой урон по этой башне ×0.5, пока он её держит.");
        }
        s.combat.wave.hp = Ranks.has(s, "mercy") ? Math.ceil(s.combat.wave.maxHp * 0.7) : s.combat.wave.maxHp;
        if (Ranks.has(s, "mercy") && s.combat.wave.hp < s.combat.wave.maxHp) {
          log(s, "Милосердие мира: башня восстановила только 70% HP.");
        }
        s.run.failedLastWave = true;
        s.combat.fightIndex = 0;
        s.combat.outcome = null;
        s.player.fightsLeft = Ranks.fightsPerWave(s);
        s.player.discardsLeft = discardsPerWave(s);
        DeckSys.resetAll(s, Rng.current());
        DeckSys.draw(s, Rng.current());
        assignMines(s);
        return s;
      }

      case "DEBUG_GOLD":
        s.run.gold += 1000;
        return s;
      case "DEBUG_FIGHTS":
        s.player.fightsLeft += 5;
        return s;
      case "DEBUG_DAMAGE_TOWER":
        s.combat.wave.hp = Math.max(0, s.combat.wave.hp - (action.amount || 100));
        return s;
      case "DEBUG_KILL_TOWER":
        s.combat.wave.hp = 0;
        return s;
      case "DEBUG_DRAW":
        DeckSys.draw(s, Rng.current());
        return s;
      case "DEBUG_REVEAL":
        s.debugReveal = !s.debugReveal;
        return s;

      default:
        console.warn("Unknown action:", action.type);
        return s;
    }
  }

  // Счёт забега (спек §8.1): волны + ранг + казармы + лучший удар.
  function scoreOf(state) {
    const waves = Math.min(state.run.waveIndex + (state.phase === "victory" ? 1 : 0), Content.waves.order.length);
    const rank = state.run.rank || 1;
    return Math.round(
      waves * 100
      + rank * 150
      + state.run.barracks * 200
      + Math.min(99999, state.stats.biggestHit) / 50
    );
  }

  return {
    createInitialState, dispatch, scoreOf,
    FIGHTS_PER_WAVE, DISCARDS_PER_WAVE, WAVE_CLEAR_GOLD, BARRACKS_MAX,
    EXILE_COST, TRAIN_COST, TRAIN_RANK_MAX, DECK_MIN,
    assignMines, rankOf, heroAttr, heroLevel, maxSlots, recruitPrice, itemCost, rerollCost,
    XP_PER_LEVEL, XP_LEVEL_CAP,
    archPerk, discardsPerWave, starterDeckIds,
    itemCapacity, itemBlockedReason, rollRouteOptions,
  };
})();
