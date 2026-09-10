// Dalatro — game state + action dispatch.
// EVERYTHING that mutates state goes through dispatch(). UI never edits state,
// content never edits state: State -> Action -> Engine -> Events/Effects -> State.
const Game = (function () {
  const FIGHTS_PER_WAVE = 4;
  const DISCARDS_PER_WAVE = 3;
  const WAVE_CLEAR_GOLD = 6;
  const BARRACKS_MAX = 2; // жизни забега: одна ошибка — полколоды, вторая — конец
  const EXILE_COST = 4;
  const TRAIN_COST = 5;
  const TRAIN_RANK_MAX = 12;
  const DECK_MIN = 8;

  function createInitialState(seedCode) {
    return {
      seedCode: seedCode || "",
      phase: "title",
      run: { act: 1, waveIndex: 0, barracks: 2, gold: 4, momentum: 0, ranks: {}, campBoon: false, rank: 1, heroUses: {}, comboUses: {}, curses: [], pendingCurse: null, inflationBuys: 0, archetype: null, freeRerollUsed: false, pendingShopPrice: null, pendingItemRarity: null, pendingExtraRecruit: 0, pendingRoute: null, shopPriceMult: 1, waveHandBonus: 0, upgrades: [], skipNextBattle: false, handSlots: 0, attrCharges: 0, heroAttrs: {}, shopRerolls: 0, shopBuys: 0, loyaltyUsed: false, brokeUsed: false, afterBoss: false, failedLastWave: false, winCount: 0, upgradePurchases: 0, pendingHandBonus: 0 },
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

  function rankOf(state, heroId) {
    const overrides = state.run.ranks || {};
    const base = overrides[heroId] != null ? overrides[heroId] : Content.heroes.byId[heroId].power;
    return Math.max(1, base - Ranks.heroPenalty(state, heroId));
  }

  // Перк стартового архетипа (run.archetype), null для «Стандарта»/старых сейвов.
  function archPerk(state) {
    const a = state.run.archetype && Content.archetypes.byId[state.run.archetype];
    return a ? a.perk : null;
  }

  // ТП-сбросы за волну: правила лиги + перк «Контроль» (+1 в акте 1).
  function discardsPerWave(state) {
    const base = Ranks.discardsPerWave(state) + Upgrades.sum(state, "discardsBonus");
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
    const hp = Math.round(def.hp * Ranks.waveHpMult(state, waveIndex) * (route && route.hp ? route.hp : 1));
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
      rewardMult: route && route.reward ? route.reward : 1,
      powerBonus: route && route.power ? route.power : 0,
      defenseMult: route && route.defense ? route.defense : 1,
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
    let mult = state.run.shopPriceMult || 1;
    // Торг: помеченный оффер со скидкой.
    const offer = (state.shop.offers || []).find((o) => o.id === itemId);
    if (offer && offer.sale) mult *= 1 - offer.sale / 100;
    cost = Math.max(1, Math.round(cost * mult));
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
          s.combat.selectedUids.push(uid);
        }
        return s;
      }

      case "CONFIRM_FIGHT": {
        if (s.phase !== "wave" || s.combat.outcome || s.player.fightsLeft <= 0) return s;
        if (!s.combat.selectedUids.length || s.combat.selectedUids.length > maxSlots(s)) return s;
        const resolution = Combat.resolveFight(s);
        log(s, `Бой #${s.combat.fightIndex}: ${resolution.combo.name} → ${resolution.damage} урона${(resolution.crits || []).length ? ` · КРИТ! (${resolution.crits.join(", ")})` : ""}`);
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
        s.run.shopPriceMult = s.run.pendingShopPrice || 1;
        s.run.pendingShopPrice = null;
        s.shop.offers = Economy.generateOffers(s, Economy.OFFER_SLOTS, [], guaranteeRarity);
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
        return s;
      }

      // Обновление предложений улучшений (фидбек): фиксированные 2G.
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
        // Немедленные эффекты маршрута: золото и гэмбл.
        if (route.gold) {
          s.run.gold = Math.max(0, s.run.gold + route.gold);
          log(s, `${route.name}: ${route.gold > 0 ? "+" : ""}${route.gold} золота`);
        }
        if (route.gamble) {
          const won = Rng.current().chance(route.gamble.chance);
          if (won) {
            s.run.gold += route.gamble.win;
            log(s, `${route.name}: повезло — +${route.gamble.win} золота!`);
          } else {
            log(s, `${route.name}: не повезло, пусто.`);
          }
        }
        // Одноразовые гарантии следующей лавки.
        s.run.pendingShopPrice = route.shopPrice || null;
        s.run.pendingItemRarity = route.itemRarity || null;
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
        s.run.barracks -= 1;
        if ((s.run.momentum || 0) > 0) log(s, "Импульс сброшен: серия волн прервана.");
        s.run.momentum = 0;
        log(s, `Казарма потеряна! Осталось: ${s.run.barracks}`);
        if (s.run.barracks <= 0) {
          s.phase = "gameover";
          log(s, "Трон разрушен. Забег окончен.");
          return s;
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

  return {
    createInitialState, dispatch,
    FIGHTS_PER_WAVE, DISCARDS_PER_WAVE, WAVE_CLEAR_GOLD, BARRACKS_MAX,
    EXILE_COST, TRAIN_COST, TRAIN_RANK_MAX, DECK_MIN,
    assignMines, rankOf, heroAttr, maxSlots, recruitPrice, itemCost, rerollCost,
    archPerk, discardsPerWave, starterDeckIds,
    itemCapacity, itemBlockedReason, rollRouteOptions,
  };
})();
