// Трассировщик забега: побоёвка одного сида — волна, бой, HP башни до/после,
// урон, добит ли. Инструмент калибровки I-full (BALANCE.md §Аудит силы).
//
//   node tests/fight_trace.mjs [classic|formation] [seed]
// Превью бота не логируются (simulate-диспатчи фильтруются).
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const SRC_FILES = [
  "src/systems/rng.js", "src/content/heroes.js", "src/content/items.js",
  "src/content/world.js", "src/content/upgrades.js", "src/content/routes.js",
  "src/content/aghanims.js", "src/content/content.js", "src/systems/ranks.js",
  "src/engine/events.js", "src/engine/conditions.js", "src/engine/effects.js",
  "src/engine/triggers.js", "src/engine/resolver.js", "src/engine/game.js",
  "src/engine/simulator.js", "src/systems/poker.js", "src/systems/formation.js",
  "src/systems/deck.js", "src/systems/upgrades.js", "src/systems/combat.js",
  "src/systems/economy.js", "src/systems/advisor.js",
];
const ctx = vm.createContext({ console, structuredClone, Math, Set, Map, Array, Object, JSON });
for (const file of SRC_FILES) {
  vm.runInContext(readFileSync(join(root, file), "utf8"), ctx, { filename: file });
}
const botSrc = readFileSync(join(root, "tests/ab.mjs"), "utf8");
vm.runInContext(botSrc.match(/vm\.runInContext\(`([\s\S]+?)`, ctx\);/)[1], ctx);

const RULES = process.argv[2] || "classic";
const SEED = process.argv[3] || "1000";
vm.runInContext(`
  const __log = [];
  const __dispatch = Game.dispatch;
  Game.dispatch = function (s, a) {
    if (a.type === "CONFIRM_FIGHT" && s.phase === "wave" && !s.combat.outcome && !s.simulate) {
      const w = s.combat.wave;
      __log.push({ wave: w.name, fight: s.combat.fightIndex + 1, hpBefore: w.hp, maxHp: w.maxHp, fights: s.player.fightsLeft });
    }
    const r = __dispatch(s, a);
    if (a.type === "CONFIRM_FIGHT" && !s.simulate && __log.length && s.combat.lastResolution && __log[__log.length - 1].dmg === undefined) {
      const res = s.combat.lastResolution;
      __log[__log.length - 1].dmg = res.damage;
      __log[__log.length - 1].killed = !!res.killed;
      __log[__log.length - 1].hpAfter = s.combat.wave.hp;
    }
    return r;
  };
  globalThis.__run = (rules, seed) => {
    __log.length = 0;
    const st = abPlayRun(rules, seed, "greedy", 1);
    return { st, log: __log.slice() };
  };
`, ctx);

const { st, log } = vm.runInContext(`__run(${JSON.stringify(RULES)}, ${JSON.stringify(SEED)})`, ctx);
let lastWave = "";
for (const e of log) {
  if (e.wave !== lastWave) { console.log(`— ${e.wave} (${e.maxHp} HP)`); lastWave = e.wave; }
  console.log(`   бой ${e.fight}: HP ${e.hpBefore} → ${e.hpAfter} (урон ${e.dmg}${e.killed ? ", УБИТА" : ""}, осталось тимфайтов ${e.fights - 1})`);
}
console.log(`Итог: ${st.won ? "ПОБЕДА" : "смерть на волне " + (st.waves + 1)} · казарм ${st.retries} · предметов ${st.items} · тренингов ${st.trains || 0} · улучшений ${st.upgrades || 0} · аганимов ${st.aghanims || 0}`);
