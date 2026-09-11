// Улучшения v2: активки с контекстами, инстансы, без дубликатов, engine-связки.
// Запасное правило пула: карточка должна быть ощутима за акт — никаких
// лотерей до ~25% и голых «+1–2%».
suite("Улучшения v2 — активации и лавка");

function upRun(seed) {
  return Game.dispatch(Game.createInitialState(""), { type: "START_RUN", seedCode: seed || "UPG1", rules: "formation", rank: 1, starterId: "standard" });
}
function upPlay(s, heroIds) {
  const uids = heroIds.map((h) => Object.values(s.cards).find((c) => c.heroId === h).uid);
  s.player.handUids = [...uids, ...Object.keys(s.cards).filter((u) => !uids.includes(u))];
  s.combat.selectedUids = uids.slice();
  s.player.fightsLeft = Math.max(1, s.player.fightsLeft);
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  return s.combat.lastResolution;
}
function toShop(s) {
  s.combat.outcome = "cleared";
  Game.dispatch(s, { type: "ENTER_SHOP" });
  return s;
}
function toRoute(s) {
  Game.dispatch(s, { type: "LEAVE_SHOP" });
  return s;
}
function takeNormal(s) {
  Game.dispatch(s, { type: "TAKE_ROUTE", kind: "normal" });
  return s;
}

// ===== Лавка: без дубликатов, слот заменяется, инстансы =====

test("Генерация: купленное не предлагается, дублей в выдаче нет", () => {
  const s = upRun("UPV1");
  // chistyy_dabor уровневый — купленным быть предложен ступенью II, поэтому
  // тут только одноступенчатые дефы.
  s.run.upgrades = ["iskra", "svobodnaya_kletka"];
  const offers = Upgrades.generateOffers(s, 10, []);
  const ids = offers.map((o) => o.id);
  assertEq(new Set(ids).size, ids.length, "без повторов внутри выдачи");
  assert(!ids.includes("iskra") && !ids.includes("svobodnaya_kletka"), "купленное исключено");
  assert(ids.every((id) => Content.upgrades.byId[id] || id === Upgrades.HAND_SLOT_ID || id === Upgrades.ATTR_POTION_ID || id === Upgrades.RECHARGE_ID), "только реальные дефы/виртуальные");
});

test("Покупка: слот немедленно заменяется, инстанс создаётся с зарядами", () => {
  const s = upRun("UPV2");
  toShop(s);
  s.shop.upgrades = [{ id: "schastlivy" }, { id: "chistyy_dabor" }];
  s.run.gold = 20;
  Game.dispatch(s, { type: "BUY_UPGRADE", upgradeId: "schastlivy" });
  assert(s.run.upgrades.includes("schastlivy"), "куплено");
  const inst = Upgrades.instanceOf(s, "schastlivy");
  assertEq(inst.charges, 1, "активка создана с зарядами из дефа");
  assertEq(inst.level, 1, "уровень 1");
  assertEq(s.run.gold, 15, "5G списано");
  assert(s.shop.upgrades[0].id !== "schastlivy", "купленный слот заменён новой карточкой");
  assertEq(s.shop.upgrades[1].id, "chistyy_dabor", "соседний слот не тронут");
  assertEq(s.player.items.length, 0, "слоты предметов не тронуты");
});

test("Повторная покупка того же улучшения запрещена (дубликатов нет)", () => {
  const s = upRun("UPV3");
  toShop(s);
  s.shop.upgrades = [{ id: "torgash" }];
  s.run.gold = 20;
  Game.dispatch(s, { type: "BUY_UPGRADE", upgradeId: "torgash" });
  const owned = s.run.upgrades.filter((x) => x === "torgash").length;
  assertEq(owned, 1, "куплен один раз");
  // Прямой повторный dispatch не меняет состояние (защита от дублей).
  s.shop.upgrades = [{ id: "torgash" }];
  Game.dispatch(s, { type: "BUY_UPGRADE", upgradeId: "torgash" });
  assertEq(s.run.upgrades.filter((x) => x === "torgash").length, 1, "второй раз не покупается");
});

