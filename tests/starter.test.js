// Тумблер «Оставить базовых героев» (starterDeckIds keepBase) + панель правил
// цели (Combat.comboRuleMults — зеркало шага 7 скоринга).
suite("Тумблер «Оставить базовых героев»");

function keepRun(seed, starterId, keepBase) {
  return Game.dispatch(Game.createInitialState(""), { type: "START_RUN", seedCode: seed, rules: "formation", starterId, keepBase });
}
function deckOf(s) {
  return [...s.player.handUids, ...s.player.deckUids, ...s.player.discardUids].map((uid) => s.cards[uid].heroId);
}
const roster = Content.heroes.list.map((h) => h.id);

test("keepBase=true (дефолт) сохраняет прежнее поведение: трио гарантировано", () => {
  for (const keep of [true, undefined]) {
    const deck = deckOf(keepRun("KEEP1", "assault", keep));
    assertEq(deck.length, 12, "колода 12");
    for (const h of ["juggernaut", "axe", "centaur"]) {
      assert(deck.includes(h), "трио на месте: " + h);
    }
  }
});

test("keepBase=false: все 12 случайны, без повторов, из ростера; сид детерминирован", () => {
  const a = deckOf(keepRun("RND1", "assault", false)).sort();
  const b = deckOf(keepRun("RND1", "assault", false)).sort();
  assertEq(JSON.stringify(a), JSON.stringify(b), "тот же сид = та же колода");
  assertEq(a.length, 12, "колода 12");
  assertEq(new Set(a).size, 12, "без дублей");
  for (const h of a) assert(roster.includes(h), "герой из ростера: " + h);
});

test("keepBase=false: гарантия трио снята — на серии сидов трио выпадает не всегда", () => {
  let fullTrio = 0;
  for (let i = 0; i < 10; i++) {
    const deck = deckOf(keepRun("NOBASE" + i, "assault", false));
    if (["juggernaut", "axe", "centaur"].every((h) => deck.includes(h))) fullTrio++;
  }
  assert(fullTrio < 10, "трио больше не гарантировано (полное трио на " + fullTrio + "/10 сидов)");
});

test("keepBase=false: случайность склонена в выбранный отряд, «Стандарт» — просто случайный", () => {
  // «Штурм»: уклон — доля героев из пула отряда (гарантия + fill) заметно выше
  // доли пула в ростере (19 из 44).
  let poolHits = 0;
  for (let i = 0; i < 12; i++) {
    const deck = deckOf(keepRun("BIAS" + i, "assault", false));
    poolHits += deck.filter((h) => Content.archetypes.byId.assault.guaranteed.includes(h)
      || Content.archetypes.byId.assault.fill.includes(h)).length;
  }
  const share = poolHits / (12 * 12);
  assert(share > 19 / 44, "уклон в отряд есть (доля пула " + Math.round(share * 100) + "%)");
  // «Стандарт» без гарантии — равномерный ролл: хоть один сид отличается от
  // классической двенадцатки.
  let differs = false;
  for (let i = 0; i < 10; i++) {
    const deck = deckOf(keepRun("STDRND" + i, "standard", false)).sort();
    if (JSON.stringify(deck) !== JSON.stringify(Content.heroes.startingIds.slice().sort())) differs = true;
  }
  assert(differs, "стандарт с выключенным тумблером тоже рандомится");
});

test("keepBase=false: перк архетипа остаётся (Штурм +1G, Контроль +1 сброс)", () => {
  assertEq(keepRun("PERK1", "assault", false).run.gold, 5, "+1G начального золота");
  const control = keepRun("PERK2", "control", false);
  assertEq(control.player.discardsLeft, Ranks.discardsPerWave(control) + 1, "+1 сброс в акте 1");
  assertEq(control.run.archetype, "control", "архетип записан");
});

suite("Панель правил цели (Combat.comboRuleMults)");

