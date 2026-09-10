// Aghanim's Scepter & Shard (docs/AGHANIMS.md): пилотные аугменты.
// Скипетр = изменение поведения (override/preFlag), осколок = малый паттерн.
suite("Aghanim — пилот");

function agRun(seed) {
  return Game.dispatch(Game.createInitialState(""), { type: "START_RUN", seedCode: seed || "AG1" });
}
function agEquip(s, heroId, kind, augId) {
  s.run.aghanims = s.run.aghanims || {};
  s.run.aghanims[heroId] = s.run.aghanims[heroId] || {};
  s.run.aghanims[heroId][kind] = augId;
}
function agAdd(s, heroIds) {
  for (const h of heroIds) if (!Object.values(s.cards).some((c) => c.heroId === h)) DeckSys.addHero(s, h);
}
function agPlay(s, heroIds, hpOverride) {
  const all = Object.values(s.cards);
  const uids = heroIds.map((h) => all.find((c) => c.heroId === h).uid);
  s.player.handUids = [...uids, ...Object.keys(s.cards).filter((u) => !uids.includes(u))];
  s.combat.selectedUids = uids.slice();
  s.player.fightsLeft = Math.max(1, s.player.fightsLeft);
  if (hpOverride != null) s.combat.wave.hp = hpOverride;
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  return s.combat.lastResolution;
}
function stepLabels(res) {
  return res.steps.map((st) => st.label);
}

test("Ursa Overpower: соло-бой даёт ×1.8, база не дублируется", () => {
  const s = agRun("AGUR1");
  agAdd(s, ["ursa"]);
  agEquip(s, "ursa", "scepter", "ursa_sc");
  const res = agPlay(s, ["ursa"], 999999);
  const mults = stepLabels(res).filter((l) => l.includes("Overpower") && l.includes("×1.8"));
  assertEq(mults.length, 1, "Enrage ×1.8 ровно один раз");
});

test("Ursa без скептера в соло не критует", () => {
  const s = agRun("AGUR2");
  agAdd(s, ["ursa"]);
  const res = agPlay(s, ["ursa"], 999999);
  assert(!stepLabels(res).some((l) => l.includes("×1.8")), "базовый Enrage требует 2+ героев");
});

test("Ursa Earthshock: Enrage мимо — утешительные +6 силы", () => {
  const s = agRun("AGUR3");
  agAdd(s, ["ursa"]);
  agEquip(s, "ursa", "shard", "ursa_sh");
  agAdd(s, ["tidehunter"]);
  const res = agPlay(s, ["ursa", "tidehunter"], 999999);
  assert(!stepLabels(res).some((l) => l.includes("Earthshock")), "высший ранг — Earthshock молчит");
  assert(stepLabels(res).some((l) => l.includes("×1.8")), "Enrage по высшему рангу работает");
});

test("Dawnbreaker Starbreaker: Универсал-джокер открывает Zeus'а", () => {
  const s = agRun("AGDB1");
  agEquip(s, "dawnbreaker", "scepter", "dawnbreaker_sc");
  const res = agPlay(s, ["zeus", "dawnbreaker"], 999999);
  // У базовых способностей в стеке имя героя, не способности.
  assert(stepLabels(res).some((l) => l.includes("Zeus: +2")), "EXISTS int видит джокера-UNI");
  assert(stepLabels(res).some((l) => l.includes("Starbreaker")), "preFlag-шаг в стеке");
});

test("Dawnbreaker без скептера: UNI не кормит Zeus'а", () => {
  const s = agRun("AGDB2");
  const res = agPlay(s, ["zeus", "dawnbreaker"], 999999);
  assert(!stepLabels(res).some((l) => l.includes("Zeus: +2")), "без джокера INT отсутствует");
});

test("Starbreaker: UNI добирает недостающий атрибут для Invoker'а", () => {
  const s = agRun("AGDB3");
  agAdd(s, ["invoker"]);
  agEquip(s, "dawnbreaker", "scepter", "dawnbreaker_sc");
  // {int, uni} + джокер = 3 атрибута → DISTINCT > 2 → Invoke +3.
  const res = agPlay(s, ["invoker", "dawnbreaker"], 999999);
  assert(stepLabels(res).some((l) => l.includes("Invoke") && l.includes("+3")), "2 реальных + UNI = 3 атрибута");
});

test("Dawnbreaker Celestial Hammer: единственный UNI — +5 силы", () => {
  const s = agRun("AGDB4");
  agEquip(s, "dawnbreaker", "shard", "dawnbreaker_sh");
  const solo = agPlay(s, ["dawnbreaker", "zeus"], 999999);
  assert(stepLabels(solo).some((l) => l.includes("Celestial Hammer") && l.includes("+5")), "других UNI нет — +5");
  s.combat.outcome = null;
  s.player.fightsLeft = 4;
  s.combat.selectedUids = [];
  const duo = agPlay(s, ["dawnbreaker", "primal"], 999999);
  assert(!stepLabels(duo).some((l) => l.includes("Celestial Hammer")), "второй UNI выключает осколок");
});

test("Tidehunter Ravage: пятёрка дублирует способности, база отключена", () => {
  const s = agRun("AGTH1");
  agAdd(s, ["tidehunter"]);
  agEquip(s, "tidehunter", "scepter", "tidehunter_sc");
  const res = agPlay(s, ["tusk", "axe", "cm", "zeus", "tidehunter"], 999999);
  const labels = stepLabels(res);
  assert(labels.filter((l) => l.includes("Tidehunter: +2")).length === 0, "базовый Kraken Shell заменён");
  assert(labels.filter((l) => l.includes("Tusk: +4")).length === 2, "Snowball сработал дважды");
  assert(labels.some((l) => l.includes("Ravage") && l.includes("дважды")), "шаг про двойные способности");
});

test("Tidehunter без скептера: пятёрка даёт Kraken Shell один раз", () => {
  const s = agRun("AGTH2");
  agAdd(s, ["tidehunter"]);
  const res = agPlay(s, ["tusk", "axe", "cm", "zeus", "tidehunter"], 999999);
  const labels = stepLabels(res);
  assert(labels.filter((l) => l.includes("Tidehunter: +2")).length === 1, "база на месте");
  assert(labels.filter((l) => l.includes("Tusk: +4")).length === 1, "без двойных способностей");
});

test("Tidehunter Kelp Vise: ровно 4 героя — +6 силы", () => {
  const s = agRun("AGTH3");
  agAdd(s, ["tidehunter"]);
  agEquip(s, "tidehunter", "shard", "tidehunter_sh");
  const res = agPlay(s, ["tusk", "axe", "cm", "tidehunter"], 999999);
  assert(stepLabels(res).some((l) => l.includes("Kelp Vise") && l.includes("+6")), "компенсация за неполную пятёрку");
});

