// Fun-билды (docs/PROPOSALS_FUN_BUILDS.md): легенды таверны, новые предметы
// и улучшения. Каждая механика проверяется в бою; лотереи — перебором сидов.
// Хелперы с префиксом fn* — контекст общий, имена не пересекаются.

suite("Fun-билды: легенды и новые предметы");

function fnRun(seed, rules) {
  return Game.dispatch(Game.createInitialState(""), { type: "START_RUN", seedCode: seed, rules });
}
function fnAdd(s, heroIds) {
  for (const h of [].concat(heroIds)) DeckSys.addHero(s, h);
}
function fnPlay(s, heroIds) {
  const uids = heroIds.map((h) => Object.values(s.cards).find((c) => c.heroId === h).uid);
  s.player.handUids = uids.slice();
  s.player.deckUids = Object.keys(s.cards).filter((uid) => !uids.includes(uid));
  s.player.discardUids = [];
  s.combat.selectedUids = uids.slice();
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  return s.combat.lastResolution;
}
function fnStep(res, part) {
  return res.steps.some((st) => st.label.indexOf(part) !== -1);
}
// Находит сид с нужным свойством среди первых tries.
function fnSeedWhere(make, predicate, tries) {
  for (let i = 1; i <= tries; i++) {
    const s = make("FSEED" + i);
    if (predicate(s)) return { seed: "FSEED" + i, state: s };
  }
  return null;
}

test("Venomancer — Poison Nova: +7 осадного урона в каждом бою", () => {
  const s = fnRun("FNV1");
  fnAdd(s, "venomancer");
  const res = fnPlay(s, ["venomancer", "cm"]);
  assert(fnStep(res, "Осада: +7 чистого урона"), "яд в стеке");
  assertEq(s.combat.wave.burnBank, undefined, "без Воронки банка нет");
});

test("Воронка яда: осадный урон копится между боями волны", () => {
  const s = fnRun("FNF1");
  fnAdd(s, "venomancer");
  s.player.items.push("venom_funnel");
  s.combat.wave.hp = 100000; s.combat.wave.maxHp = 100000;
  const venoUid = Object.values(s.cards).find((c) => c.heroId === "venomancer").uid;
  const r1 = fnPlay(s, ["venomancer", "cm"]);
  assert(fnStep(r1, "Яд копится: всего 7"), "первый бой: банк 7");
  assertEq(s.combat.wave.burnBank, 7, "банк волны = 7");
  // второй бой той же волны: venomancer снова в строю — свежий яд ложится в банк
  s.player.handUids = [venoUid, ...s.player.handUids.filter((u) => u !== venoUid)];
  s.player.deckUids = Object.keys(s.cards).filter((u) => !s.player.handUids.includes(u));
  s.player.discardUids = s.player.discardUids.filter((u) => u !== venoUid);
  s.combat.selectedUids = [venoUid, s.player.handUids[1]];
  s.player.fightsLeft = Math.max(1, s.player.fightsLeft);
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  const r2 = s.combat.lastResolution;
  assert(fnStep(r2, "Яд копится: всего 14"), "второй бой: банк 14 — яд не смывается");
  assertEq(s.combat.wave.burnBank, 14, "банк накопился");
});

test("Wraith King — Wraithfire: +1 сила за каждый бой, навсегда", () => {
  const s = fnRun("FWK1");
  fnAdd(s, "wraith_king");
  assertEq(Game.rankOf(s, "wraith_king"), 6, "старт 6");
  fnPlay(s, ["wraith_king", "cm"]);
  assertEq(Game.rankOf(s, "wraith_king"), 7, "после боя 7");
  assert(fnStep(s.combat.lastResolution, "воскрешает сильнее — теперь 7 силы"), "шаг роста: итоговый ранг");
});

test("Magnus — Reverse Polarity: соседи +35% их силы", () => {
  const s = fnRun("FMG1");
  fnAdd(s, "magnus");
  const res = fnPlay(s, ["magnus", "sven"]);
  // сосед Sven 8: round(8 × 0.35) = 3
  assert(fnStep(res, "Magnus: рог бьёт по площади — +3 силы (1 сосед × 35%)"), "бонус соседа");
  const solo = fnPlay(fnRun("FMG2"), ["cm"]);
  assert(!fnStep(solo, "Magnus:"), "соло-герой Magnus не участвует");
});

