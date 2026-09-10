// Фаза B — стартовые архетипы (спек §7): трио гарантировано, состав колоды
// варьируется от сида, перки микроскопические и детерминированные.
suite("Фаза B — стартовые архетипы");

function archRun(seed, starterId, rules) {
  return Game.dispatch(Game.createInitialState(""), { type: "START_RUN", seedCode: seed, rules, starterId });
}
function archDeck(s) {
  return [...s.player.handUids, ...s.player.deckUids, ...s.player.discardUids].map((uid) => s.cards[uid].heroId);
}

test("Архетип гарантирует своё трио и держит размер колоды 12", () => {
  const s = archRun("ARCH1", "assault");
  const deck = archDeck(s);
  assertEq(deck.length, 12, "колода стартового архетипа = 12 карт");
  for (const h of ["juggernaut", "axe", "centaur"]) {
    assert(deck.includes(h), "в колоде гарантированный " + h);
  }
});

test("«Стандарт» (дефолт) не ломает старые сиды: колода = прежняя двенадцатка", () => {
  const s = archRun("STD1", "standard");
  const deck = archDeck(s).slice().sort();
  const base = Content.heroes.startingIds.slice().sort();
  assertEq(JSON.stringify(deck), JSON.stringify(base), "колода стандарта == startingIds");
  assertEq(s.run.archetype, "standard");
  assertEq(s.run.gold, 4, "перка нет — 4G на старте");
  const omitted = Game.dispatch(Game.createInitialState(""), { type: "START_RUN", seedCode: "STD1" });
  assertEq(archDeck(omitted).length, 12, "START_RUN без starterId тоже работает");
});

test("Состав колоды детерминирован сидом и варьируется между сидами", () => {
  const a1 = archDeck(archRun("VAR1", "crit")).sort().join(",");
  const a2 = archDeck(archRun("VAR1", "crit")).sort().join(",");
  assertEq(a1, a2, "тот же сид + тот же архетип = та же колода");
  const seen = new Set();
  const union = new Set();
  for (let i = 0; i < 8; i++) {
    const deck = archDeck(archRun("VAR" + (10 + i), "crit"));
    seen.add(deck.slice().sort().join(","));
    for (const h of deck) union.add(h);
  }
  assert(seen.size >= 2, "разные сиды дают разный состав (получено " + seen.size + " вариантов)");
  // Регрессия на жалобу «кроме трёх базовых все не случайные»: узкий пул
  // (10 кандидатов на 9 слотов) прокручивал только одного героя. Пул на 16
  // обязан за 8 сидов показать заметно больше половины своих кандидатов.
  assert(union.size >= 14, "добор реально вращается: " + union.size + " разных героев на 8 сидов");
});

test("Перк «Штурм» (gold1): +1G на старте", () => {
  assertEq(archRun("AG1", "assault").run.gold, 5, "5G вместо 4G");
});

test("Перк «Контроль» (tp1): +1 ТП-сброс в акте 1, в акте 2 — база", () => {
  const s = archRun("TP1", "control");
  const base = Ranks.discardsPerWave(s);
  assertEq(s.player.discardsLeft, base + 1, "акт 1: +1 сброс");
  s.run.waveIndex = 5; // act 2
  s.run.act = 2;
  s.player.discardsLeft = Game.discardsPerWave(s);
  assertEq(s.player.discardsLeft, base, "акт 2: без перка");
});

test("Перк «Крит» (lasthit2): точный ласт-хит даёт +5+2 золота", () => {
  const s = archRun("LH10", "crit");
  // Детерминированная пара без шанс-эффектов: Падж(7)+Джаггернаут(7) = 24×2 = 48.
  const uids = ["pudge", "juggernaut"].map((h) => Object.values(s.cards).find((c) => c.heroId === h).uid);
  assert(uids.every(Boolean), "падж и джаггернаут в колоде отряда «Крит»");
  s.player.handUids = [...uids, ...Object.keys(s.cards).filter((u) => !uids.includes(u))];
  s.combat.selectedUids = uids.slice();
  s.combat.wave.hp = 48;
  s.combat.wave.maxHp = Math.max(s.combat.wave.maxHp, 48);
  const goldBefore = s.run.gold;
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  assertEq(s.combat.lastResolution.damage, 48, "урон пары = 48, башня снята в ноль");
  assertEq(s.run.gold - goldBefore, 6 + 5 + 2 + 3, "зачистка 6G + ласт-хит 5G + перк 2G + бонус скорости 3G (3 тимфайта не потрачены)");
  assert(s.combat.lastResolution.steps.some((st) => st.label.includes("Отряд «Крит»")), "шаг перка виден в стеке");
});

test("Перк «Магия» (freeroll1): первый реролл лавки бесплатен, второй — за золото", () => {
  const s = archRun("FR1", "arcane");
  s.combat.outcome = "cleared";
  Game.dispatch(s, { type: "ENTER_SHOP" });
  s.run.gold = 0;
  Game.dispatch(s, { type: "REROLL_SHOP" });
  assertEq(s.run.gold, 0, "первый реролл не списывает золото");
  assert(s.run.freeRerollUsed, "флаг бесплатного реролла потрачен");
  const offers1 = JSON.stringify(s.shop.offers.map((o) => o.id).sort());
  Game.dispatch(s, { type: "REROLL_SHOP" });
  assertEq(JSON.stringify(s.shop.offers.map((o) => o.id).sort()), offers1, "без золота второй реролл не проходит");
  // Новая лавка — флаг сбрасывается (ENTER_SHOP требует волну с зачисткой).
  s.run.gold = 10;
  s.phase = "wave";
  s.combat.outcome = "cleared";
  Game.dispatch(s, { type: "ENTER_SHOP" });
  assert(!s.run.freeRerollUsed, "в новой лавке бесплатный реролл снова доступен");
});

test("Название отряда попадает в журнал старта", () => {
  const s = archRun("LOG1", "arcane");
  assert(s.log.some((l) => l.includes("отряд «Магия»")), "журнал называет архетип");
});