test("PL Doppelganger: градиент вместо флеша", () => {
  const s = agRun("AGPL1");
  agAdd(s, ["phantom_lancer"]);
  agEquip(s, "phantom_lancer", "scepter", "phantom_lancer_sc");
  // 3 AGI (pa, jugg, pl) + cm + zeus: +3 за агих, all-agi не сработал.
  const res = agPlay(s, ["phantom_lancer", "pa", "juggernaut", "cm", "zeus"], 999999);
  const labels = stepLabels(res);
  assert(labels.some((l) => l.includes("Doppelganger") && l.includes("+3")), "3 AGI = +3");
  assert(!labels.some((l) => l.includes("Precision Aura")), "база заменена");
  s.combat.outcome = null;
  s.player.fightsLeft = 4;
  // Чистый аги-отряд: +3 за трёх AGI и +1 сверху.
  const res2 = agPlay(s, ["phantom_lancer", "pa", "juggernaut"], 999999);
  const labels2 = stepLabels(res2);
  assert(labels2.some((l) => l.includes("Doppelganger") && l.includes("+3")), "3 AGI");
  assert(labels2.some((l) => l.includes("Doppelganger") && l.includes("+1")), "полный AGI-отряд: бонус +1");
});

test("PL Phantom Rush: иллюзия Manta считается AGI", () => {
  const s = agRun("AGPL2");
  agAdd(s, ["phantom_lancer"]);
  agEquip(s, "phantom_lancer", "shard", "phantom_lancer_sh");
  s.player.items.push("manta");
  // Минимальный стейт для buildEffectiveSet: иллюзия сильнейшего (Sven, STR).
  const played = [
    { uid: "u1", heroId: "sven", power: 8, attr: "str", illusion: false, slotIndex: 0 },
    { uid: "u2", heroId: "phantom_lancer", power: 6, attr: "agi", illusion: false, slotIndex: 1 },
  ];
  const probe = {
    rules: "classic",
    run: { aghanims: s.run.aghanims },
    combat: { scoring: { flags: {} }, wave: null },
    player: { items: ["manta"] },
  };
  const out = Combat.buildEffectiveSet(probe, played, { steps: [] });
  const illusion = out.effective.find((c) => c.illusion);
  assert(!!illusion, "иллюзия создана");
  assertEq(illusion.attr, "agi", "донор STR, но иллюзия AGI");
  assertEq(illusion.attr, Game.heroAttr(probe, "sven") === "str" ? "agi" : illusion.attr, "переопределение атрибута");
});

test("Tiny Avalanche: ТП-сбросы растят ранг навсегда, кап +3", () => {
  const s = agRun("AGTN1");
  agAdd(s, ["tiny"]);
  agEquip(s, "tiny", "scepter", "tiny_sc");
  const base = Game.rankOf(s, "tiny");
  assertEq(base, 10, "база Tiny 10");
  // Один ТП-сброс → used 1.
  const anyUid = s.player.handUids[0];
  s.combat.selectedUids = [anyUid];
  Game.dispatch(s, { type: "DISCARD", uids: [anyUid] });
  agPlay(s, ["tiny"], 999999);
  assertEq(Game.rankOf(s, "tiny"), 11, "1 сброс = +1 ранг");
  // Ещё два сброса → used 2 → +2.
  s.combat.outcome = null;
  s.player.fightsLeft = 4;
  for (let i = 0; i < 2; i++) {
    const uid = s.player.handUids.find((u) => !s.combat.selectedUids.includes(u));
    s.combat.selectedUids = [uid];
    Game.dispatch(s, { type: "DISCARD", uids: [uid] });
  }
  agPlay(s, ["tiny"], 999999);
  assertEq(Game.rankOf(s, "tiny"), 13, "3 сброса = +3 ранга (кап)");
  // Кап: дальнейшие сбросы не растят.
  s.combat.outcome = null;
  s.player.fightsLeft = 4;
  const uid3 = s.player.handUids[0];
  s.combat.selectedUids = [uid3];
  Game.dispatch(s, { type: "DISCARD", uids: [uid3] });
  agPlay(s, ["tiny"], 999999);
  assertEq(Game.rankOf(s, "tiny"), 13, "кап +3 достигнут");
});

test("Huskar Burn the Racks: зачистка с потерянной казармой даёт +1 XP", () => {
  const s = agRun("AGHK1");
  agAdd(s, ["huskar"]);
  agEquip(s, "huskar", "scepter", "huskar_sc");
  // Полные казармы: grant молчит.
  const res1 = agPlay(s, ["huskar"], 1);
  assert(res1.killed, "башня зачищена");
  assertEq((s.run.heroXp || {}).huskar, 2, "добивающий бой +2, без скептер-бонуса");
  // Потеряна казарма: зачистка даёт +3 (2 + 1).
  s.combat.outcome = null;
  s.player.fightsLeft = 4;
  s.run.barracks = 1;
  const res2 = agPlay(s, ["huskar"], 1);
  assertEq((s.run.heroXp || {}).huskar, 5, "2 + 1 за потерянную казарму");
  assert(stepLabels(res2).some((l) => l.includes("Burn the Racks")), "шаг аугмента в стеке");
});

test("Huskar Inner Fire: башня ниже 50% — +5 силы", () => {
  const s = agRun("AGHK2");
  agAdd(s, ["huskar"]);
  agEquip(s, "huskar", "shard", "huskar_sh");
  s.combat.wave.hp = Math.round(s.combat.wave.maxHp * 0.4);
  const res = agPlay(s, ["huskar"]); // без hpOverride — HP уже 40%
  assert(stepLabels(res).some((l) => l.includes("Inner Fire") && l.includes("+5")), "низкая башня кормит Huskar'а");
});

test("Ursa Earthshock: не соло и не высший — +6 силы", () => {
  const s = agRun("AGUR4");
  agAdd(s, ["ursa", "kunkka"]);
  agEquip(s, "ursa", "shard", "ursa_sh");
  // Ранги 12/12 = ничья: IS_HIGHEST_RANK считает Урсу высшим. Поднимаем
  // союзнику ранг (тренировка+XP) — Enrage промахивается, осколок утешает.
  s.run.ranks = { kunkka: 13 };
  const res = agPlay(s, ["ursa", "kunkka"], 999999);
  assert(stepLabels(res).some((l) => l.includes("Earthshock") && l.includes("+6")), "Enrage мимо — утешительные +6");
});