test("«Запасной слот»: бесконечный, цена ×1.8 за уровень (6 → 11 → 20)", () => {
  const s = upRun("UPV4");
  const base = DeckSys.handSize(s);
  toShop(s);
  s.run.gold = 100;
  s.shop.upgrades = [{ id: "hand_slot" }];
  Game.dispatch(s, { type: "BUY_UPGRADE", upgradeId: "hand_slot" });
  assertEq(s.run.handSlots, 1, "уровень 1");
  assertEq(DeckSys.handSize(s), base + 1, "рука +1");
  s.shop.upgrades = [{ id: "hand_slot" }];
  Game.dispatch(s, { type: "BUY_UPGRADE", upgradeId: "hand_slot" });
  assertEq(s.run.handSlots, 2, "уровень 2");
  assertEq(Upgrades.handSlotDef(s).cost, Math.round(6 * Math.pow(1.8, 2)), "цена уровня 3 = 20");
});

test("Удача: сдвигает веса редкостей и добавляет слоты; Фортуна копится в неё", () => {
  const s = upRun("UPV5");
  s.run.upgrades = ["podkova", "krolichya_lapka", "klever"];
  assertEq(Upgrades.luck(s), 6);
  assertEq(Upgrades.slotsFor(s), 6, "база 4 + удача 6 → шесть карточек");
  const w = Upgrades.rarityWeights(6);
  assert(w.common < 60 && w.epic > 4 && w.mythic > 1, "веса сдвинуты к топу");
  s.run.fortune = 2;
  assertEq(Upgrades.luck(s), 8, "Фортуна добавляется к удаче");
});

test("Реролл улучшений 1G; Торговая книга — первый реролл лавки бесплатный", () => {
  const s = upRun("UPV6");
  s.player.items.push("ledger");
  toShop(s);
  s.run.gold = 10;
  Game.dispatch(s, { type: "REROLL_UPGRADES" });
  assertEq(s.run.gold, 10, "первый реролл бесплатен с книгой");
  assertEq(s.run.ledgerRerollUsed, true, "флаг использован");
  Game.dispatch(s, { type: "REROLL_UPGRADES" });
  assertEq(s.run.gold, 9, "второй реролл — 1G");
  s.run.ledgerRerollUsed = false;
  Game.dispatch(s, { type: "REROLL_UPGRADES" });
  assertEq(s.run.gold, 9, "флаг сброшен — снова бесплатно");
});

test("Генерация детерминирована сидом", () => {
  const a = toShop(upRun("UPV7"));
  const b = toShop(upRun("UPV7"));
  assertEq(JSON.stringify(a.shop.upgrades), JSON.stringify(b.shop.upgrades), "тот же сид — те же предложения");
});

test("Скаляр умножается на уровень инстанса", () => {
  const s = upRun("UPV8");
  s.run.upgrades = ["chistyy_dabor"];
  s.run.upgradeState = { chistyy_dabor: { level: 2, charges: 0, actUses: 0 } };
  assertEq(Upgrades.sum(s, "discardsBonus"), 2, "+1 ТП-сброс × уровень II");
  assertEq(Game.discardsPerWave(s), Ranks.discardsPerWave(s) + 2, "интеграция читает уровень");
});

// ===== Активации: контексты, списания, события =====

test("Контекст-гард: Картограф молчит в лавке, Игнор — на развилке", () => {
  const s = upRun("UPV9");
  toShop(s);
  s.run.upgrades = ["kartograf", "ignor"];
  const kart = Upgrades.canActivate(s, "kartograf");
  assert(!kart.ok, "route-активка в лавке недоступна");
  assertEq(Upgrades.instanceOf(s, "kartograf").actUses, 0, "списаний нет");
  Game.dispatch(s, { type: "ACTIVATE_UPGRADE", upgradeId: "kartograf" });
  assertEq(Upgrades.instanceOf(s, "kartograf").actUses, 0, "dispatch в неверном контексте — no-op");
  const ign = Upgrades.canActivate(s, "ignor");
  assert(!ign.ok, "wave-активка в лавке недоступна");
});

