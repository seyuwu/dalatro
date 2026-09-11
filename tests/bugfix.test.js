// Аудит работоспособности способностей всех 44 героев (задача «проверь каждого»).
// Для каждого героя: способность стреляет при выполнении своего when (шаг в
// стеке боя / золото в state) и молчит при обратном условии. Где возможно —
// оба режима (classic и formation). Хелперы с префиксом bf* — контекст общий,
// имена не пересекаются с другими test-файлами.
//
// Регрессии здесь:
//   - Meepo/Zeus: «рядом» = NEIGHBOR_ATTR_IS, а не EXISTS_ATTRIBUTE (баг
//     игрока: Meepo рядом с Axe давал +6 от дальнего AGI);
//   - дубликаты героев на руках (маршрут «Дублирование»/старый сейв) не роняют
//     бой и честно срабатывают с обеих копий;
//   - таверна не предлагает уже нанятых героев.

suite("Аудит способностей — стартовая колода");

function bfRun(seed, rules) {
  return Game.dispatch(Game.createInitialState(""), { type: "START_RUN", seedCode: seed, rules });
}
function bfAdd(s, heroIds) {
  for (const h of [].concat(heroIds)) DeckSys.addHero(s, h);
}
function bfHandUids(s, uids) {
  s.player.handUids = uids.slice();
  s.player.deckUids = Object.keys(s.cards).filter((uid) => !uids.includes(uid));
  s.player.discardUids = [];
}
function bfHand(s, heroIds) {
  const uids = heroIds.map((h) => Object.values(s.cards).find((c) => c.heroId === h).uid);
  bfHandUids(s, uids);
  return uids;
}
function bfPlay(s, heroIds) {
  const uids = bfHand(s, heroIds);
  s.combat.selectedUids = uids.slice();
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  return s.combat.lastResolution;
}
function bfStep(res, part) {
  return res.steps.some((st) => st.label.indexOf(part) !== -1);
}
function bfStepCount(res, part) {
  return res.steps.filter((st) => st.label.indexOf(part) !== -1).length;
}
// Способность стреляет в обоих режимах (позиционные герои). addIds — найм
// таверн-героев на КАЖДЫЙ свежий стейт (стартовые герои можно не перечислять).
function bfFiresBoth(seed, addIds, lineup, part) {
  const sc = bfRun(seed + "c");
  if (addIds) bfAdd(sc, addIds);
  assert(bfStep(bfPlay(sc, lineup), part), "classic: нет шага «" + part + "»");
  const sf = bfRun(seed + "f", "formation");
  if (addIds) bfAdd(sf, addIds);
  assert(bfStep(bfPlay(sf, lineup), part), "formation: нет шага «" + part + "»");
}
function bfBossWave(s, withAegis) {
  s.combat.wave = {
    towerId: "roshan", name: "Roshan", emoji: "👹", isBoss: true, miniBoss: false, elite: false,
    hp: 100, maxHp: 100, modifiers: withAegis ? [{ id: "aegis" }] : [], enemyItems: [], aegisUsed: false,
  };
}

test("Tusk — Snowball: +4 за соседа; в одиночку молчит", () => {
  bfFiresBoth("BF01", null, ["tusk", "axe"], "Tusk: +4 силы (1 сосед");
  const solo = bfPlay(bfRun("BF01s"), ["tusk"]);
  assert(!bfStep(solo, "Tusk: +"), "в одиночку соседей нет — молчит");
});

test("Axe — Counter Helix: тройка рангов даёт +10; вне тройки молчит", () => {
  const f = bfPlay(bfRun("BF02"), ["axe", "zeus", "morphling"]);
  assert(bfStep(f, "Axe: +10 силы"), "тройка 5-5-5");
  const no = bfPlay(bfRun("BF02b"), ["axe", "cm"]);
  assert(!bfStep(no, "Axe: +10"), "пара — молчит");
});

