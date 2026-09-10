suite("Lab: маршруты, таверна, увольнение, тренировка, проклятия, новые герои");

function newRun(seed) {
  return Game.dispatch(Game.createInitialState(""), { type: "START_RUN", seedCode: seed || "LAB0" });
}

function uidOf(s, heroId) {
  return Object.values(s.cards).find((c) => c.heroId === heroId).uid;
}

function forceHand(s, heroIds) {
  const uids = heroIds.map((h) => uidOf(s, h));
  s.player.handUids = uids.slice();
  s.player.deckUids = Object.keys(s.cards).filter((uid) => !uids.includes(uid));
  s.player.discardUids = [];
  return uids;
}

function play(s, heroIds) {
  forceHand(s, heroIds);
  s.combat.selectedUids = s.player.handUids.slice();
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  return s.combat.lastResolution;
}

function setWave(s, waveId, opts = {}) {
  const def = Content.waves.byId[waveId];
  const hp = opts.hpMult ? Math.round(def.hp * opts.hpMult) : def.hp;
  s.combat.wave = {
    towerId: waveId, name: def.name, emoji: def.emoji,
    isBoss: !!def.isBoss, miniBoss: !!def.miniBoss, elite: !!opts.elite,
    hp, maxHp: hp,
    modifiers: (def.modifiers || []).concat(opts.curse ? [{ id: opts.curse }] : []).map((m) => ({ id: m.id })),
    enemyItems: [], aegisUsed: false,
  };
}

function deckTotal(s) {
  return s.player.handUids.length + s.player.deckUids.length + s.player.discardUids.length;
}

suite("Маршруты");

test("LEAVE_SHOP открывает развилку; лагерь реально пропускает следующую волну", () => {
  const s = newRun("RT1");
  s.combat.outcome = "cleared";
  Game.dispatch(s, { type: "ENTER_SHOP" });
  Game.dispatch(s, { type: "LEAVE_SHOP" });
  assertEq(s.phase, "route", "развилка открыта");
  const ids = s.combat.routeOptions.map((o) => o.id);
  assertEq(ids[0], "normal", "обычная башня всегда первая");
  assert(ids.includes("camp"), "лагерь в опциях, пока не зачищен");
  const goldBefore = s.run.gold;
  const barracksBefore = s.run.barracks;
  Game.dispatch(s, { type: "TAKE_ROUTE", kind: "camp" });
  assertEq(s.phase, "shop", "лагерь возвращает в лавку");
  assertEq(s.run.gold, goldBefore + 6, "+6 золота");
  assertEq(s.run.barracks, Math.min(Game.BARRACKS_MAX, barracksBefore + 1), "+1 казарма");
  assert(s.run.campBoon, "привал на увольнение");
  assert(s.run.skipNextBattle, "следующий бой помечен к пропуску");
  // Выходим из лавки — волна 2 листается без боя, развилка сразу за неё.
  Game.dispatch(s, { type: "LEAVE_SHOP" });
  assertEq(s.run.waveIndex, 1, "волна 2 (T2) пропущена без боя");
  assertEq(s.phase, "route", "сразу развилка за пропущенной волной");
  assert(s.combat.routeOptions.every((o) => o.id !== "camp"), "два лагеря подряд невозможны");
  // Обычная башня после пропуска: волна 3, стандартное HP
  Game.dispatch(s, { type: "TAKE_ROUTE", kind: "normal" });
  assertEq(s.phase, "wave", "бой");
  assertEq(s.run.waveIndex, 2, "волна 3");
  const def = Content.waves.byId[Content.waves.order[s.run.waveIndex]];
  assertEq(s.combat.wave.hp, def.hp, "обычное HP");
  // campTaken сброшен только что отыгранной волной — лагерь снова доступен дальше
});

test("Лагерь перед мини-боссом: пропуск приводит сразу к Рошану", () => {
  const s = newRun("RT1B");
  s.run.waveIndex = 2;
  s.combat.outcome = "cleared";
  Game.dispatch(s, { type: "ENTER_SHOP" });
  Game.dispatch(s, { type: "LEAVE_SHOP" });
  // форк для волны 4 (Techies, мини-босс) — инжектим лагерь детерминированно
  s.combat.routeOptions = [{ id: "normal" }, { id: "camp" }];
  Game.dispatch(s, { type: "TAKE_ROUTE", kind: "camp" });
  assertEq(s.phase, "shop");
  Game.dispatch(s, { type: "LEAVE_SHOP" });
  assertEq(s.run.waveIndex, 4, "Techies (3) пропущены, стоим на Рошане (4)");
  assertEq(s.phase, "wave", "после пропуска — сразу босс, без развилки");
  assert(s.combat.wave.isBoss, "Рошан");
});

