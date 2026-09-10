// Фаза A — фидбек крита (спек §2): шанс-эффекты (ПА, Daedalus, Bloodthorn)
// должны оставлять явный след: resolution.crits + строка «КРИТ!» в журнале.
suite("Фаза A — подтверждение крита");

function vaRun(seed) {
  return Game.dispatch(Game.createInitialState(""), { type: "START_RUN", seedCode: seed || "VA1" });
}

test("Крит ПА попадает в resolution.crits и подтверждается в журнале", () => {
  let found = null;
  for (let i = 0; i < 40 && !found; i++) {
    const s = vaRun("VACRIT" + i);
    // ПА (9) + Dawnbreaker (9) = пара, иначе COMBO_MIN pair не пустит крит.
    const uids = ["pa", "dawnbreaker"].map((h) => Object.values(s.cards).find((c) => c.heroId === h).uid);
    s.player.handUids = [...uids, ...Object.keys(s.cards).filter((u) => !uids.includes(u))];
    s.combat.selectedUids = uids.slice();
    Game.dispatch(s, { type: "CONFIRM_FIGHT" });
    const res = s.combat.lastResolution;
    if ((res.crits || []).length) found = { s, res };
  }
  assert(found, "за 40 боёв парой ПА ни разу не кританул (p ≈ 1e-12)");
  assert(found.res.crits.includes("Phantom Assassin"), "в crits записано имя источника");
  assert(found.s.log.some((l) => l.indexOf("КРИТ!") !== -1), "журнал содержит строку «КРИТ!»");
});

test("ТП-сброс убирает героев из слотов боя (фидбек)", () => {
  const s = vaRun("VADISC");
  const uids = s.player.handUids.slice(0, 2);
  for (const uid of uids) Game.dispatch(s, { type: "SELECT_CARD", uid });
  assertEq(s.combat.selectedUids.length, 2, "двое выбраны");
  Game.dispatch(s, { type: "DISCARD", uids: s.combat.selectedUids.slice() });
  assertEq(s.combat.selectedUids.length, 0, "слоты боя пусты после сброса");
  assertEq(s.player.discardsLeft, 2, "сброс потрачен");
});
