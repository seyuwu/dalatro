// Бот-«игрок» (фаза I-full). Закрывает документированные пробелы жадного бота
// (BALANCE.md §«Замер I-mini», стена п.3): сбросы, выбор маршрута, активки
// улучшений (Игнор/Счастливый случай/Сюрприз/Торгаш/Пересдача), контр-закупка
// под мины, выбор проклятий забега по предпочтению, тренировки с резервом.
// Боевая логика — тот же жадный перебор превью, что в ab.mjs (политика greedy).
//
// Цель — верхняя оценка ДОСТИЖИМОГО: если и этот бот 0% на ранге, стена в
// числах мира, а не в скилле бота. Метрики §6.4: золото/предметы/улучшения
// на контрольных волнах 5/10/14 — темп сборки билда по актам.
//
//   node tests/player.mjs                          # ранги 1,3,5,7 × 20 сидов (formation)
//   node tests/player.mjs --ranks=1,2 --seeds=30
//   node tests/player.mjs --rules=classic          # классика вместо формаций
//   node tests/player.mjs --sweep=1 --seeds=20     # вся лига 1..14
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
  "src/content/aghanims.js",
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
  "src/systems/combat.js",
  "src/systems/economy.js",
  "src/engine/game.js",
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
const SEEDS = Number(arg("seeds", 20));
const RULES = arg("rules", "formation") === "classic" ? "classic" : "formation";
const SWEEP = Number(arg("sweep", 0));
const RANKS = args_ranks();
function args_ranks() {
  if (SWEEP) return null;
  const raw = arg("ranks", "1,3,5,7");
  return raw.split(",").map(Number);
}