test("Pudge — Meathook: 50% возврат детерминирован сидом (обе стороны достижимы)", () => {
  const back = bfRun("BFP0");
  bfAdd(back, "pudge");
  const uid = Object.values(back.cards).find((c) => c.heroId === "pudge").uid;
  bfHandUids(back, [uid]);
  Game.dispatch(back, { type: "DISCARD", uids: [uid] });
  assert(back.player.handUids.includes(uid), "сид BFP0: крюк тянет обратно");
  const keep = bfRun("BFP3");
  bfAdd(keep, "pudge");
  const uid2 = Object.values(keep.cards).find((c) => c.heroId === "pudge").uid;
  bfHandUids(keep, [uid2]);
  Game.dispatch(keep, { type: "DISCARD", uids: [uid2] });
  assert(!keep.player.handUids.includes(uid2) && keep.player.discardUids.includes(uid2), "сид BFP3: шанс мимо — карта в сбросе");
});

test("Sven — God's Strength: ×1.5 только у сильнейшего", () => {
  const f = bfPlay(bfRun("BF04", "formation"), ["sven", "cm"]);
  assert(bfStep(f, "Sven: ×1.5"), "Sven 8 против CM 2");
  const no = bfPlay(bfRun("BF04b", "formation"), ["sven", "centaur"]);
  assert(!bfStep(no, "Sven: ×1.5"), "Centaur 10 сильнее — молчит");
});

test("Centaur — Trample: +4 за героя только из слота 1 (оба режима)", () => {
  bfFiresBoth("BF05", null, ["centaur", "cm"], "Centaur Warrunner: +8 силы (2 героев");
  const back = bfPlay(bfRun("BF05b", "formation"), ["cm", "centaur"]);
  assert(!bfStep(back, "Warrunner: +"), "во втором слоте молчит");
});

test("Morphling — Morph: копирует атрибут соседа слева", () => {
  bfFiresBoth("BF06", null, ["zeus", "morphling"], "Morphling копирует атрибут «Интеллект»");
});

test("Juggernaut — Blade Fury: +8 только в слоте 1", () => {
  bfFiresBoth("BF07", null, ["juggernaut", "cm"], "Juggernaut: +8 силы");
  const back = bfPlay(bfRun("BF07b", "formation"), ["cm", "juggernaut"]);
  assert(!bfStep(back, "Juggernaut: +8"), "не в слоте 1 — молчит");
});

test("PA — Coup de Grace: пара + шанс; без пары шанс не спасает", () => {
  const s = bfRun("BF08");
  bfAdd(s, "storm_spirit");
  s.run.pendingForceTriggers = true; // «Счастливый случай»: шанс гарантирован
  const f = bfPlay(s, ["pa", "storm_spirit"]);
  assert(bfStep(f, "Phantom Assassin: ×2"), "пара 9-9 при форсе критует");
  const s2 = bfRun("BF08b");
  s2.run.pendingForceTriggers = true;
  const no = bfPlay(s2, ["pa", "cm"]);
  assert(!bfStep(no, "Phantom Assassin: ×2"), "хай-карта: COMBO_MIN pair не выполнен");
});

test("CM — Frostbite: ТП-сброс даёт +2 золота", () => {
  const s = bfRun("BF09");
  bfAdd(s, "cm");
  const uid = bfHand(s, ["cm"])[0];
  const before = s.run.gold;
  Game.dispatch(s, { type: "DISCARD", uids: [uid] });
  assertEq(s.run.gold - before, 2, "CM: +2 золота за сброс");
  assert(s.log.some((l) => l.includes("Crystal Maiden") && l.includes("2 золота")), "шаг в журнале");
});

test("Zeus — Static Field: «рядом INT» — сосед слева/справа, не любой INT в строю", () => {
  bfFiresBoth("BF10", null, ["zeus", "cm"], "Zeus: +2 к множителю");
  const far = bfPlay(bfRun("BF10b", "formation"), ["zeus", "tusk", "cm"]);
  assert(!bfStep(far, "Zeus: +2"), "CM в дальнем слоте не открывает Zeus (регрессия EXISTS)");
  const none = bfPlay(bfRun("BF10c"), ["zeus", "tusk"]);
  assert(!bfStep(none, "Zeus: +2"), "INT нет вовсе — молчит");
});

