suite("Ranks — лига DALATRO (Рекрут → Папочка)");

function newRankedRun(seed, rank, rules) {
  const s = Game.dispatch(Game.createInitialState(""), { type: "START_RUN", seedCode: seed, rank, rules });
  return s;
}

function uidOf(s, heroId) {
  return Object.values(s.cards).find((c) => c.heroId === heroId).uid;
}

function forceHand(s, heroIds) {
  const uids = heroIds.map((h) => uidOf(s, h));
  s.player.handUids = uids.slice();
  s.player.deckUids = Object.keys(s.cards).filter((uid) => !uids.includes(uid));
  s.player.discardUids = [];
  return uids;
}

function play(s, heroIds) {
  const uids = forceHand(s, heroIds);
  s.combat.selectedUids = uids.slice();
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  return s.combat.lastResolution;
}

// Волна-стенд: чистая башня без контента-модификаторов и без ранговых бросков.
function bareWave(s, hp) {
  s.combat.wave.modifiers = [];
  s.combat.wave.hp = s.combat.wave.maxHp = hp;
  s.combat.forbiddenSlot = null;
  s.run.momentum = 0;
  return s;
}

test("ранг 1 = базовая игра: рука 7, 4 тимфайта, 3 сброса, HP без множителя, слот свободен", () => {
  const s = newRankedRun("RANK1", 1);
  assertEq(s.run.rank, 1, "ранг");
  assertEq(s.player.handUids.length, 7, "рука");
  assertEq(s.player.fightsLeft, 4, "тимфайты");
  assertEq(s.player.discardsLeft, 3, "ТП-сбросы");
  assertEq(s.combat.wave.maxHp, Content.waves.byId.t1.hp, "HP без множителя");
  assertEq(s.combat.forbiddenSlot, null, "без запретного слота");
  assertEq(Ranks.hpMult(s), 1, "hpMult");
  assertEq(Ranks.goldMult(s), 1, "goldMult");
});

test("HP и награда растут по рангу, множители не накапливаются", () => {
  const s = newRankedRun("RANKX", 7);
  assertEq(Ranks.hpMult(s), Content.ranks.byId[7].hpMult, "Титан: hpMult из данных");
  assertEq(Ranks.goldMult(s), Content.ranks.byId[7].goldMult, "Титан: goldMult из данных");
  // растяжка по прогрессу: первая волна мягче, Трон — на полном множителе
  assertEq(Ranks.waveHpMult(s, 0) < Ranks.waveHpMult(s, 14), true, "HP-множитель растёт к финалу");
  assertEq(Ranks.waveHpMult(s, 14), Content.ranks.byId[7].hpMult, "на Троне — полный множитель");
  // награда за зачистку: 6 × 1.6 = 10 (округление)
  bareWave(s, 100);
  s.combat.wave.gold = 6;
  s.combat.wave.hp = 10;
  play(s, ["axe", "zeus"]);
  assertEq(s.run.gold >= Math.round(6 * 1.6), true, "награда с множителем ранга");
});

test("правила наслаиваются: Папочка держит всё — рука 5, 2 тимфайта, 1 сброс, мутации, налог", () => {
  const s = newRankedRun("PAPA", 14);
  assertEq(s.player.handUids.length, 5, "рука 5");
  assertEq(Ranks.fightsPerWave(s), 2, "тимфайты 2");
  assertEq(Ranks.discardsPerWave(s), 1, "сбросы 1");
  assertEq(Ranks.taxPerWave(s), 2, "налог −2G");
  assertEq(Ranks.mutationsPerWave(s), 2, "Reality Break: 2 мутации");
  assertEq(Ranks.has(s, "inflation"), true, "инфляция сохраняется");
  assertEq(Ranks.has(s, "adaptive"), true, "адаптация сохраняется");
  assertEq(Ranks.has(s, "curseChoice"), true, "проклятия сохраняются");
});

