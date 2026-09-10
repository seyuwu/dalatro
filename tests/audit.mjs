// Аудит силы (фаза D, спек §6.1/§6.4). Жадный бот играет полные забеги,
// каждый бой пишет структурный след (resolution.trace), агрегатор выдаёт:
//   - распределения урона за бой (P50/P90/MAX) по актам;
//   - стек мультипликаторов: как часто и насколько стреляют MULT_MULT,
//     ставка/импульс/рапира (final), штрафы башни/лиги;
//   - средние слои power/mult: база комбо + карты + герои + предметы;
//   - золото/предметы к контрольным волнам §6.4.
//
//   node tests/audit.mjs                      # Recruit/Hero/Lord/Titan × 30 сидов
//   node tests/audit.mjs --rank=7 --seeds=50  # один ранг подробнее
//
// Решения о переводе × в + принимаются ПОСЛЕ чтения таблицы — инструмент
// ничего не предрешает (см. docs/REDESIGN_MASTER_PLAN.md, фаза D).
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
  "src/systems/ranks.js",
  "src/engine/events.js",
  "src/engine/conditions.js",
  "src/engine/effects.js",
  "src/engine/triggers.js",
  "src/engine/resolver.js",
  "src/engine/simulator.js",
  "src/systems/poker.js",
  "src/systems/formation.js",
  "src/systems/deck.js",
  "src/systems/upgrades.js",
  "src/systems/economy.js",
  "src/systems/combat.js",
  "src/engine/game.js",
  "src/systems/advisor.js",
];

const ctx = vm.createContext({ console, structuredClone, Math, Set, Map, Array, Object, JSON });
for (const file of SRC_FILES) {
  vm.runInContext(readFileSync(join(root, file), "utf8"), ctx, { filename: file });
}

