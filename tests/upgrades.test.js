// Фаза F — улучшения лавки (спек §5): scalar-агрегатор + hook-апгрейды через
// триггерную систему. Улучшения НЕ занимают слоты предметов.
suite("Фаза F — улучшения лавки");

function upRun(seed) {
  return Game.dispatch(Game.createInitialState(""), { type: "START_RUN", seedCode: seed || "UPG1" });
}
function upPlay(s, heroIds) {
  const uids = heroIds.map((h) => Object.values(s.cards).find((c) => c.heroId === h).uid);
  s.player.handUids = [...uids, ...Object.keys(s.cards).filter((u) => !uids.includes(u))];
  s.combat.selectedUids = uids.slice();
  s.player.fightsLeft = Math.max(1, s.player.fightsLeft);
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  return s.combat.lastResolution;
}

test("Scalar «Острый край» + «Полный состав»: проценты складываются (518 → 534)", () => {
  const s = upRun("UPG10");
  s.run.upgrades = ["ostryi_kraj", "polnyy_sostav"]; // +1% и +2% на пятёрке
  const res = upPlay(s, ["axe", "morphling", "zeus", "pudge", "juggernaut"]);
  assertEq(res.damage, 534, "518 × 1.03 = 533.54 → 534");
  assert(res.steps.some((st) => st.icon === "🔧"), "хук-шаг улучшения в стеке");
});

test("Hook «Одинокий волк»: соло-бой +4%, на пятёрке молчит", () => {
  const s = upRun("UPG11");
  s.run.upgrades = ["odinokiy_volk"];
  const solo = upPlay(s, ["tusk"]);
  assertEq(solo.damage, 8, "8 × 1.04 = 8.32 → 8 (округление вниз)");
  assert(solo.steps.some((st) => st.label.includes("Одинокий волк")), "хук сработал");
  const s2 = upRun("UPG12");
  s2.run.upgrades = ["odinokiy_volk"];
  const five = upPlay(s2, ["axe", "morphling", "zeus", "pudge", "juggernaut"]);
  assertEq(five.damage, 518, "пятёрка без волчьей прибавки");
});

test("Hook «Точный расчёт»: +3G за точный ласт-хит (к базовым +5)", () => {
  const s = upRun("UPG13");
  s.run.upgrades = ["tochnyy_raschet"];
  // Падж(7)+Джаггернаут(7) = 24×2 = 48; снимаем башню в ноль.
  const uids = ["pudge", "juggernaut"].map((h) => Object.values(s.cards).find((c) => c.heroId === h).uid);
  s.player.handUids = [...uids, ...Object.keys(s.cards).filter((u) => !uids.includes(u))];
  s.combat.selectedUids = uids.slice();
  s.combat.wave.hp = 48;
  s.combat.wave.maxHp = Math.max(s.combat.wave.maxHp, 48);
  const goldBefore = s.run.gold;
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  assertEq(s.run.gold - goldBefore, 6 + 5 + 3, "зачистка 6 + ласт-хит 5 + улучшение 3");
});

test("Hook «Перелом»: башня ниже 25% HP даёт +3% урона", () => {
  const s = upRun("UPG14");
  s.run.upgrades = ["perelom"];
  s.combat.wave.hp = Math.floor(s.combat.wave.maxHp * 0.2);
  const uids = ["axe", "morphling", "zeus", "pudge", "juggernaut"].map((h) => Object.values(s.cards).find((c) => c.heroId === h).uid);
  s.player.handUids = [...uids, ...Object.keys(s.cards).filter((u) => !uids.includes(u))];
  s.combat.selectedUids = uids.slice();
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  assertEq(s.combat.lastResolution.damage, 534, "518 × 1.03");
});

test("Scalar рука: «Запасной слот» +1 к размеру руки", () => {
  const s = upRun("UPG15");
  const base = DeckSys.handSize(s);
  s.run.upgrades = ["zapasnoy_slot"];
  assertEq(DeckSys.handSize(s), base + 1);
});

test("Scalar реролл: «Сбережения» дешевеют только при 15+ золоте", () => {
  const s = upRun("UPG16");
  s.run.upgrades = ["sberezheniya"];
  s.run.gold = 10;
  assertEq(Game.rerollCost(s), Ranks.rerollCost(s), "бедный — без скидки");
  s.run.gold = 20;
  assertEq(Game.rerollCost(s), Ranks.rerollCost(s) - 1, "богатый — −1G");
});

test("Scalar продажа: «Перепродажа» +3% к цене продажи", () => {
  const s = upRun("UPG17");
  const base = Economy.sellValue(s, "midas"); // 7/2 → 3
  s.run.upgrades = ["pereprodazha"];
  assertEq(Economy.sellValue(s, "midas"), Math.floor(3.5 * 1.03), "3.5 × 1.03 → 3");
  assert(base === 3, "база: полцены с округлением вниз");
});

test("Покупка улучшения: BUY_UPGRADE списывает золото, не трогает слоты предметов", () => {
  const s = upRun("UPG18");
  s.combat.outcome = "cleared";
  Game.dispatch(s, { type: "ENTER_SHOP" });
  assert((s.shop.upgrades || []).length === 2, "2 предложения улучшений");
  s.shop.upgrades = [{ id: "ostryi_kraj", cost: 2 }];
  s.run.gold = 10;
  const itemsBefore = s.player.items.length;
  Game.dispatch(s, { type: "BUY_UPGRADE", upgradeId: "ostryi_kraj" });
  assertEq(s.run.gold, 8, "золото списано");
  assert((s.run.upgrades || []).includes("ostryi_kraj"), "куплено");
  assertEq(s.player.items.length, itemsBefore, "слоты предметов не тронуты");
  // Повторно купить нельзя
  s.shop.upgrades.push({ id: "ostryi_kraj", cost: 2 });
  Game.dispatch(s, { type: "BUY_UPGRADE", upgradeId: "ostryi_kraj" });
  assertEq((s.run.upgrades || []).length, 1, "второй экземпляр не продаётся");
});

test("Генерация предложений: детерминизм, без купленных, редкости из пула §5.1", () => {
  const a = upRun("UPG19");
  a.combat.outcome = "cleared";
  Game.dispatch(a, { type: "ENTER_SHOP" });
  const b = upRun("UPG19");
  b.combat.outcome = "cleared";
  Game.dispatch(b, { type: "ENTER_SHOP" });
  assertEq(JSON.stringify(a.shop.upgrades), JSON.stringify(b.shop.upgrades), "тот же сид — те же предложения");
  a.run.upgrades = Content.upgrades.list.map((u) => u.id); // всё куплено
  const c = upRun("UPG20");
  c.combat.outcome = "cleared";
  c.run.upgrades = Content.upgrades.list.map((u) => u.id);
  Game.dispatch(c, { type: "ENTER_SHOP" });
  assertEq((c.shop.upgrades || []).length, 0, "пул исчерпан — предложений нет");
});
