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
      case "POWER_ABOVE":
        return typeof ctx.power === "number" && ctx.power > condition.value;
      case "HAS_ITEM":
        return ctx.state && ctx.state.player.items.includes(condition.item);
      case "TAG_IS":
        return !!(ctx.hero && ctx.hero.tags && ctx.hero.tags.includes(condition.tag));
      case "EXISTS_ATTRIBUTE":
        // Any OTHER played card (self excluded by reference) with this attribute.
        return !!(ctx.playedCards && ctx.playedCards.some(
          (c) => c !== ctx.card && c.attr === condition.value
        ));
      case "ALL_ATTRIBUTES":
        // Every played card (self included) has this attribute — flush fuel.
        return !!(ctx.playedCards && ctx.playedCards.length > 0 &&
          ctx.playedCards.every((c) => c.attr === condition.value));
      case "DISTINCT_ATTRIBUTES_ABOVE":
        return !!(ctx.playedCards && new Set(ctx.playedCards.map((c) => c.attr)).size > condition.value);
      case "NEIGHBOR_ATTR_DIFFERS":
        // A position neighbor (left or right) exists and its attribute differs.
        return !!(ctx.playedCards && ctx.playedCards.some((c, i) =>
          Math.abs(i - ctx.slotIndex) === 1 && c.attr !== ctx.card.attr
        ));
      case "NEIGHBOR_ATTR_IS":
        // A position neighbor with the given attribute (left or right).
        return !!(ctx.playedCards && ctx.card && ctx.playedCards.some((c, i) =>
          Math.abs(i - ctx.slotIndex) === 1 && c.attr === condition.value
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
      case "FIGHTS_LEFT_ABOVE":
        return !!(ctx.state && ctx.state.player.fightsLeft > condition.value);
      case "TOWER_HP_BELOW":
        // Улучшение «Перелом»: башня ниже pct% текущего максимума.
        return !!(ctx.state && ctx.state.combat.wave &&
          ctx.state.combat.wave.hp > 0 &&
          (ctx.state.combat.wave.hp / ctx.state.combat.wave.maxHp) * 100 < condition.pct);
      default:
        console.warn("Unknown condition type:", condition.type);
        return false;
    }
  }

  return { evaluate };
})();