vm.runInContext(`
  function plCombinations(arr, k) {
    const out = [];
    const rec = (start, acc) => {
      if (acc.length === k) { out.push(acc.slice()); return; }
      for (let i = start; i < arr.length; i++) { acc.push(arr[i]); rec(i + 1, acc); acc.pop(); }
    };
    rec(0, []);
    return out;
  }

  // Жадный перебор из ab.mjs: все подмножества руки (в formation — ещё и
  // порядки), максимум урона из превью. Превью не расходует стрим RNG.
  function plBestSelection(state) {
    const hand = state.player.handUids.filter((uid) => !(state.combat.minedUids || []).includes(uid));
    const maxK = Math.min(Game.maxSlots(state), hand.length);
    const rankOf = (uid) => Game.rankOf(state, state.cards[uid].heroId);
    const formation = state.rules === "formation";
    let best = null;
    for (let k = 1; k <= maxK; k++) {
      for (const subset of plCombinations(hand, k)) {
        let orders = [subset];
        if (formation && k >= 3) {
          orders = [subset,
            subset.slice().sort((a, b) => rankOf(a) - rankOf(b)),
            subset.slice().sort((a, b) => rankOf(b) - rankOf(a))];
          const seen = new Set();
          orders = orders.filter((o) => { const key = o.join("|"); if (seen.has(key)) return false; seen.add(key); return true; });
        }
        for (const uids of orders) {
          const clone = structuredClone(state);
          clone.simulate = true;
          const res = Rng.suppress(() => {
            for (const uid of uids) Game.dispatch(clone, { type: "SELECT_CARD", uid });
            Game.dispatch(clone, { type: "CONFIRM_FIGHT" });
            return clone.combat.lastResolution;
          });
          if (res && (!best || res.damage > best.damage)) best = { uids, damage: res.damage };
        }
      }
    }
    return best || { uids: hand.slice(0, 1), damage: 0 };
  }

  // сброс: если лучший ход из руки не дотягивает до темпа зачистки
  // (damage < HP/осталось боёв), сбрасываем всё, что не входит в лучшее комбо,
  // и перетягиваем. Один сброс = один ход независимо от числа карт.
  function plMaybeDiscard(state) {
    if (state.player.discardsLeft <= 0) return null;
    const best = plBestSelection(state);
    const needed = state.combat.wave.hp / Math.max(1, state.player.fightsLeft);
    if (best.damage >= needed * 0.95) return { best, discarded: false };
    const keep = new Set(best.uids);
    const toss = state.player.handUids.filter((uid) => !keep.has(uid) && !(state.combat.minedUids || []).includes(uid));
    if (toss.length < 2) return { best, discarded: false };
    Game.dispatch(state, { type: "DISCARD", uids: toss });
    return { best: plBestSelection(state), discarded: true };
  }

  // Выбор маршрута: таблица оценок + групповые фолбэки. Кэмп — жизнь при
  // последней казарме, элитка — фармер эпиков при полном здоровье.
  const PL_ROUTE_SCORE = {
    camp: 15, elite: 12, strong: 28, lastbastion: 30, papochka: 3,
    fragile: 26, berserk: 24, swift: 22, twin: 16, siege: 20, nullarmor: 24,
    reflector: 12, devourer: 10, shieldbearer: 8, disarmer: 18,
    mutetower: 6, formationjam: 14, hunter: 12, archivist: 12,
    goldvein: 22, greed: 20, casinoroute: 18, dice: 16, coinflip: 10, allin: 4,
    banker: 24, taxoffice: 20, usury: 18, loanshark: 20, blackmarket: 22,
    smuggling: 24, brokenrelic: 8, threedoors: 18, altar: 16, cursedshop: 14,
    salered: 14, junkyard: 16, wealth: 22, forge: 16, repairshop: 20,
    exchanger: 12, pawnshop: 10, inflationroute: 16, bankruptcy: 4,
    extendedhand: 24, emptyhand: 16, dupe: 20, burningcard: 12, instability: 12,
    ban: 14, sequence: 12, wildcardroute: 18, bloodhand: 14, lifeexchange: 10,
    tavernroute: 20, mercenary: 18, halfhero: 18, rotation: 12, duel: 14,
    ascension: 20, sacrifice: 8, twinsroute: 16, conflict: 8, returnroute: 10,
    blockedslot: 12, goldslot: 20, floatingpos: 12, lonewolf: 16, architect: 26,
    scout: 8, shoppeek: 14, scanner: 8, secondtry: 10, blackcontract: 18,
    devildeal: 12, riskypath: 20, debt: 14, lastchance: 16, secondlife: 14,
    echo: 26, sin: 8, timepress: 10, mirror: 8, mirrorreality: 8, anomaly: 14,
  };
  function plRoutePick(state) {
    const opts = state.combat.routeOptions;
    const act = state.run.act || 1;
    const barracks = state.run.barracks;
    const hasIgnor = (state.run.upgrades || []).includes("ignor");
    let best = null;
    for (const opt of opts) {
      let score = PL_ROUTE_SCORE[opt.id] != null ? PL_ROUTE_SCORE[opt.id] : 12;
      if (opt.id === "camp") score = barracks <= 1 ? 1000 : 15;
      if (opt.id === "elite") score = barracks === 2 && act >= 2 ? 45 : 12;
      if (opt.id === "mutetower" && hasIgnor) score = 30; // Игнор снимает Безмолвие
      const route = Content.routes.byId[opt.id];
      if (route && route.curse && opt.id !== "elite") score = hasIgnor ? 24 : 6;
      if (route && (route.hpPerItem || route.defensePerItem) && state.player.items.length >= 4) score = 3;
      if (route && route.gold && state.run.gold < 6) score += 10;
      if (!best || score > best.score) best = { id: opt.id, score };
    }
    return best.id;
  }

  // Лавка: контр-закупка (мины впереди → Sentry), самый дорогой доступный
  // товар, Торгаш если делает товар доступным, все улучшения подряд,
  // Аугменты, рекруты с резервом, тренировки с резервом.
  function plShop(state, stats) {
    // Активка «Сюрприз»: бесплатный товар, если есть слот.
    if ((state.run.upgrades || []).includes("surprise")
      && Upgrades.canActivate(state, "surprise").ok) {
      Game.dispatch(state, { type: "ACTIVATE_UPGRADE", upgradeId: "surprise" });
      stats.actives++;
    }
    // Контр-закупка: мины в ближайших трёх волнах и нет обезвреживания.
    const nextIdx = state.run.waveIndex;
    const minesAhead = [1, 2, 3].some((k) => {
      const def = Content.waves.byId[Content.waves.order[nextIdx + k]];
      return def && (def.modifiers || []).some((m) => m.id === "mines");
    });
    if (minesAhead && !Game.hasItemRule(state, "disarmMines")) {
      const sentry = state.shop.offers.find((o) => o.id === "sentry" || o.id === "bkb");
      if (sentry && !Game.itemBlockedReason(state, sentry.id)
        && Game.itemCost(state, sentry.id) <= state.run.gold) {
        Game.dispatch(state, { type: "BUY_ITEM", itemId: sentry.id });
        stats.items++;
      }
    }
    // Самый дорогой доступный товар; Торгаш открывает почти доступный.
    let pick = null;
    for (const o of state.shop.offers) {
      if (Game.itemBlockedReason(state, o.id)) continue;
      const cost = Game.itemCost(state, o.id);
      if (cost > state.run.gold) continue;
      if (!pick || cost > Game.itemCost(state, pick)) pick = o.id;
    }
    if (!pick) {
      const near = state.shop.offers
        .filter((o) => !Game.itemBlockedReason(state, o.id))
        .map((o) => ({ id: o.id, cost: Game.itemCost(state, o.id) }))
        .filter((o) => o.cost > state.run.gold && Math.round(o.cost * 0.7) <= state.run.gold)
        .sort((a, b) => a.cost - b.cost)[0];
      if (near && (state.run.upgrades || []).includes("torgash")
        && Upgrades.canActivate(state, "torgash").ok) {
        Game.dispatch(state, { type: "ACTIVATE_UPGRADE", upgradeId: "torgash", targetId: near.id });
        stats.actives++;
        if (Game.itemCost(state, near.id) <= state.run.gold) pick = near.id;
      }
    }
    if (pick) { Game.dispatch(state, { type: "BUY_ITEM", itemId: pick }); stats.items++; }
    // Улучшения: скупаем всё доступное, самое дорогое первым (ab.mjs-логика).
    let upGuard = 20;
    while (upGuard-- > 0) {
      const affordable = (state.shop.upgrades || [])
        .map((o) => ({ id: o.id, tier: o.tier || 0,
          cost: (o.tier ? (Content.upgrades.byId[o.id] ? Content.upgrades.byId[o.id].cost : 0) * o.tier
            : (Content.upgrades.byId[o.id] ? Content.upgrades.byId[o.id].cost : 0)) || 0 }))
        .filter((u) => u.cost > 0 && u.cost <= state.run.gold)
        // Запасной слот растёт ×1.8 за уровень — не переплачиваем на поздних ступенях.
        .filter((u) => u.id !== Upgrades.HAND_SLOT_ID || u.cost <= 12)
        .sort((a, b) => b.cost - a.cost);
      if (!affordable.length) break;
      const before = state.run.gold + state.run.upgradePurchases;
      Game.dispatch(state, { type: "BUY_UPGRADE", upgradeId: affordable[0].id });
      if (state.run.gold + state.run.upgradePurchases === before) break;
      stats.upgrades++;
    }
    // Пустая полка и есть деньги — дешёвый реролл улучшений (1G). Виртуальные
    // карточки (слот/зелье/розетка) живут вне Content.upgrades.byId.
    const upgradeCost = (o) => {
      if (o.id === Upgrades.HAND_SLOT_ID) return Upgrades.handSlotDef(state).cost;
      if (o.id === Upgrades.ATTR_POTION_ID) return 5;
      if (o.id === Upgrades.RECHARGE_ID) return 5;
      const def = Content.upgrades.byId[o.id];
      return def ? (o.tier ? def.cost * o.tier : def.cost) : 0;
    };
    const anyUpgrade = (state.shop.upgrades || []).some((o) => {
      const c = upgradeCost(o);
      return c > 0 && c <= state.run.gold;
    });
    if (!anyUpgrade && state.run.gold >= 4) Game.dispatch(state, { type: "REROLL_UPGRADES" });
    // Аугменты Аганима.
    for (const o of (state.shop.aghanims || []).slice()) {
      const aug = Content.aghanims.forHero(o.heroId, o.kind);
      if (aug && state.run.gold >= aug.cost + 2) {
        Game.dispatch(state, { type: "BUY_AUGMENT", kind: o.kind, heroId: o.heroId });
        stats.aghanims++;
      }
    }
    // Рекруты с резервом.
    for (const heroId of (state.shop.recruits || []).slice()) {
      if (state.run.gold >= Game.recruitPrice(heroId) + 8) {
        Game.dispatch(state, { type: "BUY_RECRUIT", heroId });
        stats.recruits++;
      }
    }
    // Тренировки с резервом (не выгрызаем золото до нуля).
    let trainGuard = 40;
    while (state.run.gold >= Game.TRAIN_COST + 8 && trainGuard-- > 0) {
      const owned = [...state.player.handUids, ...state.player.deckUids, ...state.player.discardUids]
        .map((uid) => state.cards[uid].heroId);
      const ranks = state.run.ranks || {};
      const target = owned
        .map((id) => ({ id, rank: ranks[id] != null ? ranks[id] : Content.heroes.byId[id].power }))
        .filter((h) => h.rank < Game.TRAIN_RANK_MAX)
        .sort((a, b) => b.rank - a.rank)[0];
      if (!target) break;
      Game.dispatch(state, { type: "TRAIN_HERO", heroId: target.id });
      stats.trains++;
    }
    // Реролл товаров, когда полка пуста и золото с избытком.
    const cost = Ranks.rerollCost(state);
    const free = Game.archPerk(state) === "freeroll1" && !state.run.freeRerollUsed;
    if ((free || state.run.gold >= cost + 10) && state.shop.offers.length <= 2) {
      Game.dispatch(state, { type: "REROLL_SHOP" });
      stats.rerolls++;
    }
  }

  // Активки боя: Игнор — первый бой волны с проклятием (снимает Безмолвие,
  // Туман, Глиф и броню как BKB), Счастливый случай — боссы.
  function plWaveActives(state, stats) {
    const wave = state.combat.wave;
    if (!wave) return;
    const curseIds = (wave.modifiers || []).map((m) => m.id)
      .filter((id) => Content.modifiers.byId[id] && Content.modifiers.byId[id].curse);
    if (state.combat.fightIndex === 0 && curseIds.length
      && (state.run.upgrades || []).includes("ignor")
      && Upgrades.canActivate(state, "ignor").ok) {
      Game.dispatch(state, { type: "ACTIVATE_UPGRADE", upgradeId: "ignor" });
      stats.actives++;
    }
    if (wave.isBoss && (state.run.upgrades || []).includes("schastlivy")
      && Upgrades.canActivate(state, "schastlivy").ok) {
      Game.dispatch(state, { type: "ACTIVATE_UPGRADE", upgradeId: "schastlivy" });
      stats.actives++;
    }
  }

  // Проклятия забега: время (+сброс) > хаос > кровоток (урон дороже золота)
  // > паутина > голод (−тимфайт — самый жёсткий).
  const PL_CURSE_PREF = ["time", "chaos", "blood", "web", "hunger"];

  function plPlayRun(rank, seed) {
    let state = Game.dispatch(Game.createInitialState(""), { type: "START_RUN", seedCode: seed, rules: ${JSON.stringify(RULES)}, rank });
    const stats = { rank, seed, won: false, waves: 0, deaths: 0, items: 0, upgrades: 0, recruits: 0,
      trains: 0, rerolls: 0, aghanims: 0, actives: 0, discards: 0,
      routes: {}, snap: {}, death: null };
    let guard = 0;
    while (state.phase !== "victory" && state.phase !== "gameover" && guard++ < 600) {
      const snapKey = state.run.waveIndex + 1;
      if ((snapKey === 5 || snapKey === 10 || snapKey === 14) && !stats.snap[snapKey]
        && (state.phase === "wave" || state.phase === "shop" || state.phase === "route")) {
        stats.snap[snapKey] = { gold: state.run.gold, items: state.player.items.length,
          upgrades: (state.run.upgrades || []).length, act: state.run.act };
      }
      if (state.phase === "route") {
        const kind = plRoutePick(state);
        stats.routes[kind] = (stats.routes[kind] || 0) + 1;
        state = Game.dispatch(state, { type: "TAKE_ROUTE", kind });
      } else if (state.phase === "wave" && !state.combat.outcome) {
        plWaveActives(state, stats);
        const pick = plMaybeDiscard(state);
        if (pick && pick.discarded) stats.discards++;
        const best = pick ? pick.best : plBestSelection(state);
        for (const uid of best.uids) state = Game.dispatch(state, { type: "SELECT_CARD", uid });
        state = Game.dispatch(state, { type: "CONFIRM_FIGHT" });
        if (state.combat.outcome === "failed") {
          const res = state.combat.lastResolution;
          stats.death = { wave: state.run.waveIndex + 1,
            gold: state.run.gold, items: state.player.items.length,
            hpLeft: Math.max(0, state.combat.wave.hp),
            lastDamage: res ? res.damage : 0,
            mods: (state.combat.wave.modifiers || []).map((m) => m.id).join(",") || "none" };
        }
      } else if (state.run.pendingCurse) {
        const pick = PL_CURSE_PREF.find((c) => state.run.pendingCurse.includes(c))
          || state.run.pendingCurse[0];
        state = Game.dispatch(state, { type: "CHOOSE_CURSE", curseId: pick });
      } else if (state.combat.outcome === "cleared") {
        state = Game.dispatch(state, { type: "ENTER_SHOP" });
        plShop(state, stats);
        state = Game.dispatch(state, { type: "LEAVE_SHOP" });
      } else if (state.combat.outcome === "failed") {
        // Пересдача: активка «свободный ретрай», если куплена.
        let used = false;
        if ((state.run.upgrades || []).includes("peresdacha")
          && Upgrades.canActivate(state, "peresdacha").ok) {
          state = Game.dispatch(state, { type: "RETRY_WAVE", useUpgradeId: "peresdacha" });
          used = true;
          stats.actives++;
        }
        if (!used) state = Game.dispatch(state, { type: "RETRY_WAVE" });
        stats.deaths++;
      } else {
        break;
      }
    }
    stats.won = state.phase === "victory";
    stats.waves = state.run.waveIndex + (stats.won ? 1 : 0);
    stats.itemsFinal = state.player.items.length;
    stats.upgradesFinal = (state.run.upgrades || []).length;
    return stats;
  }
`, ctx);

