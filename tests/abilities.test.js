// Способности героев v0.5 и предметы оси защиты. Каждая новая способность
// проверяется в боевом контуре в ОБОИХ режимах (classic и formation) — так же,
// как её увидит игрок. Хелперы с префиксом abl* — тесты грузятся в одном
// vm-контексте, имена не должны пересекаться с другими test-файлами.

suite("Способности стартовых героев v0.5");

function ablRun(seed, rules) {
  return Game.dispatch(Game.createInitialState(""), { type: "START_RUN", seedCode: seed || "ABL1", rules });
}
function ablHand(s, heroIds) {
  const uids = heroIds.map((h) => Object.values(s.cards).find((c) => c.heroId === h).uid);
  s.player.handUids = uids.slice();
  s.player.deckUids = Object.keys(s.cards).filter((uid) => !uids.includes(uid));
  s.player.discardUids = [];
  return uids;
}
function ablPlay(s, heroIds) {
  const uids = ablHand(s, heroIds);
  s.combat.selectedUids = uids.slice();
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  return s.combat.lastResolution;
}
function ablAdd(s, heroId) {
  DeckSys.addHero(s, heroId);
}
function ablStep(res, part) {
  return res.steps.some((st) => st.label.indexOf(part) !== -1);
}

test("Tusk — Snowball: +4 за соседа по слоту, в обоих режимах", () => {
  const edgeC = ablPlay(ablRun("ABL2"), ["tusk", "axe", "pudge"]);
  assertEq(edgeC.damage, 24, "classic: хай-карта 20 + 4 сосед");
  const centerC = ablPlay(ablRun("ABL2b"), ["axe", "tusk", "pudge"]);
  assertEq(centerC.damage, 28, "classic: +8 за двух соседей");
  const edgeF = ablPlay(ablRun("ABL2c", "formation"), ["tusk", "axe", "pudge"]);
  assertEq(edgeF.damage, 84, "formation Рампа: (16+5+15+4) × 2.1");
  const centerF = ablPlay(ablRun("ABL2d", "formation"), ["axe", "tusk", "pudge"]);
  assertEq(centerF.damage, 56, "formation Отряд: (17+15+8) × 1.4");
  assert(ablStep(centerF, "Tusk: +8 силы (2 соседа по слоту)"));
});

test("Sven — God's Strength: ×1.5 только если он сильнейший в бою", () => {
  const topF = ablPlay(ablRun("ABL3", "formation"), ["sven", "cm"]);
  assertEq(topF.damage, 42, "formation Дуэль: 20 × (1.4 × 1.5)");
  assert(ablStep(topF, "Sven: ×1.5"));
  const notTopF = ablPlay(ablRun("ABL3b", "formation"), ["sven", "centaur"]);
  assertEq(notTopF.damage, 52, "Centaur сильнее — урлы нет; Дуэль (10+5 Сила+4 Фронт+18) × 1.4");
  const topC = ablPlay(ablRun("ABL3c"), ["sven", "cm"]);
  assertEq(topC.damage, 23, "classic хай-карта 15 × 1.5");
});

test("Centaur — Trample: +4 силы за героя, только из первого слота", () => {
  const frontF = ablPlay(ablRun("ABL4", "formation"), ["centaur", "axe", "pudge"]);
  assertEq(frontF.damage, 77, "formation Отряд: (12+9+22+12) × 1.4");
  assert(ablStep(frontF, "Centaur Warrunner: +12 силы"));
  const backF = ablPlay(ablRun("ABL4b", "formation"), ["axe", "pudge", "centaur"]);
  assertEq(backF.combo.type, "ramp", "ранги 5,7,10 по возрастанию — Рампа");
  assertEq(backF.damage, 99, "(16+9+22) × 2.1");
  assert(!ablStep(backF, "Warrunner: +12"), "в тылу способности нет");
  const frontC = ablPlay(ablRun("ABL4c"), ["centaur", "axe", "pudge"]);
  assertEq(frontC.damage, 39, "classic: хай-карта 27 + 12");
});

test("Dawnbreaker — Fire Ring: в слоте 4 даёт +1 множитель за Универсала", () => {
  const c = ablPlay(ablRun("ABL5"), ["cm", "tusk", "primal", "dawnbreaker"]);
  assert(ablStep(c, "Dawnbreaker: +2 к множителю (2 × Универсал)"), "primal + dawnbreaker = 2 UNI");
  assertEq(c.damage, 125, "classic: хай-карта (5+25+8 Tusk) × (1+2) × 1.1 ставка");
  const front = ablPlay(ablRun("ABL5b", "formation"), ["dawnbreaker", "primal", "cm"]);
  assert(!ablStep(front, "Dawnbreaker: +"), "слот 1 — молчит");
});

