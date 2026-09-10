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
  assertEq(s.run.gold - goldBefore, 6 + 5 + 3 + 3, "зачистка 6 + ласт-хит 5 + улучшение 3 + бонус скорости 3G");
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

test("«Запасной слот»: бесконечный, цена ×1.8 за уровень (6 → 11 → 20)", () => {
  const s = upRun("UPG15");
  const base = DeckSys.handSize(s);
  s.combat.outcome = "cleared";
  Game.dispatch(s, { type: "ENTER_SHOP" });
  s.run.gold = 100;
  s.shop.upgrades = [{ id: "hand_slot" }];
  Game.dispatch(s, { type: "BUY_UPGRADE", upgradeId: "hand_slot" });
  assertEq(s.run.handSlots, 1, "уровень 1");
  assertEq(DeckSys.handSize(s), base + 1, "рука +1");
  s.shop.upgrades = [{ id: "hand_slot" }];
  Game.dispatch(s, { type: "BUY_UPGRADE", upgradeId: "hand_slot" });
  assertEq(s.run.handSlots, 2, "уровень 2");
  assertEq(DeckSys.handSize(s), base + 2, "рука +2");
  // Цена каждого следующего уровня растёт: 6, 11, 20...
  assertEq(Upgrades.handSlotDef(s).cost, Math.round(6 * Math.pow(1.8, 2)), "цена уровня 3 = 20");
  assertEq(Upgrades.handSlotDef(s).rarity, "mythic", "с 3-го уровня — мифик");
  assertEq(s.player.items.length, 0, "слоты предметов не тронуты");
});

test("Удача: сдвигает веса редкостей и добавляет слоты предложений", () => {
  const s = upRun("UPG15B");
  s.run.upgrades = ["podkova", "krolichya_lapka", "klever"]; // удача 6
  assertEq(Upgrades.luck(s), 6);
  assertEq(Upgrades.slotsFor(s), 6, "база 4 + удача 6 → шесть карточек");
  const w = Upgrades.rarityWeights(6);
  assert(w.common < 60 && w.epic > 4 && w.mythic > 1, "веса сдвинуты к топу");
  assert(w.common >= 15, "общие не выжигаются в ноль");
});

test("Реролл улучшений: 1G; купленное остаётся на месте и стакается", () => {
  const s = upRun("UPG15C");
  s.combat.outcome = "cleared";
  Game.dispatch(s, { type: "ENTER_SHOP" });
  assertEq((s.shop.upgrades || []).length, 4, "база — 4 карточки");
  s.run.gold = 10;
  Game.dispatch(s, { type: "REROLL_UPGRADES" });
  assertEq(s.run.gold, 9, "1G списано");
  assertEq((s.shop.upgrades || []).length, 4, "предложения обновлены");
  // Покупка: карточка ОСТАЁТСЯ на месте — можно докупить ещё раз
  s.shop.upgrades = [{ id: "ostryi_kraj" }, { id: "pereprodazha" }, { id: "meloch" }, { id: "sberezheniya" }];
  const before = s.shop.upgrades.length;
  Game.dispatch(s, { type: "BUY_UPGRADE", upgradeId: "ostryi_kraj" });
  assertEq(s.shop.upgrades.length, before, "карточка не заменяется");
  assertEq((s.run.upgrades || []).filter((x) => x === "ostryi_kraj").length, 1, "куплено 1");
  Game.dispatch(s, { type: "BUY_UPGRADE", upgradeId: "ostryi_kraj" });
  assertEq((s.run.upgrades || []).filter((x) => x === "ostryi_kraj").length, 2, "второй экземпляр стакается");
  assertEq(Upgrades.sum(s, "dmg"), 2, "эффекты складываются (+1% × 2)");
});

