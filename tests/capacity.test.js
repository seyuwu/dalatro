// Фаза C — лимит предметов (спек §6.2): 6 слотов всего всегда, класс-лимиты
// 2/2/2 только с Титана (мод capClass). Покупка сверх лимита невозможна.
suite("Фаза C — лимит предметов");

function capRun(seed, rank) {
  return Game.dispatch(Game.createInitialState(""), { type: "START_RUN", seedCode: seed, rank: rank || 1 });
}
function capBuy(s, itemId) {
  s.phase = "shop"; // BUY_ITEM работает только в лавке
  if (!s.shop.offers.some((o) => o.id === itemId)) s.shop.offers.push({ id: itemId, locked: false });
  s.run.gold = 100;
  Game.dispatch(s, { type: "BUY_ITEM", itemId });
}

test("На низком ранге: 6 слотов всего, без класс-лимитов", () => {
  const s = capRun("CAP1", 1);
  const cap = Game.itemCapacity(s);
  assertEq(cap.total, 6);
  assertEq(cap.perClass, null, "до Титана классы не лимитированы");
  for (const id of ["kaya", "daedalus", "bloodthorn", "rapier", "bkb", "midas"]) capBuy(s, id);
  assertEq(s.player.items.length, 6, "6 предметов влезло — весь урон и весь BKB");
  assert(Game.itemBlockedReason(s, "desolator") === "full", "7-й предмет не пролезает");
  capBuy(s, "desolator");
  assertEq(s.player.items.length, 6, "покупка сверх капа молча отклонена");
});

test("С Титана: класс-лимиты 2/2/2 режут чисто-уронный билд", () => {
  const s = capRun("CAP2", 7);
  for (const id of ["kaya", "daedalus", "bkb", "sentry", "midas", "vladmir"]) capBuy(s, id);
  assertEq(s.player.items.length, 6, "по 2 на класс — ровно 6");
  // Бакет полон — это причина №1, класс проверяется только при свободном тотале.
  assert(Game.itemBlockedReason(s, "bloodthorn") === "full", "7-й предмет не влезает");
  // Освободили слот защиты — атака всё ещё закрыта классом, защита открыта.
  Game.dispatch(s, { type: "SELL_ITEM", itemId: "bkb" });
  assert(Game.itemBlockedReason(s, "bloodthorn") === "class", "атака закрыта классом независимо от свободного def-слота");
  assert(Game.itemBlockedReason(s, "butterfly") === null, "защита снова открыта");
  capBuy(s, "butterfly");
  assertEq(s.player.items.filter((id) => Content.items.byId[id].slotClass === "def").length, 2, "def снова 2/2");
});

test("Продажа освобождает слот и класс", () => {
  const s = capRun("CAP3", 7);
  capBuy(s, "kaya");
  capBuy(s, "daedalus");
  assert(Game.itemBlockedReason(s, "rapier") === "class", "off переполнен (2/2)");
  Game.dispatch(s, { type: "SELL_ITEM", itemId: "kaya" });
  assert(Game.itemBlockedReason(s, "rapier") === null, "после продажи класс открыт");
});

test("У каждого предмета проставлен slotClass", () => {
  for (const item of Content.items.list) {
    assert(["off", "def", "util"].includes(item.slotClass), item.id + " без slotClass");
  }
});