test("Primal — Pulverize: ×2 в центре пятёрки (и 4 Protect 1 собирается)", () => {
  // Каноничный 4p1: кэрри 11 в слоте 3, вся свита ≤7 (на 4+ слабее КАЖДОГО).
  // Zeus «рядом INT» — cm поставлена соседом, чтобы Static Field жил.
  const f = ablPlay(ablRun("ABL6", "formation"), ["zeus", "cm", "primal", "pudge", "tusk"]);
  assertEq(f.combo.type, "protect", "кэрри 11 против сильнейшего из свиты 7: 11 ≥ 7+4");
  assertEq(f.damage, 810, "(23+5 связки+28+4 Tusk) × ((3.0+0.4 Интеллект+2 Zeus) × 2 Pulverize) × 1.25");
  assert(ablStep(f, "Primal Beast: ×2"));
  const c = ablPlay(ablRun("ABL6b"), ["tusk", "axe", "primal", "pudge", "centaur"]);
  assertEq(c.damage, 113, "classic хай-карта 45 × 2 × 1.25");
});

suite("Способности таверны v0.5");

test("Terrorblade — Soul Mirror: копирует атрибут соседа СПРАВА", () => {
  const s = ablRun("ABL7", "formation");
  ablAdd(s, "terrorblade");
  const f = ablPlay(s, ["terrorblade", "cm"]);
  assert(ablStep(f, "Terrorblade копирует атрибут «Интеллект»"), "зеркало смотрит вправо");
  assertEq(f.damage, 41, "formation Дуэль: (10+13) × (1.4+0.4 Интеллект)");
  const s2 = ablRun("ABL7b");
  ablAdd(s2, "terrorblade");
  const c = ablPlay(s2, ["terrorblade", "cm"]);
  assertEq(c.damage, 18, "classic: копия атрибута на урон не влияет");
});

test("Rubick — Fade Bolt: +9 силы рядом с INT", () => {
  const s = ablRun("ABL8", "formation");
  ablAdd(s, "rubick");
  const f = ablPlay(s, ["rubick", "zeus"]);
  assert(ablStep(f, "Rubick: +9 силы"));
  assertEq(f.damage, 118, "formation Дуэль: (10+12+9) × (1.4+0.4+2 Zeus)");
  const s2 = ablRun("ABL8b");
  ablAdd(s2, "rubick");
  const c = ablPlay(s2, ["rubick", "zeus"]);
  assertEq(c.damage, 78, "classic: (17+9) × (1+2 Zeus)");
});

test("Kez — Echo Slash: +10 силы за средний ранг в отряде", () => {
  const s = ablRun("ABL9", "formation");
  ablAdd(s, "kez");
  const f = ablPlay(s, ["tusk", "kez", "centaur"]);
  assert(ablStep(f, "Kez: +10 силы"));
  assertEq(f.damage, 116, "formation Рампа (3,7,10): (16+5+20+10+4) × 2.1");
  const s2 = ablRun("ABL9b");
  ablAdd(s2, "kez");
  const c = ablPlay(s2, ["tusk", "kez", "centaur"]);
  assertEq(c.damage, 39, "classic хай-карта (25+10+4)");
});

test("Ancient Apparition — Ice Blast: Aegis босса не срабатывает", () => {
  const s = ablRun("ABL10", "formation");
  ablAdd(s, "ancient_apparition");
  s.combat.wave = {
    towerId: "roshan", name: "Roshan", emoji: "👹", isBoss: true, miniBoss: false, elite: false,
    hp: 100, maxHp: 100, modifiers: [{ id: "aegis" }], enemyItems: [], aegisUsed: false,
  };
  const res = ablPlay(s, ["ancient_apparition", "primal", "centaur", "sven", "dawnbreaker"]);
  assert(ablStep(res, "Aegis заблокирован"), "Ice Blast отрицает возрождение");
  assertEq(res.killed, true, "башня умерла насовсем");
  assertEq(s.combat.wave.aegisUsed, false, "Aegis даже не потрачен");
  // контроль: без AA эгид срабатывает
  const s2 = ablRun("ABL10b");
  s2.combat.wave = { towerId: "roshan", name: "Roshan", emoji: "👹", isBoss: true, miniBoss: false, elite: false,
    hp: 100, maxHp: 100, modifiers: [{ id: "aegis" }], enemyItems: [], aegisUsed: false };
  const res2 = ablPlay(s2, ["primal", "centaur", "sven", "dawnbreaker", "juggernaut"]);
  assertEq(res2.killed, false, "без AA Рошан возрождается");
  assertEq(s2.combat.wave.aegisUsed, true);
});

suite("Предметы оси защиты (Desolator / Pipe)");

test("Desolator: −10 брони в формациях, +6 силы в любом режиме", () => {
  const s = ablRun("ABL11", "formation");
  s.combat.wave.towerId = "t2";
  s.player.items.push("desolator");
  const res = ablPlay(s, ["cm", "tusk", "axe", "pudge", "sven"]);
  assertEq(res.damage, 260, "(50+8+6) × 2.2 × 1.5 × 1.25 — броня 14 минус 10 коррозии");
  assert(ablStep(res, "Desolator: −10 к броне"));
  const classic = ablRun("ABL11b");
  classic.player.items.push("desolator");
  const res2 = ablPlay(classic, ["cm", "tusk"]);
  assertEq(res2.damage, 20, "classic: хай-карта 10 + 4 Tusk + 6 коррозии");
});

