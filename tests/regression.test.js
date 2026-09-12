// Регресс-тесты по находкам мультиагентного аудита. Каждый тест — свежий
// забег через Game.dispatch; никаких общих мутаций.
suite("Регресс — фиксы аудита");

function freshRun(seed) {
  const s = Game.dispatch(Game.createInitialState(""), {
    type: "START_RUN", seedCode: seed || "REGRESS", rules: "formation", rank: 1, starterId: "standard",
  });
  return s;
}

// Волна доводится до «cleared» одним ударом: HP башни прижат к 1.
function clearWave(s) {
  s.combat.wave.hp = 1;
  s.combat.selectedUids = [s.player.handUids[0]];
  s = Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  assert(s.combat.outcome === "cleared", "волна должна быть зачищена");
  return s;
}

function toShop(s) {
  s = clearWave(s);
  s = Game.dispatch(s, { type: "ENTER_SHOP" });
  assert(s.phase === "shop", "должны быть в лавке");
  return s;
}

test("Архивариус (#20): бой на проклятой башне не роняет dispatch", () => {
  let s = freshRun("ARCH");
  s.combat.wave.modifiers = [{ id: "archivist" }];
  s.combat.wave.hp = 1;
  s.combat.selectedUids = [s.player.handUids[0]];
  s = Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  assert(s.combat.lastResolution, "resolution должен существовать");
  assertEq(s.combat.outcome, "cleared");
});

test("uid-счётчик восстанавливается из сейва: наём не перезаписывает чужую карту", () => {
  const s = freshRun("UID");
  s.cards["c999"] = { uid: "c999", heroId: "axe" };
  DeckSys.syncUidCounter(s);
  const uid = DeckSys.addHero(s, "lina");
  assert(Number(uid.slice(1)) > 999, "новый uid идёт за максимумом реестра, получен " + uid);
  assertEq(s.cards["c999"].heroId, "axe", "чужая карта не перезаписана");
  assertEq(s.player.deckUids.filter((u) => u === uid).length, 1, "дубликата uid в колоде нет");
});

test("setupWave копирует gold из контента: у Рошана база 10, а не фолбэк 6", () => {
  let s = freshRun("GOLD");
  s = toShop(s);
  s.run.waveIndex = 3; // следующая — index 4, Roshan
  s = Game.dispatch(s, { type: "LEAVE_SHOP" });
  assert(s.phase === "wave" && s.combat.wave.isBoss, "должны оказаться на башне Рошана");
  assertEq(s.combat.wave.gold, 10, "gold волны из WAVES_DATA");
  assertEq(Game.waveClearGold(s), 10, "превью награды на ранге I = база");
});

test("Награда за зачистку совпадает с превью waveClearGold", () => {
  let s = freshRun("REWARD");
  const goldBefore = s.run.gold;
  s = clearWave(s);
  // Ранг I: чистая зачистка T1 без бонусов = база 6 (плюс бонусы за
  // неиспользованные бои/сбросы, поэтому ≥ базы).
  assert(s.run.gold - goldBefore >= Game.waveClearGold(s), "выдано не меньше базовой награды");
});

test("ADD_POWER_PER_USED_DISCARD считает базу от discardsPerWave, а не от 3", () => {
  const s = freshRun("DISC");
  s.player.discardsLeft = 1; // ранг I: база 3 → used 2 → +8 при value 4
  const ctx1 = { state: s, scoring: { power: 0 }, card: null, playedCards: [] };
  Effects.apply({ type: "ADD_POWER_PER_USED_DISCARD", value: 4 }, ctx1);
  assertEq(ctx1.scoring.power, 8, "ранг I: (3−1)×4");
  s.run.rank = 8; // Титан 10+: 2 сброса за волну → used 1 → +4
  assertEq(Game.discardsPerWave(s), 2, "дельта ранга видна в базe");
  const ctx2 = { state: s, scoring: { power: 0 }, card: null, playedCards: [] };
  Effects.apply({ type: "ADD_POWER_PER_USED_DISCARD", value: 4 }, ctx2);
  assertEq(ctx2.scoring.power, 4, "ранг VIII: (2−1)×4, а не (3−1)×4");
});

