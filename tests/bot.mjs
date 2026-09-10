// Бот-бейзлайн (фаза I-mini, спек §10). Жадный бот играет полные забеги и
// собирает метрики решений: winrate по рангам, медианная волна, медианы золота,
// предметов/рероллов, доминирующие комбо/герой, частоты маршрутов, причины
// смерти и МАРЖА ВЫБОРА (зазор лучший/следующий вариант — прокси «колебаний»:
// маленькая маржа на частых выборах = подозрение на UI-причину).
//
//   node tests/bot.mjs                    # Recruit/Knight/Hero/Legend ×20, Titan ×50
//   node tests/bot.mjs --seeds=50 --ranks=1,7
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

vm.runInContext(
  `
  const __runs = [];
  const __decisions = [];

  function botCombos(arr, k) {
    const out = [];
    const rec = (start, acc) => {
      if (acc.length === k) { out.push(acc.slice()); return; }
      for (let i = start; i < arr.length; i++) { acc.push(arr[i]); rec(i + 1, acc); acc.pop(); }
    };
    rec(0, []);
    return out;
  }

  // Возвращает отсортированные варианты {uids, damage} — для маржи выбора.
  function botRankedSelections(state) {
    const hand = state.player.handUids.filter((uid) => !(state.combat.minedUids || []).includes(uid));
    const maxK = Math.min(Game.maxSlots(state), hand.length);
    const out = [];
    for (let k = 1; k <= maxK; k++) {
      for (const uids of botCombos(hand, k)) {
        const res = Rng.suppress(() => {
          const clone = structuredClone(state);
          clone.simulate = true;
          for (const uid of uids) Game.dispatch(clone, { type: "SELECT_CARD", uid });
          Game.dispatch(clone, { type: "CONFIRM_FIGHT" });
          return clone.combat.lastResolution;
        });
        out.push({ uids, damage: res ? res.damage : 0, comboId: res ? res.combo.type : null });
      }
    }
    out.sort((a, b) => b.damage - a.damage);
    return out;
  }

  function botPlayRun(rank, seed) {
    let state = Game.dispatch(Game.createInitialState(""), { type: "START_RUN", seedCode: seed, rank });
    const run = {
      rank, seed, won: false, wave: 0, deaths: 0, golds: [], itemsBought: 0, rerolls: 0,
      routePicks: { normal: 0, elite: 0, camp: 0 },
      comboUses: {}, heroUses: {},
      death: null, // { wave, gold, items, mods, lastDamage, blocked }
    };
    const noteUses = (playedUids, comboId) => {
      if (comboId) run.comboUses[comboId] = (run.comboUses[comboId] || 0) + 1;
      for (const uid of playedUids) {
        const h = state.cards[uid] && state.cards[uid].heroId;
        if (h) run.heroUses[h] = (run.heroUses[h] || 0) + 1;
      }
    };
    let guard = 0;
    while (state.phase !== "victory" && state.phase !== "gameover" && guard++ < 500) {
      if (state.phase === "route") {
        const kind = state.run.barracks <= 1 && !state.combat.campTaken ? "camp" : "normal";
        run.routePicks[kind]++;
        state = Game.dispatch(state, { type: "TAKE_ROUTE", kind });
      } else if (state.phase === "wave" && !state.combat.outcome) {
        const sel = botRankedSelections(state);
        if (sel.length >= 2) {
          __decisions.push({ rank, margin: sel[0].damage - sel[1].damage, wave: state.run.waveIndex + 1 });
        }
        for (const uid of sel[0].uids) state = Game.dispatch(state, { type: "SELECT_CARD", uid });
        const playedUids = sel[0].uids.slice();
        const playedCombo = sel[0].comboId;
        state = Game.dispatch(state, { type: "CONFIRM_FIGHT" });
        noteUses(playedUids, playedCombo);
        run.golds.push(state.run.gold);
        if (state.combat.outcome === "failed") {
          const res = state.combat.lastResolution;
          run.death = {
            wave: state.run.waveIndex + 1,
            gold: state.run.gold,
            items: state.player.items.length,
            hpLeft: Math.max(0, state.combat.wave.hp),
            lastDamage: res ? res.damage : 0,
            blocked: res ? !!res.blocked : false,
            mods: (state.combat.wave.modifiers || []).map((m) => m.id).join(",") || "none",
          };
        }
      } else if (state.run.pendingCurse) {
        state = Game.dispatch(state, { type: "CHOOSE_CURSE", curseId: state.run.pendingCurse[0] });
      } else if (state.combat.outcome === "cleared") {
        state = Game.dispatch(state, { type: "ENTER_SHOP" });
        let bestItem = null;
        for (const o of state.shop.offers) {
          if (Game.itemBlockedReason(state, o.id)) continue;
          if (Game.itemCost(state, o.id) > state.run.gold) continue;
          if (!bestItem || Game.itemCost(state, o.id) > Game.itemCost(state, bestItem)) bestItem = o.id;
        }
        if (bestItem) { state = Game.dispatch(state, { type: "BUY_ITEM", itemId: bestItem }); run.itemsBought++; }
        for (const heroId of (state.shop.recruits || []).slice()) {
          if (state.run.gold >= Game.recruitPrice(heroId) + 6) {
            state = Game.dispatch(state, { type: "BUY_RECRUIT", heroId });
          }
        }
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
        // Реролл, когда богат и ассортимент пуст.
        const cost = Ranks.rerollCost(state);
        const free = Game.archPerk(state) === "freeroll1" && !state.run.freeRerollUsed;
        if ((free || state.run.gold >= cost + 8) && state.shop.offers.length <= 2) {
          state = Game.dispatch(state, { type: "REROLL_SHOP" });
          if (free || state.run.gold < cost + 8) run.rerolls++;
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
  0;
  `,
  ctx,
  { filename: "bot-engine.js" }
);

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, "").split("=");
  return [k, v === undefined ? true : v];
}));
const SEEDS = Number(args.seeds || 20);
const RANKS = args.ranks ? String(args.ranks).split(",").map(Number) : [1, 2, 3, 4, 7];
const TITAN_SEEDS = Number(args.titanSeeds || 50);

