// PROTOTYPE v2 — тесты системы «Формация + Связки + Броня». Стиль tests/run.js.
// Ключевые отличия от v1: выбор формации — максимум урона (не приоритет тира),
// детекция читает detectPower, связок 7 и все без ролей, контрпика и
// Гранд-финала нет.

suite("Формации: детекция");

test("1 герой = Харас", () => {
  const f = FormationSys.evaluate([{ power: 7, attr: "agi", slotIndex: 0 }]);
  assertEq(f.id, "skirmish");
  assertEq(f.damageType, "physical");
  assertEq(f.bonds.length, 0);
});

test("2 героя = Дуэль", () => {
  const f = FormationSys.evaluate([
    { power: 5, attr: "str", slotIndex: 0 },
    { power: 5, attr: "int", slotIndex: 1 },
  ]);
  assertEq(f.id, "duel");
});

test("Рампа читает ПОРЯДОК слотов", () => {
  const asc = [2, 3, 5, 7, 8].map((p, i) => ({ power: p, attr: ["str", "int", "agi", "str", "int"][i], slotIndex: i }));
  const desc = asc.slice().reverse().map((c, i) => ({ ...c, slotIndex: i }));
  assertEq(FormationSys.evaluate(asc).id, "ramp");
  assert(FormationSys.evaluate(desc).id !== "ramp", "обратный порядок — уже не Рампа");
});

test("детектор выбирает МАКСИМУМ УРОНА, а не приоритет позиционности", () => {
  // v1 выбирала Рампу (110.25) из-за правила «позиционная важнее».
  const asc = [2, 3, 5, 7, 8].map((p, i) => ({ power: p, attr: "str", slotIndex: i }));
  const f = FormationSys.evaluate(asc);
  assertEq(f.id, "phalanx", "Фаланга 55×2.5=137.5 жирнее Рампы 49×2.25=110.25");
  const ramp = f.alternatives.find((x) => x.id === "ramp");
  assert(ramp, "Рампа должна оставаться в списке альтернатив");
  assertEq(Math.round(ramp.damage * 10) / 10, 96.6);
});

test("ничья по урону — позиционная формация приоритетнее", () => {
  assert(FormationSys.better(
    { damage: 100, positional: true, basePower: 1, baseMult: 1 },
    { damage: 100, positional: false, basePower: 9, baseMult: 9 }
  ), "при равном уроне позиционная выигрывает");
  assert(!FormationSys.better(
    { damage: 50, positional: true, basePower: 9, baseMult: 9 },
    { damage: 60, positional: false, basePower: 1, baseMult: 1 }
  ), "меньший урон проигрывает независимо от позиционности");
});

test("Клин: сильнейший в центре", () => {
  const wedge = [
    { power: 3, attr: "int", slotIndex: 0 },
    { power: 9, attr: "str", slotIndex: 1 },
    { power: 5, attr: "agi", slotIndex: 2 },
  ];
  const f = FormationSys.evaluate(wedge);
  assertEq(f.id, "wedge");
  assertEq(f.damageType, "pure");
});

test("пик на фланге — Клина нет, детектор берёт лучшую из оставшихся", () => {
  const flank = [
    { power: 9, attr: "int", slotIndex: 0 },
    { power: 3, attr: "str", slotIndex: 1 },
    { power: 5, attr: "agi", slotIndex: 2 },
  ];
  assertEq(FormationSys.evaluate(flank).id, "triangle");
});

test("Стена: слоты 1–2 — Сила ранга ≥6", () => {
  const cards = [
    { power: 10, attr: "str", slotIndex: 0 }, { power: 8, attr: "str", slotIndex: 1 },
    { power: 5, attr: "str", slotIndex: 2 }, { power: 9, attr: "agi", slotIndex: 3 },
    { power: 5, attr: "int", slotIndex: 4 },
  ];
  const f = FormationSys.evaluate(cards);
  assertEq(f.id, "wall");
  assertEq(f.basePower, 39); // 18 база + 21 связка (Сила 5, Ганг 6, Цепочка 6, Фронт 4); Σ сил добавит combat
  assertEq(f.baseMult, 1.9);
  assertEq(Math.round(f.damage * 10) / 10, 144.4);   // «полный ожидаемый результат»: (39 + Σ37) × 1.9
});

test("Фаланга: 4+ одного атрибута", () => {
  const cards = [5, 5, 7, 8, 2].map((p, i) => ({ power: p, attr: "str", slotIndex: i }));
  const f = FormationSys.evaluate(cards);
  assertEq(f.id, "phalanx");
  assert(f.bonds.some((b) => b.id === "gang2"), "дубликаты рангов дают Ганг");
});

