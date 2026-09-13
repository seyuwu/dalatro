// Подсказки первого раза (tutorial notes): улучшения, бафы башни, коллекция.
// Сценарий туториала считаем пройденным ({main:"done"}) — проверяем только
// записки. localStorage-стаб раннера общий, перед каждым тестом чистим ключ.

suite("Подсказки первого раза");

const TUT_KEY = "dotora_tut_v1";

function tutState(over = {}) {
  const s = Game.createInitialState("TNT1");
  s.phase = over.phase || "wave";
  if (over.wave) s.combat.wave = over.wave;
  if (over.upgrades) s.run.upgrades = over.upgrades;
  return s;
}

function freshTutorial(mainState, extra = {}) {
  localStorage.removeItem(TUT_KEY);
  Tutorial.reset();
  localStorage.setItem(TUT_KEY, JSON.stringify({ main: mainState, ...extra }));
  // Прогрев: arm() читает хранилище и включает notesOn (нужен один observe
  // в title-фазе — иначе сценарий/скип решатся на фазе боя).
  Tutorial.observe(Game.createInitialState("TNT0"));
}

test("лавка с купленным улучшением → записка upg помечена", () => {
  freshTutorial("done", { shop: true }); // базовую записку лавки считаем показанной
  const s = tutState({ phase: "shop", upgrades: [{ id: "vozvrat", tier: 1 }] });
  Tutorial.observe(s);
  Tutorial.observe(s);
  const d = JSON.parse(localStorage.getItem(TUT_KEY));
  assert(d.upg, "upg отмечен");
});

test("лавка без покупок → записки upg ещё нет", () => {
  freshTutorial("done");
  const s = tutState({ phase: "shop", upgrades: [] });
  Tutorial.observe(s);
  Tutorial.observe(s);
  const d = JSON.parse(localStorage.getItem(TUT_KEY));
  assert(!d.upg, "upg ждёт первой покупки");
});

test("волна с бафами башни → записка buffs помечена", () => {
  freshTutorial("done");
  const s = tutState({ phase: "wave", wave: { id: "t2", towerId: "t2", modifiers: [{ id: "armor" }], hp: 100, maxHp: 100 } });
  s.combat.outcome = null;
  Tutorial.observe(s);
  Tutorial.observe(s);
  const d = JSON.parse(localStorage.getItem(TUT_KEY));
  assert(d.buffs, "buffs отмечен");
});

test("волна без бафов → записки buffs нет", () => {
  freshTutorial("done");
  const s = tutState({ phase: "wave", wave: { id: "t1", towerId: "t1", modifiers: [], hp: 100, maxHp: 100 } });
  s.combat.outcome = null;
  Tutorial.observe(s);
  Tutorial.observe(s);
  const d = JSON.parse(localStorage.getItem(TUT_KEY));
  assert(!d.buffs, "buffs не показывается на чистой башне");
});

test("открытие коллекции → записка coll через Tutorial.note", () => {
  freshTutorial("done");
  Tutorial.note("coll", "📚", "Коллекция — это и прокачка.");
  const d = JSON.parse(localStorage.getItem(TUT_KEY));
  assert(d.coll, "coll отмечен");
});

test("«пропустить обучение» глушит и императивные записки", () => {
  freshTutorial("skip");
  Tutorial.note("coll", "📚", "не должно появиться");
  const d = JSON.parse(localStorage.getItem(TUT_KEY));
  assert(!d.coll, "после skip записки не ставятся");
});
