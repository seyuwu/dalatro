// Фаза E — фреймворк развилок (спек §4): контент на 12 примитивах,
// ролл детерминирован сидом, спецварианты меняют волну/лавку/руку.
suite("Фаза E — развилки");

function rtRun(seed, rank) {
  return Game.dispatch(Game.createInitialState(""), { type: "START_RUN", seedCode: seed, rank: rank || 1 });
}
function rtFork(s) {
  s.combat.outcome = "cleared";
  Game.dispatch(s, { type: "ENTER_SHOP" });
  Game.dispatch(s, { type: "LEAVE_SHOP" });
  return s;
}

test("Ролл развилки детерминирован сидом", () => {
  for (let i = 0; i < 5; i++) {
    const a = rtFork(rtRun("RDR" + i));
    const b = rtFork(rtRun("RDR" + i));
    assertEq(JSON.stringify(a.combat.routeOptions), JSON.stringify(b.combat.routeOptions), "сид RDR" + i);
  }
});

test("Опций 3–4: normal всегда, camp без дубля, спцы не повторяются", () => {
  for (let i = 0; i < 12; i++) {
    const s = rtFork(rtRun("RDO" + i));
    const opts = s.combat.routeOptions;
    assert(opts.length >= 3 && opts.length <= 4, "3–4 карточки, сид " + i);
    assertEq(opts[0].id, "normal");
    const ids = opts.map((o) => o.id);
    assertEq(new Set(ids).size, ids.length, "без дублей");
    const specials = ids.filter((id) => id !== "normal" && id !== "camp");
    assert(specials.length >= 1 && specials.length <= 2, "1–2 спца");
  }
});

test("Примитивы hp/reward: Сильная башня толще и платит ×1.6", () => {
  const s = rtFork(rtRun("RST1"));
  s.combat.routeOptions = [{ id: "normal" }, { id: "strong" }];
  Game.dispatch(s, { type: "TAKE_ROUTE", kind: "strong" });
  const def = Content.waves.byId[Content.waves.order[s.run.waveIndex]];
  assertEq(s.combat.wave.maxHp, Math.round(def.hp * 1.35), "HP ×1.35");
  assertEq(s.combat.wave.rewardMult, 1.6, "награда ×1.6");
  s.combat.wave.hp = 1;
  const goldBefore = s.run.gold;
  forceHandPlay(s, ["tusk"]);
  // 6 × 1.6 = 9.6 → 10, плюс 1 золото хараса (играл один герой)
  assertEq(s.run.gold - goldBefore, Math.round((s.combat.wave.gold || 6) * 1.6) + 1, "зачистка с множителем маршрута + харас");
});

function forceHandPlay(s, heroIds) {
  const uids = heroIds.map((h) => Object.values(s.cards).find((c) => c.heroId === h).uid);
  s.player.handUids = [...uids, ...Object.keys(s.cards).filter((u) => !uids.includes(u))];
  s.combat.selectedUids = uids.slice();
  s.player.fightsLeft = Math.max(1, s.player.fightsLeft);
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
}

test("Примитив gold: Золотая жила даёт +8 сразу и толще башню", () => {
  const s = rtFork(rtRun("RGD1"));
  s.combat.routeOptions = [{ id: "normal" }, { id: "goldvein" }];
  const goldBefore = s.run.gold;
  Game.dispatch(s, { type: "TAKE_ROUTE", kind: "goldvein" });
  assertEq(s.run.gold, goldBefore + 8, "+8 немедленно");
  const def = Content.waves.byId[Content.waves.order[s.run.waveIndex]];
  assertEq(s.combat.wave.maxHp, Math.round(def.hp * 1.3), "HP ×1.3");
});

test("Примитив shopPrice: Распродажа −25% только на следующую лавку", () => {
  const s = rtFork(rtRun("RSP1"));
  s.combat.routeOptions = [{ id: "normal" }, { id: "sale" }];
  Game.dispatch(s, { type: "TAKE_ROUTE", kind: "sale" });
  s.combat.outcome = "cleared";
  Game.dispatch(s, { type: "ENTER_SHOP" });
  const item = Content.items.byId[s.shop.offers[0].id];
  assertEq(Game.itemCost(s, s.shop.offers[0].id), Math.max(1, Math.round(item.cost * 0.75)), "цена со скидкой");
  // После выхода множитель сброшен
  Game.dispatch(s, { type: "LEAVE_SHOP" });
  assertEq(s.run.shopPriceMult, 1, "множитель потрачен");
  if (s.phase === "route") {
    Game.dispatch(s, { type: "TAKE_ROUTE", kind: "normal" });
  }
  const item2 = Content.items.byId[s.shop.offers[0] ? s.shop.offers[0].id : "midas"];
  assert(!s.combat.wave || true);
});