test("Dawnbreaker — Solar Guardian: +1 множитель за каждого Универсала (включая себя)", () => {
  const solo = bfPlay(bfRun("BF11", "formation"), ["dawnbreaker"]);
  assert(bfStep(solo, "Dawnbreaker: +1 к множителю (1 героев Универсал)"), "соло: +1");
  const duo = bfPlay(bfRun("BF11b", "formation"), ["dawnbreaker", "primal"]);
  assert(bfStep(duo, "Dawnbreaker: +2 к множителю (2 героев Универсал)"), "дуо UNI: +2");
});

test("Primal — Pulverize: ×2 в центре пятёрки; при 4 героях молчит", () => {
  const f = bfPlay(bfRun("BF12"), ["tusk", "cm", "primal", "pudge", "juggernaut"]);
  assert(bfStep(f, "Primal Beast: ×2"), "слот 3 при пятёрке");
  const four = bfPlay(bfRun("BF12b"), ["cm", "primal", "pudge", "juggernaut"]);
  assert(!bfStep(four, "Primal Beast: ×2"), "слот 1 при четвёрке — молчит");
});

suite("Аудит способностей — таверна");

test("Undying — Decay: +2 за карту в сбросе; пустой сброс молчит", () => {
  const s = bfRun("BF13");
  bfAdd(s, "undying");
  const uid = bfHand(s, ["undying"])[0];
  s.player.discardUids = [s.player.deckUids.pop()];
  s.combat.selectedUids = [uid];
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  assert(bfStep(s.combat.lastResolution, "Undying: +2 силы из сброса (1 карт)"), "1 карта в сбросе");
  const s2 = bfRun("BF13b");
  bfAdd(s2, "undying");
  const no = bfPlay(s2, ["undying"]);
  assert(!bfStep(no, "Undying: +"), "сброс пуст — молчит");
});

test("Ogre Magi — Multicast: 25% шанс форсируется «Счастливым случаем»", () => {
  const s = bfRun("BF14");
  bfAdd(s, "ogre_magi");
  s.run.pendingForceTriggers = true;
  const f = bfPlay(s, ["ogre_magi", "cm"]);
  assert(bfStep(f, "Ogre Magi: +3 к множителю"), "форс гарантирует шанс");
});

test("Legion — Duel: пара и выше даёт +12; хай-карта молчит", () => {
  const s = bfRun("BF15");
  bfAdd(s, ["legion", "phantom_lancer"]);
  const f = bfPlay(s, ["legion", "phantom_lancer"]);
  assert(bfStep(f, "Legion Commander: +12 силы"), "пара 6-6");
  const s2 = bfRun("BF15b");
  bfAdd(s2, "legion");
  const no = bfPlay(s2, ["legion", "cm"]);
  assert(!bfStep(no, "Legion Commander: +12"), "хай-карта — молчит");
});

test("Huskar — Berserker's Blood: +3 за потерянную казарму", () => {
  const s = bfRun("BF16");
  bfAdd(s, "huskar");
  s.run.barracks = 1;
  const f = bfPlay(s, ["huskar", "cm"]);
  assert(bfStep(f, "Huskar: +3 силы (1 разрушенных казарм)"), "казарма потеряна");
  const s2 = bfRun("BF16b");
  bfAdd(s2, "huskar");
  const no = bfPlay(s2, ["huskar", "cm"]);
  assert(!bfStep(no, "Huskar: +"), "казармы целы — молчит");
});

test("Tidehunter — Kraken Shell: +2 множителя ровно при 5 героях", () => {
  const s = bfRun("BF17");
  bfAdd(s, "tidehunter");
  const f = bfPlay(s, ["tidehunter", "cm", "tusk", "axe", "juggernaut"]);
  assert(bfStep(f, "Tidehunter: +2 к множителю"), "5 героев");
  const s2 = bfRun("BF17b");
  bfAdd(s2, "tidehunter");
  const no = bfPlay(s2, ["tidehunter", "cm", "tusk"]);
  assert(!bfStep(no, "Tidehunter: +2"), "3 героя — молчит");
});