test("Тимвайп: 5 рангов подряд + 3 атрибута", () => {
  const cards = [
    { power: 3, attr: "str", slotIndex: 0 }, { power: 4, attr: "agi", slotIndex: 1 },
    { power: 5, attr: "int", slotIndex: 2 }, { power: 6, attr: "str", slotIndex: 3 },
    { power: 7, attr: "agi", slotIndex: 4 },
  ];
  const f = FormationSys.evaluate(cards);
  assertEq(f.id, "teamwipe");
  assertEq(f.damageType, "magical");
});

test("4 Protect 1: margin 4 (ручка §10), а не 3", () => {
  const spread = [
    { power: 7, attr: "str", slotIndex: 0 }, { power: 2, attr: "int", slotIndex: 1 },
    { power: 8, attr: "str", slotIndex: 2 }, { power: 5, attr: "int", slotIndex: 3 },
    { power: 6, attr: "int", slotIndex: 4 },
  ];
  // центр 8 против среднего остальных 5: при margin 3 проходило, при 4 — нет.
  assert(FormationSys.evaluate(spread).id !== "protect", "разброс +3 не должен давать 4 Protect 1");
  const wide = [
    { power: 3, attr: "str", slotIndex: 0 }, { power: 2, attr: "int", slotIndex: 1 },
    { power: 10, attr: "str", slotIndex: 2 }, { power: 3, attr: "agi", slotIndex: 3 },
    { power: 2, attr: "int", slotIndex: 4 },
  ];
  // центр 10 против среднего 2.5 — честная 4-1.
  assertEq(FormationSys.evaluate(wide).id, "protect");
});

test("любой набор 1-5 карт всегда получает формацию, числа конечны", () => {
  const attrs = ["str", "agi", "int", "uni"];
  const defense = { armor: 18, mr: 0.25 };
  for (let n = 1; n <= 5; n++) {
    for (let seed = 0; seed < 60; seed++) {
      const cards = [];
      for (let i = 0; i < n; i++) {
        cards.push({ power: 2 + ((seed * 7 + i * 3) % 10), attr: attrs[(seed + i) % 4], slotIndex: i });
      }
      const f = FormationSys.evaluate(cards, { defense });
      assert(f, "нет формации для набора " + JSON.stringify(cards.map((c) => c.power + c.attr)));
      assert(Number.isFinite(f.basePower) && Number.isFinite(f.baseMult), "не числа в скоринге");
      assert(f.damage >= 1, "урон ниже 1");
    }
  }
});

suite("Связки v2: складываются, ролей нет");

test("несколько связок активны одновременно, basePower = formPower + bondPower", () => {
  const cards = [8, 7, 5, 3].map((p, i) => ({ power: p, attr: "str", slotIndex: i }));
  const f = FormationSys.evaluate(cards);
  assert(f.bonds.length >= 2, "ожидали 2+ связки, получили " + f.bonds.length);
  assert(f.bondPower > 0, "связки должны давать силу");
  assertEq(f.basePower, f.formPower + f.bondPower);
});

test("Сила: 2+ героя STR", () => {
  const two = FormationSys.evaluate([
    { power: 5, attr: "str", slotIndex: 0 }, { power: 3, attr: "str", slotIndex: 1 },
  ]);
  assert(two.bonds.some((b) => b.id === "str2"), "Сила не собралась");
  const one = FormationSys.evaluate([{ power: 5, attr: "str", slotIndex: 0 }]);
  assert(!one.bonds.some((b) => b.id === "str2"), "один STR — связки нет");
});

test("Ловкость даёт и силу, и множитель", () => {
  const f = FormationSys.evaluate([
    { power: 5, attr: "agi", slotIndex: 0 }, { power: 6, attr: "agi", slotIndex: 1 },
  ]);
  assertEq(f.bondPower, 4);
  assertEq(f.bondMult, 0.2);
});

test("Интеллект даёт множитель", () => {
  const f = FormationSys.evaluate([
    { power: 5, attr: "int", slotIndex: 0 }, { power: 6, attr: "int", slotIndex: 1 },
  ]);
  assertEq(f.bondMult, 0.4);
});

test("Ганг: 2 одинаковых ранга", () => {
  const cards = [
    { power: 5, attr: "str", slotIndex: 0 }, { power: 5, attr: "agi", slotIndex: 1 },
    { power: 9, attr: "int", slotIndex: 2 },
  ];
  assert(FormationSys.evaluate(cards).bonds.some((b) => b.id === "gang2"), "Ганг1 не сработал");
});