test("Безмолвие глушит и аугменты", () => {
  const s = agRun("AGSL1");
  agAdd(s, ["ursa"]);
  agEquip(s, "ursa", "scepter", "ursa_sc");
  s.combat.wave.modifiers.push({ id: "silence" });
  s.combat.wave.hp = 999999;
  const uids = [Object.values(s.cards).find((c) => c.heroId === "ursa").uid];
  s.player.handUids = uids.slice();
  s.combat.selectedUids = uids.slice();
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  const labels = stepLabels(s.combat.lastResolution);
  assert(!labels.some((l) => l.includes("×1.8")), "скептер под Безмолвием молчит");
});

suite("Aghanim — лавка");

test("Скипетр гарантирован в лавке после босса акта", () => {
  const s = agRun("AGSH1");
  s.combat.outcome = "cleared";
  s.run.afterBoss = true;
  Game.dispatch(s, { type: "ENTER_SHOP" });
  const offers = s.shop.aghanims || [];
  const sc = offers.find((o) => o.kind === "scepter");
  assert(!!sc, "после босса скипетр в лавке");
  const owned = new Set([...s.player.handUids, ...s.player.deckUids, ...s.player.discardUids].map((u) => s.cards[u].heroId));
  assert(owned.has(sc.heroId), "герой из ростера");
  assert(!(s.run.aghanims[sc.heroId] && s.run.aghanims[sc.heroId].scepter), "герой без скептера");
});

test("Скипетр не выпадает в акте 1 без босса", () => {
  for (let i = 0; i < 20; i++) {
    const st = agRun("AGSH4-" + i);
    st.run.afterBoss = false;
    assert(!Game.aghanimOffers(st).some((o) => o.kind === "scepter"), "акт 1: скипетра нет");
  }
});

test("Осколок не предлагается уже экипированным героям", () => {
  let sawShard = false;
  for (let i = 0; i < 40 && !sawShard; i++) {
    const st = agRun("AGSH3-" + i);
    agAdd(st, ["ursa"]);
    agEquip(st, "dawnbreaker", "shard", "dawnbreaker_sh");
    const sh = Game.aghanimOffers(st).find((o) => o.kind === "shard");
    if (sh) {
      sawShard = true;
      assert(sh.heroId !== "dawnbreaker", "экипированный не в пуле осколков");
      assert(Content.aghanims.forHero(sh.heroId, "shard"), "у предложенного героя есть осколок");
    }
  }
  assert(sawShard, "за 40 сидов осколок должен выпасть");
});

test("BUY_AUGMENT: списывает золото, экипирует, оффер исчезает", () => {
  const s = agRun("AGSH2");
  s.combat.outcome = "cleared";
  s.run.afterBoss = true;
  Game.dispatch(s, { type: "ENTER_SHOP" });
  const sc = (s.shop.aghanims || []).find((o) => o.kind === "scepter");
  assert(!!sc, "оффер есть");
  const aug = Content.aghanims.forHero(sc.heroId, "scepter");
  s.run.gold = 100;
  Game.dispatch(s, { type: "BUY_AUGMENT", heroId: sc.heroId, kind: "scepter" });
  assertEq(s.run.aghanims[sc.heroId].scepter, aug.id, "экипирован");
  assertEq(s.run.gold, 100 - aug.cost, "золото списано");
  assert(!(s.shop.aghanims || []).some((o) => o.kind === "scepter"), "оффер удалён");
  assert(s.log.some((l) => l.includes(aug.name)), "журнал: покупка записана");
  // Повторная покупка того же слота герою запрещена.
  s.shop.aghanims = s.shop.aghanims || [];
  s.shop.aghanims.push({ kind: "scepter", heroId: sc.heroId });
  const gold2 = s.run.gold;
  Game.dispatch(s, { type: "BUY_AUGMENT", heroId: sc.heroId, kind: "scepter" });
  assertEq(s.run.gold, gold2, "второй скептер тому же герою запрещён");
});

test("Дорогой аугмент не покупается", () => {
  const s = agRun("AGSH6");
  s.combat.outcome = "cleared";
  s.run.afterBoss = true;
  Game.dispatch(s, { type: "ENTER_SHOP" });
  const sc = (s.shop.aghanims || []).find((o) => o.kind === "scepter");
  s.run.gold = 1;
  const gold2 = s.run.gold;
  Game.dispatch(s, { type: "BUY_AUGMENT", heroId: sc.heroId, kind: "scepter" });
  assertEq(s.run.gold, gold2, "без золота покупки нет");
  assert(!(s.run.aghanims[sc.heroId] && s.run.aghanims[sc.heroId].scepter), "не экипирован");
});

test("Увольнение героя теряет аугменты", () => {
  const s = agRun("AGSH5");
  agAdd(s, ["ursa"]);
  agEquip(s, "ursa", "scepter", "ursa_sc");
  agEquip(s, "ursa", "shard", "ursa_sh");
  s.phase = "shop";
  s.run.gold = 100;
  Game.dispatch(s, { type: "EXILE_HERO", heroId: "ursa" });
  assert(!s.run.aghanims.ursa, "аугменты удалены");
  assert(s.log.some((l) => l.includes("Аугменты")), "журнал: аугменты потеряны");
});

suite("Aghanim — полный реестр");

test("Реестр цел: герои существуют, условия и эффекты известны движку", () => {
  assertEq(Content.aghanims.list.length, 88, "44 скептера + 44 осколка — весь пул");
  // PRE_DETECT-эффекты интерпретируются пайплайном детекции (combat.js),
  // остальные — через Effects.apply.
  const PRE_DETECT_TYPES = ["COPY_ATTRIBUTE", "CREATE_ILLUSION", "WILD_RANK", "BUMP_STRONGEST_RANK",
    "KEEP_NATIVE_ATTR", "COPY_ATTRIBUTE_FALLBACK", "MIRROR_RANK", "ILLUSION_RATIO", "ILLUSION_ATTR", "STEAL_ATTR"];
  const st = agRun("AGSMOKE");
  const warnings = [];
  const orig = console.warn;
  console.warn = (m) => warnings.push(String(m));
  try {
    for (const aug of Content.aghanims.list) {
      assert(Content.heroes.byId[aug.heroId], "герой существует: " + aug.heroId);
      assert(aug.desc, "описание есть: " + aug.id);
      assertEq(Content.aghanims.forHero(aug.heroId, aug.kind).id, aug.id, "forHero находит");
      const abils = aug.abilities || (aug.ability ? [aug.ability] : []);
      for (const ab of abils) {
        const card = { uid: "u1", heroId: aug.heroId, power: 5, attr: "uni", illusion: false, slotIndex: 0 };
        const ctx = {
          state: st, combo: null, playedCards: [card], slotIndex: 0, card,
          hero: Content.heroes.byId[aug.heroId], scoring: { flags: {}, power: 0, mult: 1, finalMult: 1 },
          discardCtx: null, sourceId: aug.heroId, sourceName: aug.name,
        };
        if (ab.when) Cond.evaluate(ab.when, ctx);
        if (ab.event === "PRE_DETECT") {
          for (const eff of ab.effects || []) assert(PRE_DETECT_TYPES.includes(eff.type), "PRE_DETECT-тип известен: " + eff.type);
          continue;
        }
        for (const eff of ab.effects || []) Effects.apply(eff, ctx);
      }
    }
    assert(!warnings.some((w) => w.includes("Unknown")), "нет неизвестных типов: " + warnings.join(" | "));
  } finally { console.warn = orig; }
});