test("Kunkka — Ghostship: центр при 4+ героях", () => {
  const s = bfRun("BF18");
  bfAdd(s, "kunkka");
  const f = bfPlay(s, ["cm", "tusk", "kunkka", "pudge"]);
  assert(bfStep(f, "Kunkka: +2 к множителю"), "слот 3 при четвёрке");
  const s2 = bfRun("BF18b");
  bfAdd(s2, "kunkka");
  const no = bfPlay(s2, ["cm", "kunkka", "tusk", "pudge"]);
  assert(!bfStep(no, "Kunkka: +2"), "слот 2 — молчит");
});

test("Meepo — Poof: «рядом AGI», дальний AGI не считается (баг игрока)", () => {
  bfFiresBoth("BF19", "meepo", ["meepo", "juggernaut"], "Meepo: +6 силы");
  // Регрессия бага: Meepo рядом с Axe (силовик), AGI есть в строю — но не рядом.
  const sfar = bfRun("BF19b", "formation");
  bfAdd(sfar, "meepo");
  const far = bfPlay(sfar, ["meepo", "axe", "pa"]);
  assert(!bfStep(far, "Meepo: +6"), "AGI в строю, но не сосед — +6 нет");
  const snone = bfRun("BF19c");
  bfAdd(snone, "meepo");
  const none = bfPlay(snone, ["meepo", "axe"]);
  assert(!bfStep(none, "Meepo: +6"), "рядом силовик — молчит");
});

test("Bounty — Track: флаг ласт-хит-золота выставляется", () => {
  const s = bfRun("BF20");
  bfAdd(s, "bounty");
  const f = bfPlay(s, ["bounty", "cm"]);
  assert(bfStep(f, "Bounty Hunter: точный ласт-хит принесёт +8 золота"), "флаг в стеке");
});

test("Slark — Essence Shift: +4 за использованный ТП-сброс волны", () => {
  const s = bfRun("BF21");
  bfAdd(s, "slark");
  s.player.discardsLeft = 2; // 1 сброс использован
  const f = bfPlay(s, ["slark", "cm"]);
  assert(bfStep(f, "Slark: +4 силы (1 ТП-сбросов за волну)"), "1 использованный сброс");
  const s2 = bfRun("BF21b");
  bfAdd(s2, "slark");
  const no = bfPlay(s2, ["slark", "cm"]);
  assert(!bfStep(no, "Slark: +"), "сбросы не тратились — молчит");
});

test("Phantom Lancer — Precision Aura: все сыгранные AGI", () => {
  const s = bfRun("BF22");
  bfAdd(s, "phantom_lancer");
  const f = bfPlay(s, ["phantom_lancer", "juggernaut", "pa"]);
  assert(bfStep(f, "Phantom Lancer: +3 к множителю"), "все трое AGI");
  const s2 = bfRun("BF22b");
  bfAdd(s2, "phantom_lancer");
  const no = bfPlay(s2, ["phantom_lancer", "juggernaut", "cm"]);
  assert(!bfStep(no, "Phantom Lancer: +3"), "CM ломает мону — молчит");
});

test("Anti-Mage — Mana Break: +4 за пустую позицию", () => {
  const s = bfRun("BF23");
  bfAdd(s, "anti_mage");
  const f = bfPlay(s, ["anti_mage", "cm", "juggernaut"]);
  assert(bfStep(f, "Anti-Mage: +8 силы (2 пустых позиций)"), "3 из 5 слотов");
  const s2 = bfRun("BF23b");
  bfAdd(s2, "anti_mage");
  const no = bfPlay(s2, ["anti_mage", "cm", "juggernaut", "axe", "tusk"]);
  assert(!bfStep(no, "Anti-Mage: +"), "пятёрка — пустых нет");
});

