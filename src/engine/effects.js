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

  const applicators = {
    ADD_POWER(effect, ctx) {
      ctx.scoring.power += effect.value;
      return { label: `${ctx.sourceName}: +${effect.value} силы` };
    },
    ADD_MULT(effect, ctx) {
      ctx.scoring.mult += effect.value;
      return { label: `${ctx.sourceName}: +${effect.value} к множителю` };
    },
    MULT_MULT(effect, ctx) {
      ctx.scoring.mult *= effect.value;
      return {
        label: `${ctx.sourceName}: ×${effect.value} множитель${ctx.note ? " (" + ctx.note + ")" : ""}`,
      };
    },
    FINAL_MULT(effect, ctx) {
      ctx.scoring.finalMult *= effect.value;
      return { label: `${ctx.sourceName}: ×${effect.value} к итоговому урону` };
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
    ADD_MULT_PER_ITEM(effect, ctx) {
      const n = ctx.state.player.items.length;
      if (!n) return null;
      ctx.scoring.mult += effect.value * n;
      return { label: `${ctx.sourceName}: +${effect.value * n} к множителю (${n} предметов)` };
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
