// Интеграционные тесты ядра "formation" (state.rules = "formation").
// Проверяют боевой контур целиком: детекцию формаций в resolveFight, шаги
// resolution stack, митигейт защиты, алиасы условий §7 и нетронутость classic.
// Хелперы свои (frm*) — не зависят от порядка загрузки других test-файлов.

suite("Флаг formation: интеграция боёвки");

function frmRun(seed, rules) {
  return Game.dispatch(Game.createInitialState(""), { type: "START_RUN", seedCode: seed || "FRM1", rules });
}

function frmForceHand(s, heroIds) {
  const uids = heroIds.map((h) => Object.values(s.cards).find((c) => c.heroId === h).uid);
  s.player.handUids = uids.slice();
  s.player.deckUids = Object.keys(s.cards).filter((uid) => !uids.includes(uid));
  s.player.discardUids = [];
  return uids;
}

function frmPlay(s, heroIds) {
  const uids = frmForceHand(s, heroIds);
  s.combat.selectedUids = uids.slice();
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  return s.combat.lastResolution;
}

function frmHasStep(res, part) {
  return res.steps.some((st) => st.label.indexOf(part) !== -1);
}

test("флаг: classic по умолчанию, formation — по action.rules", () => {
  assertEq(Game.createInitialState("").rules, "classic");
  assertEq(frmRun("FRM0").rules, "classic");
  assertEq(frmRun("FRM0", "formation").rules, "formation");
});

test("формация детектится в бою, Axe срабатывает через алиас §7 (3 одинаковых ранга)", () => {
  const s = frmRun("FRM2", "formation");
  const res = frmPlay(s, ["axe", "morphling", "zeus", "pudge", "sven"]);
  // Morphling копирует STR у Axe (PRE_DETECT) → 4 STR: Фаланга; связки Сила+Ганг+Фронт
  assertEq(res.combo.type, "phalanx");
  assertEq(res.combo.tier, 3);
  assertEq(res.damageType, "physical");
  assertEq(res.power, 75, "сила: 20 база + 15 связки + 30 карт + 10 от Axe");
  assertEq(Math.round(res.mult * 100) / 100, 3.3, "2.2 × 1.5 от Sven (сильнейший в бою)");
  assertEq(res.damage, 309, "75 × 3.3 × 1.25 ставка, T1 без защиты");
  assert(frmHasStep(res, "Формация «Фаланга»"), "шаг формации в стеке");
  assert(frmHasStep(res, "Связка «Сила»"), "шаг связки в стеке");
  assert(frmHasStep(res, "Связка «Фронт»"), "Morphling стал STR — фронт собран");
  assert(frmHasStep(res, "Axe: +10 силы"), "алиас COMBO_IS three → SAME_RANK_GROUP 3");
  assert(frmHasStep(res, "Sven: ×1.5"), "способность Sven сработала");
});

test("порядок слотов меняет урон: по возрастанию 295, обратный 319 (Фронт)", () => {
  const a = frmPlay(frmRun("FRM3", "formation"), ["cm", "tusk", "axe", "pudge", "sven"]);
  assertEq(a.combo.type, "phalanx", "детектор берёт максимум урона: Фаланга, не Рампа");
  assertEq(a.damage, 239, "(25+25+8 Tusk) × 2.2 × 1.5 Sven × 1.25, T1");
  const b = frmPlay(frmRun("FRM3", "formation"), ["sven", "pudge", "axe", "tusk", "cm"]);
  assertEq(b.combo.type, "phalanx");
  assertEq(b.damage, 256, "+4 связки Фронт (слоты 1–2 STR ≥5)");
});

test("митигейт: физический урон минус броня T2, шаг виден в стеке", () => {
  const s = frmRun("FRM4", "formation");
  s.combat.wave.towerId = "t2"; // защита: armor 10, mr 0
  const res = frmPlay(s, ["cm", "tusk", "axe", "pudge", "sven"]);
  assertEq(res.damage, 225, "239 raw − 14 брони");
  assert(frmHasStep(res, "Броня башни 14"), "шаг митигейта телеграфирует расчёт");
});

test("чистый урон игнорирует броню (Клин pure)", () => {
  const s = frmRun("FRM5", "formation");
  s.combat.wave.towerId = "t2";
  // Zeus теперь «рядом INT» (Static Field): cm стоит соседом, чтобы +2 множ. жил.
  const res = frmPlay(s, ["cm", "zeus", "centaur", "tusk", "pudge"]);
  assertEq(res.combo.type, "wedge", "пик в центре, но свита не на 4 слабее: не 4p1, берётся Клин");
  assertEq(res.damageType, "pure");
  assertEq(res.damage, 315, "(16+5 связки+27+8 Tusk) × (2.1+0.4 Интеллект+2 Zeus) × 1.25 — броня T2 не применяется");
  assert(frmHasStep(res, "Чистый урон"), "шаг «чистый урон» в стеке");
});