test("Faceless — Chronosphere: +2 множителя только на боссе", () => {
  const s = bfRun("BF24");
  bfAdd(s, "faceless");
  bfBossWave(s, false);
  const f = bfPlay(s, ["faceless", "cm"]);
  assert(bfStep(f, "Faceless Void: +2 к множителю"), "босс");
  const s2 = bfRun("BF24b");
  bfAdd(s2, "faceless");
  const no = bfPlay(s2, ["faceless", "cm"]);
  assert(!bfStep(no, "Faceless Void: +2"), "обычная башня — молчит");
});

test("Terrorblade — Soul Mirror: копирует соседа справа", () => {
  bfFiresBoth("BF25", "terrorblade", ["terrorblade", "cm"], "Terrorblade копирует атрибут «Интеллект»");
});

test("Ursa — Enrage: ×1.8 только у сильнейшего", () => {
  const s = bfRun("BF26");
  bfAdd(s, "ursa");
  const f = bfPlay(s, ["ursa", "cm"]);
  assert(bfStep(f, "Ursa: ×1.8"), "Ursa 12 сильнейший");
  // Инверсия через оверрайд ранга: Ursa 12 — максимум, слабее его можно сделать
  // только усталостью/овверрайдом (тренировка капится тем же рангом).
  const s2 = bfRun("BF26b");
  bfAdd(s2, "ursa");
  s2.run.ranks = { ursa: 5 };
  const no = bfPlay(s2, ["ursa", "centaur"]);
  assert(!bfStep(no, "Ursa: ×1.8"), "Centaur 10 сильнее ослабленного Ursa 5 — молчит");
});

test("Oracle — False Promise: +10 если он слабейший", () => {
  const s = bfRun("BF27");
  bfAdd(s, "oracle");
  const f = bfPlay(s, ["oracle", "juggernaut"]);
  assert(bfStep(f, "Oracle: +10 силы"), "Oracle 3 против Jugg 7");
  const s2 = bfRun("BF27b");
  bfAdd(s2, "oracle");
  const no = bfPlay(s2, ["oracle", "cm"]);
  assert(!bfStep(no, "Oracle: +10"), "CM 2 слабее — молчит");
});

test("Skywrath — Mystic Flare: ×2 в одиночном рейде", () => {
  const s = bfRun("BF28");
  bfAdd(s, "skywrath");
  const f = bfPlay(s, ["skywrath"]);
  assert(bfStep(f, "Skywrath Mage: ×2"), "соло");
  const s2 = bfRun("BF28b");
  bfAdd(s2, "skywrath");
  const no = bfPlay(s2, ["skywrath", "cm"]);
  assert(!bfStep(no, "Skywrath Mage: ×2"), "не соло — молчит");
});

test("Lina — Laguna Blade: +20 при 1–2 героях", () => {
  const s = bfRun("BF29");
  bfAdd(s, "lina");
  const f = bfPlay(s, ["lina", "cm"]);
  assert(bfStep(f, "Lina: +20 силы"), "дуо");
  const s2 = bfRun("BF29b");
  bfAdd(s2, "lina");
  const no = bfPlay(s2, ["lina", "cm", "tusk"]);
  assert(!bfStep(no, "Lina: +20"), "трое — молчит");
});

test("Rubick — Fade Bolt: +9 рядом с INT", () => {
  bfFiresBoth("BF30", "rubick", ["rubick", "zeus"], "Rubick: +9 силы");
  const s2 = bfRun("BF30b", "formation");
  bfAdd(s2, "rubick");
  const no = bfPlay(s2, ["rubick", "tusk"]);
  assert(!bfStep(no, "Rubick: +9"), "сосед-силовик — молчит");
});

test("Invoker — Invoke: 3+ разных атрибута", () => {
  const s = bfRun("BF31");
  bfAdd(s, "invoker");
  const f = bfPlay(s, ["invoker", "axe", "pa"]);
  assert(bfStep(f, "Invoker: +3 к множителю"), "int+str+agi");
  const s2 = bfRun("BF31b");
  bfAdd(s2, "invoker");
  const no = bfPlay(s2, ["invoker", "axe"]);
  assert(!bfStep(no, "Invoker: +3"), "два атрибута — молчит");
});