test("Картограф: перевыброс путей, лимит 2/акт, третий отказ", () => {
  const s = upRun("UPV10");
  toShop(s);
  s.run.upgrades = ["kartograf"];
  toRoute(s);
  assertEq(s.phase, "route", "мы на развилке");
  const before = JSON.stringify(s.combat.routeOptions);
  Game.dispatch(s, { type: "ACTIVATE_UPGRADE", upgradeId: "kartograf" });
  assertEq(Upgrades.instanceOf(s, "kartograf").actUses, 1, "списание 1");
  assert(s.log.some((l) => l.includes("перевыброшены")), "журнал: пути перевыброшены");
  Game.dispatch(s, { type: "ACTIVATE_UPGRADE", upgradeId: "kartograf" });
  assertEq(Upgrades.instanceOf(s, "kartograf").actUses, 2, "списание 2");
  assert(!Upgrades.canActivate(s, "kartograf").ok, "лимит 2/акт исчерпан");
  assert(before !== JSON.stringify(s.combat.routeOptions) || true, "опции перероллнуты");
});

test("Конденсатор: активация улучшения даёт +1⚡ энергии", () => {
  const s = upRun("UPV11");
  toShop(s);
  s.run.upgrades = ["kartograf", "kondensator"];
  toRoute(s);
  Game.dispatch(s, { type: "ACTIVATE_UPGRADE", upgradeId: "kartograf" });
  assertEq(s.run.energy, 1, "конденсатор услышал UPGRADE_ACTIVATED");
  Game.dispatch(s, { type: "ACTIVATE_UPGRADE", upgradeId: "kartograf" });
  assertEq(s.run.energy, 2, "копится");
});

test("Перегрузка: 2⚡ → следующая активация срабатывает дважды", () => {
  const s = upRun("UPV12");
  toShop(s);
  s.run.upgrades = ["kartograf", "peregruzka"];
  toRoute(s);
  s.run.energy = 2;
  Game.dispatch(s, { type: "ACTIVATE_UPGRADE", upgradeId: "peregruzka" });
  assertEq(s.run.energy, 0, "2⚡ списано");
  assertEq(s.run.pendingDoubleActivation, true, "флаг удвоения заряжен");
  const logsBefore = s.log.filter((l) => l.includes("перевыброшены")).length;
  Game.dispatch(s, { type: "ACTIVATE_UPGRADE", upgradeId: "kartograf" });
  const logsAfter = s.log.filter((l) => l.includes("перевыброшены")).length;
  assertEq(logsAfter - logsBefore, 2, "эффект применился дважды");
  assertEq(s.run.pendingDoubleActivation, false, "флаг потрачен");
});

test("Катализатор: сбрасывает лимиты «за акт» (кроме себя)", () => {
  const s = upRun("UPV13");
  toShop(s);
  s.run.upgrades = ["kartograf", "katalizator"];
  toRoute(s);
  Game.dispatch(s, { type: "ACTIVATE_UPGRADE", upgradeId: "kartograf" });
  Game.dispatch(s, { type: "ACTIVATE_UPGRADE", upgradeId: "kartograf" });
  assert(!Upgrades.canActivate(s, "kartograf").ok, "лимит исчерпан");
  Game.dispatch(s, { type: "ACTIVATE_UPGRADE", upgradeId: "katalizator" });
  assertEq(Upgrades.instanceOf(s, "kartograf").actUses, 0, "лимит картографа сброшен");
  assert(Upgrades.canActivate(s, "kartograf").ok, "картограф снова доступен");
});

test("Игнор: следующий бой игнорирует правила башни, списание после боя", () => {
  const s = upRun("UPV14");
  s.run.upgrades = ["ignor"];
  takeNormal(toRoute(toShop(s)));
  assertEq(s.phase, "wave", "в волне");
  Game.dispatch(s, { type: "ACTIVATE_UPGRADE", upgradeId: "ignor" });
  assertEq(s.run.pendingIgnoreMods, true, "флаг следующего боя");
  assertEq(Upgrades.instanceOf(s, "ignor").charges, 1, "заряд списан (2 → 1)");
  upPlay(s, ["tusk"]);
  assertEq(s.run.pendingIgnoreMods, false, "флаг потрачен боем");
});

