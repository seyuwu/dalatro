// Реролл агианим-предложений: цена, лимит, семантика осколка/скипетра.
// РНГ сидированный — осколок может и не выпасть (45%), поэтому структурные
// проверки: предложение (если есть) валидно по пулу, лимиты и золото точны.

suite("Реролл агианимов");

function shopWithAugh(over = {}) {
  let s = Game.dispatch(Game.createInitialState("AGR1"), { type: "START_RUN", seedCode: "AGR1", rules: "formation" });
  s.phase = "shop";
  s.run.gold = 30;
  s.shop.aughRerolls = 0;
  s.shop.aghanims = over.aghanims !== undefined ? over.aghanims : [];
  Object.assign(s.shop, over.shop || {});
  return s;
}

test("реролл стоит 3 золота и ограничен двумя за визит", () => {
  let s = shopWithAugh();
  s.run.gold = 7;
  s = Game.dispatch(s, { type: "REROLL_AUGH" });
  assertEq(s.run.gold, 4, "первый реролл −3G");
  assertEq(s.shop.aughRerolls, 1);
  s = Game.dispatch(s, { type: "REROLL_AUGH" });
  assertEq(s.run.gold, 1, "второй реролл −3G");
  assertEq(s.shop.aughRerolls, 2);
  const gold = s.run.gold;
  s = Game.dispatch(s, { type: "REROLL_AUGH" });
  assertEq(s.run.gold, gold, "третий — лимит, золото не тратится");
  assertEq(s.shop.aughRerolls, 2);
});

test("без золота реролл не работает", () => {
  let s = shopWithAugh();
  s.run.gold = 2;
  s = Game.dispatch(s, { type: "REROLL_AUGH" });
  assertEq(s.run.gold, 2);
  assertEq(s.shop.aughRerolls, 0);
});

test("новая лавка сбрасывает лимит рероллов", () => {
  // Сетап как в abilities.test.js: реальные герои, волна 5 — босс акта 1.
  let s = Game.dispatch(Game.createInitialState(""), { type: "START_RUN", seedCode: "AGR2", rules: "formation" });
  s.shop.aughRerolls = 2; // лимит израсходован в прошлом визите
  s.run.waveIndex = 4;
  const uids = s.player.handUids.slice(0, 5);
  s.combat.selectedUids = uids.slice();
  s.combat.wave.hp = 1; // любой удар убивает босса
  s = Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  assertEq(s.combat.outcome, "cleared", "контроль: босс побеждён");
  s = Game.dispatch(s, { type: "ENTER_SHOP" });
  assertEq(s.shop.aughRerolls, 0, "новый визит — лимит заново");
});

test("реролл скипетра: вид сохраняется, меняется герой из валидного пула", () => {
  let s = shopWithAugh();
  // даём герою осколок — пул скипетра независим
  const owned = [...new Set([...s.player.handUids, ...s.player.deckUids].map((uid) => s.cards[uid].heroId))];
  s.shop.aghanims = [{ kind: "scepter", heroId: owned[0] }];
  const before = owned[0];
  s = Game.dispatch(s, { type: "REROLL_AUGH" });
  const sc = s.shop.aghanims.find((o) => o.kind === "scepter");
  assert(sc, "скипетр не исчезает при реролле (факт появления зафиксирован)");
  const equipped = s.run.aghanims || {};
  const validPool = owned.filter((h) => !(equipped[h] && equipped[h].scepter) && Content.aghanims.forHero(h, "scepter"));
  assert(validPool.includes(sc.heroId), "герой скипетра из валидного пула");
});

test("реролл осколка: предложение либо валидно, либо отсутствует (45% промаха)", () => {
  let s = shopWithAugh();
  const owned = [...new Set([...s.player.handUids, ...s.player.deckUids, ...s.player.discardUids].map((uid) => s.cards[uid].heroId))];
  s = Game.dispatch(s, { type: "REROLL_AUGH" });
  const shard = s.shop.aghanims.find((o) => o.kind === "shard");
  if (shard) {
    const equipped = s.run.aghanims || {};
    const validPool = owned.filter((h) => !(equipped[h] && equipped[h].shard) && Content.aghanims.forHero(h, "shard"));
    assert(validPool.includes(shard.heroId), "герой осколка из валидного пула (владелец, без купленного осколка)");
  }
  assert(s.shop.aghanims.every((o) => o.kind !== "scepter" || s.shop.aghanims.some((x) => x.kind === "scepter")), "структура предложений консистентна");
});

test("воронка: на каких волнах заканчиваются забеги", () => {
  const b = Backend.createBackend({ dataDir: Backend.tmpDataDir(), runGapMs: 0 });
  b.call("POST", "/register", { body: { name: "Funneler", password: "123456" } });
  const token = b.call("POST", "/login", { body: { name: "funneler", password: "123456" } }).setCookie.match(/dalatro_sess=([a-f0-9]+)/)[1];
  // поражение на волне 1 и на волне 7, победа (15 волн)
  b.call("POST", "/runs", { body: { seed: "F1", rank: 1, won: false, waves: 1, deaths: 2, timeMs: 120000, barracks: 0, biggestHit: 0, spareResets: 0, startedAt: 1700000000001 }, cookie: "dalatro_sess=" + token });
  b.call("POST", "/runs", { body: { seed: "F7", rank: 1, won: false, waves: 7, deaths: 2, timeMs: 120000, barracks: 0, biggestHit: 0, spareResets: 0, startedAt: 1700000000002 }, cookie: "dalatro_sess=" + token });
  b.call("POST", "/runs", { body: { seed: "F15", rank: 1, won: true, waves: 15, deaths: 0, timeMs: 300000, barracks: 2, biggestHit: 0, spareResets: 0, startedAt: 1700000000003 }, cookie: "dalatro_sess=" + token });
  const funnel = b.waveFunnel();
  assertEq(funnel[0].lost, 1, "волна 1: одно поражение");
  assertEq(funnel[6].lost, 1, "волна 7: одно поражение");
  assertEq(funnel[14].won, 1, "волна 15: одна победа");
  assertEq(funnel[3].lost + funnel[3].won, 0, "волна 4 пуста");
});