test("Storm Spirit — Ball Lightning: +9 из первого слота", () => {
  const s = bfRun("BF32");
  bfAdd(s, "storm_spirit");
  const f = bfPlay(s, ["storm_spirit", "cm"]);
  assert(bfStep(f, "Storm Spirit: +9 силы"), "слот 1");
  const s2 = bfRun("BF32b");
  bfAdd(s2, "storm_spirit");
  const no = bfPlay(s2, ["cm", "storm_spirit"]);
  assert(!bfStep(no, "Storm Spirit: +9"), "слот 2 — молчит");
});

test("Outworld — Sanity's Eclipse: +12 при 3+ атрибутах", () => {
  const s = bfRun("BF33");
  bfAdd(s, "outworld");
  const f = bfPlay(s, ["outworld", "axe", "pa"]);
  assert(bfStep(f, "Outworld Destroyer: +12 силы"), "три атрибута");
  const s2 = bfRun("BF33b");
  bfAdd(s2, "outworld");
  const no = bfPlay(s2, ["outworld", "axe"]);
  assert(!bfStep(no, "Outworld Destroyer: +12"), "два атрибута — молчит");
});

test("AA — Ice Blast: на боссе с Aegis отрицает возрождение", () => {
  const s = bfRun("BF34");
  bfAdd(s, "ancient_apparition");
  bfBossWave(s, true);
  const f = bfPlay(s, ["ancient_apparition", "cm"]);
  assert(bfStep(f, "Aegis заблокирован"), "DENY_REVIVE");
  const s2 = bfRun("BF34b");
  bfAdd(s2, "ancient_apparition");
  const no = bfPlay(s2, ["ancient_apparition", "cm"]);
  assert(!bfStep(no, "Aegis заблокирован"), "без босса — молчит");
});

test("Enigma — Eidolon: иллюзия вступает в бой", () => {
  const s = bfRun("BF35");
  bfAdd(s, "enigma");
  const f = bfPlay(s, ["enigma", "cm"]);
  assert(f.steps.some((st) => st.label.includes("иллюзия") && st.label.includes("Enigma")), "иллюзия создана");
});

suite("Аудит способностей — универсалы");

test("Io — Tether: «есть герой Силы» — любой в строю (не сосед)", () => {
  const s = bfRun("BF36");
  bfAdd(s, "io");
  const f = bfPlay(s, ["io", "axe"]);
  assert(bfStep(f, "Io: +6 силы"), "силовик в строю");
  const sfar = bfRun("BF36b");
  bfAdd(sfar, "io");
  const far = bfPlay(sfar, ["io", "cm", "tusk"]);
  assert(bfStep(far, "Io: +6 силы"), "EXISTS: силовик не сосед — всё равно стреляет");
  const s2 = bfRun("BF36c");
  bfAdd(s2, "io");
  const no = bfPlay(s2, ["io", "cm"]);
  assert(!bfStep(no, "Io: +6"), "силовиков нет — молчит");
});

test("Muerta — Dead Shot: +8 в слоте 3", () => {
  const s = bfRun("BF37");
  bfAdd(s, "muerta");
  const f = bfPlay(s, ["cm", "tusk", "muerta"]);
  assert(bfStep(f, "Muerta: +8 силы"), "слот 3");
  const s2 = bfRun("BF37b");
  bfAdd(s2, "muerta");
  const no = bfPlay(s2, ["cm", "muerta", "tusk"]);
  assert(!bfStep(no, "Muerta: +8"), "слот 2 — молчит");
});

test("Marci — Sidekick: сосед другого атрибута", () => {
  const s = bfRun("BF38");
  bfAdd(s, "marci");
  const f = bfPlay(s, ["marci", "axe"]);
  assert(bfStep(f, "Marci: +8 силы"), "UNI против STR");
  const s2 = bfRun("BF38b");
  bfAdd(s2, ["marci", "io"]);
  const no = bfPlay(s2, ["marci", "io"]);
  assert(!bfStep(no, "Marci: +8"), "оба UNI — молчит");
});

