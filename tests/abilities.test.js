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
  assertEq(edgeF.damage, 97, "formation: ранги 3,5,7 по возрастанию — Рампа (43+4) × 2.25");
  const centerF = ablPlay(ablRun("ABL2d", "formation"), ["axe", "tusk", "pudge"]);
  assertEq(centerF.damage, 65, "formation: порядок ломается — Отряд (43) × 1.5");
  assert(ablStep(centerF, "Tusk: +8 силы (2 соседа по слоту)"));
});

test("Sven — God's Strength: ×1.5 только если он сильнейший в бою", () => {
  const topF = ablPlay(ablRun("ABL3", "formation"), ["sven", "cm"]);
  assertEq(topF.damage, 50, "formation Дуэль: 22 × 1.5 × 1.5");
  assert(ablStep(topF, "Sven: ×1.5"));
  const notTopF = ablPlay(ablRun("ABL3b", "formation"), ["sven", "centaur"]);
  assertEq(notTopF.damage, 62, "Centaur сильнее — урлы нет; Дуэль (12+18+6 Сила+5 Фронт) × 1.5");
  const topC = ablPlay(ablRun("ABL3c"), ["sven", "cm"]);
  assertEq(topC.damage, 23, "classic хай-карта 15 × 1.5");
});

test("Centaur — Trample: +4 силы за героя, только из первого слота", () => {
  const frontF = ablPlay(ablRun("ABL4", "formation"), ["centaur", "axe", "pudge"]);
  assertEq(frontF.damage, 89, "formation Отряд: (14+11+22+12) × 1.5");
  assert(ablStep(frontF, "Centaur Warrunner: +12 силы"));
  const backF = ablPlay(ablRun("ABL4b", "formation"), ["axe", "pudge", "centaur"]);
  assertEq(backF.combo.type, "ramp", "ранги 5,7,10 по возрастанию — Рампа");
  assertEq(backF.damage, 115, "(18+11+22) × 2.25");
  assert(!ablStep(backF, "Warrunner: +12"), "в тылу способности нет");
  const frontC = ablPlay(ablRun("ABL4c"), ["centaur", "axe", "pudge"]);
  assertEq(frontC.damage, 39, "classic: хай-карта 27 + 12");
});

test("Dawnbreaker — Solar Guardian: +1 множитель за каждого Универсала", () => {
  const f = ablPlay(ablRun("ABL5", "formation"), ["dawnbreaker", "primal", "cm"]);
  assertEq(f.combo.type, "wedge", "Primal в центре — Клин");
  assertEq(f.damage, 170, "formation Клин: (18+22) × (2.25 + 2 за двух UNI), pure");
  assert(ablStep(f, "Dawnbreaker: +2 к множителю (2 героев Универсал)"));
  const c = ablPlay(ablRun("ABL5b"), ["dawnbreaker", "primal", "cm"]);
  assertEq(c.damage, 81, "classic хай-карта 27 × 3");
});

test("Primal — Pulverize: ×2 в центре пятёрки (и 4 Protect 1 собирается)", () => {
  const f = ablPlay(ablRun("ABL6", "formation"), ["tusk", "axe", "primal", "pudge", "centaur"]);
  assertEq(f.combo.type, "protect", "кэрри в центре: 11 против среднего 6.25, margin 4");
  assertEq(f.damage, 630, "(26+6+36+4 Tusk) × (3.5 × 2 Pulverize) × 1.25");
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
  assertEq(f.damage, 50, "formation Дуэль: (12+13) × (1.5+0.5 Интеллект)");
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
  assertEq(f.damage, 132, "formation Дуэль: (12+12+9) × (1.5+0.5+2 Zeus)");
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
  assertEq(f.damage, 131, "formation Рампа (3,7,10): (18+6+20+10+4) × 2.25");
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
  assertEq(res.damage, 323, "(55+8 Tusk+6) × 3.75 × 1.25 — броня 10 пробита коррозией");
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
  assertEq(bare.damage, 312, "(18+14+24+8 Jugg+10 Axe) × (2+0.5+2 Zeus) × 1.25, минус 25% mr");
  const s2 = ablRun("ABL12b", "formation");
  s2.combat.wave.towerId = "t3";
  s2.player.items.push("pipe");
  const res = ablPlay(s2, ["juggernaut", "cm", "zeus", "axe", "morphling"]);
  assertEq(res.damage, 509, "74 × (2+0.5+2+1 Pipe) × 1.25 — сопротивление игнорируется");
  assert(ablStep(res, "магический урон игнорирует сопротивление"));
});
