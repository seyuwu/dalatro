// A/B на одинаковых сидах: classic (покер) vs formation (формации+связки+броня).
// Один и тот же бот играет полные забеги в обоих режимах; выбор тимфайта —
// по максимуму урона из ПРЕВЬЮ самой системы (Sim = тот же dispatch на клоне).
//
//   node tests/ab.mjs                 # 40 сидов на режим
//   node tests/ab.mjs --seeds=100     # больше сидов
//   node tests/ab.mjs --verbose=3     # показать первые N забегов по волнам
//
// Честность: бот нейтрален (жадный по превью), шоп — «самый дорогой доступный
// предмет», развилка — всегда обычная башня. Сравниваются распределения по
// сидам, а не попарные пути (расход RNG после первого боя расходится).
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
  "src/content/upgrades.js",
  "src/content/routes.js",
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
];

const ctx = vm.createContext({ console, structuredClone, Math, Set, Map, Array, Object, JSON });
for (const file of SRC_FILES) {
  vm.runInContext(readFileSync(join(root, file), "utf8"), ctx, { filename: file });
}

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith("--" + name + "="));
  return hit ? hit.split("=")[1] : fallback;
};
const SEEDS = Number(arg("seeds", 40));
const VERBOSE = Number(arg("verbose", 0));

vm.runInContext(`
  function abSimFight(state, uids) {
    const clone = structuredClone(state);
    clone.simulate = true;
    return Rng.suppress(() => {
      for (const uid of uids) Game.dispatch(clone, { type: "SELECT_CARD", uid });
      Game.dispatch(clone, { type: "CONFIRM_FIGHT" });
      return clone.combat.lastResolution;
    });
  }

  function abCombinations(arr, k) {
    const out = [];
    const rec = (start, acc) => {
      if (acc.length === k) { out.push(acc.slice()); return; }
      for (let i = start; i < arr.length; i++) { acc.push(arr[i]); rec(i + 1, acc); acc.pop(); }
    };
    rec(0, []);
    return out;
  }

  // Жадный бот: перебирает подмножества руки (в formation — ещё и порядки
  // возрастания/убывания рангов) и берёт максимум урона из превью.
  function abBestSelection(state) {
    const hand = state.player.handUids.filter((uid) => !(state.combat.minedUids || []).includes(uid));
    const maxK = Math.min(Game.maxSlots(state), hand.length);
    const rankOf = (uid) => Game.rankOf(state, state.cards[uid].heroId);
    const formation = state.rules === "formation";
    let best = null;
    for (let k = 1; k <= maxK; k++) {
      for (const subset of abCombinations(hand, k)) {
        let orders = [subset];
        if (formation && k >= 3) {
          orders = [
            subset,
            subset.slice().sort((a, b) => rankOf(a) - rankOf(b)),
            subset.slice().sort((a, b) => rankOf(b) - rankOf(a)),
          ];
          const seen = new Set();
          orders = orders.filter((o) => { const key = o.join("|"); if (seen.has(key)) return false; seen.add(key); return true; });
        }
        for (const uids of orders) {
          const res = abSimFight(state, uids);
          if (res && (!best || res.damage > best.damage)) best = { uids, damage: res.damage };
        }
      }
    }
    return best || { uids: hand.slice(0, 1), damage: 0 };
  }

  // Один полный забег: бой за боем, шоп — самый дорогой доступный предмет,
  // развилка — всегда обычная башня, сбросы не тратим.
  // policy "greedy": максимум урона из превью; "naive": первая пятёрка руки
  // (симулирует игрока без оптимизации — меряет пол системы).
  function abPlayRun(rules, seedCode, policy, rank) {
    let state = Game.dispatch(Game.createInitialState(""), { type: "START_RUN", seedCode, rules, rank: rank || 1 });
    const stats = { fights: 0, retries: 0, positional: 0, bonds: 0, tiers: 0, waves: 0, won: false, shops: 0, items: 0 };
    let guard = 0;
    while (state.phase !== "victory" && state.phase !== "gameover" && guard++ < 500) {
      // Порядок веток важен: в фазе route исход ещё "cleared" — поэтому
      // route проверяется раньше лавки.
      if (state.phase === "route") {
        // Разумный игрок: при последней казарме берёт крип-лагерь (+1 жизнь).
        const kind = state.run.barracks <= 1 && !state.combat.campTaken ? "camp" : "normal";
        Game.dispatch(state, { type: "TAKE_ROUTE", kind });
      } else if (state.phase === "wave" && !state.combat.outcome) {
        const uids = policy === "naive"
          ? state.player.handUids.slice(0, Game.maxSlots(state))
          : abBestSelection(state).uids;
        for (const uid of uids) Game.dispatch(state, { type: "SELECT_CARD", uid });
        Game.dispatch(state, { type: "CONFIRM_FIGHT" });
        const res = state.combat.lastResolution;
        stats.fights++;
        if (res && rules === "formation") {
          if (res.combo.positional) stats.positional++;
          stats.bonds += res.combo.bonds ? res.combo.bonds.length : 0;
          stats.tiers += res.combo.tier || 0;
        }
      } else if (state.run.pendingCurse) {
        // Лига Титанов: бот берёт первое проклятие из трёх.
        Game.dispatch(state, { type: "CHOOSE_CURSE", curseId: state.run.pendingCurse[0] });
      } else if (state.combat.outcome === "cleared") {
        Game.dispatch(state, { type: "ENTER_SHOP" });
        const affordable = state.shop.offers
          .map((o) => Content.items.byId[o.id])
          .filter((i) => i && !state.player.items.includes(i.id) && i.cost <= state.run.gold && !Game.itemBlockedReason(state, i.id))
          .sort((a, b) => b.cost - a.cost);
        if (affordable[0]) { Game.dispatch(state, { type: "BUY_ITEM", itemId: affordable[0].id }); stats.items++; }
        // Нанимает рекрута, если остаётся запас: больше карт = лучше ротация
        // против усталости и адаптации мира.
        for (const heroId of (state.shop.recruits || []).slice()) {
          const price = Game.recruitPrice(heroId);
          if (state.run.gold >= price + 6) {
            Game.dispatch(state, { type: "BUY_RECRUIT", heroId });
            stats.recruits = (stats.recruits || 0) + 1;
          }
        }
        // Разумный игрок тренирует героев остатками золота: главный источник
        // скейлинга урона на поздних рангах.
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
          Game.dispatch(state, { type: "TRAIN_HERO", heroId: target.id });
          stats.trains = (stats.trains || 0) + 1;
        }
        stats.shops++;
        Game.dispatch(state, { type: "LEAVE_SHOP" });
      } else if (state.combat.outcome === "failed") {
        Game.dispatch(state, { type: "RETRY_WAVE" });
        stats.retries++;
      } else {
        break;
      }
    }
    stats.won = state.phase === "victory";
    stats.waves = state.run.waveIndex + (stats.won ? 1 : 0);
    stats.damage = state.stats.totalDamage;
    stats.barracks = state.run.barracks;
    return stats;
  }
`, ctx);