test("RETRY_WAVE восстанавливает дельту боёв маршрута", () => {
  let s = freshRun("RETRY");
  s.combat.outcome = "failed";
  s.combat.wave.routeFights = 1;
  const base = Ranks.fightsPerWave(s);
  s = Game.dispatch(s, { type: "RETRY_WAVE" });
  assertEq(s.player.fightsLeft, base + 1, "дельта маршрута вернулась на ретрай");
  assertEq(s.combat.wave.fightsTotal, base + 1);
});

test("REROLL_SHOP учитывает shopSlotsDelta (маршрут «Распродажа»)", () => {
  let s = toShop(freshRun("REROLL"));
  s.run.shopSlotsDelta = -2;
  s = Game.dispatch(s, { type: "REROLL_SHOP" });
  assertEq(s.shop.offers.length, 3, "реролл не возвращает срезанные слоты");
});

test("BUY_UPGRADE без золота не увеличивает счётчик покупок", () => {
  let s = toShop(freshRun("BUYUP"));
  s.run.gold = 0;
  const target = (s.shop.upgrades || [])[0];
  assert(target, "в лавке должно быть предложение улучшения");
  const before = s.run.upgradePurchases || 0;
  s = Game.dispatch(s, { type: "BUY_UPGRADE", upgradeId: target.id });
  assertEq(s.run.upgradePurchases || 0, before, "счётчик не тронут при отказе");
});

test("CHANGE_ATTR вне лавки отклоняется", () => {
  const s = freshRun("ATTR");
  s.run.attrCharges = 2;
  const heroId = s.cards[s.player.handUids[0]].heroId;
  const out = Game.dispatch(s, { type: "CHANGE_ATTR", heroId, attr: "int" });
  assertEq(out.run.attrCharges, 2, "заряд не потрачен вне фазы лавки");
});

test("Ломбард: продажа с pawnBonus дороже и тратит бонус", () => {
  let s = toShop(freshRun("PAWN"));
  const item = Content.items.list.find((i) => i.rarity === "common" && !s.player.items.includes(i.id));
  s.player.items.push(item.id);
  s.run.pawnBonus = 50;
  const goldBefore = s.run.gold;
  s = Game.dispatch(s, { type: "SELL_ITEM", itemId: item.id });
  // Движок: floor(floor(cost/2) × 1.5) — база округляется до продажи.
  assertEq(s.run.gold - goldBefore, Math.floor(Math.floor(item.cost / 2) * 1.5), "50% цены +50%");
  assert(!s.run.pawnBonus, "бонус потрачен");
});

test("«Герой за полцены»: рекрут стоит половину базовой цены", () => {
  const s = freshRun("DISC");
  s.run.pendingRecruitDiscount = 0.5;
  const heroId = Content.heroes.list.find((h) => h.inDeck).id;
  const base = 4 + Math.floor(Content.heroes.byId[heroId].power / 2);
  assertEq(Game.recruitPrice(heroId, s), Math.ceil(base * 0.5), "скидка применена");
});

test("«Таверна»: третий рекрут появляется и переживает реролл", () => {
  let s = freshRun("EXTRA");
  s.run.pendingExtraRecruit = 1;
  s = clearWave(s);
  s = Game.dispatch(s, { type: "ENTER_SHOP" });
  assertEq(s.shop.recruits.length, 3, "три рекрута");
  s = Game.dispatch(s, { type: "REROLL_SHOP" });
  assertEq(s.shop.recruits.length, 3, "реролл сохраняет размер таверны");
});

