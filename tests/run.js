// dotora test runner. Loads the same script files the browser loads — the list
// is parsed out of index.html (single source of truth, same as build.js),
// then runs tests/*.test.js inside a vm context. No dependencies, no build step.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

// Browser-only files: main.js вешает обработчики на живой DOM и диспатчит
// действия сам, audio.js требует AudioContext. Всё остальное из index.html —
// включая tutorial.js и ui.js — грузится в тесты в том же порядке.
const SKIP_FILES = new Set(["src/main.js", "src/ui/audio.js"]);

const html = readFileSync(join(root, "index.html"), "utf8");
const SRC_FILES = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)]
  .map(([, src]) => src)
  .filter((src) => !SKIP_FILES.has(src));
if (!SRC_FILES.length) {
  console.error("RUNNER FAILED: no <script src> entries found in index.html");
  process.exit(1);
}

// DOM/Sfx-заглушки: ui.js рендерит в innerHTML и читает Sfx.isMuted —
// для headless smoke-тестов хватает пустышек. tutorial.js создаёт слой через
// createElement и ищет в нём элементы — заглушке нужны querySelector/addEventListener.
const appEl = { innerHTML: "", scrollTop: 0 };
const stubEl = () => ({
  innerHTML: "", scrollTop: 0, style: {}, dataset: {},
  classList: { toggle() {}, add() {}, remove() {} },
  appendChild(el) { return el; }, remove() {},
  addEventListener() {}, removeEventListener() {},
  querySelector: () => null, querySelectorAll: () => [],
  getBoundingClientRect: () => null,
});
const documentStub = {
  body: stubEl(),
  getElementById: (id) => (id === "app" ? appEl : stubEl()),
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => stubEl(),
  addEventListener() {},
};
const storageStub = (() => {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
})();

const sandbox = {
  console,
  structuredClone,
  document: documentStub,
  localStorage: storageStub,
  addEventListener() {},
  removeEventListener() {},
  Sfx: { isMuted: () => false, play() {}, toggleMuted() {} },
};
// В браузере window и есть глобальный объект (ui.js пишет window.Tutorial,
// а читает просто Tutorial). Самоссылка воспроизводит эту семантику в vm.
sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);

// server.js — Node-ESM модуль бэкенда, в браузере он не живёт. Серверные тесты
// (backend.test.js) идут тем же синхронным раннером: HTTP-обёртка не нужна,
// гоняем API-ядро напрямую, фабрика инжектится в песочницу как Backend.
sandbox.Backend = await import("../server.js");

// Асинхронные отказы вне тестов не должны проходить незамеченными.
let unhandled = 0;
process.on("unhandledRejection", (e) => {
  unhandled++;
  console.error("UNHANDLED REJECTION:", e && (e.stack || e.message || e));
});

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
    try {
      const out = fn();
      // Раннер синхронный: промис от async-теста нельзя дождаться — иначе
      // rejection проглотится и тест запишется как пройденный. Падаем громко.
      if (out && typeof out.then === "function") {
        __results.push({ suite: __currentSuite, name, ok: false, error: "async-тест не поддерживается синхронным раннером (вернулся промис)" });
        return;
      }
      __results.push({ suite: __currentSuite, name, ok: true });
    } catch (e) {
      __results.push({ suite: __currentSuite, name, ok: false, error: String((e && e.message) || e), stack: e && e.stack });
    }
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
  // Каждый файл — в IIFE: декларации хелперов (newRun, setWave, play…) не
  // текут между файлами в общем контексте; раньше дубли уже разошлись
  // сигнатурами и любой новый конфликт имён падал бы SyntaxError'ом.
  try {
    vm.runInContext(`(function(){\n${code}\n})();`, ctx, { filename: "tests/" + file });
  } catch (e) {
    // Ошибка вне test() (top-level подготовка) не должна хоронить сводку.
    console.error(`\nFILE FAILED: tests/${file}`);
    console.error(e && (e.stack || e.message || e));
  }
}

const results = vm.runInContext("__results", ctx);
if (!results.length) {
  console.error("RUNNER FAILED: 0 тестов найдено (glob tests/*.test.js пуст?)");
  process.exit(1);
}
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
    if (r.stack) {
      const lines = String(r.stack).split("\n").slice(1, 4).filter((l) => l.includes("tests/"));
      if (lines.length) console.log(lines.map((l) => "      " + l.trim()).join("\n"));
    }
  }
}
console.log(`\n${results.length - failed}/${results.length} прошло`);
process.exit(failed || unhandled ? 1 : 0);