const runs = [];
const t0 = Date.now();

function runBatch(rank, n) {
  for (let i = 0; i < n; i++) {
    const seed = "PL" + rank + String(i).padStart(2, "0");
    const s = vm.runInContext(`plPlayRun(${rank}, ${JSON.stringify(seed)})`, ctx);
    runs.push(s);
  }
}

if (SWEEP) {
  console.log(`Бот-«игрок» (I-full): свип лиги 1–14 · ${RULES} · ${SEEDS} сидов на ранг\n`);
  for (let rank = 1; rank <= 14; rank++) {
    runBatch(rank, SEEDS);
    process.stderr.write(`  [${new Date().toLocaleTimeString()}] ранг ${rank}: 20 забегов посчитано\n`);
  }
} else {
  console.log(`Бот-«игрок» (I-full): ранги ${RANKS.join(",")} · ${RULES} · ${SEEDS} сидов на ранг\n`);
  for (const rank of RANKS) {
    runBatch(rank, SEEDS);
    process.stderr.write(`  [${new Date().toLocaleTimeString()}] ранг ${rank}: ${SEEDS} забегов посчитано\n`);
  }
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}
const med = (a) => percentile(a.slice().sort((x, y) => x - y), 50);
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

console.log("Ранг".padEnd(20)
  + "win".padStart(7) + "волна P50".padStart(10) + "P90".padStart(5)
  + " | предметы 5/10/14 (медиана)".padEnd(30)
  + " | золото 5/10/14".padEnd(18) + " | улучш. к 10".padEnd(13));