function waveRun(seed, rank, rules) {
  const s = Game.dispatch(Game.createInitialState(""), { type: "START_RUN", seedCode: seed, rules: rules || "classic", rank: rank || 1 });
  s.phase = "wave"; // панель читается только в фазе волны
  return s;
}

test("Фортификация режет малые комбинации и видна на панели", () => {
  const s = waveRun("BAST1");
  s.combat.wave.modifiers = [{ id: "bastion" }];
  const small = Combat.comboRuleMults(s, "high_card");
  assertEq(small.length, 1, "один бейдж");
  assertEq(small[0].name, "Фортификация");
  assertEq(small[0].value, 0.5);
  assertEq(Combat.comboRuleMults(s, "full_house").length, 0, "топ-комбо не задето");
  // BKB обезвреживает проклятие башни — бейдж исчезает.
  s.player.items.push("bkb");
  assertEq(Combat.comboRuleMults(s, "high_card").length, 0, "BKB снимает проклятие");
});

test("Классика и формации: порог «малого комбо» совпадает со скорингом", () => {
  const classic = waveRun("BAST2", 1, "classic");
  classic.combat.wave.modifiers = [{ id: "bastion" }];
  assertEq(Combat.comboRuleMults(classic, "two_pair").length, 1, "ранг ≤2 — бейдж");
  assertEq(Combat.comboRuleMults(classic, "three").length, 0, "ранг 3 — чисто");
  const form = waveRun("BAST3", 1, "formation");
  form.combat.wave.modifiers = [{ id: "bastion" }];
  assertEq(Combat.comboRuleMults(form, "squad").length, 1, "тир ≤1 — бейдж");
  assertEq(Combat.comboRuleMults(form, "triangle").length, 0, "тир 2 — чисто");
});

test("Память башен и Адаптация мира показываются на панели (не снимаются BKB)", () => {
  const s = waveRun("MEM1", 2); // Рыцарь: память башен
  s.combat.lastComboType = "pair";
  const mults = Combat.comboRuleMults(s, "pair");
  assertEq(mults.length, 1, "повтор типа удара — бейдж");
  assertEq(mults[0].name, "Память башен");
  assertEq(mults[0].value, 0.9);
  assertEq(Combat.comboRuleMults(s, "three").length, 0, "другое комбо чисто");

  const titan = waveRun("ADAPT1", 7); // Титан: адаптация мира
  titan.run.comboUses = { pair: 3, high_card: 1 };
  const hunted = Combat.comboRuleMults(titan, "pair");
  assertEq(hunted.length, 1, "изученное комбо — бейдж");
  assertEq(hunted[0].name, "Адаптация мира");
  assertEq(hunted[0].value, 0.85);
});

suite("UI: тумблер и красные бейджи в рендере");

test("Титул: тумблер «Оставить базовых героев» и подписи под режимами", () => {
  UI.render(Game.createInitialState("UITB"));
  const html = document.getElementById("app").innerHTML;
  assert(html.includes("Оставить базовых героев"), "тумблер на титуле");
  assert(html.includes("Базовые герои:"), "под каждым режимом — базовые герои");
  UI.UIState.keepBase = false;
  UI.render(Game.createInitialState("UITB"));
  const htmlOff = document.getElementById("app").innerHTML;
  assert(htmlOff.includes("Все 12 — случайные"), "выключенный тумблер честно предупреждает");
  UI.UIState.keepBase = true;
});

test("Волна с Фортификацией: комбинации справа в красном бейдж-множителе", () => {
  const s = Game.dispatch(Game.createInitialState(""), { type: "START_RUN", seedCode: "UITC", rules: "classic" });
  s.combat.wave.modifiers = [{ id: "bastion" }];
  UI.render(s);
  const html = document.getElementById("app").innerHTML;
  assert(html.includes("combo-mult-badge"), "бейдж множителя на панели комбинаций");
  assert(html.includes("×0.5"), "множитель показан");
  assert(html.includes("penalized"), "строки комбинаций подсвечены");
  assert(html.includes("режет правило цели"), "легенда объясняет красную точку");
});
