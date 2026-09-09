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
  assertEq(res.damage, 39, "10 + 4 Tusk + 25");
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
  assertEq(res.power, 57, "10 + 12 карт + 25 heart + 10 kaya");
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
  const res = play(s, ["dawnbreaker", "centaur", "tusk", "cm", "sven"]);
  // 9,10,3,2,8: бамп 10→9 → пара 9-9: (10+32+8 Tusk) × (2+1 Dawnbreaker-UNI) × 1.25 = 188
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
  assertEq(three.damage, 45, "(5+13+4 Tusk+8) × 1.5 Sven");
  const s2 = newRun("MET2");
  s2.player.items.push("meteor_hammer");
  const two = play(s2, ["tusk", "cm"]);
  assertEq(two.damage, 14, "без триггера (10+4 Tusk)");
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
