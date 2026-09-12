// dotora — trigger resolution.
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
    // ON_HELD: бой начался — триггеры героев, ОСТАВШИХСЯ В РУКЕ (скамейка
    // бьёт, docs/PROPOSALS_FUN_BUILDS.md §0.1 Silencer), плюс предметы-слушатели.
    if (eventName === "ON_HELD") {
      const sources = [];
      const selected = new Set(state.combat.selectedUids || []);
      for (const uid of state.player.handUids) {
        if (selected.has(uid)) continue;
        const card = state.cards[uid];
        const hero = card && Content.heroes.byId[card.heroId];
        if (!hero || card.illusion) continue;
        for (const agh of aghSources(state, hero)) sources.push({ ...agh, card, slotIndex: -1, hero });
        if (hero.ability) {
          sources.push({ kind: "hero", card, slotIndex: -1, hero, def: { ...hero.ability, sourceId: hero.id, sourceName: hero.name } });
        }
      }
      state.player.items.forEach((itemId) => {
        const item = Content.items.byId[itemId];
        if (item && item.ability && item.ability.event === "ON_HELD") {
          sources.push({ kind: "item", hero: null, card: null, slotIndex: -1, item, def: { ...item.ability, sourceId: item.id, sourceName: item.name } });
        }
      });
      return sources;
    }
    // Heroes in slot order, then items in acquisition order, then shop
    // upgrades (фаза F), then tower/boss modifiers.
    const sources = [];
    playedCards.forEach((card, slotIndex) => {
      const hero = Content.heroes.byId[card.heroId];
      if (!hero || card.illusion) return; // illusions never activate abilities
      // Аугмент с override (скипетр или осколок) заменяет базовую способность.
      const ownedAug = state.run.aghanims && state.run.aghanims[hero.id];
      const overridden = !!(ownedAug && ["scepter", "shard"].some((k) => ownedAug[k] && Content.aghanims.byId[ownedAug[k]] && Content.aghanims.byId[ownedAug[k]].override));
      if (hero.ability && !overridden) {
        sources.push({ kind: "hero", card, slotIndex, hero, def: { ...hero.ability, sourceId: hero.id, sourceName: hero.name } });
      }
      const aghs = aghSources(state, hero);
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

      // Refresher/Эхо: второй прогон героев помечаем ♻, чтобы в стеке боя
      // читался порядок «способности → рефрешер → способности (повтор)».
      const re = payload.refreshed ? { icon: "♻", note: " · повтор" } : null;

      // «Счастливый случай»: шанс-способности героя срабатывают гарантированно.
      const forcedHero = source.kind === "hero" && payload.scoring && payload.scoring.flags.forceHeroTriggers && def.chance != null;
      if (forcedHero) {
        resolution.steps.push({ icon: "🎯", label: `${def.sourceName}: гарантировано улучшением`, kind: "info" });
      }

      if (def.chance != null && !forcedHero) {
        if (payload.simulate) {
          // Preview: show the lottery without spinning it.
          resolution.steps.push({
            icon: "🎲",
            label: `${def.sourceName}: шанс ${Math.round(def.chance * 100)}% — эффект ещё не разыгран${re ? re.note : ""}`,
            kind: "info",
          });
          continue;
        }
        if (!Rng.current().chance(def.chance)) {
          resolution.steps.push({ icon: re ? re.icon : "🎲", label: `${def.sourceName}: шанс не сработал${re ? re.note : ""}`, kind: "miss" });
          continue;
        }
        ctxBase.note = "крит!";
        // Явный флаг для UI: после боя показывается крупный «КРИТ!».
        (resolution.crits = resolution.crits || []).push(def.sourceName);
      }

      // Скипетр «Grand Magus» (Rubick) читает, чьи способности уже сработали.
      // Записываем после проверки шанса: промах — не «сработавшая» способность.
      if (source.kind === "hero" && source.hero) {
        resolution.heroTriggers = resolution.heroTriggers || [];
        if (!resolution.heroTriggers.includes(source.hero.id)) resolution.heroTriggers.push(source.hero.id);
      }

      for (const effect of def.effects || []) {
        const result = Effects.apply(effect, ctxBase);
        if (result) {
          const iconByKind = { hero: "✦", item: "◆", upgrade: "🔧", aghanim: "🟣", modifier: "☠" };
          resolution.steps.push({
            icon: re ? re.icon : (iconByKind[source.kind] || "☠"),
            label: result.label + (re ? re.note : ""),
            kind: source.kind,
          });
        }
      }
    }
  }

  return { runEvent, collectSources };
})();
