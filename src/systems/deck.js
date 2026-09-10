// Dalatro — deck system: deck / hand / discard as uid arrays + card registry.
const DeckSys = (function () {
  let uidCounter = 0;
  // Hand of 7 vs deck of 12: after playing 5 the refill exactly drains the deck,
  // so played heroes return only on the next full cycle (no full-house spam).
  const HAND_SIZE = 7;

  // state.cards: uid -> { uid, heroId }. Deck arrays hold uids only.
  function createFromHeroes(state, heroIds) {
    state.cards = {};
    state.player.deckUids = [];
    for (const heroId of heroIds) {
      const uid = "c" + uidCounter++;
      state.cards[uid] = { uid, heroId };
      state.player.deckUids.push(uid);
    }
    state.player.handUids = [];
    state.player.discardUids = [];
  }

  // Draws until the hand reaches the current hand size (rank may cut it to 6/5,
  // see Ranks.handSize; маршрут даёт ±слоты на волну, «Запасные слоты» —
  // бесконечно, по уровню run.handSlots) or deck+discard are empty.
  function handSize(state) {
    return Ranks.handSize(state)
      + (state.run.waveHandBonus || 0)
      + (state.run.handSlots || 0)
      + (typeof Upgrades !== "undefined" ? Upgrades.sum(state, "hand") : 0);
  }

  function draw(state, rng) {
    const size = handSize(state);
    while (state.player.handUids.length < size) {
      if (state.player.deckUids.length === 0) {
        if (state.player.discardUids.length === 0) return;
        state.player.deckUids = rng.shuffle(state.player.discardUids.slice());
        state.player.discardUids = [];
      }
      state.player.handUids.push(state.player.deckUids.pop());
    }
  }

  function moveToDiscard(state, uids) {
    for (const uid of uids) {
      const idx = state.player.handUids.indexOf(uid);
      if (idx !== -1) {
        state.player.handUids.splice(idx, 1);
        state.player.discardUids.push(uid);
      }
    }
  }

  function resetAll(state, rng) {
    const all = state.player.deckUids
      .concat(state.player.handUids)
      .concat(state.player.discardUids);
    state.player.deckUids = rng.shuffle(all.slice());
    state.player.handUids = [];
    state.player.discardUids = [];
  }

  // Creates a card for a recruited hero and adds it to the deck (tavern).
  function addHero(state, heroId) {
    const uid = "c" + uidCounter++;
    state.cards[uid] = { uid, heroId };
    state.player.deckUids.push(uid);
    return uid;
  }

  return { createFromHeroes, draw, moveToDiscard, resetAll, addHero, handSize, HAND_SIZE };
})();
