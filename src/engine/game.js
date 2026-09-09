// Dalatro — game state + action dispatch.
// EVERYTHING that mutates state goes through dispatch(). UI never edits state,
// content never edits state: State -> Action -> Engine -> Events/Effects -> State.
const Game = (function () {
  const FIGHTS_PER_WAVE = 4;
  const DISCARDS_PER_WAVE = 3;
  const WAVE_CLEAR_GOLD = 6;
  const BARRACKS_MAX = 6;
  const EXILE_COST = 4;
  const TRAIN_COST = 5;
  const TRAIN_RANK_MAX = 12;
  const DECK_MIN = 8;

  function createInitialState(seedCode) {
    return {
      seedCode: seedCode || "",
      phase: "title",
      run: { act: 1, waveIndex: 0, barracks: 6, gold: 4, momentum: 0, ranks: {}, campBoon: false },
      player: { deckUids: [], handUids: [], discardUids: [], items: [], fightsLeft: 0, discardsLeft: 0 },
      cards: {},
      combat: { wave: null, fightIndex: 0, selectedUids: [], outcome: null, lastResolution: null, scoring: null, minedUids: [], lastComboType: null, campTaken: false },
      shop: { offers: [], recruits: [] },
      log: [],
      stats: { totalDamage: 0, biggestHit: 0 },
      // Ядро скоринга: "classic" (покерные комбо) | "formation" (формации+связки+броня).
      rules: "classic",
      simulate: false,
    };
  }

  // Ранг героя с учётом тренировки в лаборатории колоды.
  function rankOf(state, heroId) {
    const overrides = state.run.ranks || {};
    return overrides[heroId] != null ? overrides[heroId] : Content.heroes.byId[heroId].power;
  }

  // Обезоруживание: проклятие элитки режет слоты до 4 (BKB снимает).
  function maxSlots(state) {
    const wave = state.combat.wave;
    if (wave && (wave.modifiers || []).some((m) => m.id === "disarm") && !state.player.items.includes("bkb")) {
      return 4;
    }
    return Combat.MAX_SLOTS;
  }

  function log(state, text) {
    state.log.push(text);
    if (state.log.length > 300) state.log.shift();
  }

  function setupWave(state, waveIndex, route) {
    const def = Content.waves.byId[Content.waves.order[waveIndex]];
    const elite = !!(route && route.elite) && !def.isBoss;
    const hp = elite ? Math.round(def.hp * 1.5) : def.hp;
    state.combat.wave = {
      towerId: def.id,
      name: def.name,
      emoji: def.emoji,
      isBoss: !!def.isBoss,
      miniBoss: !!def.miniBoss,
      elite,
      hp,
      maxHp: hp,
      modifiers: (def.modifiers || []).concat(elite && route.curse ? [{ id: route.curse }] : []).map((m) => ({ id: m.id })),
      enemyItems: [],
      aegisUsed: false,
    };
    state.combat.fightIndex = 0;
    state.combat.selectedUids = [];
    state.combat.outcome = null;
    state.combat.lastComboType = null;
    state.combat.campTaken = false;
    state.run.campBoon = false;
    state.combat.route = null;
    state.player.fightsLeft = FIGHTS_PER_WAVE;
    state.player.discardsLeft = DISCARDS_PER_WAVE;
    DeckSys.resetAll(state, Rng.current());
    DeckSys.draw(state, Rng.current());
    assignMines(state);
    log(state, elite
      ? `— Элитная волна ${waveIndex + 1}: ${def.name} — ${hp} HP (${Content.modifiers.byId[route.curse].name}!)`
      : `— Волна ${waveIndex + 1}: ${def.name} — ${def.hp} HP`);
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

  function dispatch(state, action) {
    const s = state;
    switch (action.type) {
      case "START_RUN": {
        const code = Rng.normalizeSeedCode(action.seedCode) || Rng.randomSeedCode();
        const fresh = createInitialState(code);
        fresh.rules = action.rules === "formation" ? "formation" : "classic";
        fresh.phase = "wave";
        Rng.setActive(Rng.create(code));
        DeckSys.createFromHeroes(fresh, Content.heroes.startingIds);
        setupWave(fresh, 0);
        log(fresh, `Забег начат. Seed: DALATRO-${code}${fresh.rules === "formation" ? " · режим формаций" : ""}`);
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
        log(s, `Бой #${s.combat.fightIndex}: ${resolution.combo.name} → ${resolution.damage} урона`);
        if (resolution.killed) {
          s.combat.outcome = "cleared";
          s.run.momentum = Math.min((s.run.momentum || 0) + 1, Combat.MOMENTUM_CAP);
          s.combat.campTaken = false;
          const clearGold = s.combat.wave.elite ? Math.round(WAVE_CLEAR_GOLD * 1.5) : WAVE_CLEAR_GOLD;
          s.run.gold += clearGold;
          log(s, `Волна зачищена! +${clearGold} золота${s.combat.wave.elite ? " (элитная добыча ×1.5)" : ""}. Импульс: ${s.run.momentum} волн подряд`);
          returnRapierIfHeld(s);
          if (s.combat.wave.isBoss) {
            s.phase = "victory";
            log(s, "РОШАН ПОВЕРЖЕН. ТИ ВЗЯТ!");
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
        if (s.phase !== "wave" || s.combat.outcome !== "cleared") return s;
        s.phase = "shop";
        s.shop.offers = Economy.generateOffers(s, Economy.OFFER_SLOTS, [], s.combat.wave.elite);
        s.shop.recruits = pickRecruits(s);
        return s;
      }

      case "BUY_ITEM": {
        if (s.phase !== "shop") return s;
        const item = Content.items.byId[action.itemId];
        const offerIdx = s.shop.offers.findIndex((o) => o.id === action.itemId);
        if (!item || offerIdx === -1) return s;
        if (s.player.items.includes(action.itemId)) return s;
        if (s.run.gold < item.cost) return s;
        s.run.gold -= item.cost;
        s.player.items.push(action.itemId);
        s.shop.offers.splice(offerIdx, 1);
        log(s, `Куплено: ${item.name} (−${item.cost} золота)`);
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
        const value = Economy.sellValue(action.itemId);
        s.player.items.splice(idx, 1);
        s.run.gold += value;
        log(s, `Продано: ${item.name} (+${value} золота)`);
        return s;
      }

      case "REROLL_SHOP": {
        if (s.phase !== "shop" || s.run.gold < Economy.REROLL_COST) return s;
        s.run.gold -= Economy.REROLL_COST;
        const locked = s.shop.offers.filter((o) => o.locked);
        s.shop.offers = Economy.generateOffers(s, Economy.OFFER_SLOTS, locked);
        s.shop.recruits = pickRecruits(s);
        return s;
      }

      case "LEAVE_SHOP": {
        if (s.phase !== "shop") return s;
        const nextIndex = s.run.waveIndex + 1;
        const nextDef = Content.waves.byId[Content.waves.order[nextIndex]];
        if (!nextDef) return s;
        if (nextDef.isBoss) {
          // перед боссом развилки нет — только его башня
          s.phase = "wave";
          s.run.waveIndex = nextIndex;
          setupWave(s, nextIndex, null);
          return s;
        }
        const rng = Rng.current();
        const curse = Content.curses[Math.floor(rng.next() * Content.curses.length)];
        s.combat.route = { curse };
        s.phase = "route";
        return s;
      }

      case "TAKE_ROUTE": {
        if (s.phase !== "route" || !s.combat.route) return s;
        const nextIndex = s.run.waveIndex + 1;
        if (action.kind === "camp") {
          if (s.combat.campTaken) return s;
          s.run.gold += 6;
          s.run.barracks = Math.min(BARRACKS_MAX, s.run.barracks + 1);
          s.run.campBoon = true;
          s.combat.campTaken = true;
          s.combat.route = null;
          s.phase = "shop";
          log(s, "Крип-лагерь зачищен без боя: +6 золота, привал (+1 казарма), бесплатное увольнение в лавке");
          return s;
        }
        s.phase = "wave";
        s.run.waveIndex = nextIndex;
        setupWave(s, nextIndex, action.kind === "elite" ? { elite: true, curse: s.combat.route.curse } : null);
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
        s.combat.wave.hp = s.combat.wave.maxHp;
        s.combat.fightIndex = 0;
        s.combat.outcome = null;
        s.player.fightsLeft = FIGHTS_PER_WAVE;
        s.player.discardsLeft = DISCARDS_PER_WAVE;
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
    assignMines, rankOf, maxSlots, recruitPrice,
  };
})();