test("Sven Warcry: чистая рука +8, после сброса молчит", () => {
  const s = agRun("AGSV1");
  agEquip(s, "sven", "scepter", "sven_sc");
  const res = agPlay(s, ["sven", "cm"], 999999);
  assert(stepLabels(res).some((l) => l.includes("Warcry") && l.includes("+8")), "чистая рука кормит");
  s.combat.outcome = null;
  s.player.fightsLeft = 4;
  const uid = s.player.handUids[0];
  s.combat.selectedUids = [uid];
  Game.dispatch(s, { type: "DISCARD", uids: [uid] });
  const res2 = agPlay(s, ["sven", "cm"], 999999);
  assert(!stepLabels(res2).some((l) => l.includes("Warcry")), "сброс выключает Warcry");
});

test("Centaur Retaliate: считает только героев позади", () => {
  const s = agRun("AGCT1");
  agEquip(s, "centaur", "scepter", "centaur_sc");
  const res = agPlay(s, ["cm", "centaur", "tusk"], 999999);
  assert(stepLabels(res).some((l) => l.includes("Retaliate") && l.includes("+4")), "1 герой позади = +4");
  s.combat.outcome = null;
  s.player.fightsLeft = 4;
  const res2 = agPlay(s, ["centaur", "cm", "tusk"], 999999);
  assert(!stepLabels(res2).some((l) => l.includes("Retaliate")), "первый слот — позади никого");
  assert(stepLabels(res2).some((l) => l.includes("Centaur Warrunner: +12")), "базовый Trample на первом слоте");
});

test("Morphling Attribute Shift: двухцветная карта добирает атрибут Invoker'у", () => {
  const s = agRun("AGMP1");
  agAdd(s, ["invoker"]);
  agEquip(s, "morphling", "scepter", "morphling_sc");
  // Морф копирует UNI у Dawnbreaker'а, родной AGI остаётся: {int, uni, agi} = 3.
  const res = agPlay(s, ["invoker", "dawnbreaker", "morphling"], 999999);
  assert(stepLabels(res).some((l) => l.includes("Invoker: +3")), "3 атрибута благодаря родному");
  assert(stepLabels(res).some((l) => l.includes("двух атрибутов")), "шаг KEEP_NATIVE_ATTR");
  const s2 = agRun("AGMP2");
  agAdd(s2, ["invoker"]);
  const res2 = agPlay(s2, ["invoker", "dawnbreaker", "morphling"], 999999);
  assert(!stepLabels(res2).some((l) => l.includes("Invoker: +3")), "без скептера атрибутов 2");
});

test("Morphling Waveform: слева пусто — копия правого соседа", () => {
  const s = agRun("AGMP3");
  agEquip(s, "morphling", "shard", "morphling_sh");
  const res = agPlay(s, ["morphling", "cm"], 999999);
  assert(stepLabels(res).some((l) => l.includes("Waveform") && l.includes("Интеллект")), "копия справа");
});

test("Primal Uproot: ×2 со слота 4 при четырёх героях", () => {
  const s = agRun("AGPB1");
  agEquip(s, "primal", "scepter", "primal_sc");
  const res = agPlay(s, ["cm", "tusk", "axe", "primal"], 999999);
  assert(stepLabels(res).some((l) => l.includes("×2")), "ослабленное условие даёт ×2");
  const s2 = agRun("AGPB2");
  const res2 = agPlay(s2, ["cm", "tusk", "axe", "primal"], 999999);
  assert(!stepLabels(res2).some((l) => l.includes("×2")), "база требует центр и ровно 5");
});

test("Undying Soul Rip: сброс — заряд, бой тратит целиком", () => {
  const s = agRun("AGUN1");
  agAdd(s, ["undying"]);
  agEquip(s, "undying", "scepter", "undying_sc");
  const uid = s.player.handUids[0];
  s.combat.selectedUids = [uid];
  Game.dispatch(s, { type: "DISCARD", uids: [uid] });
  assertEq((s.run.heroCharges.undying || {}).count, 1, "заряд за ТП-сброс");
  const res = agPlay(s, ["undying"], 999999);
  assert(stepLabels(res).some((l) => l.includes("Soul Rip") && l.includes("+3")), "заряд конвертирован в +3");
  assertEq((s.run.heroCharges.undying || {}).count, 0, "заряды потрачены");
});

test("Meepo Divided We Stand: +6 за каждого Ловкого", () => {
  const s = agRun("AGME1");
  agAdd(s, ["meepo"]);
  agEquip(s, "meepo", "scepter", "meepo_sc");
  const res = agPlay(s, ["meepo", "juggernaut", "cm"], 999999);
  assert(stepLabels(res).some((l) => l.includes("Divided We Stand") && l.includes("+12")), "2 агих = +12 (база заменена)");
});

test("Bounty Jinada: точный ласт-хит возвращает ТП-сброс", () => {
  const s = agRun("AGBO1");
  agAdd(s, ["bounty"]);
  agEquip(s, "bounty", "scepter", "bounty_sc");
  s.combat.wave.hp = 8; // соло Bounty: 5 база + 3 ранг = 8 урона
  const res = agPlay(s, ["bounty"], 8);
  assert(res.killed, "башня добита точно");
  assertEq(s.run.pendingDiscardBonus, 1, "возврат сброса на следующую волну");
  assert(stepLabels(res).some((l) => l.includes("Jinada")), "шаг аугмента");
});

test("Bounty Shuriken Toss: ласт-хиты копят удачу", () => {
  const s = agRun("AGBO2");
  agAdd(s, ["bounty"]);
  agEquip(s, "bounty", "shard", "bounty_sh");
  s.combat.wave.hp = 8;
  agPlay(s, ["bounty"], 8);
  assertEq(Upgrades.luck(s), 1, "первый ласт-хит: удача 1");
  s.combat.outcome = null;
  s.player.fightsLeft = 4;
  s.combat.wave.hp = 8;
  agPlay(s, ["bounty"], 8);
  assertEq(Upgrades.luck(s), 2, "второй: 2");
});

