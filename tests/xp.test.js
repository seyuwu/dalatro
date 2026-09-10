// Фаза G — XP героев (спек §7.2): бой +1, добивший +2; уровень = +1 сила (кап +3).
suite("Фаза G — XP героев");

function xpRun(seed) {
  return Game.dispatch(Game.createInitialState(""), { type: "START_RUN", seedCode: seed || "XP1" });
}
function xpPlay(s, heroIds, hpOverride) {
  const uids = heroIds.map((h) => Object.values(s.cards).find((c) => c.heroId === h).uid);
  s.player.handUids = [...uids, ...Object.keys(s.cards).filter((u) => !uids.includes(u))];
  s.combat.selectedUids = uids.slice();
  s.player.fightsLeft = Math.max(1, s.player.fightsLeft);
  if (hpOverride != null) s.combat.wave.hp = hpOverride;
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  return s.combat.lastResolution;
}

test("Бой даёт +1 XP, добивающий бой +2", () => {
  const s = xpRun("XPG1");
  xpPlay(s, ["tusk"], 999999); // не убил
  assertEq((s.run.heroXp || {}).tusk, 1, "обычный бой +1");
  s.combat.outcome = null;
  s.player.fightsLeft = 4;
  xpPlay(s, ["tusk"], 1); // добил с 1 HP (ласт-хит туска 8 ≠ 1 → overkill 7 < 10% maxHp? maxHp 450 → да, близкая)
  assert((s.run.heroXp.tusk) >= 3, "добивающий +2 (итого ≥3): " + s.run.heroXp.tusk);
});

test("Уровень = +1 сила в rankOf, кап +3", () => {
  const s = xpRun("XPG2");
  const base = Game.rankOf(s, "tusk");
  s.run.heroXp = { tusk: 5 };
  assertEq(Game.heroLevel(s, "tusk"), 1);
  assertEq(Game.rankOf(s, "tusk"), base + 1, "уровень 1: +1 сила");
  s.run.heroXp = { tusk: 999 };
  assertEq(Game.heroLevel(s, "tusk"), 3, "кап уровня 3");
  assertEq(Game.rankOf(s, "tusk"), base + 3, "+3 силы максимум");
});

test("Повышение уровня пишется в журнал и стек боя", () => {
  const s = xpRun("XPG3");
  s.run.heroXp = { tusk: 4 }; // до уровня
  const res = xpPlay(s, ["tusk"], 999999);
  assert(res.steps.some((st) => st.icon === "🌱" && st.label.includes("уровень 1")), "шаг 🌱 в стеке");
  assert(s.log.some((l) => l.includes("tusk".length ? "Tusk" : "") && l.includes("уровень 1")), "журнал: уровень 1");
});

test("Тренировочный зал (#23): нанятый герой начинает с +3 опыта", () => {
  const s = xpRun("XPG4");
  s.combat.outcome = "cleared";
  Game.dispatch(s, { type: "ENTER_SHOP" });
  s.run.upgrades = ["trenzal"];
  s.shop.recruits = ["zeus"];
  s.run.gold = 50;
  Game.dispatch(s, { type: "BUY_RECRUIT", heroId: "zeus" });
  assertEq((s.run.heroXp || {}).zeus, 3, "стартовый опыт");
  assertEq(Game.heroLevel(s, "zeus"), 0, "уровень ещё 0 (3 < 5)");
});