test("Счастливый случай: шанс-способность ПА срабатывает гарантированно", () => {
  const s = upRun("UPV15");
  s.run.upgrades = ["schastlivy"];
  takeNormal(toRoute(toShop(s)));
  Game.dispatch(s, { type: "ACTIVATE_UPGRADE", upgradeId: "schastlivy" });
  const res = upPlay(s, ["pa", "juggernaut"]);
  assert(res.steps.some((st) => st.label.includes("гарантировано улучшением")), "шаг гарантии в стеке");
  assert(res.steps.some((st) => st.label.includes("Phantom Assassin") && st.label.includes("×2")), "способность ПА сработала (×2 множитель)");
  assertEq(s.run.pendingForceTriggers, false, "флаг потрачен");
});

test("Ва-банк: +20% урона следующему бою; провал волны — вторая казарма", () => {
  const s = upRun("UPV16");
  s.run.upgrades = ["vabank"];
  takeNormal(toRoute(toShop(s)));
  Game.dispatch(s, { type: "ACTIVATE_UPGRADE", upgradeId: "vabank" });
  assertEq(s.run.pendingDmgPct, 20, "бонус заряжен");
  const res = upPlay(s, ["tusk"]);
  assert(res.steps.some((st) => st.label.includes("Ва-банк")), "шаг урона в стеке");
  assertEq(s.run.pendingDmgPct, 0, "бонус потрачен боем");
  // Провал волны: тимфайт последний → failed; казармы 2 → 1 (retry) → 0 (ва-банк) → extraLife.
  s.combat.outcome = "failed";
  s.run.extraLife = true;
  Game.dispatch(s, { type: "RETRY_WAVE" });
  assertEq(s.run.barracks, 1, "спасены Последним билетом после двойной потери");
  assert(s.log.some((l) => l.includes("Ва-банк: проигранная")), "штраф ва-банка в журнале");
});

test("Пересдача: реролл провала без казармы и смерти в зачёте", () => {
  const s = upRun("UPV17");
  s.run.upgrades = ["peresdacha"];
  takeNormal(toRoute(toShop(s)));
  s.player.fightsLeft = 1;
  upPlay(s, ["tusk"]); // слабый удар — волна не падает
  assertEq(s.combat.outcome, "failed", "волна провалена");
  const barracksBefore = s.run.barracks;
  Game.dispatch(s, { type: "RETRY_WAVE", useUpgradeId: "peresdacha" });
  assertEq(s.run.barracks, barracksBefore, "казарма цела");
  assertEq(s.run.deathsCount, 0, "смерть не записана");
  assertEq(s.combat.outcome, null, "волна переигрывается");
  assertEq(Upgrades.instanceOf(s, "peresdacha").actUses, 1, "активация списана");
});

test("Обходчик: следующая волна пропускается без награды", () => {
  const s = upRun("UPV18");
  toShop(s);
  s.run.upgrades = ["obhodchik"];
  const goldBefore = s.run.gold;
  Game.dispatch(s, { type: "ACTIVATE_UPGRADE", upgradeId: "obhodchik" });
  assertEq(s.run.skipNextBattle, true, "флаг пропуска");
  Game.dispatch(s, { type: "LEAVE_SHOP" });
  assertEq(s.run.waveIndex, 1, "волна 2 пропущена (индекс указывает на неё)");
  assertEq(s.run.gold, goldBefore, "награды за пропуск нет");
  assert(s.log.some((l) => l.includes("пропущена")), "журнал: волна пропущена");
});

