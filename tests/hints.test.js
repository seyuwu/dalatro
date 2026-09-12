// Тесты подсказок формаций в руке (FormationSys.suggestForHand +
// Game.refreshFormationHints). Хелперы свои — от других test-файлов не зависят.

suite("Подсказки формаций в руке");

function hRun(seed) {
  return Game.dispatch(Game.createInitialState(""), { type: "START_RUN", seedCode: seed || "HNT1", rules: "formation" });
}

function hForceHand(s, heroIds) {
  const uids = heroIds.map((h) => Object.values(s.cards).find((c) => c.heroId === h).uid);
  s.player.handUids = uids.slice();
  s.player.deckUids = Object.keys(s.cards).filter((uid) => !uids.includes(uid));
  s.player.discardUids = [];
  return uids;
}

// Стартовая раздача случайна и уже израсходовала часть кап — для сценария
// с фиксированными руками счётчики начинаем с нуля.
function hResetHints(s) {
  s.run.formationHints = { handKey: null, shows: {}, current: [] };
}

// Клички для юнит-тестов suggestForHand: чистые карты без Content.
const C = (uid, power, attr, heroId) => ({ uid, heroId: heroId || "h" + uid, power, attr });

test("юнит: Клин из трёх карт — сильнейший в центре, порядок в подсказке готов", () => {
  const cards = [C(1, 4, "str"), C(2, 8, "str"), C(3, 3, "int")];
  const hints = FormationSys.suggestForHand(cards);
  const wedge = hints.find((h) => h.id === "wedge");
  assert(wedge, "Клин найден в руке 4/8/3");
  assertEq(wedge.uids.join(","), "1,2,3", "сильнейший (uid 2) встал в центр");
  assert(wedge.damage > 0, "оценка урона положительная");
  assert(wedge.why && wedge.why.length > 0, "есть объяснение «почему»");
});

test("юнит: Рампа требует возрастания — порядок слотов в подсказке возрастающий", () => {
  const cards = [C(1, 8, "agi"), C(2, 4, "agi"), C(3, 2, "int")];
  const hints = FormationSys.suggestForHand(cards);
  const ramp = hints.find((h) => h.id === "ramp");
  assert(ramp, "Рампа найдена");
  assertEq(ramp.uids.join(","), "3,2,1", "ранги идут по возрастанию 2 → 4 → 8");
});

test("юнит: тривиальные тиры (Харас/Дуэль/Отряд) не подсказываются", () => {
  const cards = [C(1, 4, "str"), C(2, 8, "str"), C(3, 3, "int")];
  const hints = FormationSys.suggestForHand(cards);
  assert(!hints.some((h) => ["skirmish", "duel", "squad"].includes(h.id)), "только нетривиальные формации");
});

test("юнит: коллизия — Фаланга из 4 Силовиков выигрывает и показывается одной пилюлей", () => {
  const cards = [C(1, 9, "str"), C(2, 7, "str"), C(3, 6, "str"), C(4, 6, "str")];
  const hints = FormationSys.suggestForHand(cards);
  const ids = hints.map((h) => h.id);
  assert(ids.includes("phalanx"), "Фаланга из 4 Силовиков");
  const phalanx = hints.find((h) => h.id === "phalanx");
  assertEq(phalanx.uids.length, 4, "Фаланга играет всем набором");
  assert(hints.every((h) => h.uids.length >= 3), "нет подсказок из 1–2 карт");
});

test("юнит: allowed прячет формации под капом, выдача отсортирована по урону", () => {
  const cards = [C(1, 9, "str"), C(2, 7, "str"), C(3, 6, "str"), C(4, 6, "str")];
  const hints = FormationSys.suggestForHand(cards, { allowed: ["wedge"] });
  assert(hints.length >= 1 && hints.every((h) => h.id === "wedge"), "allowed — белый список формаций");
  const damages = FormationSys.suggestForHand(cards).map((h) => h.damage);
  for (let i = 1; i < damages.length; i++) assert(damages[i - 1] >= damages[i], "сортировка по урону");
});

test("юнит: короткая рука (меньше 3 карт) — подсказок нет", () => {
  assertEq(FormationSys.suggestForHand([C(1, 4, "str"), C(2, 8, "str")]).length, 0);
});