test("Цепочка: 3 ранга подряд", () => {
  const cards = [
    { power: 3, attr: "str", slotIndex: 0 }, { power: 4, attr: "agi", slotIndex: 1 },
    { power: 5, attr: "int", slotIndex: 2 },
  ];
  assert(FormationSys.evaluate(cards).bonds.some((b) => b.id === "chain3"), "Цепочка не собралась");
});

test("Фронт: слоты 1–2 — Сила ≥5", () => {
  const yes = FormationSys.evaluate([
    { power: 6, attr: "str", slotIndex: 0 }, { power: 7, attr: "str", slotIndex: 1 },
    { power: 2, attr: "int", slotIndex: 2 },
  ]);
  assert(yes.bonds.some((b) => b.id === "front"), "Фронт не собрался");
  const no = FormationSys.evaluate([
    { power: 2, attr: "str", slotIndex: 0 }, { power: 7, attr: "str", slotIndex: 1 },
    { power: 6, attr: "int", slotIndex: 2 },
  ]);
  assert(!no.bonds.some((b) => b.id === "front"), "слабый фронт не должен давать Фронт");
});

test("Тыл: последние 2 слота — INT", () => {
  const f = FormationSys.evaluate([
    { power: 2, attr: "str", slotIndex: 0 }, { power: 7, attr: "str", slotIndex: 1 },
    { power: 3, attr: "int", slotIndex: 2 }, { power: 5, attr: "int", slotIndex: 3 },
  ]);
  assert(f.bonds.some((b) => b.id === "back"), "Тыл не собрался");
});

test("фейк-ролей больше нет: STR-отряд даёт только Силу, не Инициацию", () => {
  const cards = [5, 6, 7].map((p, i) => ({ power: p, attr: "str", slotIndex: i }));
  const f = FormationSys.evaluate(cards);
  assert(f.bonds.some((b) => b.id === "str2"), "Сила должна быть");
  assert(!f.bonds.some((b) => /init|sup|carry/.test(b.id)), "ролевых связок быть не должно: " + f.bonds.map((b) => b.id));
  assertEq(BONDS_DATA.length, 7);
  assert(FormationSys.buildCtx(cards).roles === undefined, "ctx не должен знать про роли");
});

suite("detectPower: Butterfly/Manta/Shadow Blade не ломаются");

test("детекция читает detectPower, а не голый power", () => {
  // Карта с power 4 и detectPower 5 собирает Ганг — как в покере.
  const cards = [
    { power: 5, attr: "str", slotIndex: 0 },
    { power: 4, attr: "str", detectPower: 5, slotIndex: 1 },
    { power: 3, attr: "agi", slotIndex: 2 },
  ];
  assert(FormationSys.evaluate(cards).bonds.some((b) => b.id === "gang2"), "detectPower не учтён в детекции");
});

test("detectPower включает Рампу без изменения реальной силы", () => {
  const cards = [
    { power: 2, attr: "str", slotIndex: 0 }, { power: 3, attr: "str", slotIndex: 1 },
    { power: 4, attr: "str", slotIndex: 2 }, { power: 8, attr: "str", detectPower: 5, slotIndex: 3 },
    { power: 6, attr: "str", slotIndex: 4 },
  ];
  const withDetect = FormationSys.evaluate(cards);
  assert(withDetect.alternatives.some((x) => x.id === "ramp"),
    "ранги 2,3,4,5,6 (по detect) должны сделать Рампу валидной");
  // Выбрана более жирная Фаланга — но детекция увидела Рампу, это и есть контракт.
  const bare = cards.map((c) => { const { detectPower, ...rest } = c; return rest; });
  assert(!FormationSys.evaluate(bare).alternatives.some((x) => x.id === "ramp"),
    "без detectPower (ранги 2,3,4,8,6) Рампы быть не должно");
});

suite("Броня и типы урона");

test("physical снижается плоской бронёй", () => {
  assertEq(FormationSys.mitigate(200, "physical", { armor: 40, mr: 0.25 }, 0), 160);
});

test("magical снижается сопротивлением", () => {
  assertEq(FormationSys.mitigate(200, "magical", { armor: 40, mr: 0.25 }, 0), 150);
});

test("pure игнорирует защиту", () => {
  assertEq(FormationSys.mitigate(200, "pure", { armor: 40, mr: 0.25 }, 0), 200);
});

test("armor pen пробивает броню", () => {
  assertEq(FormationSys.mitigate(200, "physical", { armor: 40, mr: 0 }, 25), 185);
});

test("броня не съедает больше половины удара, урон не в минус", () => {
  assertEq(FormationSys.mitigate(10, "physical", { armor: 40, mr: 0 }, 0), 5);
  assert(FormationSys.mitigate(0, "physical", { armor: 40, mr: 0 }, 0) >= 1, "минимум 1 урона");
});