function runMode(rules, seeds, policy, rank) {
  const per = [];
  for (let i = 0; i < seeds; i++) {
    const seed = String(1000 + i * 37);
    const stats = ctx.abPlayRun(rules, seed, policy, rank);
    per.push(stats);
    if (VERBOSE && i < VERBOSE) {
      console.log(`  [${rules}/${policy}] seed ${seed}: ${stats.won ? "ПОБЕДА" : "поражение"} · волн ${stats.waves} · боёв ${stats.fights} · казарм потеряно ${stats.retries} · предметов ${stats.items}`);
    }
  }
  const sum = (fn) => per.reduce((a, s) => a + fn(s), 0);
  return {
    rules,
    per,
    wins: sum((s) => (s.won ? 1 : 0)),
    waves: sum((s) => s.waves) / seeds,
    fights: sum((s) => s.fights) / seeds,
    retries: sum((s) => s.retries) / seeds,
    damage: sum((s) => s.damage) / seeds,
    positionalShare: sum((s) => s.positional) / Math.max(1, sum((s) => s.fights)),
    bondsPerFight: sum((s) => s.bonds) / Math.max(1, sum((s) => s.fights)),
    avgTier: sum((s) => s.tiers) / Math.max(1, sum((s) => s.fights)),
  };
}

const RANK = Number(arg("rank", 0));
const SWEEP = Number(arg("sweep", 0));

const t0 = Date.now();
console.log(`A/B: classic vs formation · ${SEEDS} сидов · два бота: greedy (превью-максимум) и naive (первая пятёрка)\n`);
if (SWEEP) {
  // Свип по лиге: победы ботов на каждом ранге (formation — основное ядро).
  console.log(`Свип лиги: ранги ${SWEEP}–14 · ${SEEDS} сидов на ранг
`);
  console.log("Ранг".padEnd(20) + "greedy".padStart(9) + "naive".padStart(9) + "   казарм/сид  волн(greedy)");
  for (let rank = SWEEP; rank <= 14; rank++) {
    const g = runMode("formation", SEEDS, "greedy", rank);
    const n = runMode("formation", SEEDS, "naive", rank);
    const name = rank + " " + vm.runInContext("Content", ctx).ranks.byId[rank].name;
    console.log(name.padEnd(20) + String(g.wins + "/" + SEEDS).padStart(9) + String(n.wins + "/" + SEEDS).padStart(9)
      + String(g.retries.toFixed(2)).padStart(12) + String(g.waves.toFixed(1)).padStart(13));
  }
  console.log("");
  process.exit(0);
}

function printTable(policy, classic, formation) {
  console.log(`=== БОТ: ${policy.toUpperCase()} ===`);
  console.log("Показатель                  " + "classic".padStart(16) + " formation".padStart(16));
  console.log("-".repeat(60));
  const row = (label, fmt, fn) => {
    const a = fn(classic), b = fn(formation);
    console.log(`${label.padEnd(26)} ${String(fmt(a)).padStart(16)} ${String(fmt(b)).padStart(16)}`);
  };
  row("Побед над Рошаном", (v) => v + "/" + SEEDS, (m) => m.wins);
  row("Волн в среднем", (v) => v.toFixed(2), (m) => m.waves);
  row("Боёв в среднем", (v) => v.toFixed(1), (m) => m.fights);
  row("Провалов (казарм)", (v) => v.toFixed(2), (m) => m.retries);
  row("Всего урона в среднем", (v) => Math.round(v).toLocaleString("ru"), (m) => m.damage);
  row("Доля позиционных формаций", (v) => Math.round(v * 100) + "%", (m) => m.positionalShare);
  row("Связок на бой", (v) => v.toFixed(2), (m) => m.bondsPerFight);
  row("Средний tier формации", (v) => v.toFixed(2), (m) => m.avgTier);
  console.log("");
}

for (const policy of ["greedy", "naive"]) {
  const classic = runMode("classic", SEEDS, policy, RANK);
  const formation = runMode("formation", SEEDS, policy, RANK);
  printTable(policy, classic, formation);
}
console.log(`Готово за ${((Date.now() - t0) / 1000).toFixed(1)} с. Цели плейтеста (§10): доля позиционных > 40%,`);
console.log("связок на бой 2–4; naive-бот показывает пол: если formation-пол заметно выше — гипотеза о «поднятии пола» подтверждается.");