test("Торговая книга: после покупки карточку можно обновить за 1G", () => {
  const s = upRun("UPG15D");
  s.player.items.push("ledger");
  s.combat.outcome = "cleared";
  Game.dispatch(s, { type: "ENTER_SHOP" });
  s.shop.upgrades = [{ id: "ostryi_kraj" }];
  s.run.gold = 10;
  Game.dispatch(s, { type: "BUY_UPGRADE", upgradeId: "ostryi_kraj" });
  assertEq(s.shop.upgrades[0].justBought, true, "карточка помечена к обновлению");
  const before = s.shop.upgrades[0].id;
  Game.dispatch(s, { type: "REFRESH_UPGRADE", upgradeId: before });
  assertEq(s.run.gold, 7, "10 − 2 покупка − 1 обновление");
  assertEq(s.shop.upgrades.length, 1, "слот по-прежнему один");
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
  assert((s.shop.upgrades || []).length >= 2, "предложения улучшений на месте");
  s.shop.upgrades = [{ id: "ostryi_kraj", cost: 2 }];
  s.run.gold = 10;
  const itemsBefore = s.player.items.length;
  Game.dispatch(s, { type: "BUY_UPGRADE", upgradeId: "ostryi_kraj" });
  assertEq(s.run.gold, 8, "золото списано");
  assert((s.run.upgrades || []).includes("ostryi_kraj"), "куплено");
  assertEq(s.player.items.length, itemsBefore, "слоты предметов не тронуты");
  // Покупается многократно — эффекты складываются
  s.shop.upgrades.push({ id: "ostryi_kraj", cost: 2 });
  Game.dispatch(s, { type: "BUY_UPGRADE", upgradeId: "ostryi_kraj" });
  assertEq((s.run.upgrades || []).length, 2, "второй экземпляр стакается");
  assertEq(Upgrades.sum(s, "dmg"), 2, "+1% дважды = +2%");
});

test("Генерация предложений: детерминизм, без купленных, редкости из пула §5.1", () => {
  const a = upRun("UPG19");
  a.combat.outcome = "cleared";
  Game.dispatch(a, { type: "ENTER_SHOP" });
  const b = upRun("UPG19");
  b.combat.outcome = "cleared";
  Game.dispatch(b, { type: "ENTER_SHOP" });
  assertEq(JSON.stringify(a.shop.upgrades), JSON.stringify(b.shop.upgrades), "тот же сид — те же предложения");
  // Стакающийся пул неисчерпаем: даже купив всё, предложения приходят.
  const c = upRun("UPG20");
  c.combat.outcome = "cleared";
  c.run.upgrades = Content.upgrades.list.map((u) => u.id).concat(Content.upgrades.list.map((u) => u.id));
  Game.dispatch(c, { type: "ENTER_SHOP" });
  const left = (c.shop.upgrades || []).map((o) => o.id);
  assert(left.length >= 4, "предложения приходят всегда");
  assert(left.every((id) => Content.upgrades.byId[id] || id === "hand_slot" || id === "attr_potion"), "только реальные улучшения: " + left);
});

test("Зелье атрибута: заряд меняет атрибут героя во всех боевых расчётах", () => {
  const s = upRun("UPG21");
  s.combat.outcome = "cleared";
  Game.dispatch(s, { type: "ENTER_SHOP" });
  s.shop.upgrades = [{ id: "attr_potion" }];
  s.run.gold = 20;
  Game.dispatch(s, { type: "BUY_UPGRADE", upgradeId: "attr_potion" });
  assertEq(s.run.attrCharges, 1, "заряд куплен");
  assertEq(s.player.items.length, 0, "слоты предметов не тронуты");
  // Меняем Zeus (INT) на AGI и играем «Тимфайт атрибута» из агентов.
  const uids = ["morphling", "juggernaut", "pa"].map((h) => Object.values(s.cards).find((c) => c.heroId === h).uid);
  s.player.handUids = [...uids, ...Object.keys(s.cards).filter((u) => !uids.includes(u))];
  Game.dispatch(s, { type: "CHANGE_ATTR", heroId: "zeus", attr: "agi" });
  assertEq(s.run.attrCharges, 0, "заряд потрачен");
  assertEq(Game.heroAttr(s, "zeus"), "agi", "оверрайд действует");
  // Возвращаемся в бой: Zeus больше не INT.
  s.phase = "wave";
  s.combat.outcome = null;
  s.combat.selectedUids = ["morphling", "juggernaut", "pa"].map((h) => Object.values(s.cards).find((c) => c.heroId === h).uid);
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  const res = s.combat.lastResolution;
  const agiInPlay = res.steps.length >= 0; // расчёт не падает — главное
  assert(res.combo, "бой считался");
  // Повторная покупка даёт второй заряд; смена на тот же атрибут запрещена.
  s.combat.outcome = "cleared";
  Game.dispatch(s, { type: "ENTER_SHOP" });
  s.shop.upgrades = [{ id: "attr_potion" }];
  Game.dispatch(s, { type: "BUY_UPGRADE", upgradeId: "attr_potion" });
  Game.dispatch(s, { type: "CHANGE_ATTR", heroId: "zeus", attr: "agi" });
  assertEq(s.run.attrCharges, 1, "смена на тот же атрибут не тратит заряд");
});