test("Перед боссом развилки нет — сразу волна Рошана", () => {
  const s = newRun("RT2");
  s.run.waveIndex = 3; // зачищена Techies, впереди Рошан
  s.combat.outcome = "cleared";
  Game.dispatch(s, { type: "ENTER_SHOP" });
  Game.dispatch(s, { type: "LEAVE_SHOP" });
  assertEq(s.phase, "wave", "без развилки");
  assert(s.combat.wave.isBoss, "Рошан");
});

test("Элитный маршрут: HP ×1.5, проклятие в модификаторах, эпик в лавке", () => {
  const s = newRun("RT3");
  s.combat.outcome = "cleared";
  Game.dispatch(s, { type: "ENTER_SHOP" });
  Game.dispatch(s, { type: "LEAVE_SHOP" });
  // Инжектим опции: элитка с фиксированным проклятием (ролл элитки не гарантирован).
  s.combat.routeOptions = [{ id: "normal" }, { id: "elite", curse: "silence" }];
  Game.dispatch(s, { type: "TAKE_ROUTE", kind: "elite" });
  assertEq(s.phase, "wave");
  const def = Content.waves.byId[Content.waves.order[s.run.waveIndex]];
  assertEq(s.combat.wave.maxHp, Math.round(def.hp * 1.5), "HP ×1.5");
  assert(s.combat.wave.elite, "флаг элиты");
  assert((s.combat.wave.modifiers || []).some((m) => m.id === "silence"), "проклятие на волне");
  s.combat.wave.hp = 1;
  s.player.fightsLeft = 4;
  play(s, ["tusk"]);
  assertEq(s.combat.outcome, "cleared");
  Game.dispatch(s, { type: "ENTER_SHOP" });
  assert(s.shop.offers.some((o) => Content.items.byId[o.id].rarity === "epic"), "гарантированный эпик");
  assert(s.shop.recruits.length === 2, "таверна предлагает 2 рекрутов");
});

suite("Проклятия элиток");

test("Фортификация: малые комбо ×0.5, BKB игнорирует", () => {
  const s = newRun("CRS1");
  setWave(s, "t1", { curse: "bastion" });
  const res = play(s, ["axe", "morphling", "tusk"]);
  assertEq(res.damage, 27, "пара (10+13+4 Tusk-сосед) × 2 × 0.5");
  const s2 = newRun("CRS2");
  s2.player.items.push("bkb");
  setWave(s2, "t1", { curse: "bastion" });
  assertEq(play(s2, ["axe", "morphling", "tusk"]).damage, 54, "BKB: полный урон");
});

test("Туман войны: ранг ≤4 не даёт силы", () => {
  const s = newRun("CRS3");
  setWave(s, "t1", { curse: "fog" });
  const res = play(s, ["tusk", "centaur"]);
  assertEq(res.power, 19, "5 базы + 10 кентавра (туск 3 в тумане) + 4 Tusk-сосед");
});

test("Безмолвие: герои молчат, предметы работают", () => {
  const s = newRun("CRS4");
  s.player.items.push("kaya");
  setWave(s, "t1", { curse: "silence" });
  const res = play(s, ["zeus", "morphling"]);
  assertEq(res.mult, 3, "2 база + 1 кая (без Static Field)");
  assertEq(res.damage, 90, "(20 + 10 кая) × 3");
});

test("Адаптация: повтор комбинации ×0.5, смена комбо сбрасывает", () => {
  const s = newRun("CRS5");
  setWave(s, "t1", { curse: "adaptation" });
  assertEq(play(s, ["axe", "morphling", "tusk"]).damage, 54, "первая пара — полная (27 × 2)");
  assertEq(play(s, ["axe", "morphling", "tusk"]).damage, 27, "повтор пары ×0.5");
  assertEq(play(s, ["tusk", "cm", "centaur"]).damage, 24, "другое комбо (хай-карта + 4 Tusk) — полная");
});

test("Обезоруживание: 4 слота, BKB возвращает пятый", () => {
  const s = newRun("CRS6");
  setWave(s, "t1", { curse: "disarm" });
  assertEq(Game.maxSlots(s), 4);
  forceHand(s, ["axe", "morphling", "zeus", "pudge", "juggernaut"]);
  for (const uid of s.player.handUids.slice()) Game.dispatch(s, { type: "SELECT_CARD", uid });
  assertEq(s.combat.selectedUids.length, 4, "пятый не выбрался");
  const s2 = newRun("CRS7");
  s2.player.items.push("bkb");
  setWave(s2, "t1", { curse: "disarm" });
  assertEq(Game.maxSlots(s2), 5, "BKB снимает обезоруживание");
});

suite("Таверна, увольнение, тренировка");

test("Рекрут нанимается за 4 + ранг/2 и попадает в колоду", () => {
  const s = newRun("TAV1");
  s.phase = "shop";
  s.shop.recruits = ["lina", "tiny"]; // силы 6 и 10 → 7g и 9g
  s.run.gold = 100;
  const before = deckTotal(s);
  Game.dispatch(s, { type: "BUY_RECRUIT", heroId: "lina" });
  assertEq(s.run.gold, 93, "−7 золота");
  assertEq(deckTotal(s), before + 1, "карта добавлена");
  assert(!s.shop.recruits.includes("lina"), "убран из таверны");
  assert(Object.values(s.cards).some((c) => c.heroId === "lina"), "карта создана");
});

