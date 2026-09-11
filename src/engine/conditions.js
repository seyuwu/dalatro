// Dalatro — conditions.
// A condition is a plain data object evaluated against a context:
//   ctx = { state, combo, playedCards, slotIndex, card, hero, source }
// Content never touches state directly — it declares conditions, engine evaluates them.
const Cond = (function () {
  // Content is loaded before any condition runs; only reference it lazily.
  function comboRank(comboId) {
    const combo = Content.combos.byId[comboId];
    return combo ? combo.rank : -1;
  }

  // Ранг карты для детекции (паритет с poker.js valueOf): wild/иллюзии меняют
  // только его. Используется условиями, читающими ранги сыгранных карт.
  function rankOfCard(c) {
    return c.detectPower != null ? c.detectPower : c.power;
  }

  // Режим формаций определяется самим комбо: у формаций есть tier, у покерных
  // комбо — нет. Классические условия в classic-режиме не затронуты.
  function isFormationCtx(ctx) {
    return !!ctx.combo && ctx.combo.tier != null;
  }

  // Миграция покерных условий на формациях (docs/REDESIGN_ANTI_BALATRO.md §7).
  // Данные героев/предметов не меняем — семантику подменяет слой алиасов.
  const FORMATION_ALIASES = {
    three: { type: "SAME_RANK_GROUP", size: 3 }, // Axe: Counter Helix — 3 одинаковых ранга
    pair: { type: "TIER_MAX", value: 2 },        // Satanic: страховка слабой руки → tier ≤ 2
    two_pair: { type: "TIER_MAX", value: 2 },
  };
  // COMBO_MIN X в формациях: «пара и выше» → tier ≥ 1 и т.д. (PA, Legion).
  const FORMATION_MIN_TIER = { high_card: 0, pair: 1, two_pair: 1, three: 2, straight: 2, flush: 3, full_house: 3 };

  function tierOf(ctx) {
    if (!ctx.combo) return -1;
    return ctx.combo.tier != null ? ctx.combo.tier : comboRank(ctx.combo.type);
  }

  // Скипетр «Starbreaker» (Dawnbreaker): Универсалы — джокеры атрибутов для
  // условий. Правило боя (preFlag), поэтому не зависит от порядка слотов.
  function uniWildcard(ctx) {
    return !!(ctx.state && ctx.state.combat && ctx.state.combat.scoring &&
      ctx.state.combat.scoring.flags && ctx.state.combat.scoring.flags.uniWildcard);
  }

  // Скипетр «Sanity Overload» (Outworld): UNI добирает недостающий атрибут,
  // но только для условий подсчёта DISTINCT.
  function uniDistinct(ctx) {
    return !!(ctx.state && ctx.state.combat && ctx.state.combat.scoring &&
      ctx.state.combat.scoring.flags && ctx.state.combat.scoring.flags.uniDistinct);
  }

  // Атрибуты карты: скопированный (attr) + родной (nativeAttr, скипетр
  // «Attribute Shift» Морфлинга — карта «двух цветов» для условий).
  function cardAttrs(c) {
    if (!c) return [];
    return c.nativeAttr && c.nativeAttr !== c.attr ? [c.attr, c.nativeAttr] : [c.attr];
  }

  // Совпадение атрибута карты с искомым (с учётом джокера-Универсала).
  function attrIs(ctx, card, value) {
    return cardAttrs(card).some((a) => a === value) ||
      (uniWildcard(ctx) && card && card.attr === "uni");
  }

  function evaluate(condition, ctx) {
    if (!condition) return true;
    if (condition.all) return condition.all.every((c) => evaluate(c, ctx));
    if (condition.any) return condition.any.some((c) => evaluate(c, ctx));
    if (condition.not) return !evaluate(condition.not, ctx);

    switch (condition.type) {
      case "ALWAYS":
        return true;
      case "COMBO_IS":
        if (isFormationCtx(ctx) && FORMATION_ALIASES[condition.value]) {
          return evaluate(FORMATION_ALIASES[condition.value], ctx);
        }
        return !!ctx.combo && ctx.combo.type === condition.value;
      case "COMBO_MIN":
        if (isFormationCtx(ctx)) {
          const minTier = FORMATION_MIN_TIER[condition.value];
          return tierOf(ctx) >= (minTier != null ? minTier : comboRank(condition.value));
        }
        return !!ctx.combo && comboRank(ctx.combo.type) >= comboRank(condition.value);
      case "DAMAGE_TYPE_IS":
        // Ярлык типа урона есть и у формаций, и у покерных комбо (world.js).
        return !!ctx.combo && ctx.combo.damageType === condition.value;
      case "TIER_MIN":
        return tierOf(ctx) >= condition.value;
      case "TIER_MAX":
        return tierOf(ctx) >= 0 && tierOf(ctx) <= condition.value;
      case "SAME_RANK_GROUP": {
        if (!ctx.playedCards) return false;
        const counts = new Map();
        for (const c of ctx.playedCards) {
          const rank = rankOfCard(c);
          counts.set(rank, (counts.get(rank) || 0) + 1);
        }
        return Array.from(counts.values()).some((n) => n >= condition.size);
      }
      case "SAME_ATTRIBUTE_COUNT_ABOVE": {
        // «Специализация» (#44): 3+ героя одного атрибута (с учётом двухцветных).
        if (!ctx.playedCards) return false;
        const counts = {};
        for (const c of ctx.playedCards) for (const a of cardAttrs(c)) counts[a] = (counts[a] || 0) + 1;
        // Скипетр «Starbreaker» (Dawnbreaker): Универсал — джокер атрибутов для
        // условий, поэтому присоединяется к крупнейшему реальному бакету
        // (паритет с attrIs: иначе Фаланга не видит джокера).
        const uni = counts.uni || 0;
        if (uniWildcard(ctx) && uni && Object.keys(counts).length > 1) {
          delete counts.uni;
          const best = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
          counts[best] += uni;
        }
        return Object.values(counts).some((n) => n > condition.value);
      }
      case "SLOT_IS":
        return ctx.slotIndex === condition.value;
      case "SLOT_IS_LAST":
        return !!ctx.playedCards && ctx.slotIndex === ctx.playedCards.length - 1;
      case "PLAYED_COUNT_IS":
        return !!ctx.playedCards && ctx.playedCards.length === condition.value;
      case "PLAYED_COUNT_ABOVE":
        return ctx.playedCards && ctx.playedCards.length > condition.value;
      case "PLAYED_COUNT_BELOW":
        return ctx.playedCards && ctx.playedCards.length < condition.value;
      case "EXISTS_ATTRIBUTE":
        // Any OTHER played card (self excluded by reference) with this attribute.
        return !!(ctx.playedCards && ctx.playedCards.some(
          (c) => c !== ctx.card && attrIs(ctx, c, condition.value)
        ));
      case "ALL_ATTRIBUTES":
        // Every played card (self included) has this attribute — flush fuel.
        return !!(ctx.playedCards && ctx.playedCards.length > 0 &&
          ctx.playedCards.every((c) => attrIs(ctx, c, condition.value)));
      case "DISTINCT_ATTRIBUTES_ABOVE": {
        if (!ctx.playedCards) return false;
        const attrs = new Set(ctx.playedCards.flatMap(cardAttrs));
        // Джокер-Универсал добирает недостающий атрибут: 2 реальных + UNI = 3.
        const hasUni = ctx.playedCards.some((c) => c.attr === "uni");
        if ((uniWildcard(ctx) || uniDistinct(ctx)) && hasUni) attrs.add("⬤");
        return attrs.size > condition.value;
      }
      case "NEIGHBOR_ATTR_DIFFERS":
        // A position neighbor (left or right) exists and its attribute differs.
        // Джокер-Универсал «подстраивается» — таким соседом различие не считается.
        return !!(ctx.playedCards && ctx.card && ctx.playedCards.some((c, i) =>
          Math.abs(i - ctx.slotIndex) === 1 && !attrIs(ctx, c, ctx.card.attr) && !attrIs(ctx, ctx.card, c.attr)
        ));
      case "NEIGHBOR_ATTR_IS":
        // A position neighbor with the given attribute (left or right).
        return !!(ctx.playedCards && ctx.card && ctx.playedCards.some((c, i) =>
          Math.abs(i - ctx.slotIndex) === 1 && attrIs(ctx, c, condition.value)
        ));
      case "IS_LOWEST_RANK":
        return !!(ctx.card && ctx.playedCards && ctx.playedCards.length > 1 &&
          ctx.playedCards.every((c) => c.power >= ctx.card.power));
      case "IS_HIGHEST_RANK":
        return !!(ctx.card && ctx.playedCards && ctx.playedCards.length > 1 &&
          ctx.playedCards.every((c) => c.power <= ctx.card.power));
      case "IS_BOSS_WAVE":
        return !!(ctx.state && ctx.state.combat.wave && ctx.state.combat.wave.isBoss);
      case "IS_MINIBOSS_WAVE":
        return !!(ctx.state && ctx.state.combat.wave && ctx.state.combat.wave.miniBoss);
      case "MODE_IS":
        return !!(ctx.state && ctx.state.rules === condition.value);
      case "COMBO_DIFFERENT_FROM_LAST":
        return !!(ctx.combo && ctx.state && ctx.state.combat.lastComboType && ctx.state.combat.lastComboType !== ctx.combo.type);
      case "AFTER_FAILURE":
        return !!(ctx.state && ctx.state.run.failedLastWave);
      case "TOWER_HP_BELOW":
        // Улучшение «Перелом»: башня ниже pct% текущего максимума.
        return !!(ctx.state && ctx.state.combat.wave &&
          ctx.state.combat.wave.hp > 0 &&
          (ctx.state.combat.wave.hp / ctx.state.combat.wave.maxHp) * 100 < condition.pct);
      case "TOWER_HP_ABOVE":
        // Осколок «Chilling Touch» (AA): башня выше pct% максимума.
        return !!(ctx.state && ctx.state.combat.wave &&
          ctx.state.combat.wave.hp > 0 &&
          (ctx.state.combat.wave.hp / ctx.state.combat.wave.maxHp) * 100 > condition.pct);
      case "DISCARDS_UNUSED":
        // Скипетр «Warcry» (Sven) / осколок «Onslaught» (Primal): за бой не
        // потрачено ни одного ТП-сброса волны.
        return !!(ctx.state && Game.discardsPerWave(ctx.state) === ctx.state.player.discardsLeft);
      case "HERO_LEVEL_ABOVE":
        // Скипетр «Ascended Charge» (Void Spirit): уровень XP героя > value.
        return !!(ctx.card && ctx.state && Game.heroLevel(ctx.state, ctx.card.heroId) > condition.value);
      case "IS_MIDDLE_SLOT":
        // Скипетр «Raptor Dance» (Kez): герой ровно в середине строя.
        return !!(ctx.playedCards && ctx.slotIndex != null &&
          ctx.slotIndex === Math.floor((ctx.playedCards.length - 1) / 2));
      case "SLOT_CHANGED":
        // Скипетр «Overload» (Storm): герой не на своём слоте прошлого боя.
        return !!(ctx.card && ctx.state && ctx.state.combat.lastSlot &&
          ctx.state.combat.lastSlot[ctx.card.heroId] != null &&
          ctx.state.combat.lastSlot[ctx.card.heroId] !== ctx.slotIndex);
      case "SLOT_LEFT_EXISTS":
        return ctx.playedCards && ctx.slotIndex != null && ctx.slotIndex > 0;
      case "SLOT_RIGHT_EXISTS":
        return !!(ctx.playedCards && ctx.slotIndex != null && ctx.slotIndex < ctx.playedCards.length - 1);
      case "BOTH_NEIGHBORS_DIFFER":
        // Скипетр «Rebound» (Marci): оба соседа другого атрибута.
        return !!(ctx.playedCards && ctx.card && ctx.slotIndex > 0 && ctx.slotIndex < ctx.playedCards.length - 1 &&
          !attrIs(ctx, ctx.playedCards[ctx.slotIndex - 1], ctx.card.attr) &&
          !attrIs(ctx, ctx.playedCards[ctx.slotIndex + 1], ctx.card.attr));
      case "BOTH_NEIGHBORS_SAME":
        // Осколок «Companion Run» (Marci): оба соседа одного (моего) атрибута.
        return !!(ctx.playedCards && ctx.card && ctx.slotIndex > 0 && ctx.slotIndex < ctx.playedCards.length - 1 &&
          attrIs(ctx, ctx.playedCards[ctx.slotIndex - 1], ctx.card.attr) &&
          attrIs(ctx, ctx.playedCards[ctx.slotIndex + 1], ctx.card.attr));
      case "COMBO_SAME_AS_LAST":
        // Скипетры «Blade Dance» (Juggernaut) и «Mana Break+» (Anti-Mage):
        // тот же тип комбо, что в прошлом бою (первый бой волны считается повтором).
        return !!(ctx.combo && (!ctx.state.combat.lastComboType || ctx.state.combat.lastComboType === ctx.combo.type));
      case "MOVES_ABOVE":
        // Шарды PA/Legion/AM/Tusk и скипетр Pudge: перестановки формаций за волну.
        return !!(ctx.state && (ctx.state.combat.movesUsed || 0) > condition.value);
      case "FIGHT_FIRST":
        // Скипетр «Arcane Reserve» (CM) и осколок «Quick Cast» (Invoker).
        return !!(ctx.state && ctx.state.combat.fightIndex === 0);
      case "CHARGES_ABOVE":
        // Скипетр «Invoke Mastery» (Invoker): накоплено зарядов героя больше value.
        return !!(ctx.sourceId && ctx.state.run.heroCharges[ctx.sourceId] &&
          (ctx.state.run.heroCharges[ctx.sourceId].count || 0) > condition.value);
      case "REROLL_CHARGES_ABOVE":
        // Скипетр «Rearm Protocol» (Tinker): в ядре накоплено рероллов лавки.
        return !!(ctx.state && (ctx.state.run.rerollCharges || 0) > condition.value);
      case "FORMATION_ACTIONS_ABOVE":
        // Скипетр «Counter Helix+» (Axe): действия игрока за волну
        // (перестановки + ТП-сбросы) заряжают Helix.
        return !!(ctx.state && ((ctx.state.combat.movesUsed || 0) +
          Math.max(0, Game.discardsPerWave(ctx.state) - ctx.state.player.discardsLeft)) > condition.value);
      default:
        console.warn("Unknown condition type:", condition.type);
        return false;
    }
  }

  return { evaluate };
})();
