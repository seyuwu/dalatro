// PROTOTYPE runner — грузит реальный код DALATRO (тот же порядок, что
// tests/run.js). С момента переноса в src каноничная система живёт в
// src/systems/formation.js + src/content/world.js; прототипные файлы остаются
// как историческая копия и в прогон не грузятся (иначе дубли констант).
//
//   node prototype/run.mjs           — сравнение + тесты
//   node prototype/run.mjs --tests   — только тесты
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const SRC_FILES = [
  "src/systems/rng.js",
  "src/content/heroes.js",
  "src/content/items.js",
  "src/content/world.js",
  "src/content/content.js",
  "src/engine/events.js",
  "src/engine/conditions.js",
  "src/engine/effects.js",
  "src/engine/triggers.js",
  "src/engine/resolver.js",
  "src/engine/game.js",
  "src/engine/simulator.js",
  "src/systems/poker.js",
  "src/systems/formation.js",
  "src/systems/deck.js",
  "src/systems/combat.js",
  "src/systems/economy.js",
  "src/systems/advisor.js",
];

const ctx = vm.createContext({ console, structuredClone, Math, Set, Map, Array, Object, JSON });
for (const file of SRC_FILES) {
  vm.runInContext(readFileSync(join(root, file), "utf8"), ctx, { filename: file });
}

vm.runInContext(
  `var __results = [], __suite = "";
   function suite(n){ __suite = n; }
   function test(n, fn){ try { fn(); __results.push({suite:__suite,name:n,ok:true}); }
     catch(e){ __results.push({suite:__suite,name:n,ok:false,error:String((e&&e.message)||e)}); } }
   function assert(c,m){ if(!c) throw new Error(m||"assert failed"); }
   function assertEq(a,b,m){ if(a!==b) throw new Error((m||"assertEq")+" — ожидалось "+b+", получено "+a); }`,
  ctx, { filename: "harness.js" }
);

const onlyTests = process.argv.includes("--tests");

if (!onlyTests) {
  vm.runInContext(readFileSync(join(here, "compare.js"), "utf8"), ctx, { filename: "compare.js" });
}
vm.runInContext(readFileSync(join(here, "formation.test.js"), "utf8"), ctx, { filename: "formation.test.js" });

const results = ctx.__results;
const failed = results.filter((r) => !r.ok);
let lastSuite = null;
for (const r of results) {
  if (r.suite !== lastSuite) { console.log(`\n— ${r.suite}`); lastSuite = r.suite; }
  console.log(`  ${r.ok ? "✓" : "✗"} ${r.name}${r.ok ? "" : `\n      ${r.error}`}`);
}
console.log(`\n${results.length - failed.length}/${results.length} тестов прототипа пройдено`);
process.exit(failed.length ? 1 : 0);
