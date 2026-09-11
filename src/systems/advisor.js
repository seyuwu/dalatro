// dotora — build advisor. Turns the run's deck + items into visible build
// directions (progress bars) and per-item synergy explanations for the shop.
// Pure analysis: reads state, mutates nothing.
const Advisor = (function () {
  function deckHeroes(state) {
    return Object.values(state.cards).map((c) => Content.heroes.byId[c.heroId]);
  }

  function countBy(arr, key) {
    const map = new Map();
    for (const x of arr) map.set(x[key], (map.get(x[key]) || 0) + 1);
    return map;
  }

  // Longest run of consecutive powers in the deck.
  function longestStraight(values) {
    const distinct = Array.from(new Set(values)).sort((a, b) => a - b);
    let best = { len: 1, from: distinct[0] };
    let len = 1;
    for (let i = 1; i < distinct.length; i++) {
      len = distinct[i] === distinct[i - 1] + 1 ? len + 1 : 1;
      if (len > best.len) best = { len, from: distinct[i - len + 1] };
    }
    return { len: best.len, from: best.from, to: best.from + best.len - 1 };
  }

  // Build directions visible in the shop. Sorted: closest to complete first.
  function analyzeBuilds(state) {
    const heroes = deckHeroes(state);
    const owned = new Set(state.player.items);
    const builds = [];

    // Flush lines per attribute.
    const byAttr = countBy(heroes, "attr");
    for (const [attr, n] of byAttr) {
      if (n >= 3) {
        builds.push({
          key: "flush_" + attr,
          name: `Тимфайт ${Content.attrNames[attr]}`,
          have: n, need: 5,
          hint: "Пять героев одного атрибута = флеш: 35 × 4",
        });
      }
    }

    // Straight run.
    const straight = longestStraight(heroes.map((h) => h.power));
    if (straight.len >= 3) {
      const missing = [];
      for (let v = straight.from; v <= straight.to; v++) {
        if (!heroes.some((h) => h.power === v)) missing.push(v);
      }
      builds.push({
        key: "straight",
        name: "Смок-стрит",
        have: straight.len, need: 5,
        hint: missing.length
          ? `Ранги ${straight.from}–${straight.to} есть, не хватает силы ${missing.join(" и ")}`
          : `Ранги ${straight.from}–${straight.to} собраны — играй их вместе`,
      });
    }

    // Trips.
    const byPower = countBy(heroes, "power");
    for (const [power, n] of byPower) {
      if (n >= 3) {
        builds.push({
          key: "trips_" + power,
          name: `Ганг силы ${power}`,
          have: n, need: 3,
          hint: `Три героя силы ${power} — ганг; +2 к фулл-хаусу с любой парой`,
        });
      }
    }

    // Crit build: Daedalus + PA + Refresher.
    const critPieces =
      (owned.has("daedalus") ? 1 : 0) +
      (heroes.some((h) => h.id === "pa") ? 1 : 0) +
      (owned.has("refresher") ? 1 : 0);
    if (critPieces >= 1) {
      builds.push({
        key: "crit",
        name: "Крит-билд",
        have: critPieces, need: 3,
        hint: "Daedalus (25% ×2) + Phantom Assassin (50% ×2) + Refresher (двойной рол)",
      });
    }

    // Morph engine: Morphling + Zeus.
    const hasMorph = heroes.some((h) => h.id === "morphling");
    const hasZeus = heroes.some((h) => h.id === "zeus");
    if (hasMorph && hasZeus) {
      builds.push({
        key: "morph_engine",
        name: "Морф-движок",
        have: hasMorph && hasZeus ? 2 : 1, need: 2,
        hint: "Zeus в руке слева от Morphling: морф копирует INT, зевс +2 к множителю",
      });
    }

    // Rank manipulation: Butterfly + Manta + Shadow Blade.
    const rulePieces =
      (owned.has("butterfly") ? 1 : 0) +
      (owned.has("manta") ? 1 : 0) +
      (owned.has("shadow_blade") ? 1 : 0);
    if (rulePieces >= 2) {
      builds.push({
        key: "ranksmith",
        name: "Кузня рангов",
        have: rulePieces, need: 3,
        hint: "Butterfly ± ранг слабейшего, Shadow Blade +1 сильнейшего, Manta копия — комбо собираются из ничего",
      });
    }

    return builds
      .map((b) => ({ ...b, pct: Math.min(100, Math.round((b.have / b.need) * 100)) }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 6);
  }

  // "What does THIS item give THIS run" — shown in the shop hover panel.
  function itemSynergy(itemId, state) {
    const heroes = deckHeroes(state);
    const owned = new Set(state.player.items);
    const heroIds = new Set(heroes.map((h) => h.id));
    const lines = [];
    const has = (id) => heroIds.has(id);

    switch (itemId) {
      case "daedalus":
        if (has("pa")) lines.push("Phantom Assassin в колоде — два независимых источника ×2");
        if (owned.has("refresher")) lines.push("Refresher Orb — крит прокатится дважды");
        break;
      case "refresher":
        lines.push(`Усилит ${heroes.filter((h) => h.ability).length} способностей героев колоды`);
        if (owned.has("daedalus") || has("pa")) lines.push("Криты смогут сработать дважды за бой");
        break;
      case "satanic": {
        const pairs = Array.from(countBy(heroes, "power").entries()).filter(([, n]) => n >= 2).map(([p]) => p);
        if (pairs.length) lines.push(`В колоде стабильные пары силы ${pairs.join(", ")} — Satanic будет жечь почти каждый бой`);
        break;
      }
      case "manta": {
        const pairs = Array.from(countBy(heroes, "power").entries()).filter(([, n]) => n >= 2).map(([p]) => p);
        if (pairs.length) lines.push(`Иллюзия превращает пару силы ${pairs.join("/")} в сет или фулл-хаус`);
        if (has("morphling")) lines.push("Morphling: иллюзия наследует его ранг и атрибут");
        break;
      }
      case "butterfly":
        lines.push("Игра применит ±ранг только если он улучшает комбо — минуса нет");
        if (has("cm")) lines.push("CM (2) → 3: из {2,3,5,5} собираются две пары");
        break;
      case "shadow_blade":
        lines.push("±1 ранг сильнейшей карты: 9+10 превращаются в пару 10-10 — игра берёт только улучшение");
        break;
      case "radiance":
        lines.push("Полная пятёрка героев = +15 силы");
        if (owned.has("drum") || owned.has("meteor_hammer")) lines.push("Дружит с билдом «играй много героев»");
        break;
      case "octarine": {
        const n = state.player.items.length;
        lines.push(`Сейчас предметов: ${n} → +${n} к множителю за каждый бой`);
        lines.push("Покупай вместе с ним — ядро растёт");
        break;
      }
      case "vladmir":
        lines.push("≈ +8 золота за волну (4 боя) — окупается за волну");
        break;
      case "midas":
        lines.push("Удваивает золото с оверкилла — бей точно в ноль HP для ласт-хита");
        break;
      case "rapier":
        lines.push("Сейчас: ×2 к итоговому урону каждого боя");
        lines.push("Провал волны = рапира у врага (×0.5 к твоему урону по нему)");
        break;
      case "bkb": {
        const nextWave = Content.waves.byId[Content.waves.order[state.run.waveIndex + 1]];
        if (nextWave && nextWave.modifiers.length) {
          const defs = nextWave.modifiers.map((m) => Content.modifiers.byId[m.id].name).join(", ");
          lines.push(`Следующая башня: ${nextWave.name} (${defs}) — BKB это игнорирует`);
        } else {
          lines.push("Ближайшие башни без модификаторов — прибереги или продай");
        }
        break;
      }
      case "sentry": {
        const minesWave = Content.waves.order
          .slice(state.run.waveIndex + 1)
          .map((id) => Content.waves.byId[id])
          .find((w) => (w.modifiers || []).some((m) => m.id === "mines"));
        if (minesWave) lines.push(`Впереди ${minesWave.name}: без вардов каждый бой теряет 2 карты руки`);
        else lines.push("Techies остались позади — Sentry больше не нужен, можно продать");
        break;
      }
      case "bloodstone": {
        const lost = Math.max(0, 6 - state.run.barracks);
        lines.push(lost
          ? `Сейчас +${lost * 0.5} к множителю (${lost} казарм потеряно)`
          : "Казармы целы — камень спит. Расцветает после провалов");
        break;
      }
      case "heart":
        if (byAttrHas(heroes, "str", 4)) lines.push("Флеш Силы почти собран — Heart утяжелит каждый удар");
        break;
      case "meteor_hammer":
      case "drum":
        lines.push("Сыграй 4–5 героев, чтобы триггер был стабилен");
        break;
      case "kaya":
        lines.push("Качает обе оси сразу — безопасный первый предмет");
        break;
      case "battle_fury":
        lines.push("Любит руки с одной большой картой и мусором рядом");
        break;
    }
    return lines;
  }

  function byAttrHas(heroes, attr, n) {
    return heroes.filter((h) => h.attr === attr).length >= n;
  }

  return { analyzeBuilds, itemSynergy };
})();