// Вся игровая логика — внутри vm-контекста (Game/Rng живут там же).
vm.runInContext(
  `
  const __fights = [];
  const __runs = [];

  function auditCombinations(arr, k) {
    const out = [];
    const rec = (start, acc) => {
      if (acc.length === k) { out.push(acc.slice()); return; }
      for (let i = start; i < arr.length; i++) { acc.push(arr[i]); rec(i + 1, acc); acc.pop(); }
    };
    rec(0, []);
    return out;
  }

  // Жадный бот: максимум урона из превью (та же идея, что в ab.mjs).
  function auditBestSelection(state) {
    const hand = state.player.handUids.filter((uid) => !(state.combat.minedUids || []).includes(uid));
    const maxK = Math.min(Game.maxSlots(state), hand.length);
    let best = null;
    for (let k = 1; k <= maxK; k++) {
      for (const uids of auditCombinations(hand, k)) {
        const res = Rng.suppress(() => {
          const clone = structuredClone(state);
          clone.simulate = true;
          for (const uid of uids) Game.dispatch(clone, { type: "SELECT_CARD", uid });
          Game.dispatch(clone, { type: "CONFIRM_FIGHT" });
          return clone.combat.lastResolution;
        });
        const dmg = res ? res.damage : 0;
        if (!best || dmg > best.damage) best = { uids, damage: dmg };
      }
    }
    return best || { uids: hand.slice(0, 1), damage: 0 };
  }

  function auditPlayRun(rank, seed) {
    let state = Game.dispatch(Game.createInitialState(""), { type: "START_RUN", seedCode: seed, rank });
    const run = { rank, seed, won: false, wave: 0, goldAt: {}, itemsAt: {}, shops: 0, deaths: 0 };
    let guard = 0;
    while (state.phase !== "victory" && state.phase !== "gameover" && guard++ < 500) {
      if (state.phase === "route") {
        const kind = state.run.barracks <= 1 && !state.combat.campTaken ? "camp" : "normal";
        state = Game.dispatch(state, { type: "TAKE_ROUTE", kind });
      } else if (state.phase === "wave" && !state.combat.outcome) {
        const waveIdx = state.run.waveIndex;
        const goldBefore = state.run.gold;
        const sel = auditBestSelection(state);
        for (const uid of sel.uids) state = Game.dispatch(state, { type: "SELECT_CARD", uid });
        state = Game.dispatch(state, { type: "CONFIRM_FIGHT" });
        const res = state.combat.lastResolution;
        if (res && res.trace) __fights.push({ rank, ...res.trace });
        for (const cp of [0, 4, 9, 14]) {
          if (waveIdx === cp && run.goldAt[cp + 1] == null) {
            run.goldAt[cp + 1] = goldBefore;
            run.itemsAt[cp + 1] = state.player.items.length;
          }
        }
      } else if (state.run.pendingCurse) {
        state = Game.dispatch(state, { type: "CHOOSE_CURSE", curseId: state.run.pendingCurse[0] });
      } else if (state.combat.outcome === "cleared") {
        state = Game.dispatch(state, { type: "ENTER_SHOP" });
        run.shops++;
        // Самый дорогой доступный предмет (с учётом капа слотов).
        let bestItem = null;
        for (const o of state.shop.offers) {
          if (Game.itemBlockedReason(state, o.id)) continue;
          if (Game.itemCost(state, o.id) > state.run.gold) continue;
          if (!bestItem || Game.itemCost(state, o.id) > Game.itemCost(state, bestItem)) bestItem = o.id;
        }
        if (bestItem) state = Game.dispatch(state, { type: "BUY_ITEM", itemId: bestItem });
        // Найм при запасе: больше карт = лучше ротация (как в ab.mjs).
        for (const heroId of (state.shop.recruits || []).slice()) {
          if (state.run.gold >= Game.recruitPrice(heroId) + 6) {
            state = Game.dispatch(state, { type: "BUY_RECRUIT", heroId });
          }
        }
        // Тренировка сильнейшего героя остатками золота — главный скейлинг.
        let trainGuard = 40;
        while (state.run.gold >= Game.TRAIN_COST && trainGuard-- > 0) {
          const owned = [...state.player.handUids, ...state.player.deckUids, ...state.player.discardUids]
            .map((uid) => state.cards[uid].heroId);
          const ranks = state.run.ranks || {};
          const target = owned
            .map((id) => ({ id, rank: ranks[id] != null ? ranks[id] : Content.heroes.byId[id].power }))
            .filter((h) => h.rank < Game.TRAIN_RANK_MAX)
            .sort((a, b) => b.rank - a.rank)[0];
          if (!target) break;
          state = Game.dispatch(state, { type: "TRAIN_HERO", heroId: target.id });
        }
        state = Game.dispatch(state, { type: "LEAVE_SHOP" });
      } else if (state.combat.outcome === "failed") {
        state = Game.dispatch(state, { type: "RETRY_WAVE" });
        run.deaths++;
      } else {
        break;
      }
    }
    run.won = state.phase === "victory";
    run.wave = state.run.waveIndex + (run.won ? 1 : 0);
    __runs.push(run);
  }
  0; // выражение-инструкция: блок выше объявляет функции в контексте
  `,
  ctx,
  { filename: "audit-engine.js" }
);

// --- CLI ---
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, "").split("=");
  return [k, v === undefined ? true : Number(v)];
}));
const SEEDS = args.seeds || 30;
const RANKS = args.rank ? [args.rank] : [1, 3, 5, 7];

console.log(`Аудит силы DALATRO — ${SEEDS} сидов на ранг, ранги: ${RANKS.join(", ")}\n`);
for (const rank of RANKS) {
  vm.runInContext(`for (let i = 0; i < ${SEEDS}; i++) auditPlayRun(${rank}, "AUD${rank}" + String(i).padStart(2, "0"));`, ctx);
}

// --- отчёт (в Node, данные из контекста) ---
const fights = vm.runInContext("__fights", ctx);
const runs = vm.runInContext("__runs", ctx);

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
const pct = (n, d) => Math.round(100 * n / (d || 1));

