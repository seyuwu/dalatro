// Dalatro — ranks: лига сложности (Рекрут → ... → Титаны → Папочка).
// Ранг N = союз добавок рангов 1..N (правила наслаиваются). Здесь только
// чтение конфига и вычисления; мутации state — game.js/combat.js.
const Ranks = (function () {
  const MAX_RANK = 14;

  function rankIndex(state) {
    return Math.min(MAX_RANK, Math.max(1, (state && state.run && state.run.rank) || 1));
  }

  function rankOf(state) {
    return Content.ranks.byId[rankIndex(state)] || Content.ranks.byId[1];
  }

  // Все активные модификаторы: ранги наслаиваются, 1..N.
  function activeMods(state) {
    const top = rankIndex(state);
    const set = [];
    for (let r = 1; r <= top; r++) {
      for (const m of Content.ranks.byId[r].adds) if (!set.includes(m)) set.push(m);
    }
    return set;
  }

  function has(state, modId) {
    return activeMods(state).includes(modId);
  }

  function hasCurse(state, curseId) {
    return (state.run.curses || []).includes(curseId);
  }

  function hpMult(state) {
    return rankOf(state).hpMult;
  }

  // Множитель HP конкретной волны: ранговый прирост растягивается по актам —
  // в 1 акте игрок ещё не скейлится золотом (якорь ×0.1–0.2), в 3 акте билд
  // собран и держит полный множитель. Боссы актов с Aegis и так удваивают
  // эффективное HP — поэтому ранние якоря низкие.
  function waveHpMult(state, waveIndex) {
    const m = rankOf(state).hpMult;
    const act = Math.min(3, Math.floor(waveIndex / 5) + 1);
    const pos = ((waveIndex % 5) + 5) % 5;
    const anchors = { 1: [0.08, 0.22], 2: [0.35, 0.65], 3: [0.8, 1.0] };
    const [a, b] = anchors[act];
    const w = a + (b - a) * (pos / 4);
    return 1 + (m - 1) * w;
  }

  function goldMult(state) {
    return rankOf(state).goldMult;
  }

  // Множитель награды от проклятий забега (blood/web/chaos).
  function curseGoldMult(state) {
    let m = 1;
    if (hasCurse(state, "blood")) m *= 0.75;
    if (hasCurse(state, "web")) m *= 1.2;
    if (hasCurse(state, "chaos")) m *= 1.15;
    return m;
  }

  function fightsPerWave(state) {
    let n = Game.FIGHTS_PER_WAVE;
    if (has(state, "fights3")) n -= 1;
    if (has(state, "fights2")) n -= 1;
    if (hasCurse(state, "hunger")) n -= 1;
    return Math.max(2, n);
  }

  function discardsPerWave(state) {
    let n = Game.DISCARDS_PER_WAVE;
    if (has(state, "discards2")) n -= 1;
    if (has(state, "discards1")) n -= 1;
    if (hasCurse(state, "time")) n += 1;
    if (hasCurse(state, "web")) n -= 1;
    return Math.max(1, Math.min(3, n));
  }

  function handSize(state) {
    let n = DeckSys.HAND_SIZE;
    if (has(state, "hand6")) n -= 1;
    if (has(state, "hand5")) n -= 1;
    return Math.max(4, n);
  }

  function rerollCost(state) {
    let c = Economy.REROLL_COST;
    if (has(state, "reroll3")) c = 3;
    if (has(state, "reroll4")) c = 4;
    if (hasCurse(state, "time")) c += 2;
    return c;
  }

  function taxPerWave(state) {
    if (has(state, "tax2")) return 2;
    if (has(state, "tax1")) return 1;
    return 0;
  }

  function mutationsPerWave(state) {
    let n = 0;
    if (has(state, "mutations1")) n = 1;
    if (has(state, "mutations2")) n = 2;
    if (hasCurse(state, "chaos")) n += 1;
    return Math.min(3, n);
  }

  // Усталость: каждые 5 использований героя −1 к силе, кап −3.
  function fatiguePenalty(uses) {
    return Math.min(3, Math.floor((uses || 0) / 5));
  }

  function mostUsedHero(state) {
    const uses = state.run.heroUses || {};
    let best = null;
    let bestCount = 0;
    let tie = false;
    for (const id in uses) {
      if (uses[id] > bestCount) { best = id; bestCount = uses[id]; tie = false; }
      else if (uses[id] === bestCount) tie = true;
    }
    return bestCount >= 4 && !tie ? best : null;
  }

  function heroPenalty(state, heroId) {
    let pen = 0;
    if (has(state, "fatigue")) pen += fatiguePenalty((state.run.heroUses || {})[heroId]);
    if (has(state, "antihero") && mostUsedHero(state) === heroId) pen += 2;
    return pen;
  }

  // Адаптация мира: самое частое комбо/формация забега (≥3 применений, без ничьих).
  function mostUsedCombo(state) {
    const uses = state.run.comboUses || {};
    let best = null;
    let bestCount = 0;
    let tie = false;
    for (const id in uses) {
      if (uses[id] > bestCount) { best = id; bestCount = uses[id]; tie = false; }
      else if (uses[id] === bestCount) tie = true;
    }
    return bestCount >= 3 && !tie ? { id: best, count: bestCount } : null;
  }

  // Детерминированный выбор: мутации волны и карточки проклятий (Rng.current()).
  function rollMutations(count) {
    const rng = Rng.current();
    const copy = Content.mutations.slice();
    const picked = [];
    while (picked.length < count && copy.length) {
      picked.push(copy.splice(Math.floor(rng.next() * copy.length), 1)[0]);
    }
    return picked;
  }

  function rollCurseChoices() {
    const rng = Rng.current();
    const copy = Content.rankCurses.list.map((c) => c.id);
    const picks = [];
    while (picks.length < 3 && copy.length) {
      picks.push(copy.splice(Math.floor(rng.next() * copy.length), 1)[0]);
    }
    return picks;
  }

  return {
    MAX_RANK, rankIndex, rankOf, activeMods, has, hasCurse,
    hpMult, waveHpMult, goldMult, curseGoldMult,
    fightsPerWave, discardsPerWave, handSize, rerollCost, taxPerWave, mutationsPerWave,
    fatiguePenalty, heroPenalty, mostUsedHero, mostUsedCombo,
    rollMutations, rollCurseChoices,
  };
})();