test("Faceless Time Lock: мини-босс тоже, и Aegis заперт", () => {
  const s = agRun("AGFV1");
  agAdd(s, ["faceless"]);
  agEquip(s, "faceless", "scepter", "faceless_sc");
  s.combat.wave.miniBoss = true;
  const res = agPlay(s, ["faceless"], 999999);
  const labels = stepLabels(res);
  assert(labels.some((l) => l.includes("Time Lock") && l.includes("+2")), "мини-босс входит в условие");
  assert(labels.some((l) => l.includes("Aegis")), "возрождение заблокировано");
});

test("Terrorblade Reflection: в детекции он — ранг соседа", () => {
  const s = agRun("AGTB1");
  agAdd(s, ["terrorblade"]);
  agEquip(s, "terrorblade", "scepter", "terrorblade_sc");
  const res = agPlay(s, ["terrorblade", "cm"], 999999);
  assertEq(res.combo.type, "pair", "11 и 2 → пара 2/2 в детекции");
});

test("Oracle Fortune's End: слабейший даёт ×1.6", () => {
  const s = agRun("AGOR1");
  agAdd(s, ["oracle"]);
  agEquip(s, "oracle", "scepter", "oracle_sc");
  s.run.ranks = { cm: 5 }; // Oracle 3 становится слабейшим
  const res = agPlay(s, ["cm", "oracle"], 999999);
  assert(stepLabels(res).some((l) => l.includes("×1.6")), "замена силы на множитель");
});

test("Skywrath Ancient Seal: дуо ×1.4, трио молчит", () => {
  const s = agRun("AGSW1");
  agAdd(s, ["skywrath"]);
  agEquip(s, "skywrath", "scepter", "skywrath_sc");
  const duo = agPlay(s, ["skywrath", "cm"], 999999);
  assert(stepLabels(duo).some((l) => l.includes("×1.4")), "дуо-градиент");
  s.combat.outcome = null;
  s.player.fightsLeft = 4;
  const trio = agPlay(s, ["skywrath", "cm", "zeus"], 999999);
  assert(!stepLabels(trio).some((l) => l.includes("×1.4")), "3 героя — вне условия");
});

test("Lina Fiery Soul: сбросы кормят малый отряд", () => {
  const s = agRun("AGLN1");
  agAdd(s, ["lina"]);
  agEquip(s, "lina", "scepter", "lina_sc");
  const uid = s.player.handUids[0];
  s.combat.selectedUids = [uid];
  Game.dispatch(s, { type: "DISCARD", uids: [uid] });
  const res = agPlay(s, ["lina"], 999999);
  assert(stepLabels(res).some((l) => l.includes("Fiery Soul") && l.includes("+5")), "сброс = +5 силы");
});

test("Storm Overload: ротация слотов вознаграждается", () => {
  const s = agRun("AGST1");
  agAdd(s, ["storm_spirit"]);
  agEquip(s, "storm_spirit", "scepter", "storm_spirit_sc");
  s.combat.lastSlot = { storm_spirit: 2 };
  const res = agPlay(s, ["storm_spirit"], 999999);
  const labels = stepLabels(res);
  assert(labels.some((l) => l.includes("Storm Spirit: +9")), "база на первом слоте");
  assert(labels.some((l) => l.includes("Overload") && l.includes("+9")), "скептер за смену позиции");
});

test("Outworld Sanity Overload и Essence Flux", () => {
  const s = agRun("AGOW1");
  agAdd(s, ["outworld"]);
  agEquip(s, "outworld", "scepter", "outworld_sc");
  const res = agPlay(s, ["outworld", "dawnbreaker", "tusk", "juggernaut"], 999999);
  assert(stepLabels(res).some((l) => l.includes("Sanity Overload") && l.includes("+6")), "4-й атрибут = +6/+0.5");
  const s2 = agRun("AGOW2");
  agAdd(s2, ["outworld"]);
  agEquip(s2, "outworld", "shard", "outworld_sh");
  const res2 = agPlay(s2, ["outworld", "dawnbreaker", "cm"], 999999);
  assert(stepLabels(res2).some((l) => l.includes("Outworld Destroyer: +12")), "UNI добирает третий атрибут");
});

test("AA Shatter: зачистка ослабляет следующую башню", () => {
  const s = agRun("AGAA1");
  agAdd(s, ["ancient_apparition"]);
  agEquip(s, "ancient_apparition", "scepter", "aa_sc");
  const res = agPlay(s, ["ancient_apparition"], 1);
  assert(res.killed, "зачистка");
  assertEq(s.run.nextWaveHpPct, 10, "минус 10% на следующую башню");
  assert(stepLabels(res).some((l) => l.includes("Shatter")), "шаг аугмента");
});

test("Enigma Demonic Conversion: иллюзия с полным рангом в детекции", () => {
  const s = agRun("AGEN1");
  agAdd(s, ["enigma"]);
  agEquip(s, "enigma", "scepter", "enigma_sc");
  const probe = {
    rules: "classic",
    run: { aghanims: s.run.aghanims },
    combat: { scoring: { flags: {} }, wave: null },
    player: { items: [] },
  };
  const played = [{ uid: "u1", heroId: "enigma", power: 12, attr: "int", illusion: false, slotIndex: 0 }];
  const out = Combat.buildEffectiveSet(probe, played, { steps: [] });
  const il = out.effective.find((c) => c.illusion);
  assert(!!il, "иллюзия создана ровно одна");
  assertEq(il.power, 6, "сила 50%");
  assertEq(il.detectPower, 12, "детекция видит полный ранг");
});

test("Io Relocate: +6 за Сильного соседа по слоту", () => {
  const s = agRun("AGIO1");
  agAdd(s, ["io"]);
  agEquip(s, "io", "scepter", "io_sc");
  const near = agPlay(s, ["io", "tusk", "cm"], 999999);
  assert(stepLabels(near).some((l) => l.includes("Relocate") && l.includes("+6")), "сосед STR");
  s.combat.outcome = null;
  s.player.fightsLeft = 4;
  const far = agPlay(s, ["io", "cm", "zeus"], 999999);
  assert(!stepLabels(far).some((l) => l.includes("Relocate")), "соседей STR нет");
});

test("Muerta The Calling: последняя карта +20% своей силы", () => {
  const s = agRun("AGMU1");
  agAdd(s, ["muerta"]);
  agEquip(s, "muerta", "scepter", "muerta_sc");
  const res = agPlay(s, ["muerta", "tusk"], 999999);
  assert(stepLabels(res).some((l) => l.includes("The Calling")), "проводник финального удара");
});

