suite("Risk layer: ставка, импульс, мины Techies, Bloodstone");

function newRun(seed) {
  return Game.dispatch(Game.createInitialState(""), { type: "START_RUN", seedCode: seed || "RISK0" });
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

function setWave(s, waveId, hpOverride) {
  const def = Content.waves.byId[waveId];
  s.combat.wave = {
    towerId: waveId, name: def.name, emoji: def.emoji,
    isBoss: !!def.isBoss, miniBoss: !!def.miniBoss,
    hp: hpOverride != null ? hpOverride : def.hp, maxHp: def.hp,
    modifiers: (def.modifiers || []).map((m) => ({ id: m.id })),
    enemyItems: [], aegisUsed: false,
  };
}

suite("Ставка");

test("5 героев = ×1.25: шаг «Коммит» в стеке, урон 414 → 518", () => {
  const s = newRun("STAV1");
  const res = play(s, ["axe", "morphling", "zeus", "pudge", "juggernaut"]);
  const step = res.steps.find((st) => st.icon === "🎖");
  assert(step, "шаг ставки присутствует");
  assert(step.label.includes("Коммит"), "назван тир");
  assertEq(res.damage, 518, "round(69 × 6 × 1.25)");
});

test("4 героя = ×1.1: пара 25×2 → 55", () => {
  const s = newRun("STAV2");
  const res = play(s, ["axe", "morphling", "tusk", "cm"]);
  assertEq(res.damage, 73, "round((25+8 Tusk) × 2 × 1.1)");
});

test("2-3 героя — нейтрально, шага ставки нет", () => {
  const s = newRun("STAV3");
  const res = play(s, ["axe", "morphling", "tusk"]);
  assert(!res.steps.some((st) => st.icon === "🎖"), "нет шага ставки");
  assertEq(res.damage, 54, "(23+4 Tusk) × 2 без изменений");
});

test("харас: 1 герой = +1 золото", () => {
  const s = newRun("STAV4");
  const goldBefore = s.run.gold;
  const res = play(s, ["tusk"]);
  assertEq(res.damage, 8, "урон без изменений");
  assertEq(res.goldGained, 1, "харас-золото");
  assertEq(s.run.gold, goldBefore + 1);
});

suite("Импульс");

test("зачистка волны даёт серию, следующая волна бьёт ×1.05", () => {
  const s = newRun("MOM1");
  assertEq(s.run.momentum, 0, "старт без серии");
  play(s, ["axe", "morphling", "zeus", "pudge", "juggernaut"]); // 518 убивает T1 (300)
  assertEq(s.combat.outcome, "cleared");
  assertEq(s.run.momentum, 1, "серия началась");
  // следующая волна: та же пятёрка unavailable (ушла в сброс), играем пару 7-7
  setWave(s, "t2", 2000);
  s.combat.outcome = null;
  s.combat.fightIndex = 1;
  s.player.fightsLeft = 4;
  const res = play(s, ["pudge", "juggernaut", "tusk"]);
  assert(res.steps.some((st) => st.icon === "🔥"), "шаг импульса в стеке");
  // пара 7-7: (10 + 7+7+3+4 Tusk) × 2 = 62 → ×1.05 = 65
  assertEq(res.damage, 65, "round(62 × 1.05)");
});

test("провал волны сбрасывает импульс", () => {
  const s = newRun("MOM2");
  s.run.momentum = 3;
  s.player.fightsLeft = 1;
  play(s, ["cm"]); // 7 урона — T1 (300) жива → провал
  assertEq(s.combat.outcome, "failed");
  Game.dispatch(s, { type: "RETRY_WAVE" });
  assertEq(s.run.momentum, 0, "серия сброшена");
  assertEq(s.run.barracks, 5, "казарма снесена");
});

suite("Мины Techies");

test("2 карты руки заминированы и не выбираются", () => {
  const s = newRun("MINE1");
  setWave(s, "techies");
  s.combat.outcome = null;
  Game.assignMines(s);
  assertEq(s.combat.minedUids.length, 2, "две мины");
  const mined = s.combat.minedUids[0];
  Game.dispatch(s, { type: "SELECT_CARD", uid: mined });
  assert(!s.combat.selectedUids.includes(mined), "заминированная карта не выбралась");
  const free = s.player.handUids.find((uid) => !s.combat.minedUids.includes(uid));
  Game.dispatch(s, { type: "SELECT_CARD", uid: free });
  assert(s.combat.selectedUids.includes(free), "чистая карта выбирается");
});

test("Sentry Ward и BKB обезвреживают мины", () => {
  const withSentry = newRun("MINE2");
  withSentry.player.items.push("sentry");
  setWave(withSentry, "techies");
  withSentry.combat.outcome = null;
  Game.assignMines(withSentry);
  assertEq(withSentry.combat.minedUids.length, 0, "sentry снимает мины");

  const withBkb = newRun("MINE3");
  withBkb.player.items.push("bkb");
  setWave(withBkb, "techies");
  withBkb.combat.outcome = null;
  Game.assignMines(withBkb);
  assertEq(withBkb.combat.minedUids.length, 0, "bkb снимает мины");
});

test("на волнах без Techies мин нет", () => {
  const s = newRun("MINE4");
  assertEq(s.combat.minedUids.length, 0, "T1 чиста");
});

suite("Bloodstone");

test("+0.5 множителя за каждую потерянную казарму", () => {
  const s = newRun("BLD1");
  s.player.items.push("bloodstone");
  s.run.barracks = 4; // потеряно 2
  const res = play(s, ["tusk"]);
  assertEq(res.mult, 2, "1 база + 2 × 0.5");
  assertEq(res.damage, 16, "8 × 2");
  const s2 = newRun("BLD2");
  s2.player.items.push("bloodstone");
  const res2 = play(s2, ["tusk"]);
  assertEq(res2.damage, 8, "казармы целы — камень спит");
});
