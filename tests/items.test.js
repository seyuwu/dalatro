suite("Items v2 + Advisor");

function newRun(seed) {
  return Game.dispatch(Game.createInitialState(""), { type: "START_RUN", seedCode: seed || "ITEMS1" });
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

test("Heart: +25 силы", () => {
  const s = newRun("HEART1");
  s.player.items.push("heart");
  const res = play(s, ["tusk", "cm"]);
  // хай-карта (5+3+2=10) + 4 Tusk-сосед + 25 = 39
  assertEq(res.damage, 24, "10 + 4 Tusk + 10 Heart (+0 казармы)");
});

test("Satanic: ×1.5 на паре, молчит на хай-карте", () => {
  const s = newRun("SAT1");
  s.player.items.push("satanic");
  const pair = play(s, ["pudge", "juggernaut", "tusk"]);
  // пара 7-7: (10+17+4 Tusk) × 2 × 1.5 = 93
  assertEq(pair.damage, 93, "31 × 2, множитель 2 → ×1.5 = 3");
  const s2 = newRun("SAT2");
  s2.player.items.push("satanic");
  const high = play(s2, ["tusk", "cm"]);
  assertEq(high.damage, 14, "хай-карта 10 + 4 Tusk, без Satanic");
});

test("Radiance: +3 силы за каждого сыгранного", () => {
  const s = newRun("RAD1");
  s.player.items.push("radiance");
  const res = play(s, ["axe", "morphling", "zeus", "pudge", "centaur"]);
  // сет 5-5-5: 30 + (5+5+5+7+10=32) + 15 = 77; морф копирует силу у axe → str; zeus без int-соседа
  // axe: сет → +10 → 87; mult 3 → 261, ставка ×1.25 за пятёрку → 326
  assertEq(res.power, 87, "30 + 32 + 15 + 10");
  assertEq(res.damage, 326, "round(87 × 3 × 1.25)");
});

test("Octarine: +1 множитель за каждый предмет", () => {
  const s = newRun("OCT1");
  s.player.items.push("octarine", "heart", "kaya");
  const res = play(s, ["zeus", "morphling", "cm"]);
  // морф копирует INT у зевса (слева) → зевс +2; флеш? инт 3, аги 0 — нет. пара 5-5: (10+15) × (2+2+3) = 25 × 7
  // kaya +10 силы → 35; octarine даёт +3 (3 предмета)
  assertEq(res.combo.type, "pair", "комбо");
  assertEq(res.power, 42, "10 + 12 карт + 10 heart + 10 kaya");
  assertEq(res.mult, 8, "2 база + 2 zeus + 1 kaya + 3 octarine");
});

test("Vladmir: +2 золота за бой, харас добавляет +1", () => {
  const s = newRun("VLD1");
  s.player.items.push("vladmir");
  const goldBefore = s.run.gold;
  const res = play(s, ["tusk"]);
  assertEq(s.run.gold, goldBefore + 3, "+2 за бой и +1 за харас одним героем");
  assertEq(res.damage, 8, "обычный урон не тронут");
});

test("Shadow Blade: бамп сильнейшего только если он улучшает комбо", () => {
  const s = newRun("SHB1");
  s.player.items.push("shadow_blade");
  const res = play(s, ["cm", "tusk", "centaur", "dawnbreaker", "sven"]);
  // 2,3,10,9,8: бамп 10→9 → пара 9-9: (10+32+8 Tusk) × (2+1 Fire Ring) × 1.25 = 188
  assertEq(res.combo.type, "pair", "бамп собрал пару из 9+10");
  assertEq(res.damage, 188, "50 × 3 × 1.25");
  // а вот пару бамп ломать не должен — движок выбирает лучший вариант
  const s2 = newRun("SHB2");
  s2.player.items.push("shadow_blade");
  const res2 = play(s2, ["axe", "morphling", "tusk"]);
  // 5,5,3: без бампа — пара (10+13+4 Tusk)×2; с бампом сильнейшего (5→6) — high card; выбор: пара
  assertEq(res2.combo.type, "pair", "бамп не сломал пару");
  assertEq(res2.damage, 54, "27 × 2");
});

test("Meteor Hammer: +8 силы при 3+ героях", () => {
  const s = newRun("MET1");
  s.player.items.push("meteor_hammer");
  const three = play(s, ["tusk", "cm", "sven"]);
  assertEq(three.damage, 83, "(18+4 Tusk) × 1.5 Sven + 50 осады");
  const s2 = newRun("MET2");
  s2.player.items.push("meteor_hammer");
  const two = play(s2, ["tusk", "cm"]);
  assertEq(two.damage, 64, "(10+4 Tusk) + 50 осады");
});

suite("Advisor");

test("analyzeBuilds: флеш Силы 5/5 и ганг силы 5 в стартовой колоде", () => {
  const s = newRun("ADV1");
  const builds = Advisor.analyzeBuilds(s);
  const flush = builds.find((b) => b.key === "flush_str");
  assert(flush, "строка флеша силы");
  assertEq(flush.have, 5, "5 героев STR");
  const trips = builds.find((b) => b.key === "trips_5");
  assert(trips, "ганг пятёрок");
  assertEq(trips.have, 3, "три героя силы 5");
  const straight = builds.find((b) => b.key === "straight");
  assert(straight, "стрит-прогресс");
  assertEq(straight.have, 5, "7,8,9,10,11 все в колоде");
});

test("itemSynergy: Daedalus видит PA, BKB видит модификатор следующей волны", () => {
  const s = newRun("ADV2");
  s.run.waveIndex = 0; // следующая волна — T2 с Armor
  const lines = Advisor.itemSynergy("daedalus", s);
  assert(lines.some((l) => l.includes("Phantom Assassin")), "PA-синергия");
  const bkbLines = Advisor.itemSynergy("bkb", s);
  assert(bkbLines.some((l) => l.includes("Armor")), "BKB знает про Armor на T2");
});

// ---------- Refresher: читаемость стека боя ----------

function stepLabels(res) {
  return res.steps.map((st) => st.label);
}

test("Refresher: второй прогон способностей помечен «повтор», порядок виден в стеке", () => {
  const s = newRun("RFR1");
  s.player.items.push("refresher");
  const res = play(s, ["zeus", "morphling"]);
  assertEq(res.damage, 120, "урон как в combat-тесте: 20 × (2+2+2)");
  const labels = stepLabels(res);
  const refIdx = labels.findIndex((l) => l.includes("Refresher Orb"));
  const firstIdx = labels.findIndex((l) => l.includes("Zeus: +2"));
  const repeatIdx = labels.findIndex((l) => l.includes("повтор"));
  assert(refIdx !== -1, "шаг рефрешера в стеке");
  assert(firstIdx !== -1 && firstIdx < refIdx, "первый Static Field до рефрешера");
  assert(repeatIdx !== -1 && repeatIdx > refIdx, "повтор Static Field после рефрешера");
  assertEq(labels.filter((l) => l.includes("повтор")).length, 1, "ровно один повторный шаг");
});

test("Безмолвие: Refresher пишет «заглушен», герои молчат, повторов нет", () => {
  const s = newRun("RFRSL1");
  s.player.items.push("refresher");
  s.combat.wave.modifiers.push({ id: "silence" });
  const res = play(s, ["zeus", "morphling"]);
  const labels = stepLabels(res);
  assert(labels.some((l) => l.includes("Refresher Orb") && l.includes("заглушен")), "честный шаг вместо обещания двойного прогона");
  assert(!labels.some((l) => l.includes("Static Field")), "способности героев молчат");
  assert(!labels.some((l) => l.includes("повтор")), "второго прогона нет");
});

// ===== Эпики v2 (Tempest Double, Miser's Chest) =====

test("Tempest Double: первый бой волны — способности героев дважды, дальше один раз", () => {
  const s = newRun("TDOUBLE1");
  s.player.items.push("tempest_double");
  const res = play(s, ["zeus", "morphling"]);
  assertEq(res.damage, 120, "как с Refresher: 20 × (2+2+2)");
  assert(stepLabels(res).some((l) => l.includes("Tempest Double")), "шаг двойника в стеке");
  // Второй бой волны: FIGHT_FIRST уже не выполняется.
  forceHand(s, ["zeus", "morphling"]);
  s.combat.selectedUids = s.player.handUids.slice();
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  const res2 = s.combat.lastResolution;
  assertEq(res2.damage, 80, "без двойника: 20 × (2+2)");
  assert(!stepLabels(res2).some((l) => l.includes("повтор")), "повторного прогона нет");
});

test("Tempest Double под Безмолвием честно молчит", () => {
  const s = newRun("TDOUBLE2");
  s.player.items.push("tempest_double");
  s.combat.wave.modifiers.push({ id: "silence" });
  const res = play(s, ["zeus", "morphling"]);
  assertEq(res.damage, 40, "способности героев глушены: 20 × 2");
  assert(!stepLabels(res).some((l) => l.includes("повтор")), "второго прогона нет");
});

test("Miser's Chest: +1G за каждый неиспользованный сброс в бою", () => {
  const s = newRun("MCHEST1");
  s.player.items.push("misers_chest");
  const before = s.run.gold;
  const res = play(s, ["tusk", "cm"]);
  assertEq(s.run.gold - before, 3, "3 сброса не потрачены — +3G");
  assert(stepLabels(res).some((l) => l.includes("Miser's Chest") && l.includes("+3")), "шаг в стеке боя");
});
