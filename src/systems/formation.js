// FormationSys — альтернативное ядро скоринга (state.rules = "formation").
// Тот же контракт evaluate(cards), что у PokerSys, но детекция читает ПОРЯДОК
// слотов через detectPower-ранги, а формация выбирается по максимальному
// ИТОГОВОМУ урону, а не по приоритету тира. Все правила — данные из
// content/world.js (FORMATIONS_DATA / BONDS_DATA / TOWER_DEFENSE).
//
// Правило выбора (docs/REDESIGN_ANTI_BALATRO.md §12):
//   1. найти все валидные формации;
//   2. для каждой посчитать полный ожидаемый результат — итоговый урон
//      (связки + Σ сил карт + тип урона + защита цели);
//   3. выбрать максимум;
//   4. ничья — предпочесть позиционную формацию (порядок требует навыка).
//
// Контракт совместим с боевым пайплайном:
//   evaluate(cards, opts?) -> { id, name, tier, basePower, baseMult,
//                               damageType, damage, bonds[], alternatives[] }
// где cards = [{ power, attr, detectPower?, slotIndex }] в порядке слотов, а
// opts = { defense: {armor, mr}, armorPen, commit } — контекст цели и ставка.
const FormationSys = (function () {
  // Ранг для детекции — паритет с poker.js valueOf: Butterfly/Manta/Shadow
  // Blade меняют только его; реальная сила карт в Σ сил считает combat.
  function valueOf(card) {
    return card.detectPower != null ? card.detectPower : card.power;
  }

  function buildCtx(cards) {
    const bySlot = cards.slice().sort((a, b) => a.slotIndex - b.slotIndex);
    const powers = bySlot.map(valueOf);
    const attrs = bySlot.map((c) => c.attr);
    const counts = (arr) => {
      const m = new Map();
      for (const v of arr) m.set(v, (m.get(v) || 0) + 1);
      return m;
    };
    return {
      cards: bySlot,
      playedCards: bySlot,
      powers,
      attrs,
      attrCounts: counts(attrs),
      rankCounts: counts(powers),
      // Σ РЕАЛЬНЫХ сил (не detectPower) — combat.js добавляет её к базе на шаге 3.
      // Нужна здесь, потому что «полный ожидаемый результат» для выбора формации
      // обязан включать её: броня вычитается плоско, и константа меняет рейтинг.
      cardPower: bySlot.reduce((a, c) => a + (c.power || 0), 0),
      n: bySlot.length,
      maxPower: Math.max(...powers),
      minPower: Math.min(...powers),
    };
  }

  // Наибольшая длина подряд идущих рангов (для «Цепочки» и «Тимвайпа»).
  function longestRun(ctx) {
    const distinct = Array.from(new Set(ctx.powers)).sort((a, b) => a - b);
    let best = 1, run = 1;
    for (let i = 1; i < distinct.length; i++) {
      run = distinct[i] === distinct[i - 1] + 1 ? run + 1 : 1;
      if (run > best) best = run;
    }
    return distinct.length ? best : 0;
  }

  function ascending(ctx) {
    for (let i = 1; i < ctx.powers.length; i++) if (ctx.powers[i] <= ctx.powers[i - 1]) return false;
    return ctx.powers.length >= 3;
  }

  // Сильнейший герой стоит В ЦЕНТРЕ формации: для нечётного n — средний слот,
  // для чётного — один из двух средних.
  function peakInCenter(ctx) {
    if (ctx.n < 3) return false;
    const idx = ctx.powers.indexOf(ctx.maxPower);
    const mid = Math.floor((ctx.n - 1) / 2);
    return ctx.n % 2 === 1 ? idx === mid : idx === mid || idx === mid + 1;
  }

  // Кэрри в центре и заметно выше остальных — «4 protect 1». Порог — по
  // СИЛЬНЕЙШЕМУ из остальных (не по среднему): иначе три слабых героя
  // «разбавляют» планку и рядом с кэрри встаёт почти равный ему герой.
  function carryProtected(ctx, margin) {
    if (ctx.n < 5) return false;
    const center = Math.floor(ctx.n / 2);
    const carry = ctx.powers[center];
    if (carry !== ctx.maxPower) return false;
    const others = ctx.powers.filter((_, i) => i !== center);
    const strongestOther = Math.max(...others);
    return carry >= strongestOther + margin;
  }

  function frontIs(ctx, attr, minPower) {
    const front = ctx.cards.slice(0, 2);
    return front.length === 2 && front.every((c) => valueOf(c) >= minPower && c.attr === attr);
  }

  function backIs(ctx, attr, minPower) {
    const back = ctx.cards.slice(-2);
    return ctx.n >= 4 && back.every((c) => valueOf(c) >= minPower && c.attr === attr);
  }

  // Собственный eval-слой условий: новые типы читают ctx формации,
  // остальные отдаём существующему Cond (ctx.playedCards уже подставлен).
  function evalWhen(when, ctx) {
    if (!when) return true;
    if (when.all) return when.all.every((w) => evalWhen(w, ctx));
    if (when.any) return when.any.some((w) => evalWhen(w, ctx));
    if (when.not) return !evalWhen(when.not, ctx);

    switch (when.type) {
      case "PLAYED_COUNT_IS": return ctx.n === when.value;
      case "PLAYED_COUNT_ABOVE": return ctx.n > when.value;
      case "PLAYED_COUNT_BELOW": return ctx.n < when.value;
      case "DISTINCT_ATTRIBUTES_ABOVE": return new Set(ctx.attrs).size > when.value;
      case "SAME_ATTRIBUTE_COUNT_ABOVE": {
        // Универсал — отдельный бакет; со скипетром Starbreaker (opts.uniWildcard)
        // он — джокер: присоединяется к крупнейшему реальному бакету. Паритет с
        // Cond.evaluate (conditions.js) — превью и бой считают одинаково.
        const counts = {};
        for (const [a, n] of ctx.attrCounts) counts[a] = n;
        const uni = counts.uni || 0;
        if (ctx.uniWildcard && uni && Object.keys(counts).length > 1) {
          delete counts.uni;
          const best = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
          counts[best] += uni;
        }
        return Object.values(counts).some((n) => n > when.value);
      }
      case "FRONT_IS": return frontIs(ctx, when.attr, when.minPower || 0);
      case "BACK_IS": return backIs(ctx, when.attr, when.minPower || 0);
      case "PEAK_IN_CENTER": return peakInCenter(ctx);
      case "RANKS_ASCENDING": return ascending(ctx);
      case "RANK_RUN": return longestRun(ctx) >= when.value;
      case "CARRY_PROTECTED": return carryProtected(ctx, when.margin || 0);
      case "COUNT_ATTR": return (ctx.attrCounts.get(when.attr) || 0) >= when.min;
      case "SAME_RANK_GROUP": return Array.from(ctx.rankCounts.values()).some((n) => n >= when.size);
      default:
        // Делегируем в боевой Cond (COMBO_IS и пр. там уже умеют работать).
        if (typeof Cond !== "undefined") return Cond.evaluate(when, { playedCards: ctx.cards, card: null, slotIndex: -1 });
        return false;
    }
  }

  function resolveDamageType(def, ctx) {
    if (def.damageType !== "byAttribute") return def.damageType;
    const dominant = Array.from(ctx.attrCounts.entries()).sort((a, b) => b[1] - a[1])[0];
    return { str: "physical", agi: "physical", int: "magical", uni: "pure" }[dominant[0]] || "physical";
  }

  // Все активные связки (в отличие от формации — складываются все).
  function computeBonds(ctx) {
    const active = [];
    for (const bond of BONDS_DATA) {
      if (evalWhen(bond.when, ctx)) active.push(bond);
    }
    return active;
  }

  // Броня/сопротивление: третья ось. pure игнорирует защиту.
  function mitigate(rawDamage, damageType, defense, armorPen) {
    const pen = armorPen || 0;
    if (damageType === "pure") return Math.max(1, Math.round(rawDamage));
    if (damageType === "magical") {
      const mr = Math.max(0, (defense.mr || 0) - pen / 200);
      return Math.max(1, Math.round(rawDamage * (1 - mr)));
    }
    // Плоская броня, но не больше половины удара: мелкая рука не обнуляется.
    const armor = Math.max(0, (defense.armor || 0) - pen);
    const absorbed = Math.min(armor, rawDamage * 0.5);
    return Math.max(1, Math.round(rawDamage - absorbed));
  }

  // Строгий порядок «кто лучше»: урон → позиционность → база.
  function better(a, b) {
    if (a.damage !== b.damage) return a.damage > b.damage;
    if (!!a.positional !== !!b.positional) return !!a.positional;
    return a.basePower * a.baseMult > b.basePower * b.baseMult;
  }

  function scoreFormation(def, ctx, opts) {
    const bonds = computeBonds(ctx);
    const bondPower = bonds.reduce((a, b) => a + (b.power || 0), 0);
    const bondMult = bonds.reduce((a, b) => a + (b.mult || 0), 0);
    const basePower = def.basePower + bondPower;
    const baseMult = def.baseMult + bondMult;
    const damageType = resolveDamageType(def, ctx);
    // «Полный ожидаемый результат»: база + связки + Σ сил карт (реальных),
    // ставка (finalMult) до защиты — как в combat.js (шаги 3 → 6.5 → 7 → 8).
    // basePower в ответе остаётся БЕЗ Σ — её добавит combat (контракт PokerSys).
    const raw = (basePower + ctx.cardPower) * baseMult * (opts.commit || 1);
    const damage = opts.defense ? mitigate(raw, damageType, opts.defense, opts.armorPen) : raw;
    return { def, bonds, bondPower, bondMult, basePower, baseMult, damageType, raw, damage };
  }

  // Все валидные формации, отсортированные по итоговому урону.
  // Это данные для панели альтернатив: «Клин 347 / Фаланга 284 / Рампа 251».
  function rankFormations(cards, opts = {}) {
    const withSlots = cards.map((c, i) => ({ ...c, slotIndex: c.slotIndex != null ? c.slotIndex : i }));
    const ctx = buildCtx(withSlots);
    // Правило боя со скипетром Starbreaker (Dawnbreaker): Универсал — джокер
    // условий. Бой передаёт флаг из scoring.flags, превью — так же, как бой.
    ctx.uniWildcard = !!(opts && opts.uniWildcard);
    const list = [];
    for (const def of FORMATIONS_DATA) {
      if (!evalWhen(def.when, ctx)) continue;
      const s = scoreFormation(def, ctx, opts);
      list.push({
        id: s.def.id, name: s.def.name, tier: s.def.tier, rule: s.def.rule,
        positional: !!s.def.positional, damageType: s.damageType,
        formPower: s.def.basePower, formMult: s.def.baseMult,
        basePower: s.basePower, baseMult: s.baseMult,
        bonds: s.bonds, bondPower: s.bondPower, bondMult: s.bondMult,
        raw: s.raw, damage: s.damage,
      });
    }
    list.sort((a, b) => (better(a, b) ? -1 : better(b, a) ? 1 : 0));
    return { ctx, list };
  }

  function evaluate(cards, opts = {}) {
    if (!cards || !cards.length) return null;
    const { list } = rankFormations(cards, opts);
    if (!list.length) return null;
    const best = list[0];
    return {
      // Совместимость со старым контрактом PokerSys.
      type: best.id, name: best.name, basePower: best.basePower, baseMult: best.baseMult,
      // Новый слой.
      id: best.id, tier: best.tier, rule: best.rule, positional: best.positional,
      damageType: best.damageType, raw: best.raw, damage: best.damage,
      formPower: best.formPower, formMult: best.formMult,
      bonds: best.bonds, bondPower: best.bondPower, bondMult: best.bondMult,
      alternatives: list,
    };
  }

  // Подсказка перестановки: обмен двух слотов, дающий лучший итоговый урон.
  // Это и есть gameplay loop v2: «переставь Sven в центр → Клин 150 (+17)».
  // Возвращает { swap: [i, j], id, name, damage, gain } или null.
  function bestSwap(cards, opts = {}) {
    if (!cards || cards.length < 2) return null;
    const base = evaluate(cards, opts);
    if (!base) return null;
    // Позиции нормализуем сами: вызывающий может передать карты без slotIndex.
    const positioned = cards.map((c, i) => ({ ...c, slotIndex: c.slotIndex != null ? c.slotIndex : i }));
    let best = null;
    for (let i = 0; i < positioned.length; i++) {
      for (let j = i + 1; j < positioned.length; j++) {
        const swapped = positioned.map((c) => ({ ...c }));
        const ti = swapped[i].slotIndex, tj = swapped[j].slotIndex;
        swapped[i].slotIndex = tj;
        swapped[j].slotIndex = ti;
        const r = evaluate(swapped, opts);
        if (r && r.damage > (best ? best.damage : base.damage)) {
          best = { swap: [i, j], id: r.id, name: r.name, damage: r.damage };
        }
      }
    }
    if (!best || best.damage <= base.damage) return null;
    best.gain = best.damage - base.damage;
    return best;
  }

  return { evaluate, rankFormations, bestSwap, mitigate, computeBonds, buildCtx, evalWhen, better, longestRun };
})();