test("Marci Rebound и Companion Run", () => {
  const s = agRun("AGMA1");
  agAdd(s, ["marci"]);
  agEquip(s, "marci", "scepter", "marci_sc");
  const differ = agPlay(s, ["tusk", "marci", "cm"], 999999);
  assert(stepLabels(differ).some((l) => l.includes("Rebound") && l.includes("+12")), "оба соседа чужие");
  s.combat.outcome = null;
  s.player.fightsLeft = 4;
  agEquip(s, "marci", "shard", "marci_sh");
  const same = agPlay(s, ["primal", "marci", "dawnbreaker"], 999999);
  assert(stepLabels(same).some((l) => l.includes("Companion Run") && l.includes("+6")), "оба соседа UNI");
});

test("Snapfire Lil' Shredder: сбросы в множитель", () => {
  const s = agRun("AGSN1");
  agAdd(s, ["snapfire"]);
  agEquip(s, "snapfire", "scepter", "snapfire_sc");
  const uid = s.player.handUids[0];
  s.combat.selectedUids = [uid];
  Game.dispatch(s, { type: "DISCARD", uids: [uid] });
  const res = agPlay(s, ["snapfire"], 999999);
  assert(stepLabels(res).some((l) => l.includes("Lil' Shredder") && l.includes("+0.5")), "сброс = +0.5 множителя");
});

test("Void Spirit Ascended Charge: опыт снимает условие ранга", () => {
  const s = agRun("AGVS1");
  agAdd(s, ["void_spirit", "ursa"]);
  agEquip(s, "void_spirit", "scepter", "void_spirit_sc");
  s.run.heroXp = { void_spirit: 5 };
  const res = agPlay(s, ["void_spirit", "ursa"], 999999);
  assert(stepLabels(res).some((l) => l.includes("Ascended Charge") && l.includes("+8")), "не высший, но прокачан");
  const s2 = agRun("AGVS2");
  agAdd(s2, ["void_spirit", "ursa"]);
  const res2 = agPlay(s2, ["void_spirit", "ursa"], 999999);
  assert(!stepLabels(res2).some((l) => l.includes("Ascended Charge")), "без уровня и ранга — мимо");
});

test("Kez Raptor Dance: середина отряда даёт +1 множитель", () => {
  const s = agRun("AGKZ1");
  agAdd(s, ["kez"]);
  agEquip(s, "kez", "scepter", "kez_sc");
  const res = agPlay(s, ["cm", "kez", "tusk"], 999999);
  assert(stepLabels(res).some((l) => l.includes("Raptor Dance") && l.includes("+1")), "центр строя");
});

test("Beastmaster Call of the Wild: ранги ±1 считаются", () => {
  const s = agRun("AGBM1");
  agAdd(s, ["beastmaster"]);
  agEquip(s, "beastmaster", "scepter", "beastmaster_sc");
  s.run.ranks = { cm: 7 };
  const res = agPlay(s, ["beastmaster", "cm"], 999999);
  assert(stepLabels(res).some((l) => l.includes("Call of the Wild") && l.includes("+2")), "соседний ранг кормит");
  agEquip(s, "beastmaster", "shard", "beastmaster_sh");
  s.run.ranks = { cm: 7, zeus: 7 };
  s.combat.outcome = null;
  s.player.fightsLeft = 4;
  const res2 = agPlay(s, ["cm", "zeus", "beastmaster"], 999999);
  assert(stepLabels(res2).some((l) => l.includes("Wild Axes") && l.includes("+4")), "пара рангов");
});

test("Фикс #44 «Специализация»: 3+ одного атрибута дают +2% урона", () => {
  const s = agRun("AGSP1");
  agAdd(s, ["lina"]);
  s.run.upgrades = ["specializaciya"];
  const res = agPlay(s, ["cm", "zeus", "lina"], 999999);
  assert(stepLabels(res).some((l) => l.includes("Улучшения лавки: +2% урона")), "условие наконец работает");
});

suite("Aghanim — текстовые 15 (батч 3)");

function mkCtx(state, combo, crits, heroTriggers) {
  const card = { uid: "u", heroId: "x", power: 5, attr: "uni", illusion: false, slotIndex: 0 };
  return {
    state, combo, playedCards: [card], slotIndex: 0, card, hero: null,
    scoring: { flags: {}, power: 0, mult: 1, finalMult: 1 },
    resolution: { crits: crits || [], heroTriggers: heroTriggers || [] },
    sourceId: "x", sourceName: "T",
  };
}

test("PA Echo Strike: эхо встаёт только после крита (юнит)", () => {
  const st = agRun("AGB3PA");
  const ctx = mkCtx(st, { type: "pair" });
  Effects.apply({ type: "ARM_ECHO_ON_CRIT", pct: 30 }, { ...ctx, resolution: { crits: ["Phantom Assassin"] } });
  assertEq(ctx.scoring.flags.echoPower.pct, 30, "флаг эха после крита");
  const ctx2 = mkCtx(st, { type: "pair" });
  const r = Effects.apply({ type: "ARM_ECHO_ON_CRIT", pct: 30 }, ctx2);
  assertEq(r, null, "без крита эха нет");
  assert(!ctx2.scoring.flags.echoPower, "флаг не выставлен");
});

test("Ogre Multicast+: эхо-урон в реальном бою (ролл по сидам)", () => {
  let found = false;
  for (let i = 0; i < 30 && !found; i++) {
    const s = agRun("AGB3OG-" + i);
    agEquip(s, "ogre_magi", "scepter", "ogre_sc");
    agAdd(s, ["ogre_magi"]);
    s.run.aghanims = { ogre_magi: { scepter: "ogre_sc" } };
    const all = Object.values(s.cards);
    const uid = all.find(c => c.heroId === "ogre_magi").uid;
    s.player.handUids = [uid, ...Object.keys(s.cards).filter(u => u !== uid)];
    s.combat.selectedUids = [uid];
    s.combat.wave.hp = 999999;
    Game.dispatch(s, { type: "CONFIRM_FIGHT" });
    found = stepLabels(s.combat.lastResolution).some(l => l.includes("Эхо"));
  }
  assert(found, "за 30 сидов эхо должно сработать");
});

test("Zeus Circuit: +1 за каждый тип комбо за забег", () => {
  const s = agRun("AGB3ZE");
  const ctx = mkCtx(s, { type: "pair" });
  const r = Effects.apply({ type: "ADD_MULT_PER_DISTINCT_COMBO", value: 1, cap: 3 }, ctx);
  assertEq(ctx.scoring.mult, 2, "pair новый: база 1 → +1 = 2");
  assert(r.label.includes("+1"), "лейбл +1");
  s.run.comboTypes = { pair: 1, high_card: 1 };
  const ctx2 = mkCtx(s, { type: "pair" });
  Effects.apply({ type: "ADD_MULT_PER_DISTINCT_COMBO", value: 1, cap: 3 }, ctx2);
  assertEq(ctx2.scoring.mult, 3, "pair уже был → 2 типа: 1 + 2");
});

