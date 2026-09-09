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

  function evaluate(condition, ctx) {
    if (!condition) return true;
    if (condition.all) return condition.all.every((c) => evaluate(c, ctx));
    if (condition.any) return condition.any.some((c) => evaluate(c, ctx));
    if (condition.not) return !evaluate(condition.not, ctx);

    switch (condition.type) {
      case "ALWAYS":
        return true;
      case "COMBO_IS":
        return !!ctx.combo && ctx.combo.type === condition.value;
      case "COMBO_MIN":
        return !!ctx.combo && comboRank(ctx.combo.type) >= comboRank(condition.value);
      case "SLOT_IS":
        return ctx.slotIndex === condition.value;
      case "PLAYED_COUNT_ABOVE":
        return ctx.playedCards && ctx.playedCards.length > condition.value;
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
      default:
        console.warn("Unknown condition type:", condition.type);
        return false;
    }
  }

  return { evaluate };
})();
