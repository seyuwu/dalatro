// PROTOTYPE v2 — сравнение СТАРОЙ системы (покер) с НОВОЙ (формация+связки+броня).
//
// Честность сравнения (фиксы v1, см. docs/REDESIGN_ANTI_BALATRO.md §12):
//   — ставка ×1.25 за 5 героев применяется к ОБОИМ системам (в v1 — ни одной);
//   — контрпика больше нет: его ×1.15 не раздувает новую систему
//     (в v1 заголовочные 245/313 включали его молча);
//   — выбор формации — максимум урона, а не «позиционная важнее».

(function () {
  const COMMIT_5 = 1.25; // Combat.COMMIT_TIERS[5].finalMult

  const H = (id) => {
    const h = Content.heroes.byId[id];
    return { heroId: h.id, power: h.power, attr: h.attr, name: h.name };
  };

  const wave = { id: "t3", hp: 800, maxHp: 800 };
  const defense = TOWER_DEFENSE[wave.id];
  const opts = { defense, commit: COMMIT_5 };

  function lineup(ids) { return ids.map((id, i) => ({ ...H(id), slotIndex: i })); }

  // Старая математика (как в combat.js): power × mult × ставка.
  function scoreOld(cards) {
    const combo = PokerSys.evaluate(cards);
    const power = combo.basePower + cards.reduce((a, c) => a + c.power, 0);
    const commit = cards.length === 5 ? COMMIT_5 : 1;
    return { label: combo.name + " (" + combo.type + ")", damage: Math.round(power * combo.baseMult * commit) };
  }

  function scoreNew(cards) { return FormationSys.evaluate(cards, opts); }

  const scenarios = [
    ["Харас (1 герой)", ["juggernaut"]],
    ["Дуо разных атрибутов", ["axe", "zeus"]],
    ["5× STR (старый флеш)", ["tusk", "axe", "pudge", "sven", "centaur"]],
    ["Ранги по возрастанию", ["cm", "tusk", "axe", "pudge", "sven"]],
    ["ТЕ ЖЕ КАРТЫ, обратный порядок", ["sven", "pudge", "axe", "tusk", "cm"]],
    ["Пик в центре", ["cm", "tusk", "centaur", "pudge", "zeus"]],
    ["3 INT + 2 STR (без паттерна)", ["cm", "zeus", "skywrath", "axe", "sven"]],
    ["Микс без паттерна", ["cm", "pudge", "zeus", "sven", "morphling"]],
  ];

  const pad = (s, n) => String(s).padEnd(n);
  console.log("\n=== СТАРАЯ СИСТЕМА (покер) vs НОВАЯ v2 (формация+связки+броня) ===");
  console.log(`Башня: ${wave.id.toUpperCase()} — armor ${defense.armor}, magic resist ${Math.round(defense.mr * 100)}%. Ставка ×${COMMIT_5} у обеих систем.\n`);
  console.log(pad("Сценарий", 32) + pad("СТАРЫЙ урон", 30) + pad("НОВЫЙ урон", 36) + "Связки");
  console.log("-".repeat(132));
  for (const [title, ids] of scenarios) {
    const cards = lineup(ids);
    const o = scoreOld(cards);
    const n = scoreNew(cards);
    console.log(
      pad(title, 32) +
      pad(`${o.damage} (${o.label})`, 30) +
      pad(`${n.damage} (${n.name}, ${n.damageType})`, 36) +
      n.bonds.map((b) => b.trait).join(" ")
    );
  }

  const asc = scoreNew(lineup(["cm", "tusk", "axe", "pudge", "sven"]));
  const rev = scoreNew(lineup(["sven", "pudge", "axe", "tusk", "cm"]));
  const rampAlt = asc.alternatives.find((f) => f.id === "ramp");
  console.log("\nГлавное отличие:");
  console.log(`  одинаковые 5 карт, порядок ↑ = ${asc.damage} (${asc.name}); Рампа в альтернативах: ${rampAlt ? rampAlt.damage : "—"}`);
  console.log(`  одинаковые 5 карт, порядок ↓ = ${rev.damage} (${rev.name})`);
  console.log(`  в покерной системе оба дали бы ${scoreOld(lineup(["cm", "tusk", "axe", "pudge", "sven"])).damage}`);
  console.log(`  (v1 выбирала Рампу 120 вместо Фаланги 154 — детектор v2 берёт максимум урона)`);
})();