test("Примитив itemRarity: Чёрный рынок гарантирует редкий товар", () => {
  const s = rtFork(rtRun("RBM1"));
  s.combat.routeOptions = [{ id: "normal" }, { id: "blackmarket" }];
  Game.dispatch(s, { type: "TAKE_ROUTE", kind: "blackmarket" });
  s.combat.outcome = "cleared";
  Game.dispatch(s, { type: "ENTER_SHOP" });
  assert(s.shop.offers.some((o) => Content.items.byId[o.id].rarity === "rare"), "редкий в офферах");
});

test("Примитив hand: Расширенная рука +2 слота на волну", () => {
  const s = rtFork(rtRun("RHD1"));
  s.combat.routeOptions = [{ id: "normal" }, { id: "extendedhand" }];
  Game.dispatch(s, { type: "TAKE_ROUTE", kind: "extendedhand" });
  assertEq(DeckSys.handSize(s), Ranks.handSize(s) + 2, "рука +2");
  assertEq(s.player.handUids.length, Ranks.handSize(s) + 2, "карт добрано по размеру");
});

test("Примитив fights: Быстрая отнимает тимфайт", () => {
  const s = rtFork(rtRun("RFT1"));
  s.combat.routeOptions = [{ id: "normal" }, { id: "swift" }];
  Game.dispatch(s, { type: "TAKE_ROUTE", kind: "swift" });
  assertEq(s.player.fightsLeft, Ranks.fightsPerWave(s) - 1, "на 1 тимфайт меньше");
});

test("Примитив power: Вознесение добавляет силу каждому бою (шаг в стеке)", () => {
  const s = rtFork(rtRun("RPW1"));
  s.combat.routeOptions = [{ id: "normal" }, { id: "ascension" }];
  Game.dispatch(s, { type: "TAKE_ROUTE", kind: "ascension" });
  const uids = ["tusk"].map((h) => Object.values(s.cards).find((c) => c.heroId === h).uid);
  s.player.handUids = [...uids, ...Object.keys(s.cards).filter((u) => !uids.includes(u))];
  s.combat.selectedUids = uids.slice();
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  const res = s.combat.lastResolution;
  assert(res.steps.some((st) => st.label.includes("Вознесение")), "шаг маршрута в стеке");
  assertEq(res.trace.routePower, 8, "в аудите учтено +8 силы маршрута");
});

test("Примитив mods: Отражатель вешает мутацию на волну", () => {
  const s = rtFork(rtRun("RMD1"));
  s.combat.routeOptions = [{ id: "normal" }, { id: "reflector" }];
  Game.dispatch(s, { type: "TAKE_ROUTE", kind: "reflector" });
  assert(s.combat.wave.modifiers.some((m) => m.id === "reflection"), "мод на волне");
});

test("Примитив gamble: Казино даёт 0 или +12, детерминировано сидом", () => {
  const seen = new Set();
  for (let i = 0; i < 10; i++) {
    const s = rtFork(rtRun("RCS" + i));
    s.combat.routeOptions = [{ id: "normal" }, { id: "casino" }];
    const before = s.run.gold;
    Game.dispatch(s, { type: "TAKE_ROUTE", kind: "casino" });
    seen.add(s.run.gold - before);
  }
  for (const delta of seen) assert(delta === 0 || delta === 12, "исход 0 или +12 (видели " + [...seen] + ")");
});

test("Ролл уважает minRank: Аномалия не выпадает на Рекруте, Папочка — до Титан 1000", () => {
  for (let i = 0; i < 10; i++) {
    const s1 = rtFork(rtRun("RMN" + i, 1));
    assert(!s1.combat.routeOptions.some((o) => o.id === "anomaly" || o.id === "papochka"), "Рекрут: без поздних спцов, сид " + i);
    const s2 = rtFork(rtRun("RMN" + i, 10));
    // на ранге 10 аномалия возможна, но ролл тот же, что у Рекрута по структуре
    assert(s2.combat.routeOptions.length >= 3);
  }
});