test("Silencer — Last Word (ON_HELD): скамейка бьёт за каждого в руке", () => {
  const s = fnRun("FSL1");
  fnAdd(s, "silencer");
  const ids = Object.values(s.cards);
  const axe = ids.find((c) => c.heroId === "axe").uid;
  const sil = ids.find((c) => c.heroId === "silencer").uid;
  s.player.handUids = [axe, sil, ...s.player.handUids.filter((u) => u !== axe && u !== sil)];
  s.player.deckUids = Object.keys(s.cards).filter((u) => !s.player.handUids.includes(u));
  s.combat.selectedUids = [axe];
  const held = s.player.handUids.length - 1;
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  const res = s.combat.lastResolution;
  assert(fnStep(res, `скамейка бьёт — +${held * 2} силы (${held} в руке)`), "скамейка бьёт за каждого held");
});

test("Скипетр Барона: ранг 12 в руке — ×1.35 к множителю", () => {
  const s = fnRun("FBR1");
  fnAdd(s, "kunkka");
  s.player.items.push("baron_scepter");
  const ids = Object.values(s.cards);
  const axe = ids.find((c) => c.heroId === "axe").uid;
  const kk = ids.find((c) => c.heroId === "kunkka").uid;
  s.player.handUids = [axe, kk, ...s.player.handUids.filter((u) => u !== axe && u !== kk)];
  s.player.deckUids = Object.keys(s.cards).filter((u) => !s.player.handUids.includes(u));
  s.combat.selectedUids = [axe];
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  const res = s.combat.lastResolution;
  assert(fnStep(res, "1 король в руке — ×1.35 к множителю"), "Барон видит Kunkka 12");
  // Kunkka играет сам — королей в руке нет, Барон молчит
  const s2 = fnRun("FBR2");
  fnAdd(s2, "kunkka");
  s2.player.items.push("baron_scepter");
  const no = fnPlay(s2, ["kunkka", "cm"]);
  assert(!fnStep(no, "короля в руке"), "король на поле — не в руке");
});

test("Chaos Knight — Chaos Bolt: 50/50, оба исхода достижимы", () => {
  let hits = 0, misses = 0;
  for (let i = 1; i <= 8; i++) {
    const s = fnRun("FCKB" + i);
    fnAdd(s, "chaos_knight");
    const res = fnPlay(s, ["chaos_knight", "cm"]);
    if (fnStep(res, "хаос сложился — ×2")) hits++;
    if (fnStep(res, "хаос рассыпался — +16")) misses++;
    assert(hits + misses === i, "ровно один исход за бой");
  }
  assert(hits > 0 && misses > 0, `оба исхода достижимы (×2: ${hits}, +16: ${misses})`);
});

test("Три звезды: 3+ героя одного ранга — +50% силы каждому из группы", () => {
  const s = fnRun("FTS1");
  s.player.items.push("three_stars");
  const res = fnPlay(s, ["axe", "morphling", "zeus"]);
  // тройка 5-5-5: floor(5×0.5)=2 → +6
  assert(fnStep(res, "3 героя группы усилены — +6 силы"), "группа усилена");
  const s2 = fnRun("FTS2");
  s2.player.items.push("three_stars");
  const no = fnPlay(s2, ["axe", "cm", "tusk"]);
  assert(!fnStep(no, "группы усилены"), "без тройки молчит");
});

test("Полароид: первый герой строю 10+ — ×2", () => {
  const s = fnRun("FPL1");
  s.player.items.push("polaroid");
  const res = fnPlay(s, ["centaur", "cm"]);
  assertEq(res.mult, 2, "Centaur 10 первым — ×2");
  const s2 = fnRun("FPL2");
  s2.player.items.push("polaroid");
  const no = fnPlay(s2, ["cm", "centaur"]);
  assert(!fnStep(no, "Snapshot: ×"), "первый — CM 2, молчит");
});

test("Демоническая форма: каждый бой волны качает следующий", () => {
  const s = fnRun("FDF1");
  s.player.items.push("demon_form");
  s.combat.fightIndex = 0;
  const r1 = fnPlay(s, ["cm"]);
  assert(fnStep(r1, "форма растёт"), "первый бой: сообщение о разгоне");
  const s2 = fnRun("FDF2");
  s2.player.items.push("demon_form");
  s2.combat.fightIndex = 2; // третий бой волны: +8
  const r2 = fnPlay(s2, ["cm"]);
  assert(fnStep(r2, "демоническая форма — +8 силы (бой 3 волны)"), "бой 3: +8");
});

test("Однорукий бандит: джекпот делает весь отряд рангом 7", () => {
  const found = fnSeedWhere(
    (seed) => {
      const s = fnRun(seed);
      s.player.items.push("one_armed_bandit");
      fnPlay(s, ["axe", "cm"]);
      return s;
    },
    (s) => s.combat.lastResolution.combo.type === "pair" && fnStep(s.combat.lastResolution, "ДЖЕКПОТ"),
    25
  );
  assert(found, "за 25 сидов джекпот собрал пару 7-7");
});

