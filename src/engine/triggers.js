// Dalatro — trigger resolution.
// Runs every trigger registered for an event, checks its conditions,
// applies its effects and records each application as a resolution step.
//
// Trigger shape (heroes, items, upgrades, aghanims, modifiers — one format):
//   { event, when?, chance?, effects: [...] }
const Triggers = (function () {
  // Аугменты героя (docs/AGHANIMS.md): скипетр (с override базовой способности)
  // и осколок. Возвращают источники kind "aghanim" для сыгранного героя.
  function aghSources(state, hero) {
    const owned = state.run.aghanims && state.run.aghanims[hero.id];
    if (!owned) return [];
    const sources = [];
    for (const kind of ["scepter", "shard"]) {
      const aug = owned[kind] ? Content.aghanims.byId[owned[kind]] : null;
      if (!aug) continue;
      for (const ability of aug.abilities || (aug.ability ? [aug.ability] : [])) {
        sources.push({
          kind: "aghanim",
          def: { ...ability, sourceId: hero.id, sourceName: aug.name },
        });
      }
    }
    return sources;
  }

  function collectSources(state, playedCards, eventName) {
    // ON_ANY_DISCARD: сброс вне боя — аугменты всех владельческих героев.
    if (eventName === "ON_ANY_DISCARD") {
      const sources = [];
      const owned = new Set([...state.player.handUids, ...state.player.deckUids, ...state.player.discardUids]
        .map((uid) => state.cards[uid] && state.cards[uid].heroId));
      for (const heroId of owned) {
        const hero = Content.heroes.byId[heroId];
        if (!hero) continue;
        for (const agh of aghSources(state, hero)) sources.push({ ...agh, card: null, slotIndex: -1, hero });
      }
      return sources;
    }
    // Heroes in slot order, then items in acquisition order, then shop
    // upgrades (фаза F), then tower/boss modifiers.
    const sources = [];
    playedCards.forEach((card, slotIndex) => {
      const hero = Content.heroes.byId[card.heroId];
      if (!hero || card.illusion) return; // illusions never activate abilities
      const aghs = aghSources(state, hero);
      // Скипетр с override заменяет базовую способность героя.
      const overridden = state.run.aghanims && state.run.aghanims[hero.id] && state.run.aghanims[hero.id].scepter &&
        Content.aghanims.byId[state.run.aghanims[hero.id].scepter] &&
        Content.aghanims.byId[state.run.aghanims[hero.id].scepter].override;
      if (hero.ability && !overridden) {
        sources.push({ kind: "hero", card, slotIndex, hero, def: { ...hero.ability, sourceId: hero.id, sourceName: hero.name } });
      }
      for (const agh of aghs) {
        sources.push({ ...agh, card, slotIndex, hero });
      }
    });
    state.player.items.forEach((itemId) => {
      const item = Content.items.byId[itemId];
      if (item && item.ability) {
        sources.push({ kind: "item", hero: null, slotIndex: -1, item, def: { ...item.ability, sourceId: item.id, sourceName: item.name } });
      }
    });
    (state.run.upgrades || []).forEach((id) => {
      const up = Content.upgrades.byId[id];
      if (up && up.ability) {
        sources.push({ kind: "upgrade", hero: null, card: null, slotIndex: -1, def: { ...up.ability, sourceId: up.id, sourceName: up.name } });
      }
    });
    const tower = state.combat.wave;
    (tower.modifiers || []).forEach((mod) => {
      const def = Content.modifiers.byId[mod.id];
      if (def && def.ability) {
        sources.push({ kind: "modifier", hero: null, slotIndex: -1, mod, def: { ...def.ability, sourceId: def.id, sourceName: def.name || def.id } });
      }
    });
    return sources;
  }

  // true, если условие НЕ выполнялось бы на наборе карт без скопированных
  // атрибутов (т.е. копия Morphling буквально открыла этот триггер).
  function assistedByCopy(when, ctxBase, copyLog) {
    if (!when || !copyLog || !copyLog.length) return false;
    const uncopied = ctxBase.playedCards.map((c) => {
      const cp = copyLog.find((l) => l.uid === c.uid);
      return cp ? { ...c, attr: cp.from } : c;
    });
    if (uncopied.every((c, i) => c.attr === ctxBase.playedCards[i].attr)) return false;
    return !Cond.evaluate(when, { ...ctxBase, playedCards: uncopied });
  }

  function runEvent(state, bus, eventName, payload, resolution) {
    const playedCards = payload.playedCards || [];
    const sources = collectSources(state, playedCards, eventName);

    for (const source of sources) {
      if (payload.onlyKinds && !payload.onlyKinds.includes(source.kind)) continue;
      const def = source.def;
      if (def.event !== eventName) continue;

      const ctxBase = {
        state,
        combo: payload.combo || null,
        playedCards,
        slotIndex: source.slotIndex,
        card: source.card || null,
        hero: source.hero,
        power: payload.power,
        sourceId: def.sourceId,
        sourceName: def.sourceName,
        sourceKind: source.kind,
        scoring: payload.scoring,
        resolution,
        discardCtx: payload.discardCtx || null,
        note: null,
      };

      if (def.when && !Cond.evaluate(def.when, ctxBase)) continue;

      // Скипетр «Grand Magus» (Rubick) читает, чьи способности уже сработали.
      if (source.kind === "hero" && source.hero) {
        resolution.heroTriggers = resolution.heroTriggers || [];
        if (!resolution.heroTriggers.includes(source.hero.id)) resolution.heroTriggers.push(source.hero.id);
      }

      // Synergy feedback: если условие стало выполнимым ТОЛЬКО из-за копий
      // атрибута (Morphling) — пометить цепочку в стеке.
      if (assistedByCopy(def.when, ctxBase, payload.scoring && payload.scoring.copyLog)) {
        for (const l of payload.scoring.copyLog) {
          resolution.steps.push({
            icon: "🔗",
            label: `Цепочка: копия ${Content.heroes.byId[l.heroId].name} (${Content.attrNames[l.from]} → ${Content.attrNames[l.to]}) открыла условие ${def.sourceName}`,
            kind: "chain",
          });
        }
      }

      if (def.chance != null) {
        if (payload.simulate) {
          // Preview: show the lottery without spinning it.
          resolution.steps.push({
            icon: "🎲",
            label: `${def.sourceName}: шанс ${Math.round(def.chance * 100)}% — эффект ещё не разыгран`,
            kind: "info",
          });
          continue;
        }
        if (!Rng.current().chance(def.chance)) {
          resolution.steps.push({ icon: "🎲", label: `${def.sourceName}: шанс не сработал`, kind: "miss" });
          continue;
        }
        ctxBase.note = "крит!";
        // Явный флаг для UI: после боя показывается крупный «КРИТ!».
        (resolution.crits = resolution.crits || []).push(def.sourceName);
      }

      for (const effect of def.effects || []) {
        const result = Effects.apply(effect, ctxBase);
        if (result) {
          const iconByKind = { hero: "✦", item: "◆", upgrade: "🔧", aghanim: "🟣", modifier: "☠" };
          resolution.steps.push({ icon: iconByKind[source.kind] || "☠", label: result.label, kind: source.kind });
        }
      }
    }
  }

  return { runEvent, collectSources };
})();