test("Увольнение: −4g, минимум 8 карт, привал лагеря бесплатный", () => {
  const s = newRun("EXL1");
  s.phase = "shop";
  s.run.gold = 10;
  assertEq(deckTotal(s), 12, "старт 12");
  Game.dispatch(s, { type: "EXILE_HERO", heroId: "tusk" });
  assertEq(s.run.gold, 6, "−4 золота");
  assert(!Object.values(s.cards).some((c) => c.heroId === "tusk"), "карта удалена");
  s.run.gold = 100;
  let guard = 10;
  while (deckTotal(s) > Game.DECK_MIN && guard--) {
    Game.dispatch(s, { type: "EXILE_HERO", heroId: Object.values(s.cards)[0].heroId });
  }
  assertEq(deckTotal(s), Game.DECK_MIN, "ниже 8 не уволить");
  // нанимаем и увольняем с привалом бесплатно
  s.shop.recruits = ["meepo"];
  Game.dispatch(s, { type: "BUY_RECRUIT", heroId: "meepo" });
  s.run.campBoon = true;
  const goldBefore = s.run.gold;
  Game.dispatch(s, { type: "EXILE_HERO", heroId: "meepo" });
  assertEq(s.run.gold, goldBefore, "привал = бесплатно");
  assert(!Object.values(s.cards).some((c) => c.heroId === "meepo"), "нанятый уволен");
});

test("Тренировка: +1 ранг за 5g, влияет на силу, кап 12", () => {
  const s = newRun("TRN1");
  s.phase = "shop";
  s.run.gold = 20;
  Game.dispatch(s, { type: "TRAIN_HERO", heroId: "tusk" });
  assertEq(Game.rankOf(s, "tusk"), 4, "ранг 3 → 4");
  assertEq(s.run.gold, 15, "−5 золота");
  s.phase = "wave";
  s.player.fightsLeft = 4;
  const res = play(s, ["tusk"]);
  assertEq(res.power, 9, "5 базы + 4 ранга");
  s.run.gold = 100;
  s.run.ranks.tusk = 12;
  Game.dispatch(s, { type: "TRAIN_HERO", heroId: "tusk" });
  assertEq(Game.rankOf(s, "tusk"), 12, "кап 12");
  assertEq(s.run.gold, 100, "у капа не тратится");
});

suite("Новые герои таверны");

function recruitInto(s, heroId) {
  DeckSys.addHero(s, heroId);
  return uidOf(s, heroId);
}

test("Lina: +20 силы при 1–2 героях", () => {
  const s = newRun("NH1");
  const lina = recruitInto(s, "lina");
  forceHand(s, ["cm"]);
  s.player.handUids.unshift(lina);
  s.combat.selectedUids = [lina, uidOf(s, "cm")];
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  // хай-карта: 5 + 6 + 2 = 13, Lina +20 → 33
  assertEq(s.combat.lastResolution.power, 33);
});

test("Huskar: +3 силы за разрушенную казарму", () => {
  const s = newRun("NH2");
  recruitInto(s, "huskar");
  s.run.barracks = 1; // потеряна 1 из 2
  setWave(s, "t1");
  const res = play(s, ["huskar"]);
  assertEq(res.power, 17, "5 базы + 9 хускар + 3 за казарму");
});

test("Skywrath: ×2 в одиночке; Tidehunter: 5 героев +2 множителя", () => {
  const s = newRun("NH3");
  const sky = recruitInto(s, "skywrath");
  forceHand(s, ["cm"]);
  s.player.handUids.unshift(sky);
  s.combat.selectedUids = [sky];
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  assertEq(s.combat.lastResolution.mult, 2, "харас ×2");
  const s2 = newRun("NH4");
  recruitInto(s2, "tidehunter");
  const res = play(s2, ["tidehunter", "axe", "morphling", "zeus", "pudge"]);
  // сет 5-5-5 (морф копирует STR): база 3 + tidehunter 2 = 5
  assertEq(res.mult, 5);
});

test("Bounty: точный ласт-хит приносит +8 золота", () => {
  const s = newRun("NH5");
  const bounty = recruitInto(s, "bounty");
  forceHand(s, ["cm"]);
  s.player.handUids.unshift(bounty);
  setWave(s, "t1");
  s.combat.wave.hp = 11; // 5 базы + 3 баунти + 2 cm = 10 + 1 харас-золото... урон 10; ставим 10
  s.combat.wave.hp = 10;
  s.combat.selectedUids = [bounty, uidOf(s, "cm")];
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  // урон 10 ровно в HP: ласт-хит 5 + Track 8 = 13
  assertEq(s.combat.lastResolution.goldGained, 13, "5 ласт-хит + 8 Track");
});