test("движок: рука собралась в Клин — подсказка появилась и кап посчитан", () => {
  const s = hRun("HNT2");
  hForceHand(s, ["tusk", "sven", "cm"]); // 3 / 8 / 2 — Клин со Свеном в центре
  hResetHints(s);
  Game.refreshFormationHints(s);
  const fh = s.run.formationHints;
  assert(fh.current.some((p) => p.id === "wedge"), "пилюля Клина в current");
  assertEq(fh.shows.wedge, 1, "первый показ");
  const wedge = fh.current.find((p) => p.id === "wedge");
  const powers = wedge.uids.map((uid) => Game.rankOf(s, s.cards[uid].heroId));
  assertEq(powers.join(","), "3,8,2", "порядок слотов готов: 3 → 8 → 2");
});

test("движок: трудная формация (Клин, тир 3) показывается дважды за забег", () => {
  const s = hRun("HNT3");
  hForceHand(s, ["tusk", "sven", "cm"]);
  hResetHints(s);
  Game.refreshFormationHints(s);
  assertEq(s.run.formationHints.shows.wedge, 1, "Клин: показ 1");
  hForceHand(s, ["axe", "pudge", "zeus"]); // 5 / 7 / 5 — Клин c Pudge в центре
  Game.refreshFormationHints(s);
  assertEq(s.run.formationHints.shows.wedge, 2, "Клин: показ 2");
  hForceHand(s, ["tusk", "sven", "cm"]);
  Game.refreshFormationHints(s);
  assert(!s.run.formationHints.current.some((p) => p.id === "wedge"), "кап исчерпан — Клин молчит");
  assertEq(s.run.formationHints.shows.wedge, 2, "капа не растёт сверх двух");
});

test("движок: лёгкая формация (Стена, тир 2) — один показ за забег", () => {
  const s = hRun("HNT7");
  hForceHand(s, ["sven", "pudge", "cm"]); // фронт 8/7 STR ≥6 — Стена
  hResetHints(s);
  Game.refreshFormationHints(s);
  assert(s.run.formationHints.current.some((p) => p.id === "wall"), "Стена найдена");
  assertEq(s.run.formationHints.shows.wall, 1);
  hForceHand(s, ["pudge", "sven", "zeus"]); // фронт 7/8 — снова возможна
  Game.refreshFormationHints(s);
  assertEq(s.run.formationHints.shows.wall, 1, "второго показа нет");
  assert(!s.run.formationHints.current.some((p) => p.id === "wall"), "Стена больше не подсказывается");
});

test("движок: рука без смены не пересчитывается, симуляция превью капы не жжёт", () => {
  const s = hRun("HNT4");
  hForceHand(s, ["tusk", "sven", "cm"]);
  hResetHints(s);
  Game.refreshFormationHints(s);
  const before = JSON.stringify(s.run.formationHints);
  Game.refreshFormationHints(s); // тот же handKey — no-op
  assertEq(JSON.stringify(s.run.formationHints), before, "no-op на той же руке");
  // Превью (Sim.simulate) — dispatch на клоне с s.simulate: капа не трогается.
  s.combat.selectedUids = s.player.handUids.slice();
  const clone = Sim.simulate(s, { type: "CONFIRM_FIGHT" });
  assert(clone, "симуляция работает");
  assertEq(s.run.formationHints.shows.wedge, 1, "боевая симуляция не увеличила капу");
});

test("движок: заминированная карта не участвует в подсказках", () => {
  const s = hRun("HNT5");
  const uids = hForceHand(s, ["tusk", "sven", "cm"]);
  hResetHints(s);
  s.combat.minedUids = [uids[1]]; // Свен заминирован — Клина нет
  Game.refreshFormationHints(s);
  assert(!s.run.formationHints.current.some((p) => p.id === "wedge"), "Клин требует Свена — пилюли нет");
});

test("движок: старт забега сам прогоняет пересчёт (handKey совпадает с рукой)", () => {
  const s = hRun("HNT6");
  const fh = s.run.formationHints;
  assert(fh.handKey !== null, "handKey выставлен при старте");
  assertEq(fh.handKey, s.player.handUids.slice().sort().join(","), "ключ совпадает с рукой");
});
