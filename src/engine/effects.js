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
      const same = ctx.playedCards.filter((c) => c.power === ctx.card.power).length - 1;
      if (same <= 0) return null;
      ctx.scoring.power += effect.value * same;
      return { label: `${ctx.sourceName}: +${effect.value * same} силы (${same} героя своего ранга)` };
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