test("Pipe: магический урон игнорирует сопротивление T3 (+1 множитель)", () => {
  const s = ablRun("ABL12", "formation");
  s.combat.wave.towerId = "t3"; // armor 18, mr 25%
  const bare = ablPlay(s, ["juggernaut", "cm", "zeus", "axe", "morphling"]);
  assertEq(bare.damage, 230, "Треугольник: (16+5+6 связки+24+10 Axe) × (1.9+0.4+2 Zeus) × 1.25, минус 30% mr");
  const s2 = ablRun("ABL12b", "formation");
  s2.combat.wave.towerId = "t3";
  s2.player.items.push("pipe");
  const res = ablPlay(s2, ["juggernaut", "cm", "zeus", "axe", "morphling"]);
  assertEq(res.damage, 404, "(61 × (4.3+1 Pipe)) × 1.25 = 404 — сопротивление игнорируется");
  assert(ablStep(res, "магический урон игнорирует сопротивление"));
});

suite("Предметы-капстоуны v0.7 и переход актов");

test("Ethereal Blade: ×1.4 за магический урон", () => {
  const s = ablRun("ABL13", "formation");
  s.combat.wave.towerId = "t3";
  s.player.items.push("ethereal_blade");
  const res = ablPlay(s, ["juggernaut", "cm", "zeus", "axe", "morphling"]);
  assertEq(res.damage, 321, "61 × (4.3 × 1.4 Ethereal) × 1.25, минус 30% mr");
  assert(ablStep(res, "Ethereal Blade: ×1.4"));
});

test("Monkey King Bar: +10 силы и ×1.25 за физический урон", () => {
  const s = ablRun("ABL14", "formation");
  s.combat.wave.towerId = "t2";
  s.player.items.push("mkb");
  const res = ablPlay(s, ["cm", "tusk", "axe", "pudge", "sven"]);
  assertEq(res.damage, 337, "(50+8+10) × 3.3 × 1.25 ставка = 351, минус 14 брони");
  assert(ablStep(res, "Monkey King Bar"));
});

test("Eye of Skadi: босс без Aegis возрождения", () => {
  const s = ablRun("ABL15");
  s.player.items.push("skadi");
  s.combat.wave = { towerId: "roshan", name: "Roshan", emoji: "👹", isBoss: true, miniBoss: false, elite: false,
    hp: 100, maxHp: 2800, modifiers: [{ id: "aegis" }], enemyItems: [], aegisUsed: false };
  const res = ablPlay(s, ["axe", "morphling", "zeus", "pudge", "juggernaut"]);
  assertEq(res.killed, true, "Skadi: босс умер насовсем");
  assertEq(s.combat.wave.aegisUsed, false);
  assert(ablStep(res, "башня больше не возродится"));
});

test("Dragon Lance: предмет скрепляет строй (+3 × n−1)", () => {
  const s = ablRun("ABL16");
  s.player.items.push("dragon_lance");
  const res = ablPlay(s, ["tusk", "axe", "pudge"]);
  assertEq(res.damage, 30, "classic: 20 + 4 Tusk + 6 Lance (строй из 3)");
  assert(ablStep(res, "Dragon Lance: +6 силы (строй из 3 героев)"));
});

test("Drum of Endurance: +0.25 множителя за героя", () => {
  const s = ablRun("ABL17");
  s.player.items.push("drum");
  const res = ablPlay(s, ["axe", "morphling", "zeus"]);
  assertEq(Math.round(res.mult * 100) / 100, 3.75, "3 (Ганг 5-5-5) + 0.75 (3 героя)");
  assertEq(res.damage, 206, "(30+15+10 Axe) × 3.75");
});

test("Акт-переход: босс акта даёт +5 золота и казарму, дальше — новый акт", () => {
  const s = ablRun("ABL18");
  const goldBefore = s.run.gold;
  s.run.waveIndex = 4;
  const def = Content.waves.byId["roshan"];
  s.combat.wave = { towerId: "roshan", name: def.name, emoji: def.emoji, isBoss: true, miniBoss: false, elite: false,
    hp: 100, maxHp: def.hp, gold: def.gold, modifiers: [], enemyItems: [], aegisUsed: false };
  s.player.discardsLeft = 0; // бонус меткости за сбросы проверяется в bugfix.test.js
  ablPlay(s, ["axe", "morphling", "zeus", "pudge", "juggernaut"]);
  assertEq(s.combat.outcome, "cleared");
  assertEq(s.run.gold, goldBefore + 10 + 5 + 5 + 3, "зачистка 10 + акт-премия 5 + оверкилл 5 (кап) + бонус скорости 3G");
  assert(s.log.some((l) => l.includes("АКТ 1 ПРОЙДЕН")), "лог акта");
  assertEq(s.phase, "wave", "победа только после акта 3");
  Game.dispatch(s, { type: "ENTER_SHOP" });
  Game.dispatch(s, { type: "LEAVE_SHOP" });
  Game.dispatch(s, { type: "TAKE_ROUTE", kind: "normal" });
  assertEq(s.run.act, 2, "начался акт 2");
  assertEq(s.combat.wave.name, "Руины");
});