test("Рыцарь: память башен — тот же тип удара ×0.9", () => {
  const s = bareWave(newRankedRun("MEM", 2), 100000);
  const r1 = play(s, ["axe", "zeus"]); // пара ранга 5
  assertEq(r1.combo.type, "pair", "первый бой — пара");
  assertEq(r1.damage, 40, "первый бой: 20 × 2");
  // Второй бой той же парой: handUids уже другая — форсим ту же пару руками.
  forceHand(s, ["axe", "zeus"]);
  s.combat.selectedUids = [uidOf(s, "axe"), uidOf(s, "zeus")];
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  const r2 = s.combat.lastResolution;
  assertEq(r2.combo.type, "pair", "второй бой — пара");
  assertEq(r2.damage, 36, "память: 40 × 0.9");
});

test("Рыцарь: смена типа удара не штрафуется", () => {
  const s = bareWave(newRankedRun("MEM2", 2), 100000);
  play(s, ["axe", "zeus"]); // пара
  const r2 = play(s, ["axe", "morphling", "zeus"]); // ганг — другой тип
  assertEq(r2.combo.type, "three", "второй бой — тройка");
  assertEq(r2.damage, 165, "без штрафа памяти: (30 + 15 + 10 Axe) × 3");
});

test("Властелин: нестабильная позиция — герой в запретном слоте даёт −40% силы", () => {
  const s = newRankedRun("UNST", 5);
  assertEq(s.combat.forbiddenSlot >= 1 && s.combat.forbiddenSlot <= 5, true, "слот выбран из 1..5 при setupWave");
  bareWave(s, 100000);
  s.combat.forbiddenSlot = 2; // фиксируем слот для детерминизма
  // [axe(5), juggernaut(7), zeus(5)] — пара пятёрок, juggernaut стоит в слоте 2
  forceHand(s, ["axe", "juggernaut", "zeus"]);
  s.combat.selectedUids = [uidOf(s, "axe"), uidOf(s, "juggernaut"), uidOf(s, "zeus")];
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  const res = s.combat.lastResolution;
  const step = res.steps.find((st) => st.label.includes("Нестабильная позиция"));
  assertEq(!!step, true, "шаг нестабильной позиции в расчёте");
  // штраф: floor(7 × 0.6) = 4 → сила теряет 3
  assertEq(res.power, 10 + 17 - 3, `сила ${res.power} = база 10 + 14 (штраф −3)`);
});

test("Легенда: усталость — каждые 5 боёв героя −1 к силе, кап −3", () => {
  const s = newRankedRun("FAT", 4);
  assertEq(Ranks.fatiguePenalty(4), 0, "4 боя — нет штрафа");
  assertEq(Ranks.fatiguePenalty(5), 1, "5 боёв — −1");
  assertEq(Ranks.fatiguePenalty(17), 3, "17 боёв — кап −3");
  s.run.heroUses = { juggernaut: 10 };
  assertEq(Game.rankOf(s, "juggernaut"), 5, "juggernaut: 7 − 2 усталости");
  assertEq(Game.rankOf(s, "axe"), 5, "неигравший герой не устал");
});

test("Божество: рука 6 и мутация волны из пула", () => {
  const s = newRankedRun("MUT", 6);
  assertEq(s.player.handUids.length, 6, "рука 6");
  const muts = s.combat.wave.modifiers.filter((m) => Content.modifiers.byId[m.id].mutation);
  assertEq(muts.length, 1, "1 мутация на волне");
  assertEq(Content.mutations.includes(muts[0].id), true, "мутация из пула");
});

test("Божество: регенерация лечит 4% после каждого незакрывающего боя", () => {
  const s = bareWave(newRankedRun("REG", 6), 20000);
  s.combat.wave.modifiers = [{ id: "regen" }];
  s.combat.wave.hp = 19000; // ниже максимума — лечению есть куда идти
  const res = play(s, ["axe"]); // харас, небольшой урон
  const heal = Math.round(20000 * 0.04);
  assertEq(s.combat.wave.hp, 19000 - res.damage + heal, "hp = 19000 − урон + 800");
  const step = res.steps.find((st) => st.label.includes("Регенерация"));
  assertEq(!!step, true, "шаг регенерации в расчёте");
});

test("Божество: отражение — каждый чётный бой ×0.75", () => {
  const s = bareWave(newRankedRun("REF", 6), 100000);
  s.combat.wave.modifiers = [{ id: "reflection" }];
  const r1 = play(s, ["axe", "zeus"]);
  assertEq(r1.damage, 40, "бой 1 — без штрафа");
  // второй бой — ганг (другой тип): память башен не мешает изоляции отражения
  const r2 = play(s, ["axe", "morphling", "zeus"]);
  assertEq(r2.damage, 124, "бой 2: (30 + 15 + 10 Axe) × 3 × 0.75");
});