test("4 Protect 1: порог по СИЛЬНЕЙШЕМУ из свиты, не по среднему", () => {
  // Каноничный: Primal 11 в центре, свита 2/3/5/7 — 11 ≥ 7+4.
  const ok = frmPlay(frmRun("FRM9", "formation"), ["cm", "tusk", "primal", "pudge", "zeus"]);
  assertEq(ok.combo.type, "protect", "кэрри на 4+ сильнее каждого");
  // Рядом с кэрри почти равный герой — 4p1 не собирается (раньше собирался по среднему).
  const no = frmPlay(frmRun("FRM9b", "formation"), ["cm", "tusk", "primal", "pudge", "centaur"]);
  assert(no.combo.type !== "protect", "11 против Центавра 10 — не «защита кэрри»");
});

test("алиас Satanic: ×1.5 на слабых формациях (tier ≤ 2), молчит на жирных", () => {
  const s = frmRun("FRM6", "formation");
  s.player.items.push("satanic");
  // порядок 5-2-7 не читается как Рампа → Отряд, tier 1
  const weak = frmPlay(s, ["zeus", "cm", "juggernaut"]);
  assert(frmHasStep(weak, "Satanic"), "Satanic срабатывает на tier ≤ 2");
  assertEq(weak.damage, 148, "26 × (1.4+0.4 Интеллект +2 Zeus) × 1.5 Satanic");
  const strong = frmPlay(frmRun("FRM6b", "formation"), ["cm", "tusk", "centaur", "pudge", "zeus"]);
  assert(!frmHasStep(strong, "Satanic"), "на tier 5 Satanic молчит");
});

test("проклятие Фортификация на формациях бьёт по tier ≤ 1", () => {
  const s = frmRun("FRM7", "formation");
  s.combat.wave.modifiers.push({ id: "bastion" });
  const weak = frmPlay(s, ["cm", "tusk"]); // Дуэль, tier 1
  assertEq(weak.damage, 14, "(10+5+4 Tusk) × 1.4 × 0.5");
  assert(frmHasStep(weak, "Фортификация"));
  const strong = frmPlay(frmRun("FRM7b", "formation"), ["cm", "tusk", "centaur", "pudge", "zeus"]); // 4-1, tier 5
  assert(!frmHasStep(strong, "Фортификация"), "tier 5 не «малое комбо»");
});

test("BKB снимает и числовую защиту (formation)", () => {
  const s = frmRun("FRM8", "formation");
  s.combat.wave.towerId = "t2";
  s.player.items.push("bkb");
  const res = frmPlay(s, ["cm", "tusk", "axe", "pudge", "sven"]);
  assertEq(res.damage, 239, "physical без брони — как на T1");
  assert(frmHasStep(res, "BKB: числовая защита"));
});

test("detectPower работает в формациях (Butterfly собирает Ганг)", () => {
  const s = frmRun("FRM9", "formation");
  s.player.items.push("butterfly");
  const res = frmPlay(s, ["cm", "tusk", "axe", "pudge", "sven"]);
  // слабейшая (CM 2) → детект-ранг 3: Ганг 3-3 даёт +8 силы, выбор кандидата лучший
  assert(frmHasStep(res, "Butterfly"), "PRE_DETECT-семейство живо на формациях");
  assertEq(res.combo.type, "phalanx");
  assertEq(res.power, 64, "20 база + (5 Сила + 6 Ганг) + 25 карт + 8 Tusk");
});

test("classic не затронут: та же рука — прежнее покерное комбо и математика", () => {
  const s = frmRun("FRM10"); // rules: classic
  const res = frmPlay(s, ["axe", "morphling", "zeus", "pudge", "juggernaut"]);
  assertEq(res.combo.type, "full_house");
  assertEq(res.damage, 518, "эталон из BALANCE.md/combat.test.js");
  assert(!frmHasStep(res, "Формация"), "в classic нет формационных шагов");
});

suite("Флаг formation: FormationSys из src");

test("контракт и альтернативы на реальном Content", () => {
  const cards = [2, 3, 5, 7, 8].map((p, i) => ({ power: p, attr: "str", slotIndex: i }));
  const f = FormationSys.evaluate(cards, { defense: Content.towerDefense.byId.t3 });
  assertEq(f.id, "phalanx", "детектор берёт максимум урона против T3");
  assert(f.alternatives.length >= 2 && f.alternatives[0].id === f.id, "альтернативы отсортированы");
  assert(f.alternatives.some((x) => x.id === "ramp"), "Рампа валидна и видна в списке");
  assert(f.rule && f.tier != null, "UI-поля rule/tier на месте");
  const hint = FormationSys.bestSwap(
    ["sven", "pudge", "cm", "zeus", "lina"].map((id) => {
      const h = Content.heroes.byId[id];
      return { power: h.power, attr: h.attr, heroId: h.id };
    }),
    { defense: Content.towerDefense.byId.t3, commit: 1.25 }
  );
  assert(hint && hint.gain > 0, "bestSwap находит перестановку с выигрышем: " + JSON.stringify(hint));
});