// Панель альтернатив + подсказка перестановки — сердце gameplay loop v2.
(function () {
  const defense = TOWER_DEFENSE.t3;
  const opts = { defense, commit: 1.25 };
  const H = (id) => { const h = Content.heroes.byId[id]; return { heroId: h.id, power: h.power, attr: h.attr, name: h.name }; };
  const ids = ["sven", "pudge", "cm", "zeus", "lina"];
  const cards = ids.map((id, i) => ({ ...H(id), slotIndex: i }));

  console.log("\n=== ПАНЕЛЬ АЛЬТЕРНАТИВ (данные для UI) ===");
  const base = FormationSys.evaluate(cards, opts);
  console.log(`Раскладка [${cards.map((c) => c.name + " " + c.power).join("][")}] против T3 (armor 18, mr 25%):`);
  for (const f of base.alternatives) {
    console.log(`  ${f.name.toUpperCase().padEnd(10)} ${String(f.damage).padStart(4)}  (${f.damageType}${f.positional ? ", позиционная" : ""})`);
  }
  const hint = FormationSys.bestSwap(cards, opts);
  if (hint) {
    const [i, j] = hint.swap;
    console.log(`← переставь ${cards[i].name} ↔ ${cards[j].name} → ${hint.name.toUpperCase()} ${hint.damage} (+${hint.gain})`);
  } else {
    console.log("← улучшений перестановкой нет");
  }
})();

// Кривая без предметов: сколько боёв нужно на каждую башню. Лимит — 4 боя.
(function () {
  const H = (id) => { const h = Content.heroes.byId[id]; return { power: h.power, attr: h.attr }; };
  const WAVES = [
    { id: "t1", hp: 300 }, { id: "t2", hp: 550 }, { id: "t3", hp: 800 },
    { id: "techies", hp: 1000 }, { id: "roshan", hp: 1600 },
  ];
  const lineup = ["centaur", "sven", "axe", "pa", "zeus"].map((id, i) => ({ ...H(id), slotIndex: i }));
  const opts = { commit: 1.25 };
  const f = FormationSys.evaluate(lineup, opts);

  console.log("\n=== Кривая без предметов: «" + f.name + "», " + f.basePower + " × " + f.baseMult + " × 1.25, " + f.damageType + " ===");
  console.log("Башня      HP    защита            урон/бой   боёв нужно (лимит 4)");
  for (const w of WAVES) {
    const d = TOWER_DEFENSE[w.id];
    const dmg = FormationSys.evaluate(lineup, { defense: d, commit: 1.25 }).damage;
    const need = Math.ceil(w.hp / dmg);
    console.log(
      `${w.id.padEnd(10)} ${String(w.hp).padEnd(5)} ` +
      `armor ${String(d.armor).padEnd(3)} mr ${String(Math.round(d.mr * 100) + "%").padEnd(5)} ` +
      `${String(dmg).padEnd(10)} ${need} ${need > 4 ? "← не проходит без билда" : "✓"}`
    );
  }

  const oldCombo = PokerSys.evaluate(lineup);
  const oldPower = oldCombo.basePower + lineup.reduce((a, c) => a + c.power, 0);
  const oldDmg = Math.round(oldPower * oldCombo.baseMult * 1.25);
  console.log("\nДля сравнения — СТАРАЯ система на той же руке (со ставкой ×1.25):");
  console.log(`  ${oldCombo.name} (${oldCombo.type}): ${oldPower} × ${oldCombo.baseMult} × 1.25 = ${oldDmg} урона/бой`);
  for (const w of WAVES) {
    const need = Math.ceil(w.hp / oldDmg);
    console.log(`  ${w.id.padEnd(10)} HP ${String(w.hp).padEnd(5)} → ${need} боёв ${need > 4 ? "← не проходит" : "✓"}`);
  }
  console.log("\nБез предметов новая система проходит T1–T2, T3 требует предмета —");
  console.log("это таргет BALANCE.md («после 1–2 предметов жмёт T2/T3»). Кривая v1");
  console.log("выглядела щедрее только из-за фейк-ролей (Инициация давала +1.0 mult).");
})();