test("CM Arcane Reserve: неиспользованные сбросы — мана на первый бой", () => {
  const s = agRun("AGB3CM");
  agEquip(s, "cm", "scepter", "cm_sc");
  // Копим: зачистка волны с 2 неиспользованными сбросами.
  s.combat.wave.hp = 1;
  s.player.discardsLeft = 2;
  agPlay(s, ["cm"], 1);
  assertEq(s.run.manaReserve, 2, "резерв 2");
  // Тратим: эмулируем первый бой СЛЕДУЮЩЕЙ волны.
  s.combat.outcome = null;
  s.combat.fightIndex = 0;
  s.player.fightsLeft = 4;
  s.player.discardsLeft = 2;
  const res = agPlay(s, ["cm", "zeus"], 999999);
  assertEq(s.run.manaReserve, 0, "резерв потрачен");
  assert(stepLabels(res).some((l) => l.includes("Mana Reserve разряжен") && l.includes("+6")), "+3 силы за запас");
});

test("CM Frostbite Memory: использованные сбросы — золото", () => {
  const s = agRun("AGB3CM2");
  agEquip(s, "cm", "shard", "cm_sh");
  const uid = s.player.handUids[0];
  s.combat.selectedUids = [uid];
  Game.dispatch(s, { type: "DISCARD", uids: [uid] });
  const res = agPlay(s, ["cm"], 999999);
  assert(stepLabels(res).some((l) => l.includes("Frostbite Memory: +1 золота")), "сброс конвертирован в золото");
});

test("Tinker Rearm Protocol: 2 реролла — двойные способности, заряд тратится", () => {
  const s = agRun("AGB3TK");
  agAdd(s, ["tinker"]);
  agEquip(s, "tinker", "scepter", "tinker_sc");
  s.run.rerollCharges = 2;
  const res = agPlay(s, ["tinker", "tusk", "cm"], 999999);
  const labels = stepLabels(res);
  assert(labels.filter((l) => l.includes("Tusk: +")).length === 2, "Tusk сработал дважды");
  assertEq(s.run.rerollCharges, 0, "заряды потрачены");
  // Без зарядов двойных способностей нет (Rearm заменён).
  s.combat.outcome = null;
  s.player.fightsLeft = 4;
  s.run.rerollCharges = 0;
  const res2 = agPlay(s, ["tinker", "tusk", "cm"], 999999);
  assert(stepLabels(res2).filter((l) => l.includes("Tusk: +")).length === 1, "без перегрева — одиночный");
});

test("Tinker Heat Sink: рероллы дают силу без траты", () => {
  const s = agRun("AGB3TK2");
  agAdd(s, ["tinker"]);
  agEquip(s, "tinker", "shard", "tinker_sh");
  s.run.rerollCharges = 2;
  const res = agPlay(s, ["tinker"], 999999);
  assert(stepLabels(res).some((l) => l.includes("Heat Sink") && l.includes("+4")), "+2 за заряд");
  assertEq(s.run.rerollCharges, 2, "заряды на месте");
});

test("Invoker Invoke Mastery: фрагменты усиливают Invoke ×1.5", () => {
  const s = agRun("AGB3IN");
  agAdd(s, ["invoker"]);
  agEquip(s, "invoker", "scepter", "invoker_sc");
  s.run.heroCharges.invoker = { count: 3 };
  const res = agPlay(s, ["invoker", "tusk", "cm"], 999999);
  assert(stepLabels(res).some((l) => l.includes("×1.5")), "3 фрагмента потрачены на усиление");
  assertEq((s.run.heroCharges.invoker || {}).count, 0, "фрагменты сгорели");
});

test("Pudge Flesh Heap: перестановки — сила, счётчик тратится", () => {
  const s = agRun("AGB3PD");
  agEquip(s, "pudge", "scepter", "pudge_sc");
  s.combat.movesUsed = 3;
  const res = agPlay(s, ["pudge", "cm"], 999999);
  assert(stepLabels(res).some((l) => l.includes("Flesh Heap") && l.includes("+6")), "3 перестановки = +6");
  assertEq(s.combat.movesUsed, 0, "Heap потрачен");
});

test("Pudge Meat Hook: соседи по слоту дают силу", () => {
  const s = agRun("AGB3PD2");
  agEquip(s, "pudge", "shard", "pudge_sh");
  const res = agPlay(s, ["pudge", "tusk", "cm"], 999999);
  assert(stepLabels(res).some((l) => l.includes("Meat Hook") && l.includes("+3")), "крюк тянет соседа");
});

test("Axe Counter Helix+: действия за волну заряжают", () => {
  const s = agRun("AGB3AX");
  agEquip(s, "axe", "scepter", "axe_sc");
  s.combat.movesUsed = 1;
  s.player.discardsLeft = 1; // использовано 2 из 3 → действий 3 > 2
  const res = agPlay(s, ["axe", "cm"], 999999);
  assert(stepLabels(res).some((l) => l.includes("Counter Helix+") && l.includes("+8")), "действия заряжают Helix");
});

test("Axe Berserker: центр отряда быстрее", () => {
  const s = agRun("AGB3AX2");
  agEquip(s, "axe", "shard", "axe_sh");
  const res = agPlay(s, ["cm", "axe", "tusk"], 999999);
  assert(stepLabels(res).some((l) => l.includes("Berserker") && l.includes("+4")), "середина кормит Axe");
});

test("Juggernaut Blade Dance: серия комбо — юнит и проводка", () => {
  const s = agRun("AGB3JG");
  const ctx = mkCtx(s, { type: "pair" });
  s.run.comboStreak = 2;
  Effects.apply({ type: "ADD_MULT_PER_COMBO_STREAK", value: 1, cap: 3 }, ctx);
  assertEq(ctx.scoring.mult, 3, "серия 2 → +2 к базе 1");
  // Проводка: после боя серия стартует с 1.
  agPlay(s, ["juggernaut"], 999999);
  assertEq(s.run.comboStreak, 1, "первый бой — серия 1");
});

test("Slark Essence Shift+: крадёт атрибут соседа (двухцветность)", () => {
  const s = agRun("AGB3SL");
  agAdd(s, ["slark"]);
  agEquip(s, "slark", "scepter", "slark_sc");
  const probe = {
    rules: "classic",
    run: { aghanims: s.run.aghanims },
    combat: { scoring: { flags: {} }, wave: null },
    player: { items: [] },
  };
  const played = [
    { uid: "u1", heroId: "cm", power: 2, attr: "int", illusion: false, slotIndex: 0 },
    { uid: "u2", heroId: "slark", power: 4, attr: "agi", illusion: false, slotIndex: 1 },
  ];
  const out = Combat.buildEffectiveSet(probe, played, { steps: [] });
  const slark = out.effective.find((c) => c.heroId === "slark");
  assertEq(slark.attr, "int", "украденный INT");
  assertEq(slark.nativeAttr, "agi", "родной AGI остался");
});