test("«Сломанная реликвия»: эпик выдаётся сразу (или компенсация золотом)", () => {
  let s = freshRun("RELIC");
  s.phase = "route";
  s.combat.routeOptions = [{ id: "brokenrelic" }];
  s = Game.dispatch(s, { type: "TAKE_ROUTE", kind: "brokenrelic" });
  const gotEpic = s.player.items.some((id) => Content.items.byId[id].rarity === "epic");
  assert(gotEpic || s.run.gold >= 15, "либо эпик в слотах, либо компенсация +15G");
});

test("«Вторая попытка»: UNDO_ROUTE откатывает выбор тропы целиком", () => {
  let s = freshRun("UNDO");
  const goldBefore = s.run.gold;
  s.phase = "route";
  s.combat.routeOptions = [{ id: "secondtry" }];
  s = Game.dispatch(s, { type: "TAKE_ROUTE", kind: "secondtry" });
  assert(s.run.routeUndo, "флаг отмены выставлен");
  assertEq(s.run.waveIndex, 1, "волна сдвинулась");
  s = Game.dispatch(s, { type: "UNDO_ROUTE" });
  assertEq(s.run.waveIndex, 0, "волна откатилась");
  assertEq(s.phase, "route", "возвращение на развилку");
  assert(!s.run.routeUndo, "отмена одноразовая");
  assert(s.combat.routeOptions.some((o) => o.id === "secondtry"), "опции развилки восстановлены");
  assertEq(s.run.gold, goldBefore, "золото откатилось");
});

test("Осколок Muerta с override заменяет базовую способность (collectSources)", () => {
  const s = freshRun("MUERTA");
  s.run.aghanims = { muerta: { shard: "muerta_sh" } };
  const card = { uid: "test-muerta", heroId: "muerta" };
  const sources = Triggers.collectSources(s, [card], "ON_PLAY");
  assert(sources.some((x) => x.kind === "aghanim" && x.def.sourceId === "muerta"), "осколок даёт источник");
  assert(!sources.some((x) => x.kind === "hero" && x.hero.id === "muerta"), "базовая способность скрыта override'ом");
});

test("powerPerGold не удваивается: bonus маршрута «Богатство» считается один раз", () => {
  let s = freshRun("WEALTH");
  s.run.gold = 50;
  s.phase = "route";
  s.combat.routeOptions = [{ id: "wealth" }];
  s = Game.dispatch(s, { type: "TAKE_ROUTE", kind: "wealth" });
  // 50G × 0.2 = +10 силы; раньше канал TAKE_ROUTE и setupWave складывались → 20.
  assertEq(s.combat.wave.powerBonus, 10, "один канал расчёта, +10 бою");
});

test("Лок: тумблер, два реролла подряд и покупка залоченного товара", () => {
  let s = toShop(freshRun("LOCK2"));
  s.run.gold = 100;
  const target = s.shop.offers[0].id;
  s = Game.dispatch(s, { type: "LOCK_OFFER", itemId: target });
  assert(s.shop.offers[0].locked, "замок выставлен");
  s = Game.dispatch(s, { type: "LOCK_OFFER", itemId: target });
  assert(!s.shop.offers[0].locked, "повторный клик снимает замок");
  s = Game.dispatch(s, { type: "LOCK_OFFER", itemId: target });
  s = Game.dispatch(s, { type: "REROLL_SHOP" });
  s = Game.dispatch(s, { type: "REROLL_SHOP" });
  assert(s.shop.offers.some((o) => o.id === target && o.locked), "лок переживает два реролла");
  assertEq(s.shop.offers.length, 5);
  // Покупка залоченного товара убирает его из лавки; реролл не resurrect'ит.
  s = Game.dispatch(s, { type: "BUY_ITEM", itemId: target });
  assert(!s.shop.offers.some((o) => o.id === target), "купленный товар исчез из лавки");
  s = Game.dispatch(s, { type: "REROLL_SHOP" });
  assert(!s.shop.offers.some((o) => o.id === target), "купленное не возвращается через лок");
});

// ---------- ранг-гейт предметов (лига III+) ----------

