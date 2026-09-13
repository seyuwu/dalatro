// Сортировка «Сила» и панель комбо с тренированными героями: UI должен
// видеть ту же эффективную силу, что и детектор боя (Game.rankOf).

suite("Сортировка руки с тренированными героями");

function trainedRun() {
  let s = Game.dispatch(Game.createInitialState("SRT1"), { type: "START_RUN", seedCode: "SRT1", rules: "formation" });
  // двое героев руки: слабый (base) и сильный (base). Тренируем слабого так,
  // чтобы он обошёл сильного — раньше сортировка этого не видела.
  const hand = s.player.handUids.slice(0, 2).map((uid) => ({
    uid, heroId: s.cards[uid].heroId,
    base: Content.heroes.byId[s.cards[uid].heroId].power,
  }));
  hand.sort((a, b) => a.base - b.base);
  const [weak, strong] = hand;
  assert(strong.base - weak.base >= 2, "в руке есть пара героев с разницей базы ≥2 — иначе тест не показателен");
  s.run.ranks = { [weak.heroId]: strong.base + 1 }; // тренировка перекрывает разницу
  UI.UIState.sort = "rank";
  return { s, weak, strong };
}

test("сортировка «Сила»: тренированный слабый герой встаёт выше сильного", () => {
  const { s, weak, strong } = trainedRun();
  const order = UI.handOrder(s).map((uid) => s.cards[uid].heroId);
  assert(order.indexOf(weak.heroId) < order.indexOf(strong.heroId),
    "эффективная сила (base+тренировка) важнее базы при сортировке");
});

test("панель комбо: тренировка делает ранг героя парным к сильному", () => {
  const { s, weak, strong } = trainedRun();
  // рука из ровно этих двух героев: без тренировки пары нет, с ней ранги
  // равны → «пара». Панель обязана видеть ЭФФЕКТИВНЫЕ ранги, как детектор.
  s.player.handUids = [weak.uid, strong.uid];
  s.player.deckUids = Object.keys(s.cards).filter((uid) => !s.player.handUids.includes(uid));
  s.player.discardUids = [];
  assertEq(UI.handComboState(s).pair, false, "контроль: без тренировки пары нет");
  s.run.ranks = { [weak.heroId]: strong.base };
  assertEq(UI.handComboState(s).pair, true, "тренированный догнал сильного — панель видит пару");
});

test("сортировка «Сила» учитывает штраф усталости (ранг 4, −3)", () => {
  let s = Game.dispatch(Game.createInitialState("SRT2"), { type: "START_RUN", seedCode: "SRT2", rules: "formation" });
  // ищем пару героев руки с разницей баз ≤2: усталость −3 опускает сильного
  // строго ниже слабого. Усталость: ранг 4, герой гонялся 15 боёв → −3.
  const hand = s.player.handUids.map((uid) => ({
    uid, heroId: s.cards[uid].heroId,
    base: Content.heroes.byId[s.cards[uid].heroId].power,
  }));
  let pair = null;
  for (let i = 0; i < hand.length && !pair; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      const hi = hand[i].base >= hand[j].base ? hand[i] : hand[j];
      const lo = hand[i].base >= hand[j].base ? hand[j] : hand[i];
      if (hi.base - lo.base >= 1 && hi.base - lo.base <= 2) { pair = { hi, lo }; break; }
    }
  }
  assert(pair, "в руке нашлась пара героев с разницей баз 1–2");
  s.run.rank = 4; // «Легенда»: модификатор усталости
  s.run.heroUses = { [pair.hi.heroId]: 15 }; // −3 силы у сильного
  UI.UIState.sort = "rank";
  const order = UI.handOrder(s).map((uid) => s.cards[uid].heroId);
  assert(order.indexOf(pair.lo.heroId) < order.indexOf(pair.hi.heroId),
    "уставший сильный опускается ниже — эффективная сила в сортировке");
});