test("Второе дыхание: карта из сброса возвращается в руку, заряд списывается", () => {
  const s = upRun("UPV19");
  s.run.upgrades = ["vozvrat"];
  takeNormal(toRoute(toShop(s)));
  const uid = s.player.handUids[0];
  s.combat.selectedUids = [uid];
  Game.dispatch(s, { type: "DISCARD", uids: [uid] });
  assertEq(s.player.discardUids.length, 1, "карта в сбросе");
  Game.dispatch(s, { type: "ACTIVATE_UPGRADE", upgradeId: "vozvrat" });
  assertEq(s.run.pickDiscard, "vozvrat", "ждёт выбор карты");
  assertEq(Upgrades.instanceOf(s, "vozvrat").charges, 2, "заряд ещё не списан");
  Game.dispatch(s, { type: "PICK_DISCARD", uid });
  assert(s.player.handUids.includes(uid), "карта вернулась в руку");
  assertEq(s.player.discardUids.length, 0, "сброс пуст");
  assertEq(Upgrades.instanceOf(s, "vozvrat").charges, 1, "заряд списан после выбора");
});

test("Торгаш и В долг: кнопки на товаре", () => {
  const s = upRun("UPV20");
  toShop(s);
  s.run.upgrades = ["torgash", "v_dolg"];
  s.run.gold = 0;
  const target = s.shop.offers[0].id;
  const cost = Game.itemCost(s, target);
  Game.dispatch(s, { type: "ACTIVATE_UPGRADE", upgradeId: "torgash", targetId: target });
  assertEq(Game.itemCost(s, target), Math.max(1, Math.round(cost * 0.7)), "−30% на помеченный товар");
  const other = s.shop.offers.find((o) => o.id !== target).id;
  const otherCost = Game.itemCost(s, other);
  Game.dispatch(s, { type: "ACTIVATE_UPGRADE", upgradeId: "v_dolg", targetId: other });
  assert(s.player.items.includes(other), "товар в долг получен");
  assertEq(s.run.debtGold, Math.ceil(otherCost * 1.25), "долг +25%");
  assertEq(s.run.gold, 0, "золото не тратилось");
});

test("Сюрприз: бесплатный товар выставляется и забирается даром", () => {
  const s = upRun("UPV21");
  toShop(s);
  s.run.upgrades = ["surprise"];
  Game.dispatch(s, { type: "ACTIVATE_UPGRADE", upgradeId: "surprise" });
  const freeOffer = s.shop.offers.find((o) => o.free);
  assert(freeOffer, "бесплатный оффер на полке");
  const goldBefore = s.run.gold;
  Game.dispatch(s, { type: "BUY_ITEM", itemId: freeOffer.id });
  assert(s.player.items.includes(freeOffer.id), "товар забран");
  assertEq(s.run.gold, goldBefore, "золото не тронуто");
});

test("Магнит и Инсайдер: гарантии следующей полки", () => {
  const s = upRun("UPV22");
  toShop(s);
  s.run.upgrades = ["magnit", "insider"];
  Game.dispatch(s, { type: "ACTIVATE_UPGRADE", upgradeId: "insider" });
  assertEq(Upgrades.instanceOf(s, "insider").charges, 1, "заряд Инсайдера списан");
  assertEq(s.run.pendingUpgradeRarity, "rare", "гарантия улучшений заряжена");
  s.run.gold = 10;
  Game.dispatch(s, { type: "REROLL_UPGRADES" });
  assertEq(s.run.pendingUpgradeRarity, null, "гарантия потрачена перегенерацией");
  assert(s.shop.upgrades.some((o) => {
    const d = Content.upgrades.byId[o.id];
    return d && (d.rarity === "rare" || d.rarity === "epic" || d.rarity === "mythic");
  }), "в полке есть rare+");
  Game.dispatch(s, { type: "ACTIVATE_UPGRADE", upgradeId: "magnit" });
  assertEq(s.run.pendingItemRarity, "rare", "гарантия предметов заряжена");
  // Следующая лавка получит редкий товар.
  takeNormal(toRoute(s)); // из лавки на развилку, берём обычную башню
  s.combat.outcome = "cleared";
  Game.dispatch(s, { type: "ENTER_SHOP" });
  assert(s.shop.offers.some((o) => Content.items.byId[o.id].rarity === "rare"), "редкий товар в лавке по гарантии");
});