suite("Ставка, альтернативы и перестановка");

test("commit применяется до защиты (как finalMult в combat.js)", () => {
  const cards = [{ power: 7, attr: "agi", slotIndex: 0 }];
  const defense = { armor: 18, mr: 0 };
  // (5 база + 7 сила) = 12; броня съедает половину → 6.
  assertEq(FormationSys.evaluate(cards, { defense }).damage, 6);
  // 12 × 1.25 = 15, минус половина → 7.5 → 8.
  assertEq(FormationSys.evaluate(cards, { defense, commit: 1.25 }).damage, 8);
});

test("alternatives отсортированы по урону и начинаются с выбранной", () => {
  const cards = [2, 3, 5, 7, 8].map((p, i) => ({ power: p, attr: "str", slotIndex: i }));
  const f = FormationSys.evaluate(cards);
  assert(f.alternatives.length >= 2, "ожидали несколько альтернатив");
  assertEq(f.alternatives[0].id, f.id);
  for (let i = 1; i < f.alternatives.length; i++) {
    assert(f.alternatives[i - 1].damage >= f.alternatives[i].damage, "альтернативы не отсортированы");
  }
  assert(f.alternatives.some((x) => x.id === "squad"), "фолбэк «Отряд» всегда в списке");
});

test("bestSwap находит Клин перестановкой (gameplay loop)", () => {
  const H = (id) => { const h = Content.heroes.byId[id]; return { power: h.power, attr: h.attr, name: h.name }; };
  const ids = ["sven", "pudge", "cm", "zeus", "lina"];
  const cards = ids.map((id, i) => ({ ...H(id), slotIndex: i }));
  const opts = { defense: TOWER_DEFENSE.t3, commit: 1.25 };
  const base = FormationSys.evaluate(cards, opts);
  assertEq(base.id, "wall");
  assertEq(base.damage, 163); // Стена: (18+15 связок+28 сил) × 2.5 × 1.25 − 28 брони
  const hint = FormationSys.bestSwap(cards, opts);
  assert(hint, "перестановка Sven ↔ Crystal Maiden обязана собрать Клин");
  assertEq(hint.id, "wedge");
  assertEq(hint.damage, 186); // Клин pure: (16+11+28) × 2.7 × 1.25, броню игнорирует
  assertEq(hint.gain, 23);
});

test("bestSwap возвращает null, когда улучшений нет", () => {
  const cards = [5, 5, 5, 5, 5].map((p, i) => ({ power: p, attr: "str", slotIndex: i }));
  assertEq(FormationSys.bestSwap(cards), null, "все карты одинаковы — переставлять нечего");
});

suite("Гигиена v2: чего в системе больше нет");

test("Гранд-финала нет (ролей всё равно нет), максимум tier 5", () => {
  assert(!FORMATIONS_DATA.some((f) => f.id === "grandfinal"), "Гранд-финал должен быть вырезан");
  assertEq(Math.max(...FORMATIONS_DATA.map((f) => f.tier)), 5);
});

test("контрпик вырезан", () => {
  assert(typeof FormationSys.counterDraft === "undefined", "counterDraft должен быть удалён");
  assert(typeof COUNTER_MATRIX === "undefined", "матрица контрпика должна быть удалена");
});

test("роли вырезаны из контента", () => {
  assert(typeof ROLE_FALLBACK === "undefined", "ROLE_FALLBACK должен быть удалён");
  assert(BONDS_DATA.every((b) => JSON.stringify(b.when).indexOf("ROLE") === -1), "связки не должны читать роли");
});

test("контракт evaluate совпадает с PokerSys", () => {
  const cards = [{ power: 5, attr: "str", slotIndex: 0 }, { power: 5, attr: "str", slotIndex: 1 }];
  const old = PokerSys.evaluate(cards);
  const next = FormationSys.evaluate(cards);
  for (const key of ["type", "name", "basePower", "baseMult"]) {
    assert(key in next, "нет поля " + key);
    assert(key in old, "старый контракт изменился: " + key);
  }
});

test("миграция условий: Axe COMBO_IS three → SAME_RANK_GROUP 3", () => {
  const ctx = FormationSys.buildCtx([
    { power: 5, attr: "str", slotIndex: 0 }, { power: 5, attr: "agi", slotIndex: 1 },
    { power: 5, attr: "int", slotIndex: 2 },
  ]);
  assertEq(FormationSys.evalWhen({ type: "SAME_RANK_GROUP", size: 3 }, ctx), true);
  assertEq(FormationSys.evalWhen({ type: "SAME_RANK_GROUP", size: 4 }, ctx), false);
});
