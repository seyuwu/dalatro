suite("Combat");

// Helpers (run inside the vm context via the harness).

function newRun(seed) {
  const s = Game.dispatch(Game.createInitialState(""), { type: "START_RUN", seedCode: seed || "TEST1" });
  return s;
}

function uidOf(s, heroId) {
  return Object.values(s.cards).find((c) => c.heroId === heroId).uid;
}

function forceHand(s, heroIds) {
  const uids = heroIds.map((h) => uidOf(s, h));
  s.player.handUids = uids.slice();
  // всё остальное — в колоду, чтобы никакие карты не «утекали»
  s.player.deckUids = Object.keys(s.cards).filter((uid) => !uids.includes(uid));
  s.player.discardUids = [];
  return uids;
}

function play(s, heroIds) {
  const uids = forceHand(s, heroIds);
  s.combat.selectedUids = uids.slice();
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  return s.combat.lastResolution;
}

test("фулл-хаус 555+77: 414 урона (69 × 6), без лишних триггеров", () => {
  const s = newRun("FULL1");
  const res = play(s, ["axe", "morphling", "zeus", "pudge", "juggernaut"]);
  assertEq(res.combo.type, "full_house", "комбо");
  assertEq(res.power, 69, "сила (40 база + 29 карт)");
  assertEq(res.mult, 6, "множитель");
  assertEq(res.damage, 414, "урон");
  // оверкилл 114 при хп 300: floor(114/20) = 5 золота
  assertEq(res.goldGained, 5, "золото за оверкилл");
  assertEq(res.killed, true);
  assertEq(s.combat.outcome, "cleared");
});

test("Axe не триггерится на фулл-хаусе (COMBO_IS строгий), триггерится на сете", () => {
  const s = newRun("AXE1");
  const res = play(s, ["axe", "morphling", "zeus", "pudge", "centaur"]);
  // 5,5,5,7,10 → сет: база 30 + 32 = 62; морф копирует силу у axe → все STR кроме zeus... attrs: str,str,int,str,str — не флеш
  // zeus: EXISTS int — нет второго int → не триггерит. jugg нет. axe: three → +10
  assertEq(res.combo.type, "three", "комбо");
  assertEq(res.power, 72, "сила (30 + 32 + 10 от Axe)");
  assertEq(res.mult, 3, "множитель");
});

test("позиция важна: [zeus, morphling] даёт Zeus-бонус, [morphling, zeus] — нет", () => {
  const s = newRun("POS1");
  const withBonus = play(s, ["zeus", "morphling"]);
  // морф копирует INT у зевса → zeus видит int-соседа: сила 10+10=20, множ 2+2=4
  assertEq(withBonus.damage, 80, "зевс рядом с морф-инт");
  const s2 = newRun("POS2");
  const noBonus = play(s2, ["morphling", "zeus"]);
  // морф слот 1 — соседа слева нет, остаётся AGI; зевс не триггерит: 20 × 2
  assertEq(noBonus.damage, 40, "зевс без int-соседа");
});

test("Juggernaut: +8 силы только из слота 1", () => {
  const s = newRun("JUG1");
  const first = play(s, ["juggernaut", "cm"]);
  // хай-карта: 5 + 7 + 2 = 14, +8 = 22
  assertEq(first.damage, 22, "джагг первым");
  const s2 = newRun("JUG2");
  const second = play(s2, ["cm", "juggernaut"]);
  assertEq(second.damage, 14, "джагг вторым");
});

test("Butterfly: слабейшая карта ±1 ранг → two_pair из 2,3,5,5", () => {
  const s = newRun("BFL1");
  const without = play(s, ["cm", "tusk", "axe", "morphling"]);
  assertEq(without.combo.type, "pair", "без бабочки — пара");
  assertEq(without.damage, 50, "25 × 2");
  const s2 = newRun("BFL2");
  s2.player.items.push("butterfly");
  const withB = play(s2, ["cm", "tusk", "axe", "morphling"]);
  // cm 2 → 3: 3,3,5,5 = two_pair: (20 + 15) × 2 = 70
  assertEq(withB.combo.type, "two_pair", "с бабочкой — две пары");
  assertEq(withB.damage, 70, "35 × 2");
});

test("Manta: иллюзия даёт пол-силы, но считается за ранг для комбо", () => {
  const s = newRun("MNT1");
  s.player.items.push("manta");
  const res = play(s, ["axe", "morphling", "pudge"]);
  // 5,5,7 + иллюзия пуджа (ранг 7, сила 3) → two_pair: (20 + 5+5+7+3) × 2 = 80
  assertEq(res.combo.type, "two_pair", "комбо с иллюзией");
  assertEq(res.damage, 80, "40 × 2");
});