test("Snapfire — Gobble & Shoot: +1 множитель на последней позиции", () => {
  const s = bfRun("BF39");
  bfAdd(s, "snapfire");
  const f = bfPlay(s, ["cm", "snapfire"]);
  assert(bfStep(f, "Snapfire: +1 к множителю"), "последняя позиция");
  const s2 = bfRun("BF39b");
  bfAdd(s2, "snapfire");
  const no = bfPlay(s2, ["snapfire", "cm"]);
  assert(!bfStep(no, "Snapfire: +1"), "первая позиция — молчит");
});

test("Void Spirit — Dissimilate: +8 если сильнейший", () => {
  const s = bfRun("BF40");
  bfAdd(s, "void_spirit");
  const f = bfPlay(s, ["void_spirit", "cm"]);
  assert(bfStep(f, "Void Spirit: +8 силы"), "6 против 2");
  const s2 = bfRun("BF40b");
  bfAdd(s2, "void_spirit");
  const no = bfPlay(s2, ["void_spirit", "centaur"]);
  assert(!bfStep(no, "Void Spirit: +8"), "Centaur сильнее — молчит");
});

test("Kez — Echo Slash: средний по рангу (не высший и не низший)", () => {
  const s = bfRun("BF41");
  bfAdd(s, "kez");
  const f = bfPlay(s, ["tusk", "kez", "centaur"]);
  assert(bfStep(f, "Kez: +10 силы"), "7 между 3 и 10");
  const s2 = bfRun("BF41b");
  bfAdd(s2, "kez");
  const no = bfPlay(s2, ["kez", "cm"]);
  assert(!bfStep(no, "Kez: +10"), "Kez высший — молчит");
});

test("Beastmaster — Primal Roar: +5 за героя своего ранга", () => {
  const s = bfRun("BF42");
  bfAdd(s, ["beastmaster", "anti_mage"]);
  const f = bfPlay(s, ["beastmaster", "anti_mage"]);
  assert(bfStep(f, "Beastmaster: +5 силы (1 героя своего ранга)"), "пара 8-8");
  const s2 = bfRun("BF42b");
  bfAdd(s2, "beastmaster");
  const no = bfPlay(s2, ["beastmaster", "cm"]);
  assert(!bfStep(no, "Beastmaster: +5"), "ранг уникален — молчит");
});

test("Tiny — Grow: +3 за каждого сыгранного", () => {
  const s = bfRun("BF43");
  bfAdd(s, "tiny");
  const f = bfPlay(s, ["tiny", "cm"]);
  assert(bfStep(f, "Tiny: +6 силы (2 героев × 3)"), "дуо: +6");
});

test("Tinker — Rearm: способности героев звучат дважды", () => {
  const s = bfRun("BF44");
  bfAdd(s, "tinker");
  const f = bfPlay(s, ["tinker", "tusk"]);
  assert(bfStep(f, "Tinker: способности героев срабатывают дважды"), "шаг Rearm");
  assertEq(bfStepCount(f, "Tusk: +4 силы (1 сосед"), 2, "Snowball прозвучал дважды");
});

suite("Универсал и Фаланга — консистентность показа и условия");

test("Dawnbreaker без скептера — свой бакет: 3 STR + UNI не собирают Фалангу", () => {
  const s = bfRun("BFUNI1", "formation");
  bfAdd(s, "dawnbreaker");
  const f = bfPlay(s, ["axe", "tusk", "pudge", "dawnbreaker"]);
  assert(f.combo.type !== "phalanx", "Универсал не должен докидывать «4+ одного атрибута» без джокера");
});