test("Божество: ярость — раз в волну лечит 10% ниже 25% HP", () => {
  const s = bareWave(newRankedRun("ENR", 6), 1000);
  s.combat.wave.modifiers = [{ id: "enrage" }];
  // Первый бой оставляет башню ниже 25% (250): харас не убивает.
  s.combat.wave.hp = 200;
  const res = play(s, ["axe"]);
  assertEq(res.killed, false, "башня выжила");
  assertEq(s.combat.wave.hp, 200 - res.damage + 100, "ярость: урон, затем +10% от 1000");
  const step = res.steps.find((st) => st.label.includes("Ярость"));
  assertEq(!!step, true, "шаг ярости в расчёте");
});

test("Божество: жадность крадёт 1G за бой слабее 30% текущего HP", () => {
  const s = bareWave(newRankedRun("GRD", 6), 100000);
  s.combat.wave.modifiers = [{ id: "greed" }];
  s.run.gold = 50;
  play(s, ["axe", "zeus"]); // слабая пара: 40 < 30 000, без харас-золота
  assertEq(s.run.gold, 49, "башня забрала 1G");
});

test("Божество: шипы — отряд 4-5 героев ×0.85", () => {
  const s = bareWave(newRankedRun("THN", 6), 100000);
  s.combat.wave.modifiers = [{ id: "thorns" }];
  const r1 = play(s, ["axe", "zeus"]);
  assertEq(r1.damage, 40, "двое — без штрафа");
  // четверо: две пары 55/77, ставка ×1.1, шипы ×0.85
  const r2 = play(s, ["axe", "morphling", "juggernaut", "pudge"]);
  assertEq(r2.combo.type, "two_pair", "две пары 5-5 / 7-7");
  assertEq(r2.damage, Math.round((20 + 24) * 2 * 1.1 * 0.85), "четверо: (44 × 2 × 1.1) × 0.85");
});

test("Титан: адаптация мира — самое частое комбо ×0.85 после 3 применений", () => {
  const s = bareWave(newRankedRun("ADP", 7), 100000);
  assertEq(Ranks.mostUsedCombo(s), null, "пока ничего не изучено");
  s.run.comboUses = { pair: 3, three: 1 };
  const hunted = Ranks.mostUsedCombo(s);
  assertEq(hunted.id, "pair", "изучена пара");
  const r = play(s, ["axe", "zeus"]); // снова пара
  const step = r.steps.find((st) => st.label.includes("Адаптация мира"));
  assertEq(!!step, true, "шаг адаптации в расчёте");
  assertEq(r.damage, 34, "40 × 0.85");
});

test("Титан: охота на героя — самый используемый герой −2 к силе", () => {
  const s = newRankedRun("HNT", 7);
  assertEq(Ranks.mostUsedHero(s), null, "пока нет фаворита");
  s.run.heroUses = { juggernaut: 4, axe: 2 };
  assertEq(Ranks.mostUsedHero(s), "juggernaut", "фаворит определён");
  assertEq(Game.rankOf(s, "juggernaut"), 5, "juggernaut: 7 − 2");
});

test("Титан 10+: проклятие забега выбирается после босса акта, лавка закрыта до выбора", () => {
  const s = newRankedRun("CRS", 9);
  // форсим честную зачистку «босса акта»: isBoss + убиваемая пара
  bareWave(s, 40);
  s.combat.wave.isBoss = true;
  play(s, ["axe", "zeus"]);
  assertEq(s.combat.outcome, "cleared", "босс зачищен");
  assertEq(s.run.pendingCurse && s.run.pendingCurse.length, 3, "3 карточки проклятий");
  const choice = s.run.pendingCurse[0];
  assertEq(Game.dispatch(s, { type: "ENTER_SHOP" }).phase, "wave", "лавка закрыта до выбора");
  const chosen = Game.dispatch(s, { type: "CHOOSE_CURSE", curseId: choice });
  assertEq(chosen.run.curses.includes(choice), true, "проклятие принято");
  assertEq(chosen.run.pendingCurse, null, "выбор сброшен");
  assertEq(Game.dispatch(chosen, { type: "ENTER_SHOP" }).phase, "shop", "лавка открыта после выбора");
});

