// Dalatro — effects.
// Content declares effects; ONLY this module (and the detection pipeline in
// combat.js for PRE_DETECT effects) applies them to state/scoring.
// Golden rule: content never mutates GameState directly.
//
// Two families:
//  - Scoring/economy effects run through Effects.apply() below.
//  - Pre-detection effects (COPY_ATTRIBUTE, CREATE_ILLUSION, WILD_RANK) are
//    interpreted by Combat.buildEffectiveSet() because they change what the
//    poker detector sees BEFORE a combo exists.
const Effects = (function () {
  function fmt(v) {
    return v > 0 ? "+" + v : String(v);
  }

  // Аудит силы (фаза D): каждое применение эффектов пишет структурный след в
  // scoring.trace — слои power/mult с разделением hero/item и списки
  // мультипликаторов. Читается тестами и tests/audit.mjs; на бой не влияет.
  function trace(ctx, kind, value) {
    const t = ctx.scoring && ctx.scoring.trace;
    if (!t) return;
    if (kind === "power") t[(ctx.sourceKind === "item" ? "itemPower" : "heroPower")] += value;
    else if (kind === "mult") t[(ctx.sourceKind === "item" ? "itemMult" : "heroMult")] += value;
    else if (kind === "mult_mult") t.multMult.push({ source: ctx.sourceName, value });
    else if (kind === "final_mult") t.finalMult.push({ source: ctx.sourceName, value });
  }

  const applicators = {
    ADD_POWER(effect, ctx) {
      ctx.scoring.power += effect.value;
      trace(ctx, "power", effect.value);
      return { label: `${ctx.sourceName}: +${effect.value} силы` };
    },
    ADD_MULT(effect, ctx) {
      ctx.scoring.mult += effect.value;
      trace(ctx, "mult", effect.value);
      return { label: `${ctx.sourceName}: +${effect.value} к множителю` };
    },
    MULT_MULT(effect, ctx) {
      ctx.scoring.mult *= effect.value;
      trace(ctx, "mult_mult", effect.value);
      return {
        label: `${ctx.sourceName}: ×${effect.value} множитель${ctx.note ? " (" + ctx.note + ")" : ""}`,
      };
    },
    FINAL_MULT(effect, ctx) {
      ctx.scoring.finalMult *= effect.value;
      trace(ctx, "final_mult", effect.value);
      return { label: `${ctx.sourceName}: ×${effect.value} к итоговому урону` };
    },
    ADD_POWER_FIRST_CARD(effect, ctx) {
      const first = ctx.playedCards && ctx.playedCards[0];
      if (!first) return null;
      const bonus = Math.max(1, Math.floor(first.power * effect.pct / 100));
      ctx.scoring.power += bonus;
      return { label: `${ctx.sourceName}: первая карта +${bonus} силы (+${effect.pct}%)` };
    },
    ADD_POWER_LAST_CARD(effect, ctx) {
      const n = ctx.playedCards && ctx.playedCards.length;
      if (!n) return null;
      const last = ctx.playedCards[n - 1];
      const bonus = Math.max(1, Math.floor(last.power * effect.pct / 100));
      ctx.scoring.power += bonus;
      return { label: `${ctx.sourceName}: последняя карта +${bonus} силы (+${effect.pct}%)` };
    },
    ADD_POWER_CENTER(effect, ctx) {
      const n = ctx.playedCards && ctx.playedCards.length;
      if (!n) return null;
      const mid = ctx.playedCards[Math.floor((n - 1) / 2)];
      const bonus = Math.max(1, Math.floor(mid.power * effect.pct / 100));
      ctx.scoring.power += bonus;
      return { label: `${ctx.sourceName}: центр отряда +${bonus} силы (+${effect.pct}%)` };
    },
    ADD_POWER_EDGES(effect, ctx) {
      const n = ctx.playedCards && ctx.playedCards.length;
      if (!n) return null;
      const edgePower = ctx.playedCards[0].power + (n > 1 ? ctx.playedCards[n - 1].power : 0);
      const bonus = Math.max(1, Math.floor(edgePower * effect.pct / 100));
      ctx.scoring.power += bonus;
      return { label: `${ctx.sourceName}: края отряда +${bonus} силы (+${effect.pct}%)` };
    },
    ADD_POWER_WEAKEST(effect, ctx) {
      if (!ctx.playedCards || !ctx.playedCards.length) return null;
      const weakest = ctx.playedCards.reduce((a, b) => (b.power < a.power ? b : a), ctx.playedCards[0]);
      const bonus = Math.max(1, Math.floor(weakest.power * effect.pct / 100));
      ctx.scoring.power += bonus;
      return { label: `${ctx.sourceName}: слабейший герой +${bonus} силы (+${effect.pct}%)` };
    },
    ADD_POWER_RANDOM_CARD(effect, ctx) {
      if (!ctx.playedCards || !ctx.playedCards.length) return null;
      const card = ctx.playedCards[Math.floor(Rng.current().next() * ctx.playedCards.length)];
      ctx.scoring.power += effect.value;
      return { label: `${ctx.sourceName}: ${card.heroId ? Content.heroes.byId[card.heroId].name : "карта"} +${effect.value} силы` };
    },
    ADD_DAMAGE_PCT(effect, ctx) {
      // Хуковые улучшения (фаза F): аддитивный процент поверх итогового урона.
      ctx.scoring.flags.dmgPct = (ctx.scoring.flags.dmgPct || 0) + effect.value;
      return { label: `${ctx.sourceName}: +${effect.value}% к урону` };
    },
    WEAKEST_POWER_DOUBLE(effect, ctx) {
      const powers = ctx.playedCards.map((c) => c.power);
      if (!powers.length) return null;
      const weakest = Math.min(...powers);
      ctx.scoring.power += weakest;
      return { label: `${ctx.sourceName}: cleave +${weakest} (сила слабейшего)` };
    },
    ADD_POWER_PER_PLAYED(effect, ctx) {
      const n = ctx.playedCards.length;
      if (!n) return null;
      ctx.scoring.power += effect.value * n;
      return { label: `${ctx.sourceName}: +${effect.value * n} силы (${n} героев × ${effect.value})` };
    },
    ADD_MULT_PER_PLAYED(effect, ctx) {
      const n = ctx.playedCards.length;
      if (!n) return null;
      const bonus = Math.round(effect.value * n * 100) / 100;
      ctx.scoring.mult += bonus;
      return { label: `${ctx.sourceName}: +${bonus} к множителю (${n} героев × ${effect.value})` };
    },
    TOWER_BURN(effect, ctx) {
      ctx.scoring.flags.towerBurn = (ctx.scoring.flags.towerBurn || 0) + effect.value;
      return { label: `${ctx.sourceName}: осада — башне нанесётся +${effect.value} чистого урона сверх удара` };
    },
    ADD_MULT_PER_ITEM(effect, ctx) {
      const n = ctx.state.player.items.length;
      if (!n) return null;
      ctx.scoring.mult += effect.value * n;
      return { label: `${ctx.sourceName}: +${effect.value * n} к множителю (${n} предметов)` };
    },
    ADD_MULT_PER_LOST_BARRACKS(effect, ctx) {
      const max = (typeof Game !== "undefined" && Game.BARRACKS_MAX) || 6;
      const lost = Math.max(0, max - ctx.state.run.barracks);
      if (!lost) return null;
      const bonus = Math.round(effect.value * lost * 10) / 10;
      ctx.scoring.mult += bonus;
      return { label: `${ctx.sourceName}: +${bonus} к множителю (${lost} разрушенных казарм)` };
    },
    ADD_POWER_PER_LOST_BARRACKS(effect, ctx) {
      const max = (typeof Game !== "undefined" && Game.BARRACKS_MAX) || 6;
      const lost = Math.max(0, max - ctx.state.run.barracks);
      if (!lost) return null;
      ctx.scoring.power += effect.value * lost;
      return { label: `${ctx.sourceName}: +${effect.value * lost} силы (${lost} разрушенных казарм)` };
    },
    ADD_POWER_PER_PAIR_GROUP(effect, ctx) {
      const counts = new Map();
      for (const c of ctx.playedCards) counts.set(c.power, (counts.get(c.power) || 0) + 1);
      const groups = [...counts.values()].filter((n) => n >= 2).length;
      if (!groups) return null;
      ctx.scoring.power += effect.value * groups;
      return { label: `${ctx.sourceName}: +${effect.value * groups} силы (${groups} групп рангов)` };
    },
    ADD_POWER_PER_EMPTY_SLOT(effect, ctx) {
      const maxSlots = (typeof Game !== "undefined" && Game.maxSlots) ? Game.maxSlots(ctx.state) : 5;
      const empty = Math.max(0, maxSlots - ctx.playedCards.length);
      if (!empty) return null;
      ctx.scoring.power += effect.value * empty;
      return { label: `${ctx.sourceName}: +${effect.value * empty} силы (${empty} пустых позиций)` };
    },
    ADD_POWER_PER_SAME_RANK(effect, ctx) {
      if (!ctx.card) return null;
      const tol = effect.tolerance || 0;
      const near = ctx.playedCards.filter((c) => Math.abs(c.power - ctx.card.power) <= tol).length - 1;
      if (near <= 0) return null;
      ctx.scoring.power += effect.value * near;
      const how = tol ? `${near} героя ранга ±${tol}` : `${near} героя своего ранга`;
      return { label: `${ctx.sourceName}: +${effect.value * near} силы (${how})` };
    },
    ADD_POWER_PER_DISCARD(effect, ctx) {
      const bonus = Math.min(effect.cap || Infinity, ctx.state.player.discardUids.length) * effect.value;
      if (!bonus) return null;
      ctx.scoring.power += bonus;
      return { label: `${ctx.sourceName}: +${bonus} силы из сброса (${ctx.state.player.discardUids.length} карт)` };
    },
    ADD_POWER_PER_USED_DISCARD(effect, ctx) {
      const base = (typeof Game !== "undefined" && Game.DISCARDS_PER_WAVE) || 3;
      const used = Math.max(0, base - ctx.state.player.discardsLeft);
      const bonus = used * (effect.value || 4);
      if (!bonus) return null;
      ctx.scoring.power += bonus;
      return { label: `${ctx.sourceName}: +${bonus} силы (${used} ТП-сбросов за волну)` };
    },
    ADD_POWER_PER_NEIGHBOR(effect, ctx) {
      const n = ctx.playedCards ? ctx.playedCards.length : 0;
      if (n < 2) return null;
      // Герой считается с фактическими соседями; предмет «скрепляет строй»
      // целиком (максимум смежности = n−1).
      const neighbors = ctx.slotIndex != null && ctx.slotIndex >= 0
        ? (ctx.slotIndex > 0 ? 1 : 0) + (ctx.slotIndex < n - 1 ? 1 : 0)
        : n - 1;
      if (!neighbors) return null;
      ctx.scoring.power += effect.value * neighbors;
      const word = neighbors === 1 ? "сосед" : neighbors < 5 ? "соседа" : "соседей";
      const how = ctx.slotIndex != null && ctx.slotIndex >= 0
        ? `${neighbors} ${word} по слоту`
        : `строй из ${n} героев`;
      return { label: `${ctx.sourceName}: +${effect.value * neighbors} силы (${how})` };
    },
    DENY_REVIVE(effect, ctx) {
      ctx.scoring.flags.denyRevive = true;
      return { label: `${ctx.sourceName}: башня больше не возродится (Aegis заблокирован)` };
    },
    ADD_ARMOR_PEN(effect, ctx) {
      ctx.scoring.flags.armorPen = (ctx.scoring.flags.armorPen || 0) + effect.value;
      return { label: `${ctx.sourceName}: −${effect.value} к броне башни (формации)` };
    },
    PIERCE_MR(effect, ctx) {
      ctx.scoring.flags.pierceMr = true;
      return { label: `${ctx.sourceName}: магический урон игнорирует сопротивление башни` };
    },
    ADD_MULT_PER_ATTRIBUTE(effect, ctx) {
      const n = ctx.playedCards.filter((c) => c.attr === effect.attr).length;
      if (!n) return null;
      ctx.scoring.mult += effect.value * n;
      return { label: `${ctx.sourceName}: +${effect.value * n} к множителю (${n} героев ${Content.attrNames[effect.attr]})` };
    },
    LAST_HIT_GOLD(effect, ctx) {
      ctx.scoring.flags.lastHitGold = (ctx.scoring.flags.lastHitGold || 0) + effect.value;
      return { label: `${ctx.sourceName}: точный ласт-хит принесёт +${effect.value} золота` };
    },
    GOLD(effect, ctx) {
      ctx.state.run.gold += effect.value;
      return { label: `${ctx.sourceName}: ${fmt(effect.value)} золота`, gold: effect.value };
    },
    IGNORE_TOWER_MODS(effect, ctx) {
      ctx.scoring.flags.ignoreTowerMods = true;
      return { label: `${ctx.sourceName}: игнорирует модификаторы башни` };
    },
    OVERKILL_RATE(effect, ctx) {
      ctx.scoring.flags.overkillRate *= effect.value;
      return { label: `${ctx.sourceName}: золото с оверкилла ×${effect.value}` };
    },
    REFRESH_HERO_TRIGGERS(effect, ctx) {
      ctx.scoring.flags.refreshHeroTriggers = true;
      return { label: `${ctx.sourceName}: способности героев срабатывают дважды` };
    },
    REVIVE(effect, ctx) {
      const tower = ctx.state.combat.wave;
      const restored = Math.max(1, Math.round((tower.maxHp * effect.hpPercent) / 100));
      tower.hp = restored;
      return { label: `Aegis: ${ctx.sourceName} возрождается с ${restored} HP`, revive: restored };
    },
    RETURN_TO_HAND(effect, ctx) {
      if (ctx.discardCtx) ctx.discardCtx.returnToHand = true;
      return { label: `${ctx.sourceName}: крюк вытягивает обратно в руку` };
    },
    // Скипетр «Burn the Racks» (Huskar): выставляет флаг — пост-бой код
    // выдаст +XP героям боя при зачистке волны с потерянной казармой.
    GRANT_XP_ON_CLEAR(effect, ctx) {
      ctx.scoring.flags.grantXpOnClear = (ctx.scoring.flags.grantXpOnClear || 0) + effect.value;
      return { label: `${ctx.sourceName}: казармы = опыт (при зачистке с потерей казармы)` };
    },
    // Скипетр «Avalanche» (Tiny): использованные ТП-сбросы волны растят ранг
    // навсегда (heroCharges, читается в Game.rankOf). Ранг влияет на комбо.
    GAIN_RANK_PER_USED_DISCARD(effect, ctx) {
      if (!ctx.sourceId) return null;
      const used = Math.max(0, Game.discardsPerWave(ctx.state) - ctx.state.player.discardsLeft);
      if (!used) return null;
      const charges = ctx.state.run.heroCharges;
      charges[ctx.sourceId] = charges[ctx.sourceId] || {};
      const before = charges[ctx.sourceId].rank || 0;
      const after = Math.min(effect.cap || Infinity, before + used * (effect.value || 1));
      if (after === before) return null;
      charges[ctx.sourceId].rank = after;
      return { label: `${ctx.sourceName}: ранг растёт +${after - before} (крепчает на ${after})` };
    },
    // Осколок «Phantom Rush» (PL): иллюзии этого боя считаются заданным атрибутом.
    // Правило боя — CREATE_ILLUSION читает флаг при создании иллюзии.
    ILLUSION_ATTR(effect, ctx) {
      ctx.scoring.flags.illusionAttr = effect.attr;
      return { label: `${ctx.sourceName}: иллюзии этого боя — ${Content.attrNames[effect.attr]}` };
    },
    // +сила за каждого соседа ПО СЛОТУ с заданным атрибутом (и за себя, если
    // includeSelf). Соседи по фактическому строю, не «где-то в отряде».
    ADD_POWER_PER_NEIGHBOR_ATTR(effect, ctx) {
      if (!ctx.playedCards || ctx.slotIndex == null || ctx.slotIndex < 0) return null;
      let count = effect.includeSelf && ctx.card && ctx.card.attr === effect.attr ? 1 : 0;
      ctx.playedCards.forEach((c, i) => {
        if (Math.abs(i - ctx.slotIndex) === 1 && c.attr === effect.attr) count += 1;
      });
      if (!count) return null;
      ctx.scoring.power += effect.value * count;
      return { label: `${ctx.sourceName}: +${effect.value * count} силы (${Content.attrNames[effect.attr]} рядом)` };
    },
    // Скипетр «Retaliate» (Centaur): +сила только за героев ПОЗАДИ (правее).
    ADD_POWER_PER_PLAYED_AFTER(effect, ctx) {
      if (!ctx.playedCards || ctx.slotIndex == null) return null;
      const after = ctx.playedCards.filter((c, i) => i > ctx.slotIndex).length;
      if (!after) return null;
      ctx.scoring.power += effect.value * after;
      return { label: `${ctx.sourceName}: +${effect.value * after} силы (${after} позади)` };
    },
    // +сила за каждого героя заданного атрибута в отряде (включая себя).
    ADD_POWER_PER_ATTRIBUTE(effect, ctx) {
      if (!ctx.playedCards) return null;
      const n = ctx.playedCards.filter((c) => c.attr === effect.attr).length;
      if (!n) return null;
      ctx.scoring.power += effect.value * n;
      return { label: `${ctx.sourceName}: +${effect.value * n} силы (${n} × ${Content.attrNames[effect.attr]})` };
    },
    // +множитель за каждый использованный в бою ТП-сброс.
    ADD_MULT_PER_USED_DISCARD(effect, ctx) {
      const base = Game.discardsPerWave(ctx.state);
      const used = Math.max(0, base - ctx.state.player.discardsLeft);
      if (!used) return null;
      const bonus = Math.round(effect.value * used * 100) / 100;
      ctx.scoring.mult += bonus;
      return { label: `${ctx.sourceName}: +${bonus} к множителю (${used} ТП-сброса)` };
    },
    // Скипетр «Sanity Overload» (Outworld): каждый атрибут СВЕРХ третьего.
    ADD_POWER_PER_EXTRA_DISTINCT(effect, ctx) {
      if (!ctx.playedCards) return null;
      const distinct = new Set(ctx.playedCards.map((c) => c.attr)).size;
      const extra = Math.max(0, distinct - 3);
      if (!extra) return null;
      ctx.scoring.power += effect.value * extra;
      if (effect.extraMult) ctx.scoring.mult += effect.extraMult * extra;
      const parts = [`+${effect.value * extra} силы`];
      if (effect.extraMult) parts.push(`+${Math.round(effect.extraMult * extra * 100) / 100} к множителю`);
      return { label: `${ctx.sourceName}: ${parts.join(", ")} (${extra} лишних атрибута)` };
    },
    // Осколок «Shuriken Toss» (Bounty): точный ласт-хит копит удачу (кап).
    ADD_LUCK_ON_LAST_HIT(effect, ctx) {
      if (!ctx.sourceId) return null;
      ctx.scoring.flags.luckOnLastHit = { heroId: ctx.sourceId, cap: effect.cap || 3 };
      return { label: `${ctx.sourceName}: точный ласт-хит даст +1 удачу` };
    },
    // Скипетр «Jinada» (Bounty): точный ласт-хит возвращает ТП-сброс на волну.
    REFUND_DISCARD(effect, ctx) {
      ctx.scoring.flags.refundDiscards = (ctx.scoring.flags.refundDiscards || 0) + (effect.value || 1);
      return { label: `${ctx.sourceName}: точный ласт-хит вернёт ${effect.value || 1} ТП-сброс` };
    },
    // Скипетр «Shatter» (AA): зачистка волны режет HP следующей башни акта.
    SET_NEXT_WAVE_PCT(effect, ctx) {
      ctx.scoring.flags.nextWaveHpPct = (ctx.scoring.flags.nextWaveHpPct || 0) + effect.value;
      return { label: `${ctx.sourceName}: следующая башня акта начнёт с −${effect.value}% HP` };
    },
    // Скипетр «Soul Rip» (Undying): сброс волны bankит заряд, бой тратит целиком.
    ADD_CHARGE(effect, ctx) {
      if (!ctx.sourceId) return null;
      const charges = ctx.state.run.heroCharges;
      charges[ctx.sourceId] = charges[ctx.sourceId] || {};
      const before = charges[ctx.sourceId].count || 0;
      const after = Math.min(effect.cap || Infinity, before + (effect.value || 1));
      if (after === before) return null;
      charges[ctx.sourceId].count = after;
      return { label: `${ctx.sourceName}: +${after - before} заряд (сила копится)` };
    },
    SPEND_CHARGES_POWER(effect, ctx) {
      if (!ctx.sourceId) return null;
      const charges = ctx.state.run.heroCharges;
      const held = charges[ctx.sourceId] && charges[ctx.sourceId].count ? charges[ctx.sourceId].count : 0;
      if (!held) return null;
      const bonus = held * effect.value;
      charges[ctx.sourceId].count = 0;
      ctx.scoring.power += bonus;
      return { label: `${ctx.sourceName}: +${bonus} силы (${held} заряда из сбросов)` };
    },
    // Скипетр «Invoke Mastery» (Invoker): N зарядов — усиление множителем.
    SPEND_CHARGES_MULT(effect, ctx) {
      if (!ctx.sourceId) return null;
      const charges = ctx.state.run.heroCharges;
      const held = charges[ctx.sourceId] && charges[ctx.sourceId].count ? charges[ctx.sourceId].count : 0;
      const amount = effect.amount || 3;
      if (held < amount) return null;
      charges[ctx.sourceId].count = held - amount;
      ctx.scoring.mult *= effect.mult;
      return { label: `${ctx.sourceName}: заряды собраны — ×${effect.mult} к множителю` };
    },
    // Скипетр «Flesh Heap» (Pudge): перестановки формации за волну — Heap.
    ADD_POWER_PER_FORMATION_MOVE(effect, ctx) {
      const moves = ctx.state.combat.movesUsed || 0;
      if (!moves) return null;
      const bonus = Math.min(effect.cap || Infinity, moves * effect.value);
      ctx.scoring.power += bonus;
      if (effect.consume) ctx.state.combat.movesUsed = 0;
      return { label: `${ctx.sourceName}: +${bonus} силы (${moves} перестановок)` };
    },
    // Скипетр «Rearm Protocol» (Tinker): рероллы лавки — заряды перегрева.
    ADD_POWER_PER_REROLL_CHARGE(effect, ctx) {
      const charges = ctx.state.run.rerollCharges || 0;
      if (!charges) return null;
      const bonus = charges * effect.value;
      ctx.scoring.power += bonus;
      return { label: `${ctx.sourceName}: +${bonus} силы (${charges} реролла в ядре)` };
    },
    CONSUME_REROLL_CHARGES(effect, ctx) {
      const before = ctx.state.run.rerollCharges || 0;
      ctx.state.run.rerollCharges = Math.max(0, before - (effect.amount || 1));
      if (before) return { label: `${ctx.sourceName}: перегрев потрачен (−${before - ctx.state.run.rerollCharges})` };
      return null;
    },
    // Осколок «Frostbite Memory» (CM): использованные сбросы — золото.
    ADD_GOLD_PER_USED_DISCARD(effect, ctx) {
      const used = Math.max(0, Game.discardsPerWave(ctx.state) - ctx.state.player.discardsLeft);
      if (!used) return null;
      ctx.state.run.gold += used * effect.value;
      return { label: `${ctx.sourceName}: +${used * effect.value} золота (${used} ТП-сброса)`, gold: used * effect.value };
    },
    // Скипетр «Arcane Reserve» (CM): Mana Reserve копится с неиспользованных
    // сбросов волны (game.js) и тратится в первом бою следующей волны.
    SPEND_MANA_RESERVE(effect, ctx) {
      const reserve = ctx.state.run.manaReserve || 0;
      if (!reserve) return null;
      ctx.state.run.manaReserve = 0;
      ctx.scoring.power += reserve * effect.value;
      return { label: `${ctx.sourceName}: Mana Reserve разряжен — +${reserve * effect.value} силы` };
    },
    // Скипетр «Blade Dance» (Juggernaut): серия одинаковых комбо подряд.
    ADD_MULT_PER_COMBO_STREAK(effect, ctx) {
      const streak = ctx.state.run.comboStreak || 0;
      if (!streak) return null;
      const bonus = Math.min(effect.cap || Infinity, streak * effect.value);
      ctx.scoring.mult += bonus;
      return { label: `${ctx.sourceName}: +${bonus} к множителю (серия ${streak})` };
    },
    // Скипетры «Thundergod's Circuit» (Zeus) и «Torrent Combo» (Kunkka):
    // награда за разнообразие типов комбо за забег.
    ADD_MULT_PER_DISTINCT_COMBO(effect, ctx) {
      if (!ctx.combo) return null;
      const seen = ctx.state.run.comboTypes || {};
      const distinct = Object.keys(seen).length + (seen[ctx.combo.type] ? 0 : 1);
      const bonus = Math.min(effect.cap || Infinity, distinct * effect.value);
      if (!bonus) return null;
      ctx.scoring.mult += bonus;
      return { label: `${ctx.sourceName}: +${bonus} к множителю (${distinct} типа комбо)` };
    },
    ADD_POWER_PER_DISTINCT_COMBO(effect, ctx) {
      if (!ctx.combo) return null;
      const seen = ctx.state.run.comboTypes || {};
      const distinct = Object.keys(seen).length + (seen[ctx.combo.type] ? 0 : 1);
      const bonus = Math.min(effect.cap || Infinity, distinct * effect.value);
      if (!bonus) return null;
      ctx.scoring.power += bonus;
      return { label: `${ctx.sourceName}: +${bonus} силы (${distinct} типа комбо)` };
    },
    // Скипетр «Multicast+» (Ogre): шанс повторить удар мелкой копией.
    SET_ECHO_POWER(effect, ctx) {
      ctx.scoring.flags.echoPower = { pct: effect.pct, chance: effect.chance || 100 };
      return { label: `${ctx.sourceName}: ${effect.chance || 100}% шанс повторить ${effect.pct}% урона` };
    },
    // Скипетр «Echo Strike» (PA): эхо встаёт на armed только после crit-эффекта.
    ARM_ECHO_ON_CRIT(effect, ctx) {
      const crits = ctx.resolution && ctx.resolution.crits;
      if (!crits || !crits.length) return null;
      ctx.scoring.flags.echoPower = { pct: effect.pct, chance: 100 };
      return { label: `${ctx.sourceName}: крит! Эхо повторит ${effect.pct}% урона` };
    },
    // Скипетр «Walrus Chain» (Tusk): в бою сработал крит — цепь передаёт бонус.
    ADD_POWER_IF_CRIT(effect, ctx) {
      const crits = ctx.resolution && ctx.resolution.crits;
      if (!crits || !crits.length) return null;
      ctx.scoring.power += effect.value;
      return { label: `${ctx.sourceName}: +${effect.value} силы от крита` };
    },
    // Скипетр «Duel+» (Legion): точный ласт-хит — Duel stack (грант в пост-бое).
    GAIN_CHARGE_ON_LAST_HIT(effect, ctx) {
      if (!ctx.sourceId) return null;
      ctx.scoring.flags.chargeOnLastHit = { heroId: ctx.sourceId, cap: effect.cap || 6 };
      return { label: `${ctx.sourceName}: точный ласт-хит даст Duel stack` };
    },
    // Чтение зарядов героя: +сила за каждый накопленный count.
    ADD_POWER_PER_CHARGE(effect, ctx) {
      if (!ctx.sourceId) return null;
      const held = (ctx.state.run.heroCharges[ctx.sourceId] || {}).count || 0;
      if (!held) return null;
      ctx.scoring.power += held * effect.value;
      return { label: `${ctx.sourceName}: +${held * effect.value} силы (${held} stacks)` };
    },
    // Осколок «Press the Attack» (Legion): прокачанные герои бьют плотнее.
    ADD_POWER_PER_LEVELED_HERO(effect, ctx) {
      if (!ctx.playedCards || !ctx.playedCards.length) return null;
      const leveled = ctx.playedCards.filter((c) => Game.heroLevel(ctx.state, c.heroId) > 0).length;
      if (!leveled) return null;
      ctx.scoring.power += leveled * effect.value;
      return { label: `${ctx.sourceName}: +${leveled * effect.value} силы (${leveled} с уровнем)` };
    },
    // Скипетр «Grand Magus» (Rubick): +сила за каждую чужую сработавшую способность.
    ADD_POWER_PER_TRIGGERED_HEROES(effect, ctx) {
      const triggered = ctx.resolution && ctx.resolution.heroTriggers;
      if (!triggered || !triggered.length) return null;
      const others = triggered.filter((id) => id !== ctx.sourceId);
      if (!others.length) return null;
      const bonus = Math.min(effect.cap || Infinity, others.length * effect.value);
      ctx.scoring.power += bonus;
      return { label: `${ctx.sourceName}: +${bonus} силы (украл ${others.length} способност${others.length === 1 ? "ь" : "и"})` };
    },
  };

  function apply(effect, ctx) {
    const fn = applicators[effect.type];
    if (!fn) {
      console.warn("Unknown effect type:", effect.type);
      return null;
    }
    return fn(effect, ctx);
  }

  return { apply };
})();