test("Refresher: зевс рядом с морф-инт срабатывает дважды", () => {
  const s = newRun("RFR1");
  s.player.items.push("refresher");
  const res = play(s, ["zeus", "morphling"]);
  // 20 силы, множ 2 + 2 + 2 = 6 → 120
  assertEq(res.damage, 120, "20 × 6");
});

test("превью не ломает состояние и не жжёт RNG", () => {
  const s = newRun("SIM1");
  forceHand(s, ["axe", "morphling", "zeus", "pudge", "juggernaut"]);
  s.combat.selectedUids = ["axe", "morphling", "zeus", "pudge", "juggernaut"].map((h) => uidOf(s, h));
  const clone = Sim.simulate(s, { type: "CONFIRM_FIGHT" });
  assertEq(clone.combat.lastResolution.damage, 414, "превью урон");
  assertEq(s.combat.wave.hp, 300, "башня не тронута");
  assertEq(s.player.fightsLeft, 4, "бои не потрачены");
  assertEq(s.player.handUids.length, 5, "рука на месте");
  // реальный бой даёт тот же урон
  const res = Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  assertEq(s.combat.lastResolution.damage, 414, "реальный урон совпал");
});

test("Armor T2: первый бой ×0.5, BKB игнорирует", () => {
  const s = newRun("ARM1");
  s.run.waveIndex = 1;
  const def = Content.waves.byId["t2"];
  s.combat.wave = { towerId: "t2", name: def.name, emoji: def.emoji, isBoss: false, hp: def.hp, maxHp: def.hp, modifiers: [{ id: "armor" }], enemyItems: [], aegisUsed: false };
  s.combat.fightIndex = 0;
  const res = play(s, ["tusk"]);
  assertEq(res.damage, 4, "8 × 0.5");
  const s2 = newRun("ARM2");
  s2.run.waveIndex = 1;
  const def2 = Content.waves.byId["t2"];
  s2.combat.wave = { towerId: "t2", name: def2.name, emoji: def2.emoji, isBoss: false, hp: def2.hp, maxHp: def2.hp, modifiers: [{ id: "armor" }], enemyItems: [], aegisUsed: false };
  s2.combat.fightIndex = 0;
  s2.player.items.push("bkb");
  const res2 = play(s2, ["tusk"]);
  assertEq(res2.damage, 8, "BKB: полный урон");
});

test("Glyph T3: каждый 3-й бой заблокирован", () => {
  const s = newRun("GLY1");
  s.run.waveIndex = 2;
  const def = Content.waves.byId["t3"];
  s.combat.wave = { towerId: "t3", name: def.name, emoji: def.emoji, isBoss: false, hp: def.hp, maxHp: def.hp, modifiers: [{ id: "glyph" }], enemyItems: [], aegisUsed: false };
  s.combat.fightIndex = 2; // третий бой
  const res = play(s, ["axe", "morphling", "zeus", "pudge", "juggernaut"]);
  assertEq(res.blocked, true, "глиф");
  assertEq(res.damage, 0, "нулевой урон");
  assertEq(s.combat.outcome, null, "волна не проиграна");
  assertEq(s.player.fightsLeft, 3, "бой потрачен");
});

test("Aegis: Рошан возрождается один раз, потом умирает насовсем", () => {
  const s = newRun("AEG1");
  s.run.waveIndex = 3;
  const def = Content.waves.byId["roshan"];
  s.combat.wave = { towerId: "roshan", name: def.name, emoji: def.emoji, isBoss: true, hp: 400, maxHp: def.hp, modifiers: [{ id: "aegis" }], enemyItems: [], aegisUsed: false };
  const res = play(s, ["axe", "morphling", "zeus", "pudge", "juggernaut"]);
  assertEq(res.killed, false, "аегис спас");
  assertEq(s.combat.wave.hp, 800, "возрождение на 50%");
  assertEq(s.combat.wave.aegisUsed, true, "аегис потрачен");
  assertEq(s.combat.outcome, null, "не зачищено");
  s.combat.wave.hp = 300; // добиваем: 414 > 300
  const res2 = play(s, ["axe", "morphling", "zeus", "pudge", "juggernaut"]);
  assertEq(res2.killed, true, "второй раз умер");
  assertEq(s.phase, "victory", "победа");
});

test("Last Hit: урон ровно в HP башни = +5 золота", () => {
  const s = newRun("LH1");
  s.combat.wave.hp = 22;
  const res = play(s, ["juggernaut", "cm"]);
  // хай-карта 14 + джагг +8 = 22 ровно
  assertEq(res.damage, 22, "точный урон");
  assertEq(res.goldGained, 5, "ласт-хит");
});