console.log("-".repeat(120));
for (const rank of (SWEEP ? Array.from({ length: 14 }, (_, i) => i + 1) : RANKS)) {
  const rs = runs.filter((r) => r.rank === rank);
  if (!rs.length) continue;
  const won = rs.filter((r) => r.won).length;
  const waves = rs.map((r) => r.waves);
  const snap = (k, f) => {
    const vals = rs.filter((r) => r.snap[k]).map((r) => r.snap[k][f]);
    return vals.length ? String(med(vals)) : "–";
  };
  const name = rank + " " + vm.runInContext("Content", ctx).ranks.byId[rank].name;
  console.log(name.padEnd(20)
    + String(won + "/" + rs.length).padStart(7)
    + String(percentile(waves.slice().sort((a, b) => a - b), 50)).padStart(10)
    + String(percentile(waves.slice().sort((a, b) => a - b), 90)).padStart(5)
    + " |".padEnd(3) + [5, 10, 14].map((k) => snap(k, "items")).join("/")
    + "".padEnd(24)
    + " |".padEnd(3) + [5, 10, 14].map((k) => snap(k, "gold")).join("/")
    + "".padEnd(12) + " |".padEnd(3) + String(snap(10, "upgrades")));
}

// Причины смерти и маршрутные привычки — по всем рангам разом.
const deaths = runs.filter((r) => r.death);
if (deaths.length) {
  const modCount = new Map();
  for (const r of deaths) for (const m of r.death.mods.split(",")) modCount.set(m, (modCount.get(m) || 0) + 1);
  const top = [...modCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([m, n]) => `${m}:${n}`).join(" · ");
  const waveP50 = med(deaths.map((r) => r.death.wave));
  console.log(`\nСмерти: ${deaths.length} · волна P50 ${waveP50} · моды на волне смерти: ${top}`);
  const weak = deaths.filter((r) => r.death.lastDamage < r.death.hpLeft * 0.2).length;
  console.log(`Удары <20% остатка HP (нужен скейл, не точность): ${weak}/${deaths.length}`);
}
const routes = {};
for (const r of runs) for (const [k, n] of Object.entries(r.routes)) routes[k] = (routes[k] || 0) + n;
console.log(`Маршруты: ${Object.entries(routes).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${k}:${n}`).join(" · ")}`);
const agg = (f) => Math.round(avg(runs.map(f)) * 10) / 10;
console.log(`В среднем на забег: предметов ${agg((r) => r.items)} · улучшений ${agg((r) => r.upgrades)} · рекрутов ${agg((r) => r.recruits)} · тренировок ${agg((r) => r.trains)} · аугментов ${agg((r) => r.aghanims)} · активок нажато ${agg((r) => r.actives)} · сбросов ${agg((r) => r.discards)} · рероллов ${agg((r) => r.rerolls)}`);
console.log(`Готово за ${((Date.now() - t0) / 1000).toFixed(1)} с · забегов ${runs.length}`);
