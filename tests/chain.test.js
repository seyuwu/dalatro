suite("Chain feedback");

function newRun(seed) {
  return Game.dispatch(Game.createInitialState(""), { type: "START_RUN", seedCode: seed || "CHAIN0" });
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
  forceHand(s, heroIds);
  s.combat.selectedUids = s.player.handUids.slice();
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  return s.combat.lastResolution;
}

test("🔗 Zeus сработал только благодаря копии Morphling — цепочка видна в стеке", () => {
  const s = newRun("CHN1");
  const res = play(s, ["zeus", "morphling"]);
  // морф копирует INT у зевса (сосед слева); без копии морф — AGI и условие
  // зевса не выполняется → движок обязан пометить цепочку
  const chain = res.steps.find((st) => st.icon === "🔗");
  assert(chain, "🔗-шаг присутствует");
  assert(chain.label.includes("Zeus"), "указан бенефициар цепочки");
  assert(chain.label.includes("Morphling"), "указан источник копии");
  assertEq(res.damage, 80, "урон прежний: 20 × 4");
});

test("натуральный INT (CM) не помечается цепочкой", () => {
  const s = newRun("CHN2");
  const res = play(s, ["cm", "zeus"]);
  const chain = res.steps.find((st) => st.icon === "🔗");
  assert(!chain, "без копии нет 🔗-шага");
  assert(res.mult >= 3, "zeus сработал от натурального INT");
});

test("цепочка видна и в превью-симуляции", () => {
  const s = newRun("CHN3");
  forceHand(s, ["zeus", "morphling"]);
  s.combat.selectedUids = s.player.handUids.slice();
  const clone = Sim.simulate(s, { type: "CONFIRM_FIGHT" });
  const steps = clone.combat.lastResolution.steps;
  assert(steps.some((st) => st.icon === "🔗"), "превью показывает цепочку");
  assertEq(s.combat.wave.hp, 450, "состояние не тронуто");
});

test("Morphling без копии (слот 1) не порождает 🔗", () => {
  const s = newRun("CHN4");
  const res = play(s, ["morphling", "zeus"]);
  // морф первый — копировать некого; зевс не триггерит (морф остался AGI)
  const chain = res.steps.find((st) => st.icon === "🔗");
  assert(!chain, "копии не было — цепочки нет");
  assertEq(res.damage, 40, "20 × 2 без бонуса зевса");
});