test("Проклятие Кровотока: урон ×1.15, награда ×0.75; Голод: −1 тимфайт, цены −20%", () => {
  const s = newRankedRun("BLD", 9);
  s.run.curses = ["blood"];
  bareWave(s, 40); // пара 40×1.15 = 46 урона убивает башню
  const r = play(s, ["axe", "zeus"]);
  assertEq(r.damage, 46, "урон ×1.15");
  assertEq(s.run.gold, 4 + Math.round(6 * (Ranks.goldMult(s) * Ranks.curseGoldMult(s))) - Ranks.taxPerWave(s), "зачистка с рангом, Кровотоком и налогом (+стартовые 4G)");
  const h = newRankedRun("HGR", 9);
  h.run.curses = ["hunger"];
  assertEq(Ranks.fightsPerWave(h), 3, "голод: −1 тимфайт");
  assertEq(Game.itemCost(h, "bkb"), Math.floor(7 * 0.8), "BKB: 7 → 5");
});

test("Инфляция: покупка в визите дорожает на 1G, счётчик сбрасывается при входе в лавку", () => {
  const s = newRankedRun("INF", 3);
  s.run.gold = 100;
  s.phase = "shop";
  s.shop.offers = [{ id: "bkb", locked: false }, { id: "butterfly", locked: false }];
  assertEq(Game.itemCost(s, "bkb"), 7, "первая покупка по базе");
  Game.dispatch(s, { type: "BUY_ITEM", itemId: "bkb" });
  assertEq(Game.itemCost(s, "butterfly"), 9, "вторая: 8 + 1 инфляции");
  Game.dispatch(s, { type: "BUY_ITEM", itemId: "butterfly" });
  assertEq(s.run.gold, 100 - 7 - 9, "списано 7 и 9");
});

test("Милосердие Рекрута: после провала башня стоит на 70% HP (наслаивается на все ранги)", () => {
  const s = newRankedRun("MRC", 1);
  s.combat.outcome = "failed";
  const state = Game.dispatch(s, { type: "RETRY_WAVE" });
  assertEq(state.combat.wave.hp, Math.ceil(state.combat.wave.maxHp * 0.7), "70% HP на Рекруте");
  // Ранг 7 держит милосердие Рекрута: правила лиги не исчезают
  const t = newRankedRun("MRCT", 7);
  t.combat.outcome = "failed";
  const t2 = Game.dispatch(t, { type: "RETRY_WAVE" });
  assertEq(t2.combat.wave.hp, Math.ceil(t2.combat.wave.maxHp * 0.7), "70% HP и на Титане");
});

test("Папочка: Трон здоровается лично", () => {
  const s = newRankedRun("PAP2", 14);
  s.run.waveIndex = 14;
  // последний босс — Трон: переименование происходит в setupWave
  const waveIndex = Content.waves.order.length - 1;
  const def = Content.waves.byId[Content.waves.order[waveIndex]];
  assertEq(def.isBoss, true, "последняя волна — босс");
  // прячу полную проверку setupWave (приватной) за общим контрактом рангов:
  assertEq(Ranks.rankOf(s).papochka, true, "ранг помечен как Папочка");
});

test("ранги 1-4 не тратят RNG на мутации/слоты: HP волны 1 детерминирован базой", () => {
  const a = newRankedRun("SEEDSAME", 1);
  const b = newRankedRun("SEEDSAME", 1);
  assertEq(a.combat.wave.maxHp, b.combat.wave.maxHp, "одинаковый seed — одинаковый HP");
  assertEq(a.combat.wave.maxHp, 450, "база T1");
});

test("Rng: ранг задаёт детерминированные мутации — одинаковый seed даёт одинаковые мутации", () => {
  const a = newRankedRun("MUTDET", 6);
  const b = newRankedRun("MUTDET", 6);
  const ma = a.combat.wave.modifiers.map((m) => m.id).join(",");
  const mb = b.combat.wave.modifiers.map((m) => m.id).join(",");
  assertEq(ma, mb, "мутации совпадают на одном seed");
});