test("Мантра: 3 боя подряд одной формации — следующий ×1.75", () => {
  const s = fnRun("FMN1", "formation");
  s.player.items.push("mantra");
  s.run.comboStreak = 3;
  s.run.lastComboTypeRaw = "wedge";
  const res = fnPlay(s, ["cm", "centaur", "tusk"]);
  assertEq(res.combo.type, "wedge");
  assert(fnStep(res, "Мантра: ×1.75 множитель"), "божественный режим");
  const s2 = fnRun("FMN2", "formation");
  s2.player.items.push("mantra");
  const no = fnPlay(s2, ["cm", "centaur", "tusk"]);
  assert(!fnStep(no, "×1.75"), "без серии молчит");
});

test("Еретик: Фаланга от 3 героев одного атрибута, Треугольник от 2", () => {
  const s = fnRun("FHR1", "formation");
  fnAdd(s, "lina");
  s.player.items.push("heresy");
  const res = fnPlay(s, ["zeus", "lina", "cm"]);
  assertEq(res.combo.type, "phalanx", "три INT — Фаланга по Ереси");
  assertEq(res.combo.rule, "Еретик: 3 героя одного атрибута", "правило подписано");
  const s2 = fnRun("FHR2", "formation");
  fnAdd(s2, "lina");
  const bare = fnPlay(s2, ["zeus", "lina", "cm"]);
  assert(bare.combo.type !== "phalanx", "без Ереси тройка монотопа — не Фаланга (пик в центре даёт Клин)");
});

test("Осадный колун: броня башни прибавляется к удару", () => {
  const bare = fnRun("FAX1", "formation");
  bare.combat.wave.towerId = "t2";
  const r1 = fnPlay(bare, ["axe", "cm"]);
  const withAxe = fnRun("FAX1", "formation");
  withAxe.combat.wave.towerId = "t2";
  withAxe.player.items.push("siege_axe");
  const r2 = fnPlay(withAxe, ["axe", "cm"]);
  // raw 23.8: голыми руками броня съедает min(14, raw/2) = 11.9 → 12;
  // с колуном броня ПРИБАВЛЯЕТСЯ: 23.8 + 14 = 37.8 → 38. Дельта 26.
  assertEq(r1.damage, 12, "голыми руками: −броня");
  assertEq(r2.damage, 38, "с колуном: +броня");
  assert(fnStep(r2, "Осадный колун: броня 14 прибавлена к удару"), "честная метка в стеке");
});

test("Pugna — Nether Ward: лечение башни обращается в урон", () => {
  const make = (seed, withPugna) => {
    const s = fnRun(seed);
    s.combat.wave.modifiers.push({ id: "regen" });
    s.combat.wave.hp = 100000; s.combat.wave.maxHp = 100000;
    if (withPugna) fnAdd(s, "pugna");
    return fnPlay(s, withPugna ? ["pugna", "cm"] : ["cm", "tusk"]);
  };
  const bare = make("FPG1", false);
  const fed = make("FPG2", true);
  // у составов разная сила — сравниваем шаг, а не числа
  assert(fnStep(fed, "Pugna обращает лечение во вред — башня теряет"), "Регенерация во вред");
  assert(fnStep(bare, "Регенерация: башня лечит"), "без Пугны лечится");
});

test("Крысиный ультиматум: 1–2 героя — башня теряет 8% maxHp", () => {
  const s = fnRun("FRT1");
  s.player.items.push("rat_mandate");
  const res = fnPlay(s, ["cm"]);
  // T1: maxHp 450 → 8% = 36
  assert(fnStep(res, "Сплит-пуш: башня теряет ещё 36 HP (8% maxHp)"), "крысы грызут");
  const s2 = fnRun("FRT2");
  s2.player.items.push("rat_mandate");
  const big = fnPlay(s2, ["cm", "tusk", "axe"]);
  assert(!fnStep(big, "Сплит-пуш"), "трое и больше — крысы не работают");
});

