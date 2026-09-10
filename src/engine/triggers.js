// Dalatro — trigger resolution.
// Runs every trigger registered for an event, checks its conditions,
// applies its effects and records each application as a resolution step.
//
// Trigger shape (heroes, items, modifiers — one format for all):
//   { event, when?, chance?, effects: [...] }
const Triggers = (function () {
  function collectSources(state, playedCards) {
    // Heroes in slot order, then items in acquisition order, then tower/boss modifiers.
    const sources = [];
    playedCards.forEach((card, slotIndex) => {
      const hero = Content.heroes.byId[card.heroId];
      if (!hero || card.illusion) return; // illusions never activate abilities
      if (hero.ability) {
        sources.push({ kind: "hero", card, slotIndex, hero, def: { ...hero.ability, sourceId: hero.id, sourceName: hero.name } });
      }
    });
    state.player.items.forEach((itemId) => {
      const item = Content.items.byId[itemId];
      if (item && item.ability) {
        sources.push({ kind: "item", hero: null, slotIndex: -1, item, def: { ...item.ability, sourceId: item.id, sourceName: item.name } });
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
    const sources = collectSources(state, playedCards);

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
        sourceName: def.sourceName,
        scoring: payload.scoring,
        discardCtx: payload.discardCtx || null,
        note: null,
      };

      if (def.when && !Cond.evaluate(def.when, ctxBase)) continue;

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
          resolution.steps.push({ icon: source.kind === "hero" ? "✦" : source.kind === "item" ? "◆" : "☠", label: result.label, kind: source.kind });
        }
      }
    }
  }

  return { runEvent, collectSources };
})();