const GATED_IDS = Content.items.list.filter((i) => i.minRank).map((i) => i.id);
assert(GATED_IDS.length >= 20, "гейт-пул предметов должен пополниться: " + GATED_IDS.length);

test("Ранг-гейт: на I ранге гейт-предметы не появляются в лавке", () => {
  for (let seed = 0; seed < 10; seed++) {
    let s = freshRun("GATE" + seed);
    s = toShop(s);
    for (let reroll = 0; reroll < 3; reroll++) {
      for (const o of s.shop.offers) {
        assert(!Content.items.byId[o.id].minRank, "гейт-утечка на ранге I: " + o.id);
      }
      s = Game.dispatch(s, { type: "REROLL_SHOP" });
    }
  }
});

test("Ранг-гейт: на VII ранге гейт-предметы реально выпадают", () => {
  let seen = new Set();
  for (let seed = 0; seed < 12 && seen.size < 3; seed++) {
    let s = Game.dispatch(Game.createInitialState(""), {
      type: "START_RUN", seedCode: "HIGH" + seed, rules: "formation", rank: 7, starterId: "standard",
    });
    s = toShop(s);
    for (const o of s.shop.offers) if (Content.items.byId[o.id].minRank) seen.add(o.id);
    for (let reroll = 0; reroll < 4; reroll++) {
      s = Game.dispatch(s, { type: "REROLL_SHOP" });
      for (const o of s.shop.offers) if (Content.items.byId[o.id].minRank) seen.add(o.id);
    }
  }
  assert(seen.size >= 3, "ожидал ≥3 разных гейт-предметов на VII ранге, увидел: " + [...seen].join(", "));
});

test("Удача двигает редкости ПРЕДМЕТОВ: при удаче 40 эпики выходят чаще", () => {
  let s = toShop(freshRun("LUCKY"));
  s.run.gold = 999;
  s.run.fortune = 40; // luck = 40 → вклад в веса ограничен 10
  let epics = 0, total = 0;
  for (let i = 0; i < 40; i++) {
    s = Game.dispatch(s, { type: "REROLL_SHOP" });
    for (const o of s.shop.offers) {
      total++;
      if (Content.items.byId[o.id].rarity === "epic") epics++;
    }
  }
  assert(total >= 150, "полки должны заполняться без дублей пула: " + total);
  assert(epics >= 12, "эпиков при удаче 10+ должно быть много, получено " + epics + "/" + total);
});

test("Маршруты удачи: «Талисман странника» даёт +1 удачи", () => {
  let s = freshRun("CHARM");
  const luckBefore = Upgrades.luck(s);
  s.phase = "route";
  s.combat.routeOptions = [{ id: "wanderer_charm" }];
  s = Game.dispatch(s, { type: "TAKE_ROUTE", kind: "wanderer_charm" });
  assertEq(s.run.luckFlat, 1);
  assertEq(Upgrades.luck(s), luckBefore + 1);
});

test("После боя «призрачный» выбор не тянется в следующий бой", () => {
  let s = freshRun("GHOST");
  s.combat.selectedUids = [s.player.handUids[0], s.player.handUids[1]];
  s.combat.wave.hp = 1;
  s = Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  assert(
    s.combat.selectedUids.every((uid) => s.player.handUids.includes(uid)),
    "в выборе остались карты, которых нет в руке: " + s.combat.selectedUids.join(",")
  );
});

test("Смок: все 20 новых предметов применяются в бою без падений", () => {
  for (const id of GATED_IDS) {
    let s = freshRun("SMOKE" + id.length);
    s.player.items.push(id);
    s.combat.wave.hp = 1;
    s.combat.selectedUids = [s.player.handUids[0], s.player.handUids[1]];
    s = Game.dispatch(s, { type: "CONFIRM_FIGHT" });
    assert(s.combat.lastResolution, "бой с предметом " + id + " должен посчитаться");
  }
});
