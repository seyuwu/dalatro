// Dalatro — game state + action dispatch.
// EVERYTHING that mutates state goes through dispatch(). UI never edits state,
// content never edits state: State -> Action -> Engine -> Events/Effects -> State.
const Game = (function () {
  const FIGHTS_PER_WAVE = 4;
  const DISCARDS_PER_WAVE = 3;
  const WAVE_CLEAR_GOLD = 6;

  function createInitialState(seedCode) {
    return {
      seedCode: seedCode || "",
      phase: "title",
      run: { act: 1, waveIndex: 0, barracks: 6, gold: 4 },
      player: { deckUids: [], handUids: [], discardUids: [], items: [], fightsLeft: 0, discardsLeft: 0 },
      cards: {},
      combat: { wave: null, fightIndex: 0, selectedUids: [], outcome: null, lastResolution: null, scoring: null },
      shop: { offers: [] },
      log: [],
      stats: { totalDamage: 0, biggestHit: 0 },
      simulate: false,
    };
  }

  function log(state, text) {
    state.log.push(text);
    if (state.log.length > 300) state.log.shift();
  }

  function setupWave(state, waveIndex) {
    const def = Content.waves.byId[Content.waves.order[waveIndex]];
    state.combat.wave = {
      towerId: def.id,
      name: def.name,
      emoji: def.emoji,
      isBoss: !!def.isBoss,
      hp: def.hp,
      maxHp: def.hp,
      modifiers: (def.modifiers || []).map((m) => ({ id: m.id })),
      enemyItems: [],
      aegisUsed: false,
    };
    state.combat.fightIndex = 0;
    state.combat.selectedUids = [];
    state.combat.outcome = null;
    state.player.fightsLeft = FIGHTS_PER_WAVE;
    state.player.discardsLeft = DISCARDS_PER_WAVE;
    DeckSys.resetAll(state, Rng.current());
    DeckSys.draw(state, Rng.current());
    log(state, `— Волна ${waveIndex + 1}: ${def.name} — ${def.hp} HP`);
  }

  function returnRapierIfHeld(state) {
    if (state.combat.wave.enemyItems.includes("rapier")) {
      state.combat.wave.enemyItems = state.combat.wave.enemyItems.filter((id) => id !== "rapier");
      state.player.items.push("rapier");
      log(state, "Divine Rapier возвращается к тебе!");
    }
  }

  function dispatch(state, action) {
    const s = state;
    switch (action.type) {
      case "START_RUN": {
        const code = Rng.normalizeSeedCode(action.seedCode) || Rng.randomSeedCode();
        const fresh = createInitialState(code);
        fresh.phase = "wave";
        Rng.setActive(Rng.create(code));
        DeckSys.createFromHeroes(fresh, Content.heroes.startingIds);
        setupWave(fresh, 0);
        log(fresh, `Забег начат. Seed: DALATRO-${code}`);
        return fresh;
      }

      case "SELECT_CARD": {
        if (s.phase !== "wave" || s.combat.outcome) return s;
        const uid = action.uid;
        const idx = s.combat.selectedUids.indexOf(uid);
        if (idx !== -1) {
          s.combat.selectedUids.splice(idx, 1);
        } else if (s.combat.selectedUids.length < Combat.MAX_SLOTS && s.player.handUids.includes(uid)) {
          s.combat.selectedUids.push(uid);
        }
        return s;
      }

      case "CONFIRM_FIGHT": {
        if (s.phase !== "wave" || s.combat.outcome || s.player.fightsLeft <= 0) return s;
        if (!s.combat.selectedUids.length || s.combat.selectedUids.length > Combat.MAX_SLOTS) return s;
        const resolution = Combat.resolveFight(s);
        log(s, `Бой #${s.combat.fightIndex}: ${resolution.combo.name} → ${resolution.damage} урона`);
        if (resolution.killed) {
          s.combat.outcome = "cleared";
          s.run.gold += WAVE_CLEAR_GOLD;
          log(s, `Волна зачищена! +${WAVE_CLEAR_GOLD} золота`);
          returnRapierIfHeld(s);
          if (s.combat.wave.isBoss) {
            s.phase = "victory";
            log(s, "РОШАН ПОВЕРЖЕН. ТИ ВЗЯТ!");
          }
        } else if (s.player.fightsLeft <= 0) {
          s.combat.outcome = "failed";
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
        return s;
      }

      case "ENTER_SHOP": {
        if (s.phase !== "wave" || s.combat.outcome !== "cleared") return s;
        s.phase = "shop";
        s.shop.offers = Economy.generateOffers(s);
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
        return s;
      }

      case "LEAVE_SHOP": {
        if (s.phase !== "shop") return s;
        s.phase = "wave";
        s.run.waveIndex += 1;
        setupWave(s, s.run.waveIndex);
        return s;
      }

      case "RETRY_WAVE": {
        if (s.phase !== "wave" || s.combat.outcome !== "failed") return s;
        s.run.barracks -= 1;
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

  return { createInitialState, dispatch, FIGHTS_PER_WAVE, DISCARDS_PER_WAVE, WAVE_CLEAR_GOLD };
})();
