// Слоты боя: снятие героя — контракт движка. UI-клик по слоту выполняет тот
// же SELECT_CARD-toggl (splice из selectedUids), поэтому тестируем семантику:
// герой уходит, остальные сохраняют относительный порядок и подтягиваются.

suite("Слоты боя: снятие героя");

test("снятие из середины: герой в руку, остальные подтягиваются в исходном порядке", () => {
  let s = Game.dispatch(Game.createInitialState("SLT1"), { type: "START_RUN", seedCode: "SLT1", rules: "formation" });
  const hand = s.player.handUids.slice(0, 3);
  for (const uid of hand) s = Game.dispatch(s, { type: "SELECT_CARD", uid });
  assertEq(s.combat.selectedUids.length, 3, "трое в слотах");
  // снять среднего — остальные остаются в том же относительном порядке
  const middle = s.combat.selectedUids[1];
  s = Game.dispatch(s, { type: "SELECT_CARD", uid: middle });
  assertEq(s.combat.selectedUids.join(","), [hand[0], hand[2]].join(","), "первый и третий на местах, сдвиг влево после снятого");
  assert(s.player.handUids.includes(middle), "снятый вернулся в руку");
  // вернуть обратно — порядок восстановим новым кликом
  s = Game.dispatch(s, { type: "SELECT_CARD", uid: middle });
  assertEq(s.combat.selectedUids.join(","), [hand[0], hand[2], middle].join(","), "возврат встаёт в конец (игрок может передвинуть перетаскиванием)");
});

test("снятие не задевает счётчик перестановок (movesUsed кормит аугменты)", () => {
  let s = Game.dispatch(Game.createInitialState("SLT2"), { type: "START_RUN", seedCode: "SLT2", rules: "formation" });
  const hand = s.player.handUids.slice(0, 2);
  for (const uid of hand) s = Game.dispatch(s, { type: "SELECT_CARD", uid });
  const before = s.combat.movesUsed || 0;
  s = Game.dispatch(s, { type: "SELECT_CARD", uid: hand[0] });
  assertEq(s.combat.movesUsed || 0, before, "снятие — не перестановка");
});