const byRank = {};
for (const f of fights) (byRank[f.rank] = byRank[f.rank] || []).push(f);

for (const rank of RANKS) {
  const fs = byRank[rank] || [];
  if (!fs.length) continue;
  const winRate = Math.round(100 * runs.filter((r) => r.rank === rank && r.won).length / SEEDS);
  console.log(`════ РАНГ ${rank} · winrate ${winRate}% · боёв ${fs.length} ════`);

  for (const act of [1, 2, 3]) {
    const dmgs = fs.filter((f) => f.act === act).map((f) => f.damage).sort((a, b) => a - b);
    if (!dmgs.length) continue;
    console.log(`  акт ${act}: урон P50 ${percentile(dmgs, 50).toLocaleString("ru")} · P90 ${percentile(dmgs, 90).toLocaleString("ru")} · MAX ${dmgs[dmgs.length - 1].toLocaleString("ru")}`);
  }

  const baseSum = avg(fs.map((f) => f.comboBase + f.cardsPower));
  const heroSum = avg(fs.map((f) => f.heroPower));
  const itemSum = avg(fs.map((f) => f.itemPower));
  const multBase = avg(fs.map((f) => f.comboMult));
  const multHero = avg(fs.map((f) => f.heroMult));
  const multItem = avg(fs.map((f) => f.itemMult));
  console.log(`  сила: база ${Math.round(baseSum)} · герои +${Math.round(heroSum)} (${pct(heroSum, baseSum)}%) · предметы +${Math.round(itemSum)} (${pct(itemSum, baseSum)}%)`);
  console.log(`  множитель: комбо ×${multBase.toFixed(2)} · герои +${multHero.toFixed(2)} · предметы +${multItem.toFixed(2)}`);

  // Частоты ×-источников.
  const collect = (key) => {
    const m = new Map();
    for (const f of fs) for (const e of f[key] || []) {
      const cur = m.get(e.source) || { n: 0, v: e.value };
      cur.n++;
      m.set(e.source, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n)
      .map(([src, e]) => `    ${src}: ×${e.v} в ${Math.round(100 * e.n / fs.length)}% боёв`)
      .join("\n");
  };
  const mm = collect("multMult");
  console.log(`  MULT_MULT (× на множитель):${mm ? "\n" + mm : " не стреляли"}`);
  const fm = collect("finalMult");
  console.log(`  FINAL (ставка/импульс/рапира/кровь):${fm ? "\n" + fm : " нет"}`);
  const tm = collect("towerMult");
  if (tm) console.log(`  Штрафы башни/лиги:\n${tm}`);

  // Полный ×-стек поверх базы за бой.
  const stacks = fs.map((f) => {
    let s = 1;
    for (const m of f.multMult || []) s *= m.value;
    for (const m of f.finalMult || []) s *= m.value;
    return Math.round(100 * s) / 100;
  }).sort((a, b) => a - b);
  console.log(`  ×-стек поверх базы: P50 ×${percentile(stacks, 50)} · P90 ×${percentile(stacks, 90)} · MAX ×${stacks[stacks.length - 1]}`);

  // §6.4: контрольные точки золота/предметов.
  const rs = runs.filter((r) => r.rank === rank);
  const cpLines = [1, 5, 10, 15].map((cp) => {
    const golds = rs.map((r) => r.goldAt[cp]).filter((v) => v != null).sort((a, b) => a - b);
    const items = rs.map((r) => r.itemsAt[cp]).filter((v) => v != null);
    if (!golds.length) return null;
    return `    волна ${cp}: золото P50 ${percentile(golds, 50)} · предметов ${Math.round(avg(items) * 10) / 10}/6`;
  }).filter(Boolean).join("\n");
  if (cpLines) console.log(`  §6.4 (медианы):\n${cpLines}`);
  console.log("");
}
console.log(`Забегов: ${runs.length}, боёв: ${fights.length}. Решения о × → + принимать по этой таблице (план, фаза D).`);
