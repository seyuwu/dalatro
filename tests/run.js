// Dalatro test runner. Loads the same script files the browser loads (same
// order as index.html) into a vm context, then runs tests/*.test.js inside it.
// No dependencies, no build step.
import { readFileSync, readdirSync } from "node:fs";
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
  "src/systems/ranks.js",
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
  "src/systems/upgrades.js",
  "src/systems/combat.js",
  "src/systems/economy.js",
  "src/systems/advisor.js",
  "src/ui/icons.js",
];

const ctx = vm.createContext({ console, structuredClone });

for (const file of SRC_FILES) {
  const code = readFileSync(join(root, file), "utf8");
  vm.runInContext(code, ctx, { filename: file });
}

vm.runInContext(
  `
  var __results = [];
  var __currentSuite = "";
  function suite(name) { __currentSuite = name; }
  function test(name, fn) {
    try { fn(); __results.push({ suite: __currentSuite, name, ok: true }); }
    catch (e) { __results.push({ suite: __currentSuite, name, ok: false, error: String((e && e.message) || e) }); }
  }
  function assert(cond, msg) { if (!cond) throw new Error(msg || "assert failed"); }
  function assertEq(actual, expected, msg) {
    if (actual !== expected) throw new Error((msg || "assertEq") + " — ожидалось " + expected + ", получено " + actual);
  }
  function mk(power, attr) { return { power, attr }; }
  `,
  ctx,
  { filename: "harness.js" }
);

const testFiles = readdirSync(here).filter((f) => f.endsWith(".test.js"));
for (const file of testFiles) {
  const code = readFileSync(join(here, file), "utf8");
  vm.runInContext(code, ctx, { filename: "tests/" + file });
}

const results = vm.runInContext("__results", ctx);
let failed = 0;
let lastSuite = "";
for (const r of results) {
  if (r.suite !== lastSuite) {
    console.log("\n" + r.suite);
    lastSuite = r.suite;
  }
  if (r.ok) {
    console.log("  ✔ " + r.name);
  } else {
    failed++;
    console.log("  ✖ " + r.name);
    console.log("      " + r.error);
  }
}
console.log(`\n${results.length - failed}/${results.length} прошло`);
process.exit(failed ? 1 : 0);