test("Techies — Suicide: провал волны надрывает башню (пол 50%)", () => {
  const s = fnRun("FTC1");
  fnAdd(s, "techies");
  fnPlay(s, ["techies", "cm"]);
  assertEq(s.combat.wave.failBurnPct, 10, "флаг прожига на волне");
  s.combat.outcome = "failed";
  Game.dispatch(s, { type: "RETRY_WAVE" });
  // Рекрут: Милосердие восстанавливает 70%, затем Техники отгрызают 10% maxHp.
  const expected = Math.max(Math.ceil(s.combat.wave.maxHp * 0.5), Math.ceil(s.combat.wave.maxHp * 0.7) - Math.ceil(s.combat.wave.maxHp * 0.1));
  assertEq(s.combat.wave.hp, expected, "башня восстановилась надорванной");
  assert(s.log.some((l) => l.includes("башня надорвана")), "лог Техники");
});

test("Спелый банан: ×3 в бою, 30% сгниёт после зачистки", () => {
  const withBanana = fnRun("FBAN1");
  withBanana.player.items.push("ripe_banana");
  const res = fnPlay(withBanana, ["cm"]);
  assertEq(res.mult, 3, "×3 к множителю");
  // гниение: перебор сидов — должны быть и выжившие, и сгнившие
  let rotten = 0, alive = 0;
  for (let i = 1; i <= 10; i++) {
    const s = fnRun("FBANR" + i);
    s.player.items.push("ripe_banana");
    s.combat.wave.hp = 1; // мгновенная зачистка
    s.player.discardsLeft = 0;
    fnPlay(s, ["cm"]);
    if (s.player.items.includes("ripe_banana")) alive++; else rotten++;
  }
  assert(rotten > 0 && alive > 0, `оба исхода гниения (сгнило: ${rotten}, выжило: ${alive})`);
});

test("Планетарий: +0.15 множителя самой частой формации", () => {
  const s = fnRun("FPLN1", "formation");
  s.run.upgrades = [...(s.run.upgrades || []), "planetarium"];
  s.run.upgradeState = Object.assign({}, s.run.upgradeState, { planetarium: { level: 1, charges: 3, actUses: 0 } });
  s.run.comboTypes = { wedge: 5 };
  s.phase = "shop";
  Game.dispatch(s, { type: "ACTIVATE_UPGRADE", upgradeId: "planetarium" });
  assertEq(s.run.formationBoosts.wedge, 0.15, "буст записан");
  s.phase = "wave";
  const res = fnPlay(s, ["cm", "centaur", "tusk"]);
  assertEq(Math.round(res.mult * 100) / 100, 2.25, "Клин 2.1 + 0.15");
});

test("Торговая магия: каждый реролл лавки качает случайного героя", () => {
  const s = fnRun("FTM1");
  s.run.upgrades = [...(s.run.upgrades || []), "trade_magic"];
  s.run.upgradeState = Object.assign({}, s.run.upgradeState, { trade_magic: { level: 1, charges: 0, actUses: 0 } });
  s.combat.outcome = "cleared";
  Game.dispatch(s, { type: "ENTER_SHOP" });
  const sumRanks = () => [...s.player.handUids, ...s.player.deckUids, ...s.player.discardUids]
    .reduce((a, uid) => a + Game.rankOf(s, s.cards[uid].heroId), 0);
  const before = sumRanks();
  s.run.gold = 20;
  Game.dispatch(s, { type: "REROLL_SHOP" });
  assertEq(sumRanks(), before + 1, "один герой вырос на 1");
});

test("Кровная клятва: провал волны — весь ростер +1", () => {
  const s = fnRun("FBO1");
  s.run.upgrades = [...(s.run.upgrades || []), "blood_oath"];
  s.run.upgradeState = Object.assign({}, s.run.upgradeState, { blood_oath: { level: 1, charges: 0, actUses: 0 } });
  s.player.fightsLeft = 1;
  fnPlay(s, ["cm"]); // 2 урона — башня жива, волна провалена
  assertEq(s.combat.outcome, "failed", "волна провалена");
  const axeBefore = Game.rankOf(s, "axe");
  Game.dispatch(s, { type: "RETRY_WAVE" });
  assertEq(Game.rankOf(s, "axe"), axeBefore + 1, " Axe вырос от боли");
});

test("Легенды: цена ×2, максимум 2 за забег", () => {
  assertEq(Game.recruitPrice("wraith_king", null), 14, "(4 + 3) × 2 = 14");
  assertEq(Game.recruitPrice("axe", null), 6, "обычный без наценки");
  const s = fnRun("FLG1");
  fnAdd(s, ["wraith_king", "venomancer", "silencer"]); // 3 легенды «в владении»
  s.combat.outcome = "cleared";
  Game.dispatch(s, { type: "ENTER_SHOP" });
  for (const r of s.shop.recruits) {
    assert(!(Content.heroes.byId[r] || {}).legend, "легенда предложена сверх лимита: " + r);
  }
});
