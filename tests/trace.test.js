// Фаза D — структурный след урона (scoring.trace → resolution.trace) и
// ситуативный Bloodthorn (решение по таблице аудита: ×2.2 без условий
// стрелял в 11–16% всех боёв — стал боссхантером 50% на боссах/мини-боссах).
suite("Фаза D — аудит силы и Bloodthorn");

function trRun(seed) {
  return Game.dispatch(Game.createInitialState(""), { type: "START_RUN", seedCode: seed || "TRACE1" });
}
function trPlay(s, heroIds) {
  const uids = heroIds.map((h) => Object.values(s.cards).find((c) => c.heroId === h).uid);
  s.player.handUids = [...uids, ...Object.keys(s.cards).filter((u) => !uids.includes(u))];
  s.combat.selectedUids = uids.slice();
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  return s.combat.lastResolution;
}

test("trace пишет слои силы: база, карты, герои, предметы", () => {
  const s = trRun("TRC1");
  const uids = ["pudge", "juggernaut"].map((h) => Object.values(s.cards).find((c) => c.heroId === h).uid);
  s.player.handUids = [...uids, ...Object.keys(s.cards).filter((u) => !uids.includes(u))];
  s.combat.selectedUids = uids.slice();
  s.player.items.push("kaya"); // +10 силы и +1 множитель от предмета
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  const res = s.combat.lastResolution;
  const t = res.trace;
  assert(t, "resolution.trace существует");
  assertEq(t.played, 2, "в бою 2 карты");
  assertEq(t.comboId, "pair");
  assertEq(t.comboBase, 10, "база пары");
  assertEq(t.cardsPower, 14, "падж 7 + джаггернаут 7");
  assertEq(t.itemPower, 10, "Kaya: +10 силы от предмета");
  assertEq(t.itemMult, 1, "Kaya: +1 множитель от предмета");
  assertEq(t.damage, res.damage, "trace.damage совпадает с уроном боя");
  assertEq(t.gold, res.goldGained, "trace.gold совпадает с золотом боя");
});

test("Ставка и импульс попадают в trace.finalMult", () => {
  const s = trRun("TRC2");
  const all = Object.keys(s.cards);
  s.player.handUids = all;
  s.combat.selectedUids = all.slice(0, 5);
  s.run.momentum = 2;
  Game.dispatch(s, { type: "CONFIRM_FIGHT" });
  const t = s.combat.lastResolution.trace;
  const commit = t.finalMult.find((m) => m.source.includes("Ставка"));
  assert(commit && commit.value === 1.25, "ставка ×1.25 в следе");
  const mom = t.finalMult.find((m) => m.source === "Импульс");
  assert(mom && mom.value === 1.1, "импульс ×1.1 (2 волны) в следе");
});

test("Bloodthorn: крит только на боссе/мини-боссе, на обычной башне молчит", () => {
  // 20 сидов на обычной волне: шанс-эффект не должен стрелять вовсе.
  let firedOnNormal = false;
  let sawNormal = 0;
  for (let i = 0; i < 20; i++) {
    const s = trRun("BTNORMAL" + i);
    s.player.items.push("bloodthorn");
    const uid = Object.values(s.cards).find((c) => c.heroId === "pa").uid;
    const uid2 = Object.values(s.cards).find((c) => c.heroId === "dawnbreaker").uid;
    s.player.handUids = [uid, uid2];
    s.combat.selectedUids = [uid, uid2];
    Game.dispatch(s, { type: "CONFIRM_FIGHT" });
    const res = s.combat.lastResolution;
    assert(!res.steps.some((st) => st.label.includes("Bloodthorn: ×2.2")), "Blood Hunt не срабатывает вне боссов, сид " + i);
    sawNormal++;
  }
  assertEq(sawNormal, 20);
  // На боссе шанс 50% — по 20 сидам хотя бы один крит обязан случиться.
  let firedOnBoss = 0;
  for (let i = 0; i < 20; i++) {
    const s = trRun("BTBOSS" + i);
    s.player.items.push("bloodthorn");
    s.combat.wave.isBoss = true;
    const uid = Object.values(s.cards).find((c) => c.heroId === "pa").uid;
    const uid2 = Object.values(s.cards).find((c) => c.heroId === "dawnbreaker").uid;
    s.player.handUids = [uid, uid2];
    s.combat.selectedUids = [uid, uid2];
    Game.dispatch(s, { type: "CONFIRM_FIGHT" });
    if (s.combat.lastResolution.steps.some((st) => st.label.includes("Bloodthorn: ×2.2"))) firedOnBoss++;
  }
  assert(firedOnBoss >= 2, "на боссах крит ловится (поймано " + firedOnBoss + "/20, p отказа ~5e-6)");
});