test("Dawnbreaker со скипетром Starbreaker — джокер: Фаланга собирается и в бою, и в превью", () => {
  const s = bfRun("BFUNI2", "formation");
  bfAdd(s, "dawnbreaker");
  s.run.aghanims.dawnbreaker = { scepter: "dawnbreaker_sc" };
  const f = bfPlay(s, ["axe", "tusk", "pudge", "dawnbreaker"]);
  assertEq(f.combo.type, "phalanx", "3 STR + джокер-UNI = 4 одного атрибута");
  assertEq(f.combo.damageType, "physical", "доминирует реальный бакет STR");
  // Превью (симуляция без бросков) обязано показывать ту же формацию.
  s.combat.outcome = null;
  s.player.fightsLeft += 1;
  s.combat.selectedUids = [];
  const uids = ["axe", "tusk", "pudge", "dawnbreaker"].map((h) => Object.values(s.cards).find((c) => c.heroId === h).uid);
  // после боя карты в сбросе — вернём состав в руку и выберем заново
  s.player.discardUids = s.player.discardUids.filter((u) => !uids.includes(u));
  s.player.handUids = uids.concat(s.player.handUids.filter((u) => !uids.includes(u)));
  s.combat.selectedUids = uids;
  const clone = structuredClone(s);
  clone.simulate = true;
  Game.dispatch(clone, { type: "CONFIRM_FIGHT" });
  assertEq(clone.combat.lastResolution.combo.type, "phalanx", "превью показывает Фалангу");
});

suite("Дубликаты и таверна");
test("таверна не предлагает героев, уже нанятых игроком", () => {
  const s = bfRun("BFSH1");
  bfAdd(s, ["invoker", "lina", "io", "kez"]);
  s.combat.outcome = "cleared"; // имитация зачищенной волны
  Game.dispatch(s, { type: "ENTER_SHOP" });
  const owned = new Set([...s.player.handUids, ...s.player.deckUids, ...s.player.discardUids]
    .map((uid) => s.cards[uid].heroId));
  assert(s.shop.recruits.length >= 1, "таверна не пустует");
  for (const r of s.shop.recruits) {
    assert(!owned.has(r), "предложен уже нанятый герой: " + r);
  }
  assertEq(new Set(s.shop.recruits).size, s.shop.recruits.length, "нет дублей внутри полки");
});

test("дубликат героя на руках не ломает бой: копии срабатывают обе", () => {
  // Маршрут «Дублирование» (#43) намеренно клонирует карту руки.
  const s = bfRun("BFDUP1");
  DeckSys.addHero(s, "invoker");
  DeckSys.addHero(s, "invoker"); // второй экземпляр (Invoker — таверн-герой)
  const uids = Object.values(s.cards).filter((c) => c.heroId === "invoker").map((c) => c.uid);
  assertEq(uids.length, 2, "два Invoker в коллекции");
  const axe = Object.values(s.cards).find((c) => c.heroId === "axe").uid;
  const pa = Object.values(s.cards).find((c) => c.heroId === "pa").uid;
  bfHandUids(s, [uids[0], uids[1], axe, pa]);
  s.combat.selectedUids = [uids[0], uids[1], axe, pa];
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  const res = s.combat.lastResolution;
  assert(res && res.damage > 0, "бой отработал без ошибок");
  assertEq(bfStepCount(res, "Invoker: +3 к множителю"), 2, "Invoke с обеих копий");
});

suite("Фидбек: награды за неиспользованные ресурсы");

test("Неиспользованные ТП-сбросы волны — +1G каждый при зачистке", () => {
  const s = bfRun("BFD1", "formation");
  s.player.discardsLeft = 3;
  const goldBefore = s.run.gold;
  s.combat.wave.hp = 1; // добиваем волну одним ударом
  bfPlay(s, ["sven", "centaur"]);
  assert(s.combat.outcome === "cleared", "волна зачищена");
  assert(s.log.some((l) => l.includes("Бонус меткости: +3G")), "строка бонуса в журнале");
  assert(s.run.gold > goldBefore, "золото пришло");
});

test("Неиспользованные заряды «Второго дыхания» — +100 очков за заряд", () => {
  const s = bfRun("BFD2");
  const base = Game.scoreOf(s);
  s.run.upgradeState = Object.assign({}, s.run.upgradeState, { vozvrat: { level: 1, charges: 2, actUses: 0 } });
  assertEq(Game.scoreOf(s) - base, 200, "2 заряда = +200 очков");
});