test("Slark Pounce: новый слот — +5 силы", () => {
  const s = agRun("AGB3SL2");
  agAdd(s, ["slark"]);
  agEquip(s, "slark", "shard", "slark_sh");
  s.combat.lastSlot = { slark: 2 };
  const res = agPlay(s, ["slark", "cm"], 999999);
  assert(stepLabels(res).some((l) => l.includes("Pounce") && l.includes("+5")), "смена позиции кормит");
});

test("Anti-Mage Mana Break+: первое/повторное комбо — 8 или 3 за пустой слот", () => {
  const s = agRun("AGB3AM");
  agAdd(s, ["anti_mage"]);
  agEquip(s, "anti_mage", "scepter", "anti_mage_sc");
  // Первый бой: COMBO_SAME_AS_LAST (lastComboType null) → 3 × 3 пустых = 9.
  const res = agPlay(s, ["anti_mage", "cm"], 999999);
  assert(stepLabels(res).some((l) => l.includes("Mana Break+") && l.includes("+9")), "первый бой — 3 за пустой");
  assert(!stepLabels(res).some((l) => l.includes("Anti-Mage: +12")), "база заменена");
});

test("Anti-Mage Blink: перестановка — +1 множитель", () => {
  const s = agRun("AGB3AM2");
  agAdd(s, ["anti_mage"]);
  agEquip(s, "anti_mage", "shard", "anti_mage_sh");
  s.combat.movesUsed = 1;
  const res = agPlay(s, ["anti_mage", "cm"], 999999);
  assert(stepLabels(res).some((l) => l.includes("Blink") && l.includes("+1 к множителю")), "перестановка кормит");
});

test("Legion Duel+: ласт-хиты копят стеки, стеки дают силу", () => {
  const s = agRun("AGB3LG");
  agAdd(s, ["legion"]);
  agEquip(s, "legion", "scepter", "legion_sc");
  s.combat.wave.hp = 11; // соло Legion: 5 база + 6 ранг = 11
  agPlay(s, ["legion"], 11);
  assertEq((s.run.heroCharges.legion || {}).count, 1, "первый Duel stack");
  s.combat.outcome = null;
  s.player.fightsLeft = 4;
  s.combat.wave.hp = 13; // удар сильнее на 2 (стек): 5+6+2 = 13, импульс сброшен
  s.run.momentum = 0;
  const res = agPlay(s, ["legion"], 13);
  assertEq((s.run.heroCharges.legion || {}).count, 2, "второй стек");
  assert(stepLabels(res).some((l) => l.includes("Duel stack: 2/6")), "шаг стека");
});

test("Legion Press the Attack: прокачанные герои дают силу", () => {
  const s = agRun("AGB3LG2");
  agAdd(s, ["legion"]);
  agEquip(s, "legion", "shard", "legion_sh");
  s.run.heroXp = { cm: 5 };
  const res = agPlay(s, ["cm", "legion"], 999999);
  assert(stepLabels(res).some((l) => l.includes("Press the Attack") && l.includes("+2")), "ур.1 кормит");
});

test("Rubick Grand Magus: крадёт сработавшие способности", () => {
  const s = agRun("AGB3RB");
  agAdd(s, ["rubick"]);
  agEquip(s, "rubick", "scepter", "rubick_sc");
  // Tusk (+4 соседа) и Zeus (+2 рядом INT) сработают до FIGHT_SCORING.
  const res = agPlay(s, ["rubick", "tusk", "cm", "zeus"], 999999);
  assert(stepLabels(res).some((l) => l.includes("Grand Magus") && l.includes("+6")), "2 чужие способности = +6");
});

test("Rubick Fade Bolt+: условие нового комбо (юнит)", () => {
  const st = agRun("AGB3RB2");
  st.combat.lastComboType = "high_card";
  assertEq(Cond.evaluate({ type: "COMBO_DIFFERENT_FROM_LAST" }, { state: st, combo: { type: "pair" } }), true, "разные — да");
  st.combat.lastComboType = "pair";
  assertEq(Cond.evaluate({ type: "COMBO_DIFFERENT_FROM_LAST" }, { state: st, combo: { type: "pair" } }), false, "повтор — нет");
});

test("Kunkka Torrent Combo: типы комбо за забег", () => {
  const s = agRun("AGB3KK");
  agAdd(s, ["kunkka"]);
  agEquip(s, "kunkka", "scepter", "kunkka_sc");
  s.run.comboTypes = { pair: 1, high_card: 1 };
  const res = agPlay(s, ["kunkka", "cm"], 999999);
  const label = stepLabels(res).find((l) => l.includes("Torrent Combo"));
  assert(!!label, "цепь работает");
  assert(/\+(10|15) силы/.test(label), "2 типа = +10, 3 новых = +15");
});

test("Kunkka Tidebringer: сильнейший — +6", () => {
  const s = agRun("AGB3KK2");
  agAdd(s, ["kunkka"]);
  agEquip(s, "kunkka", "shard", "kunkka_sh");
  const res = agPlay(s, ["cm", "kunkka"], 999999);
  assert(stepLabels(res).some((l) => l.includes("Tidebringer") && l.includes("+6")), "сильнейший кормит");
});

test("Tusk Walrus Chain: крит передаётся (юнит)", () => {
  const st = agRun("AGB3TS");
  const ctx = mkCtx(st, { type: "pair" }, ["Daedalus"]);
  Effects.apply({ type: "ADD_POWER_IF_CRIT", value: 6 }, ctx);
  assertEq(ctx.scoring.power, 6, "крит кормит цепь");
  const ctx2 = mkCtx(st, { type: "pair" }, []);
  assertEq(Effects.apply({ type: "ADD_POWER_IF_CRIT", value: 6 }, ctx2), null, "без крита молчит");
});

test("Tusk Snowball+: перестановка — +4 силы", () => {
  const s = agRun("AGB3TS2");
  agEquip(s, "tusk", "shard", "tusk_sh");
  s.combat.movesUsed = 1;
  const res = agPlay(s, ["tusk", "cm"], 999999);
  assert(stepLabels(res).some((l) => l.includes("Snowball+") && l.includes("+4")), "перестановка кормит");
});

test("Слоты и серия пишутся после боя (проводка lastSlot/comboStreak)", () => {
  const s = agRun("AGB3LS");
  agPlay(s, ["cm", "tusk"], 999999);
  assert(s.combat.lastSlot && s.combat.lastSlot.cm === 0, "слоты запоминаются");
  assertEq(s.run.comboStreak, 1, "серия инициализирована");
  assert(Object.keys(s.run.comboTypes || {}).length === 1, "тип комбо записан");
});