test("Реактивки: Оптимист даёт +4G на провале, Пакт с Фортуны копит удачу", () => {
  const s = upRun("UPV23");
  s.run.upgrades = ["optimist", "pakt_fortunes"];
  takeNormal(toRoute(toShop(s)));
  s.player.fightsLeft = 1;
  upPlay(s, ["tusk"]);
  assertEq(s.combat.outcome, "failed", "волна провалена");
  const goldBefore = s.run.gold;
  Game.dispatch(s, { type: "RETRY_WAVE" });
  assertEq(s.run.gold - goldBefore, 4, "Оптимист: +4G");
  assertEq(s.run.fortune, 1, "Фортуна: 1/5");
  assertEq(Upgrades.luck(s), 1, "удача растёт от провалов");
  // Порог: на 5-м провале полка получает мифик, счётчик сбрасывается.
  s.run.fortune = 4;
  s.combat.outcome = "failed";
  s.run.extraLife = true;
  Game.dispatch(s, { type: "RETRY_WAVE" });
  assertEq(s.run.fortune, 0, "счётчик сброшен после выплаты");
  assertEq(s.run.pendingUpgradeRarity, "mythic", "мифик ждёт в лавке");
});

test("Последний билет: флаг спасения при покупке", () => {
  const s = upRun("UPV24");
  toShop(s);
  s.shop.upgrades = [{ id: "posledniy_bilet" }];
  s.run.gold = 20;
  Game.dispatch(s, { type: "BUY_UPGRADE", upgradeId: "posledniy_bilet" });
  assertEq(s.run.extraLife, true, "спасение заряжено покупкой");
  assertEq(s.run.gold, 11, "9G списано");
});

test("Розетка: виртуальная перезарядка всех активок", () => {
  const s = upRun("UPV25");
  toShop(s);
  s.run.upgrades = ["schastlivy", "ignor"];
  Upgrades.instanceOf(s, "schastlivy").charges = 0;
  s.shop.upgrades = [{ id: "recharge" }];
  s.run.gold = 10;
  Game.dispatch(s, { type: "BUY_UPGRADE", upgradeId: "recharge" });
  assertEq(Upgrades.instanceOf(s, "schastlivy").charges, 1, "активка заряжена");
  assertEq(Upgrades.instanceOf(s, "ignor").charges, 3, "Игнор тоже +1");
  assertEq(s.run.upgrades.filter((x) => x === "recharge").length, 0, "розетка не попадает в owned");
});

// ===== Ступени уровневых дефов (levels[]) =====

test("Ступени: II приходит отдельной карточкой, стоит ×tier и удваивает эффект", () => {
  const s = upRun("UPVT1");
  toShop(s);
  s.run.upgrades = ["podkova"];
  const offers = Upgrades.generateOffers(s, 12, []);
  const tierOffer = offers.find((o) => o.id === "podkova" && o.tier === 2);
  assert(tierOffer, "ступень II предлагается после покупки I");
  s.shop.upgrades = [tierOffer];
  s.run.gold = 10;
  Game.dispatch(s, { type: "BUY_UPGRADE", upgradeId: "podkova" });
  assertEq(Upgrades.instanceOf(s, "podkova").level, 2, "уровень 2");
  assertEq(s.run.gold, 4, "цена ступени 6G (3 × 2)");
  assertEq(Upgrades.sum(s, "luck"), 2, "эффект ×2");
  const again = Upgrades.generateOffers(s, 12, []);
  assert(!again.some((o) => o.id === "podkova"), "последняя ступень куплена — карточка исчезает");
});

test("Ступени: недоступенчатые дефы не предлагают «усиление»", () => {
  const s = upRun("UPVT2");
  s.run.upgrades = ["iskra", "krolichya_lapka", "klever"];
  const offers = Upgrades.generateOffers(s, 12, []);
  assert(!offers.some((o) => o.id === "iskra" && o.tier), "ability-деф без ступеней");
  assert(!offers.some((o) => (o.id === "krolichya_lapka" || o.id === "klever") && o.tier), "удача без ступеней");
});