console.log(`Бот-бейзлайн DALATRO: ранги ${RANKS.join(",")} ×${SEEDS}${RANKS.includes(7) ? `, Титан ×${TITAN_SEEDS}` : ""}\n`);
for (const rank of RANKS) {
  const n = rank === 7 ? TITAN_SEEDS : SEEDS;
  vm.runInContext(`for (let i = 0; i < ${n}; i++) botPlayRun(${rank}, "BOT${rank}" + String(i).padStart(2, "0"));`, ctx);
}

const runs = vm.runInContext("__runs", ctx);
const decisions = vm.runInContext("__decisions", ctx);

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const med = (a) => percentile(a.slice().sort((x, y) => x - y), 50);

for (const rank of RANKS) {
  const rs = runs.filter((r) => r.rank === rank);
  if (!rs.length) continue;
  const won = rs.filter((r) => r.won);
  const waves = rs.map((r) => r.wave).sort((a, b) => a - b);
  const golds = rs.map((r) => r.golds.length ? med(r.golds) : 0);
  const margin = decisions.filter((d) => d.rank === rank).map((d) => d.margin);
  const tinyMargin = margin.filter((m) => m === 0).length;
  console.log(`════ РАНГ ${rank} (${rs.length} забегов) ════`);
  console.log(`  winrate ${Math.round(100 * won.length / rs.length)}% · волна P50 ${percentile(waves, 50)} · P90 ${percentile(waves, 90)} · лучшая ${waves[waves.length - 1]}`);
  console.log(`  золото в бою P50 ${med(golds)} · предметов куплено ${Math.round(avg(rs.map((r) => r.itemsBought)) * 10) / 10} · рероллов ${Math.round(avg(rs.map((r) => r.rerolls)) * 10) / 10} · провалов ${Math.round(avg(rs.map((r) => r.deaths)) * 10) / 10}`);
  const routes = { normal: 0, elite: 0, camp: 0 };
  for (const r of rs) for (const k of Object.keys(routes)) routes[k] += r.routePicks[k] || 0;
  console.log(`  маршруты: обычная ${routes.normal} · элитка ${routes.elite} · лагерь ${routes.camp}`);
  // Доминирующие комбо/герои (спам-детектор §10).
  const agg = (key) => {
    const m = new Map();
    for (const r of rs) for (const [id, n] of Object.entries(r[key] || {})) m.set(id, (m.get(id) || 0) + n);
    const total = [...m.values()].reduce((a, b) => a + b, 0) || 1;
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([id, n]) => `${id} ${Math.round(100 * n / total)}%`).join(" · ");
  };
  console.log(`  комбо top: ${agg("comboUses")}`);
  console.log(`  герои top: ${agg("heroUses")}`);
  // Причины смерти: модификаторы волны смерти + последний удар.
  const deaths = rs.filter((r) => r.death);
  if (deaths.length) {
    const modCount = new Map();
    for (const r of deaths) {
      for (const m of r.death.mods.split(",")) modCount.set(m, (modCount.get(m) || 0) + 1);
    }
    const top = [...modCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([m, n]) => `${m}:${n}`).join(" · ");
    const blockedDeaths = deaths.filter((r) => r.death.blocked).length;
    const lowDamage = deaths.filter((r) => r.death.lastDamage < r.death.hpLeft * 0.2).length;
    console.log(`  смерти: волн P50 ${med(deaths.map((r) => r.death.wave))} · глиф-блоки ${blockedDeaths} · удары <20% HP цели ${lowDamage} · моды: ${top}`);
  }
  console.log(`  маржа выбора: P50 ${med(margin)} · нулевая маржа ${Math.round(100 * tinyMargin / (margin.length || 1))}% (частые «все варианты равны» → упрощение решений или UI)`);
  console.log("");
}
console.log(`Забегов: ${runs.length}. Метрики §10: спам-стратегии, экономика, причины смерти, маржа выбора.`);