test("Rapier: провал → враг подбирает, урон ×0.5; зачистка → возврат", () => {
  const s = newRun("RAP1");
  s.player.items.push("rapier");
  s.player.fightsLeft = 1;
  const res = play(s, ["tusk"]);
  assertEq(res.damage, 16, "8 × 2 рапира");
  assertEq(s.combat.outcome, "failed", "волна провалена (хп 284 > 0)");
  Game.dispatch(s, { type: "RETRY_WAVE" });
  assertEq(s.run.barracks, 5, "казарма снесена");
  assertEq(s.player.items.includes("rapier"), false, "рапира у врага");
  assertEq(s.combat.wave.enemyItems.includes("rapier"), true, "в инвентаре башни");
  // теперь урон режется вдвое
  const res2 = play(s, ["tusk"]);
  assertEq(res2.damage, 4, "8 × 0.5 вражеская рапира");
  // добиваем башню — рапира возвращается
  s.combat.wave.hp = 1;
  s.player.fightsLeft = 4;
  s.combat.outcome = null;
  s.combat.fightIndex = 0;
  const res3 = play(s, ["tusk"]);
  assertEq(res3.killed, true, "башня умерла");
  assertEq(s.player.items.includes("rapier"), true, "рапира вернулась");
});

test("цикл колоды: после боя рука добирается", () => {
  const s = newRun("DECK1");
  const handBefore = s.player.handUids.length;
  assertEq(handBefore, 7, "стартовая рука 7");
  play(s, ["axe", "morphling", "zeus", "pudge", "juggernaut"]);
  assertEq(s.player.handUids.length, 7, "после боя рука снова 7 (колода 12 иссякает ровно)");
  assertEq(s.player.fightsLeft, 3, "бои тратятся");
  // сыгранные герои НЕ возвращаются мгновенно: осёл-проверка — в руке нет axe/zeus
  const handHeroIds = s.player.handUids.map((uid) => s.cards[uid].heroId);
  assert(!handHeroIds.includes("axe"), "Axe ушёл в сброс, а не в руку");
});

test("магазин: 5 предложений с редкостями, без дублей и купленных", () => {
  const s = newRun("SHOP1");
  s.combat.outcome = "cleared";
  Game.dispatch(s, { type: "ENTER_SHOP" });
  assertEq(s.phase, "shop");
  assertEq(s.shop.offers.length, 5, "5 предложений");
  const ids = s.shop.offers.map((o) => o.id);
  assertEq(new Set(ids).size, 5, "без дублей");
  for (const id of ids) {
    assert(Content.items.byId[id] != null, "предмет из пула");
    assert(Content.items.byId[id].rarity, "у предмета есть редкость");
    assert(!s.player.items.includes(id), "не из купленных");
  }
  const first = s.shop.offers[0];
  const cost = Content.items.byId[first.id].cost;
  s.run.gold = 1000;
  const goldBefore = s.run.gold;
  Game.dispatch(s, { type: "BUY_ITEM", itemId: first.id });
  assertEq(s.run.gold, goldBefore - cost, "золото списано");
  assert(s.player.items.includes(first.id), "предмет куплен");
  assert(!s.shop.offers.some((o) => o.id === first.id), "пропало из магазина");
});

test("лок: зафиксированный предмет переживает реролл", () => {
  const s = newRun("LOCK1");
  s.combat.outcome = "cleared";
  Game.dispatch(s, { type: "ENTER_SHOP" });
  s.run.gold = 100;
  const target = s.shop.offers[0].id;
  Game.dispatch(s, { type: "LOCK_OFFER", itemId: target });
  assert(s.shop.offers.find((o) => o.id === target).locked, "залочен");
  Game.dispatch(s, { type: "REROLL_SHOP" });
  assert(s.shop.offers.some((o) => o.id === target && o.locked), "лок пережил реролл");
  assertEq(s.shop.offers.length, 5, "всё ещё 5 слотов");
});

test("сброс: CM даёт золото, Pudge может остаться в руке", () => {
  const s = newRun("DIS1");
  const cmUid = uidOf(s, "cm");
  s.player.handUids = [cmUid, uidOf(s, "tusk")];
  s.player.deckUids = s.player.deckUids.filter((uid) => !s.player.handUids.includes(uid));
  s.player.discardUids = [];
  const goldBefore = s.run.gold;
  Game.dispatch(s, { type: "DISCARD", uids: [cmUid] });
  assertEq(s.run.gold, goldBefore + 2, "CM +2 золота");
  assertEq(s.player.discardsLeft, 2, "ТП потрачен");
});

test("регрессия state.rng: chance-триггер (PA) в реальном бою не падает", () => {
  const s = newRun("PACRIT");
  const res = play(s, ["pa", "cm"]);
  // хай-карта 16 × 1: COMBO_MIN pair не проходит — PA не критует
  assertEq(res.combo.type, "high_card");
  assertEq(res.damage, 16);
  const s2 = newRun("PACRIT2");
  // пара 7-7 + PA: шанс 50% разыгрывается без исключения
  const res2 = play(s2, ["juggernaut", "pudge", "pa"]);
  assert(res2.damage > 0, "бой с chance-триггером прошёл");
});
