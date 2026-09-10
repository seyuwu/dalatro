// Dalatro — combat orchestration. The heart of the vertical slice.
//
// Resolution order (fixed, documented in ARCHITECTURE.md):
//   1. PRE_DETECT   — heroes (slot order) + items mutate what the detector sees
//                     (Morphling copy, Manta illusion, Butterfly wild rank)
//   2. Detection    — poker.evaluate on the effective set
//   3. Base         — combo base power + sum of effective card powers
//   4. Hero triggers (slot order): ON_PLAY then COMBO_DETECTED
//   5. Item triggers (acquisition order): FIGHT_SCORING
//   6. Refresher    — hero triggers (4) run a second time
//   6.5 Commitment  — ставка карт: ×1.1 (4 героя) / ×1.25 (5 героев)
//   6.6 Momentum    — серия зачищенных волн: ×1.05 за каждую
//   7. Tower mods   — BKB / Butterfly interact, then armor / glyph
//   8. Damage       — power × mult × finalMult × towerMult
//   9. Death/Aegis  — revive once, else killed
//  10. Gold         — overkill (decayed) + exact last hit
const Combat = (function () {
  const HAND_SIZE = DeckSys.HAND_SIZE;
  const MAX_SLOTS = 5;
  // Герои и их аугменты (docs/AGHANIMS.md) бегут одной фазой: глушатся
  // «Безмолвием» вместе и обновляются Refresher'ом вместе.
  const HERO_KINDS = ["hero", "aghanim"];

  // Ставка: сколько героев отправил в бой. 2-3 героя — нейтрально.
  const COMMIT_TIERS = {
    1: { name: "Харас", finalMult: 1, gold: 1 },
    4: { name: "Тимфайт", finalMult: 1.1, gold: 0 },
    5: { name: "Коммит", finalMult: 1.25, gold: 0 },
  };
  // Импульс: серия зачищенных волн подряд (сбрасывается провалом).
  const MOMENTUM_STEP = 0.05;
  const MOMENTUM_CAP = 10;

  function realPlayedCards(state) {
    return state.combat.selectedUids.map((uid) => {
      const card = state.cards[uid];
      return { uid, heroId: card.heroId, power: Game.rankOf(state, card.heroId), attr: heroAttr(state, card.heroId), illusion: false, slotIndex: 0 };
    });
  }

  // Ранг с учётом тренировки (state.run.ranks) и проклятие-список волны.
  function heroAttr(state, heroId) {
    return Game.heroAttr(state, heroId);
  }

  function waveCurses(state) {
    const wave = state.combat.wave;
    if (!wave) return [];
    return (wave.modifiers || [])
      .map((m) => m.id)
      .filter((id) => Content.modifiers.byId[id] && Content.modifiers.byId[id].curse);
  }

  function collectPreDetectEffects(state, playedCards) {
    const effects = [];
    playedCards.forEach((card, slotIndex) => {
      if (card.illusion) return;
      const hero = Content.heroes.byId[card.heroId];
      // Аугменты героя (docs/AGHANIMS.md): PRE_DETECT-осколки/скептеры.
      // Скипетр с override заменяет базовую PRE_DETECT-способность.
      const owned = state.run.aghanims && state.run.aghanims[hero.id];
      const scDef = owned && owned.scepter ? Content.aghanims.byId[owned.scepter] : null;
      if (hero.ability && !(scDef && scDef.override) && hero.ability.event === "PRE_DETECT") {
        effects.push({ effect: hero.ability.effects[0], card, slotIndex, sourceName: hero.name, sourceId: hero.id });
      }
      for (const kind of ["scepter", "shard"]) {
        const aug = owned && owned[kind] ? Content.aghanims.byId[owned[kind]] : null;
        if (aug && aug.ability && aug.ability.event === "PRE_DETECT") {
          effects.push({ effect: aug.ability.effects[0], card, slotIndex, sourceName: aug.name, sourceId: hero.id });
        }
      }
    });
    state.player.items.forEach((itemId) => {
      const item = Content.items.byId[itemId];
      if (item.ability && item.ability.event === "PRE_DETECT") {
        effects.push({ effect: item.ability.effects[0], card: null, slotIndex: -1, sourceName: item.name, sourceId: item.id });
      }
    });
    return effects;
  }

  // Builds the effective card set (scoring) and the detection view (combo).
  function buildEffectiveSet(state, playedCards, resolution) {
    const effective = playedCards.map((c) => ({ ...c }));
    const pendingIllusions = [];
    const pendingWilds = [];
    const copyLog = []; // какие копии атрибута изменили effective-набор
    let strongestBump = 0;
    let bumpSource = null;

    for (const { effect, card, slotIndex, sourceName, sourceId } of collectPreDetectEffects(state, effective)) {
      switch (effect.type) {
        case "COPY_ATTRIBUTE": {
          const right = effect.target === "right_neighbor";
          const neighbor = right
            ? (slotIndex < effective.length - 1 ? effective[slotIndex + 1] : null)
            : (slotIndex > 0 ? effective[slotIndex - 1] : null);
          if (neighbor && neighbor.attr !== effective[slotIndex].attr) {
              Resolver.pushStep(resolution, {
                icon: "✦",
                label: `${sourceName} копирует атрибут «${Content.attrNames[neighbor.attr]}» у ${Content.heroes.byId[neighbor.heroId].name}`,
                kind: "hero",
              });
              copyLog.push({
                uid: effective[slotIndex].uid,
                heroId: effective[slotIndex].heroId,
                from: effective[slotIndex].attr,
                to: neighbor.attr,
              });
              effective[slotIndex].baseAttr = effective[slotIndex].attr;
              effective[slotIndex].attr = neighbor.attr;
            }
          break;
        }
        case "COPY_ATTRIBUTE_FALLBACK": {
          // Осколок «Waveform» (Morphling): слева пусто — копируем правого.
          if (slotIndex === 0 && effective.length > 1 && effective[1].attr !== effective[0].attr) {
            Resolver.pushStep(resolution, {
              icon: "🟣",
              label: `${sourceName}: слева пусто — копирует «${Content.attrNames[effective[1].attr]}» у ${Content.heroes.byId[effective[1].heroId].name}`,
              kind: "aghanim",
            });
            effective[0].baseAttr = effective[0].attr;
            effective[0].attr = effective[1].attr;
            copyLog.push({ uid: effective[0].uid, heroId: effective[0].heroId, from: effective[0].baseAttr, to: effective[1].attr });
          }
          break;
        }
        case "KEEP_NATIVE_ATTR": {
          // Скипетр «Attribute Shift» (Morphling): карта «двух цветов» для условий.
          const native = effective[slotIndex].baseAttr || effective[slotIndex].attr;
          if (native !== effective[slotIndex].attr) {
            effective[slotIndex].nativeAttr = native;
            Resolver.pushStep(resolution, {
              icon: "🟣",
              label: `${sourceName}: помнит родной ${Content.attrNames[native]} — карта двух атрибутов`,
              kind: "aghanim",
            });
          }
          break;
        }
        case "MIRROR_RANK": {
          // Скипетр «Reflection» (Terrorblade): в детекции считается рангом
          // правого соседа (сила остаётся своей).
          const neighbor = slotIndex < effective.length - 1 ? effective[slotIndex + 1] : null;
          if (neighbor) {
            const target = neighbor.detectPower != null ? neighbor.detectPower : neighbor.power;
            if (target !== effective[slotIndex].power) {
              effective[slotIndex].detectPower = target;
              Resolver.pushStep(resolution, {
                icon: "🟣",
                label: `${sourceName}: в комбо считается рангом ${Content.heroes.byId[neighbor.heroId].name} (${target})`,
                kind: "aghanim",
              });
            }
          }
          break;
        }
        case "STEAL_ATTR": {
          // Скипетр «Essence Shift+» (Slark): крадёт атрибут соседа слева —
          // карта двух атрибутов (родной + украденный) для всех условий.
          const neighbor = slotIndex > 0 ? effective[slotIndex - 1] : null;
          if (neighbor && neighbor.attr !== effective[slotIndex].attr) {
            effective[slotIndex].baseAttr = effective[slotIndex].attr;
            effective[slotIndex].nativeAttr = effective[slotIndex].attr;
            effective[slotIndex].attr = neighbor.attr;
            Resolver.pushStep(resolution, {
              icon: "🟣",
              label: `${sourceName}: крадёт «${Content.attrNames[neighbor.attr]}» у ${Content.heroes.byId[neighbor.heroId].name}`,
              kind: "aghanim",
            });
          }
          break;
        }
        case "ILLUSION_RATIO": {
          // Осколок «Malefice» (Enigma): его иллюзия 75% силы вместо 50%.
          if (state.combat.scoring && sourceId === "enigma") {
            state.combat.scoring.flags.enigmaRatio = effect.value;
            Resolver.pushStep(resolution, { icon: "🟣", label: `${sourceName}: иллюзия ${Math.round(effect.value * 100)}% силы`, kind: "aghanim" });
          }
          break;
        }
        case "CREATE_ILLUSION": {
          const strongest = effective.reduce((a, b) => (b.power > a.power ? b : a), effective[0]);
          if (strongest) {
            const ratio = sourceId === "enigma" && state.combat.scoring && state.combat.scoring.flags.enigmaRatio
              ? state.combat.scoring.flags.enigmaRatio
              : (effect.powerRatio || 0.5);
            pendingIllusions.push({ sourceName, of: strongest, ratio, fullRank: !!effect.fullRank, sourceId });
          }
          break;
        }
        case "ILLUSION_ATTR": {
          // Осколок PL: иллюзии этого боя считаются заданным атрибутом.
          // Флаг читается при материализации иллюзий (ниже).
          if (state.combat.scoring) state.combat.scoring.flags.illusionAttr = effect.attr;
          Resolver.pushStep(resolution, {
            icon: "🟣",
            label: `${sourceName}: иллюзии этого боя считаются «${Content.attrNames[effect.attr]}»`,
            kind: "aghanim",
          });
          break;
        }
        case "WILD_RANK": {
          pendingWilds.push({ sourceName });
          break;
        }
        case "BUMP_STRONGEST_RANK": {
          strongestBump += effect.value || 1;
          bumpSource = sourceName;
          break;
        }
      }
    }

    // Illusions join the effective set (half power, count for combos, never trigger).
    for (const { sourceName, of, ratio, fullRank } of pendingIllusions) {
      const illusionPower = Math.floor(of.power * ratio);
      const illusionAttr = (state.combat.scoring && state.combat.scoring.flags.illusionAttr) || of.attr;
      effective.push({
        uid: "illusion_" + of.uid,
        heroId: of.heroId,
        power: illusionPower,
        // Скипетр «Demonic Conversion» (Enigma): детекция видит ПОЛНЫЙ ранг.
        detectPower: fullRank ? of.power : (of.detectPower != null ? of.detectPower : of.power),
        attr: illusionAttr,
        illusion: true,
      });
      Resolver.pushStep(resolution, {
        icon: "◆",
        label: `${sourceName}: иллюзия ${Content.heroes.byId[of.heroId].name} (${illusionPower} силы) вступает в бой`,
        kind: "item",
      });
    }

    // Wild ranks and rank bumps affect detection only — real power still scores.
    // Candidates: identity, +bumped-strongest, each ± butterfly wild on the
    // weakest card. The engine plays whichever candidate yields the best combo,
    // so detection hooks never HURT the player.
    const identity = effective.map((c) => ({ ...c, meta: { bumped: false, wild: 0 } }));
    const candidates = [identity];
    if (strongestBump) {
      const strongestIdx = identity.reduce((mi, c, i, arr) => (c.power > arr[mi].power ? i : mi), 0);
      for (const delta of [strongestBump, -strongestBump]) {
        const bumped = effective.map((c) => ({ ...c, meta: { bumped: true, wild: 0 } }));
        bumped[strongestIdx].detectPower =
          (bumped[strongestIdx].detectPower != null ? bumped[strongestIdx].detectPower : bumped[strongestIdx].power) + delta;
        candidates.push(bumped);
      }
    }
    if (pendingWilds.length) {
      for (const base of candidates.slice()) {
        const weakestIdx = base.reduce((mi, c, i, arr) => (c.power < arr[mi].power ? i : mi), 0);
        for (const delta of [-1, 1]) {
          const variant = base.map((c) => ({ ...c, meta: { ...c.meta } }));
          variant[weakestIdx] = { ...variant[weakestIdx], detectPower: variant[weakestIdx].power + delta, meta: { bumped: variant[weakestIdx].meta.bumped, wild: delta } };
          candidates.push(variant);
        }
      }
    }
    let best = null;
    const formationMode = state.rules === "formation";
    for (const candidate of candidates) {
      const combo = formationMode
        ? FormationSys.evaluate(candidate, { defense: towerDefenseOf(state) })
        : PokerSys.evaluate(candidate);
      if (!combo) continue;
      if (!best || (formationMode ? betterFormation(combo, best.combo) : betterCombo(combo, best.combo))) {
        best = { combo, cards: candidate, meta: candidate[0].meta };
      }
    }
    const usedBump = best.meta && best.meta.bumped;
    if (strongestBump && usedBump) {
      Resolver.pushStep(resolution, {
        icon: "◆",
        label: `${bumpSource}: сильнейшая карта считается соседним рангом`,
        kind: "item",
      });
    }
    if (pendingWilds.length && best.meta && best.meta.wild !== 0) {
      Resolver.pushStep(resolution, {
        icon: "◆",
        label: `Butterfly: слабейшая карта считается соседним рангом для комбо`,
        kind: "item",
      });
    }
    return { effective, combo: best.combo, copyLog };
  }

  function betterCombo(a, b) {
    const ra = Content.combos.byId[a.type].rank;
    const rb = Content.combos.byId[b.type].rank;
    if (ra !== rb) return ra > rb;
    return a.basePower > b.basePower;
  }

  // Формации: кандидат детекции выбирается по итоговому урону против башни
  // (docs/REDESIGN_ANTI_BALATRO.md §12), ничья — позиционность/тир.
  function betterFormation(a, b) {
    if (a.damage !== b.damage) return a.damage > b.damage;
    if (a.tier !== b.tier) return a.tier > b.tier;
    return a.basePower * a.baseMult > b.basePower * b.baseMult;
  }

  // Числовая защита цели (formation): TOWER_DEFENSE по id башни, множитель
  // маршрута (batch-1 пока без defense-маршрутов). BKB обнуляет —
  // он и так выключает волновые модификаторы и проклятия.
  function towerDefenseOf(state) {
    if (state.combat.scoring && state.combat.scoring.flags.bkbBlocksMods) return { armor: 0, mr: 0 };
    const base = Content.towerDefense.byId[state.combat.wave.towerId] || { armor: 0, mr: 0 };
    const dm = state.combat.wave.defenseMult || 1;
    const perItem = state.combat.wave.defensePerItem || 0;
    const mirror = perItem ? perItem * state.player.items.length : 0;
    return {
      armor: Math.round((base.armor * dm) + mirror),
      mr: Math.min(0.9, Math.round((base.mr * dm + mirror / 200) * 100) / 100),
    };
  }

  function towerDamageMult(state, resolution, playedCount) {
    const tower = state.combat.wave;
    if (state.combat.scoring.flags.bkbBlocksMods) return 1;
    const trace = state.combat.scoring.trace;
    let mult = 1;
    for (const mod of tower.modifiers || []) {
      if (mod.id === "armor" && state.combat.fightIndex === 0) {
        // fightIndex is 0-based: 0 = first fight of the wave.
        // Butterfly evasion, one roll per fight (BKB already handled globally).
        if (state.player.items.includes("butterfly") && Rng.current().chance(0.25)) {
          Resolver.pushStep(resolution, { icon: "🎲", label: "Butterfly: броня башни уклонена!", kind: "item" });
        } else {
          Resolver.pushStep(resolution, { icon: "☠", label: "Armor T2: первый бой волны — урон ×0.5", kind: "modifier" });
          mult *= 0.5;
          if (trace) trace.towerMult.push({ source: "Armor", value: 0.5 });
        }
      }
      if (mod.id === "glyph" && state.combat.fightIndex % 3 === 2) {
        // every 3rd fight: #3, #6, ...
        Resolver.pushStep(resolution, { icon: "☠", label: "Glyph T3: бой заблокирован полностью!", kind: "modifier" });
        if (trace) trace.towerMult.push({ source: "Glyph", value: 0 });
        return 0;
      }
      // Мутации башен (ранги Божество+).
      if (mod.id === "reflection" && state.combat.fightIndex % 2 === 1) {
        mult *= 0.75;
        if (trace) trace.towerMult.push({ source: "Отражение", value: 0.75 });
        Resolver.pushStep(resolution, { icon: "☠", label: "Отражение: чётный бой — урон ×0.75", kind: "modifier" });
      }
      if (mod.id === "thorns" && playedCount >= 4) {
        mult *= 0.85;
        if (trace) trace.towerMult.push({ source: "Шипы", value: 0.85 });
        Resolver.pushStep(resolution, { icon: "☠", label: "Шипы: большой отряд — урон ×0.85", kind: "modifier" });
      }
    }
    return mult;
  }

  function enemyShieldMult(state) {
    // Enemy picked up the Divine Rapier after a failed wave.
    return (state.combat.wave.enemyItems || []).includes("rapier") ? 0.5 : 1;
  }

  // Оверкилл-золото: делители привязаны к росту HP по актам, кап — 3× награды
  // за волну. Иначе поздние акты печатают золото из больших пулов HP.
  function overkillGold(state, overkill) {
    if (overkill <= 0) return 0;
    const wave = state.combat.wave;
    const halfCap = Math.floor(wave.maxHp * 0.5);
    const fast = Math.min(overkill, halfCap);
    const slow = Math.max(0, overkill - halfCap);
    const raw = Math.floor(fast / 60) + Math.floor(slow / 120);
    const cap = 5; // жёсткий кап: оверкилл — бонус точности, а не печать золота
    return Math.min(cap, Math.floor(raw * state.combat.scoring.flags.overkillRate));
  }

  // Runs the whole fight against state.combat.wave. Mutates state.
  function resolveFight(state) {
    const resolution = Resolver.createResolution(state);
    const played = realPlayedCards(state);
    played.forEach((c, i) => (c.slotIndex = i));

    state.combat.scoring = { power: 0, mult: 1, finalMult: 1, flags: { ignoreTowerMods: false, overkillRate: 1, refreshHeroTriggers: false, bkbBlocksMods: state.player.items.includes("bkb"), lastHitGold: 0 } };
    // Скипетр- и осколок-правила боя (preFlag): до триггеров, без порядка слотов.
    for (const card of played) {
      const owned = state.run.aghanims && state.run.aghanims[card.heroId];
      if (!owned) continue;
      for (const kind of ["scepter", "shard"]) {
        const aug = owned[kind] ? Content.aghanims.byId[owned[kind]] : null;
        if (aug && aug.preFlag) {
          Object.assign(state.combat.scoring.flags, aug.preFlag);
          Resolver.pushStep(resolution, {
            icon: "🟣",
            label: `${aug.name}: ${aug.preFlag.uniWildcard ? "Универсалы — джокеры атрибутов для условий" : aug.desc}`,
            kind: "aghanim",
          });
        }
      }
    }
    // Аудит силы (фаза D): слои урона для tests/audit.mjs.
    state.combat.scoring.trace = {
      played: played.length,
      act: state.run.act || 1,
      waveIndex: state.run.waveIndex,
      rules: state.rules,
      comboId: null,
      comboBase: 0,
      cardsPower: 0,
      comboMult: 1,
      heroPower: 0,
      itemPower: 0,
      heroMult: 0,
      itemMult: 0,
      multMult: [],
      finalMult: [],
      towerMult: [],
      damage: 0,
      gold: 0,
    };

    // Проклятия элитной башни: BKB выключает их все.
    const curses = state.combat.scoring.flags.bkbBlocksMods ? [] : waveCurses(state);
    const silenced = curses.includes("silence");
    if (silenced) {
      Resolver.pushStep(resolution, { icon: "☠", label: "Безмолвие: способности героев отключены", kind: "modifier" });
    }

    // 1-2. Pre-detect + detection.
    const { effective, combo, copyLog } = buildEffectiveSet(state, played, resolution);
    resolution.combo = combo;
    if (state.rules === "formation") {
      Resolver.pushStep(resolution, {
        icon: "🧩",
        label: `Формация «${combo.name}» (тир ${combo.tier}): ${combo.formPower} × ${combo.formMult}, ${Content.damageTypeNames[combo.damageType]} урон`,
        kind: "combo",
      });
      for (const bond of combo.bonds) {
        const parts = [];
        if (bond.power) parts.push("+" + bond.power + " силы");
        if (bond.mult) parts.push("+" + bond.mult + " к множителю");
        if (parts.length) {
          Resolver.pushStep(resolution, { icon: "🔗", label: `Связка «${bond.trait}»: ${parts.join(", ")}`, kind: "bond" });
        }
      }
    } else {
      Resolver.pushStep(resolution, {
        icon: "🃏",
        label: `Комбо: ${combo.name} (база ${combo.basePower} × ${combo.baseMult})`,
        kind: "combo",
      });
    }

    // 3. Base power + played card powers (туман: ранг ≤4 не даёт силы;
    // нестабильная позиция: герой в запретном слоте волны даёт −40%).
    const fog = curses.includes("fog");
    state.combat.scoring.power = combo.basePower;
    let cardPowerSum = 0;
    let forbiddenHit = false;
    for (const card of effective) {
      let power = card.power;
      if (fog && power <= 4) continue;
      if (state.combat.forbiddenSlot && card.slotIndex === state.combat.forbiddenSlot - 1) {
        power = Math.floor(power * 0.6);
        forbiddenHit = true;
      }
      cardPowerSum += power;
    }
    if (fog && effective.some((c) => c.power <= 4)) {
      Resolver.pushStep(resolution, { icon: "☠", label: "Туман войны: герои ранга ≤4 не дают силы", kind: "modifier" });
    }
    if (forbiddenHit) {
      Resolver.pushStep(resolution, { icon: "☠", label: `Нестабильная позиция: слот ${state.combat.forbiddenSlot} — −40% силы`, kind: "modifier" });
    }
    // Вознесение (#56): сильнейший герой ×1.5.
    if (state.combat.wave.heroAscend && effective.length) {
      const top = effective.reduce((a, b) => (b.power > a.power ? b : a), effective[0]);
      const before = top.power;
      top.power = Math.round(top.power * 1.5);
      state.combat.scoring.trace.itemPower += 0;
      Resolver.pushStep(resolution, { icon: "🌟", label: `Вознесение: ${Content.heroes.byId[top.heroId].name} ×1.5 (+${top.power - before} силы)`, kind: "info" });
    }
    state.combat.scoring.power += cardPowerSum;
    state.combat.scoring.mult = combo.baseMult;
    state.combat.scoring.effective = effective;
    state.combat.scoring.copyLog = copyLog;
    // Крепкая масть (#2): случайная карта усиливается на процент.
    const cardBuffPct = Upgrades.sum(state, "cardBuffPct");
    if (cardBuffPct && effective.length) {
      const lucky = effective[Math.floor(Rng.current().next() * effective.length)];
      const bonus = Math.max(1, Math.floor(lucky.power * cardBuffPct / 100));
      lucky.power += bonus;
      state.combat.scoring.trace.itemPower += 0; // не предмет: отдельный слой не нужен
      Resolver.pushStep(resolution, {
        icon: "🔧",
        label: `Крепкая масть: ${Content.heroes.byId[lucky.heroId].name} +${bonus} силы`,
        kind: "info",
      });
    }
    // Эхо (#96): первый бой волны — способности героев дважды.
    if (state.combat.wave.echoFirst && state.combat.fightIndex === 0) {
      state.combat.scoring.flags.refreshHeroTriggers = true;
      Resolver.pushStep(resolution, { icon: "📢", label: "Эхо: способности героев звучат дважды", kind: "info" });
    }
    // Форма руки (#49/#92): первые N карт сильнее, остальные слабее.
    const shape = state.combat.wave.handShape;
    if (shape && effective.length) {
      let delta = 0;
      effective.forEach((c, i) => {
        const mult = i < shape.firstN ? shape.firstMult : shape.restMult;
        const before = c.power;
        c.power = Math.max(1, Math.round(c.power * mult));
        delta += c.power - before;
      });
      if (delta !== 0) {
        state.combat.scoring.trace.itemPower += 0;
        Resolver.pushStep(resolution, { icon: "🩸", label: `Форма руки: первые ${shape.firstN} ×${shape.firstMult}, остальные ×${shape.restMult} (${delta >= 0 ? "+" : ""}${delta} силы)`, kind: "info" });
      }
    }
    // Wildcard (#48): слабейший копирует сильнейшего.
    if (state.combat.wave.wildcardCopy && effective.length > 1) {
      const strongest = effective.reduce((a, b) => (b.power > a.power ? b : a), effective[0]);
      const weakest = effective.reduce((a, b) => (b.power < a.power ? b : a), effective[0]);
      weakest.power = Math.max(1, Math.floor(strongest.power * 0.75));
      weakest.attr = strongest.attr;
      Resolver.pushStep(resolution, { icon: "🃏", label: `Wildcard: ${Content.heroes.byId[weakest.heroId].name} копирует ${Content.heroes.byId[strongest.heroId].name} (75% силы)`, kind: "info" });
    }
    // Нестабильность (#45): случайная карта получает случайный множитель.
    if (state.combat.wave.randomCardMult && effective.length) {
      const card = effective[Math.floor(Rng.current().next() * effective.length)];
      const mult = [0.5, 0.75, 1.25, 1.5, 2][Math.floor(Rng.current().next() * 5)];
      card.power = Math.max(1, Math.round(card.power * mult));
      Resolver.pushStep(resolution, { icon: "🎲", label: `Нестабильность: ${Content.heroes.byId[card.heroId].name} ×${mult} → ${card.power} силы`, kind: "info" });
    }
    // Золотая клетка (#63): герой в отмеченном слоте ×1.5.
    if (state.combat.wave.goldenSlot) {
      const golden = effective.find((c) => c.slotIndex === state.combat.wave.goldenSlot - 1);
      if (golden) {
        golden.power = Math.round(golden.power * 1.5);
        Resolver.pushStep(resolution, { icon: "🟨", label: `Золотая клетка ${state.combat.wave.goldenSlot}: ${Content.heroes.byId[golden.heroId].name} ×1.5`, kind: "info" });
      }
    }
    // Бонус силы маршрута (Пустая рука/Вознесение/Дуэль) — всем боям волны.
    if (state.combat.wave.powerBonus) {
      state.combat.scoring.power += state.combat.wave.powerBonus;
      state.combat.scoring.trace.routePower = (state.combat.scoring.trace.routePower || 0) + state.combat.wave.powerBonus;
      Resolver.pushStep(resolution, {
        icon: "🧭",
        label: `Маршрут «${state.combat.wave.routeName}»: +${state.combat.wave.powerBonus} силы`,
        kind: "info",
      });
    }
    // База для аудита: комбо + сыгранные карты до триггеров.
    state.combat.scoring.trace.comboId = combo.type;
    state.combat.scoring.trace.comboBase = combo.basePower;
    state.combat.scoring.trace.cardsPower = cardPowerSum;
    state.combat.scoring.trace.comboMult = combo.baseMult;

    // 4. Hero triggers (+ аугменты героев).
    runTriggers(state, resolution, { playedCards: effective, combo, scoring: state.combat.scoring, simulate: state.simulate }, silenced ? [] : HERO_KINDS);

    // 5. Item triggers.
    runTriggers(state, resolution, { playedCards: effective, combo, scoring: state.combat.scoring, simulate: state.simulate }, ["item"]);

    // 5.5 Улучшения лавки (фаза F): те же триггеры, отдельный вид источника.
    runTriggers(state, resolution, { playedCards: effective, combo, scoring: state.combat.scoring, simulate: state.simulate }, ["upgrade"]);

    // 6. Refresher: hero triggers again.
    if (state.combat.scoring.flags.refreshHeroTriggers && !silenced) {
      runTriggers(state, resolution, { playedCards: effective, combo, scoring: state.combat.scoring, simulate: state.simulate, onlyKinds: HERO_KINDS, refreshed: true }, HERO_KINDS);
    }

    // 6.5 Ставка: чем больше отряд, тем жирнее удар.
    const commit = COMMIT_TIERS[played.length];
    if (commit && commit.finalMult !== 1) {
      state.combat.scoring.finalMult *= commit.finalMult;
      state.combat.scoring.trace.finalMult.push({ source: `Ставка (${played.length} героев)`, value: commit.finalMult });
      Resolver.pushStep(resolution, {
        icon: "🎖",
        label: `Ставка «${commit.name}» (${played.length} героев): ×${commit.finalMult} к урону`,
        kind: "info",
      });
    }

    // 6.6 Импульс: серия зачищенных волн.
    const momentumStacks = Math.min(state.run.momentum || 0, MOMENTUM_CAP);
    if (momentumStacks > 0) {
      const momentumMult = 1 + momentumStacks * MOMENTUM_STEP;
      state.combat.scoring.finalMult *= momentumMult;
      state.combat.scoring.trace.finalMult.push({ source: "Импульс", value: Math.round(momentumMult * 100) / 100 });
      Resolver.pushStep(resolution, {
        icon: "🔥",
        label: `Импульс ${momentumStacks} волн подряд: ×${round2(momentumMult)} к урону`,
        kind: "info",
      });
    }

    // Близнецы (#58): повтор героя в отряде.
    if (state.combat.wave.twinsBonus) {
      const seen = new Set();
      const hasDupe = played.some((c) => (seen.has(c.heroId) ? true : (seen.add(c.heroId), false)));
      if (hasDupe) {
        const mult = 1 + state.combat.wave.twinsBonus / 100;
        state.combat.scoring.finalMult *= mult;
        state.combat.scoring.trace.finalMult.push({ source: "Близнецы", value: Math.round(mult * 100) / 100 });
        Resolver.pushStep(resolution, { icon: "👯", label: `Близнецы: повтор героя в отряде — ×${Math.round(mult * 100) / 100}`, kind: "info" });
      }
    }

    // 6.7 Проклятие забега «Кровоток»: весь урон ×1.15.
    if (Ranks.hasCurse(state, "blood")) {
      state.combat.scoring.finalMult *= 1.15;
      state.combat.scoring.trace.finalMult.push({ source: "Кровоток", value: 1.15 });
      Resolver.pushStep(resolution, { icon: "🩸", label: "Кровоток: урон ×1.15", kind: "modifier" });
    }

    // 7. Tower modifiers + проклятия элиты + правила ранга.
    let curseMultiplier = 1;
    const towerTrace = state.combat.scoring.trace;
    const traceCurse = (source, value) => towerTrace.towerMult.push({ source, value });
    if (curses.includes("archivist")) {
      const hunted = Ranks.mostUsedCombo(s);
      if (hunted && hunted.id === combo.type) {
        curseMultiplier *= 0.75;
        traceCurse("Архивариус", 0.75);
        Resolver.pushStep(resolution, { icon: "☠", label: "Архивариус: изученное комбо — ×0.75", kind: "modifier" });
      }
    }
    if (curses.includes("adaptation") && state.combat.lastComboType === combo.type) {
      curseMultiplier *= 0.5;
      traceCurse("Адаптация", 0.5);
      Resolver.pushStep(resolution, { icon: "☠", label: "Адаптация: повтор комбинации ×0.5", kind: "modifier" });
    }
    if (curses.includes("bastion") && (state.rules === "formation" ? combo.tier <= 1 : Content.combos.byId[combo.type].rank <= 2)) {
      curseMultiplier *= 0.5;
      traceCurse("Фортификация", 0.5);
      Resolver.pushStep(resolution, { icon: "☠", label: "Фортификация: малое комбо ×0.5", kind: "modifier" });
    }
    // Память башен (Рыцарь): тот же тип удара, что в прошлом бою волны, — ×0.9.
    if (Ranks.has(state, "memory") && state.combat.lastComboType === combo.type) {
      curseMultiplier *= 0.9;
      traceCurse("Память башен", 0.9);
      Resolver.pushStep(resolution, { icon: "☠", label: "Память башен: тот же тип удара — ×0.9", kind: "modifier" });
    }
    // Адаптация мира (Титан): самое частое комбо забега — ×0.85. BKB не снимает:
    // это правило лиги, а не модификатор башни.
    if (Ranks.has(state, "adaptive")) {
      const hunted = Ranks.mostUsedCombo(state);
      if (hunted && hunted.id === combo.type) {
        curseMultiplier *= 0.85;
        traceCurse("Адаптация мира", 0.85);
        Resolver.pushStep(resolution, { icon: "☠", label: "Адаптация мира: изученное комбо — ×0.85", kind: "modifier" });
      }
    }
    const towerMult = towerDamageMult(state, resolution, played.length) * enemyShieldMult(state) * curseMultiplier;
    if (enemyShieldMult(state) !== 1) traceCurse("Рапира у врага", enemyShieldMult(state));
    resolution.blocked = towerMult === 0;

    // 8. Damage.
    const s = state.combat.scoring;
    let damage;
    if (state.rules === "formation") {
      // Третья ось: тип урона против числовой защиты цели (до волновых модов).
      const raw = s.power * s.mult * s.finalMult;
      const baseDefense = towerDefenseOf(state);
      const defense = s.flags.pierceMr ? { armor: baseDefense.armor, mr: 0 } : baseDefense;
      const pen = s.flags.armorPen || 0;
      const mitigated = FormationSys.mitigate(raw, combo.damageType, defense, pen);
      if (state.combat.scoring.flags.bkbBlocksMods) {
        Resolver.pushStep(resolution, { icon: "🛡", label: "BKB: числовая защита башни игнорируется", kind: "modifier" });
      } else if (combo.damageType === "pure") {
        Resolver.pushStep(resolution, { icon: "✦", label: "Чистый урон: броня и сопротивление игнорируются", kind: "info" });
      } else if (combo.damageType === "magical" && defense.mr) {
        Resolver.pushStep(resolution, { icon: "✺", label: `Сопротивление ${Math.round(defense.mr * 100)}%: ${Math.round(raw)} → ${mitigated}`, kind: "modifier" });
      } else if (defense.armor) {
        const effArmor = Math.max(0, defense.armor - pen);
        const absorbed = Math.min(effArmor, raw * 0.5);
        const penNote = pen ? ` (−${Math.min(pen, defense.armor)} коррозия)` : "";
        Resolver.pushStep(resolution, { icon: "🛡", label: `Броня башни ${effArmor}${penNote}: −${Math.round(absorbed)} (${Math.round(raw)} → ${mitigated})`, kind: "modifier" });
      }
      damage = Math.round(mitigated * towerMult);
    } else {
      damage = resolution.blocked ? 0 : Math.round(s.power * s.mult * s.finalMult * towerMult);
    }
    // Улучшения лавки (фаза F): аддитивный процент поверх итогового урона —
    // scalar (агрегатор) + сработавшие хуки (flags.dmgPct).
    const dmgPct = (s.flags.dmgPct || 0) + Upgrades.sum(state, "dmg");
    if (dmgPct && damage > 0) {
      damage = Math.round(damage * (1 + dmgPct / 100));
      if (s.trace) s.trace.finalMult.push({ source: "Улучшения лавки", value: Math.round((1 + dmgPct / 100) * 100) / 100 });
      Resolver.pushStep(resolution, { icon: "🔧", label: `Улучшения лавки: +${dmgPct}% урона`, kind: "info" });
    }
    // Эхо-аугменты (Multicast+ Огра, Echo Strike ПА): повтор части урона.
    if (!resolution.blocked && s.flags.echoPower && !state.simulate) {
      const echo = s.flags.echoPower;
      if (Rng.current().chance(echo.chance / 100)) {
        const extra = Math.max(1, Math.floor(damage * echo.pct / 100));
        damage += extra;
        Resolver.pushStep(resolution, { icon: "🟣", label: `Эхо: +${extra} урона (${echo.pct}% повтор)`, kind: "aghanim" });
      }
    }
    // Осада (TOWER_BURN): чистый добор поверх удара, глиф блокирует всё.
    if (!resolution.blocked && s.flags.towerBurn) {
      damage += s.flags.towerBurn;
      Resolver.pushStep(resolution, { icon: "☄", label: `Осада: +${s.flags.towerBurn} чистого урона по башне`, kind: "item" });
    }
    resolution.damageType = combo.damageType || null;
    resolution.power = s.power;
    resolution.mult = s.mult;
    resolution.damage = damage;
    Resolver.pushStep(resolution, {
      icon: "⚔",
      label: `Урон: ${s.power} × ${round2(s.mult)}${s.finalMult !== 1 ? " × " + round2(s.finalMult) : ""}${towerMult !== 1 ? " × " + round2(towerMult) : ""} = ${damage}`,
      kind: "damage",
    });

    // 9. Apply damage / death / aegis.
    const tower = state.combat.wave;
    const hpBefore = tower.hp;
    tower.hp -= damage;
    const overkill = Math.max(0, damage - hpBefore);
    resolution.towerHpAfter = Math.max(0, tower.hp);

    if (tower.hp <= 0) {
      const aegis = (tower.modifiers || []).find((m) => m.id === "aegis");
      if (aegis && !tower.aegisUsed && !s.flags.denyRevive) {
        tower.aegisUsed = true;
        const def = Content.modifiers.byId["aegis"];
        const result = Effects.apply({ type: "REVIVE", hpPercent: def.hpPercent }, {
          state,
          scoring: s,
          sourceName: "Roshan",
        });
        Resolver.pushStep(resolution, { icon: "☠", label: result.label, kind: "modifier" });
        resolution.killed = false;
      } else {
        resolution.killed = true;
      }
    }

    // 9.5 Мутации башни, дожившей до конца боя (ранги Божество+, BKB снимает).
    let greedSteal = false;
    if (!resolution.killed && tower.hp > 0 && !s.flags.bkbBlocksMods) {
      const hasMut = (id) => (tower.modifiers || []).some((m) => m.id === id);
      if (hasMut("regen")) {
        const heal = Math.max(1, Math.round(tower.maxHp * 0.04));
        tower.hp = Math.min(tower.maxHp, tower.hp + heal);
        tower.regenTotal += heal;
        Resolver.pushStep(resolution, { icon: "☠", label: `Регенерация: башня лечит ${heal} HP`, kind: "modifier" });
      }
      if (hasMut("enrage") && !tower.enraged && tower.hp < tower.maxHp * 0.25) {
        tower.enraged = true;
        const heal = Math.max(1, Math.round(tower.maxHp * 0.1));
        tower.hp = Math.min(tower.maxHp, tower.hp + heal);
        Resolver.pushStep(resolution, { icon: "☠", label: `Ярость: башня исцеляется на ${heal} HP`, kind: "modifier" });
      }
      if (hasMut("greed") && damage < hpBefore * 0.3) {
        greedSteal = true;
        Resolver.pushStep(resolution, { icon: "☠", label: "Жадность: слабый бой — башня забирает 1 золото", kind: "modifier" });
      }
      resolution.towerHpAfter = Math.max(0, tower.hp);
    }

    // 10. Gold from overkill + exact last hit.
    let gold = overkillGold(state, overkill);
    if (gold > 0) {
      Resolver.pushStep(resolution, { icon: "💰", label: `Overkill +${gold} золота`, kind: "gold" });
    }
    if (!resolution.blocked && damage === hpBefore && hpBefore > 0) {
      gold += 5;
      Resolver.pushStep(resolution, { icon: "🎯", label: "Last Hit! +5 золота", kind: "gold" });
      const track = s.flags.lastHitGold || 0;
      if (track) {
        gold += track;
        Resolver.pushStep(resolution, { icon: "💰", label: `Track: +${track} золота за точный ласт-хит`, kind: "gold" });
      }
      // Перк архетипа «Крит»: точный ласт-хит доплачивает.
      if (Game.archPerk(state) === "lasthit2") {
        gold += 2;
        Resolver.pushStep(resolution, { icon: "💀", label: "Отряд «Крит»: +2 золота за точный ласт-хит", kind: "gold" });
      }
      // Скипетр «Jinada» (Bounty): ласт-хит возвращает ТП-сброс на следующую волну.
      if (s.flags.refundDiscards) {
        state.run.pendingDiscardBonus = (state.run.pendingDiscardBonus || 0) + s.flags.refundDiscards;
        Resolver.pushStep(resolution, { icon: "🟣", label: `Jinada: +${s.flags.refundDiscards} ТП-сброс на следующую волну`, kind: "aghanim" });
      }
      // Осколок «Shuriken Toss» (Bounty): ласт-хит копит удачу (кап).
      const luckHit = s.flags.luckOnLastHit;
      if (luckHit) {
        const charges = state.run.heroCharges;
        charges[luckHit.heroId] = charges[luckHit.heroId] || {};
        const before = charges[luckHit.heroId].luck || 0;
        if (before < luckHit.cap) {
          charges[luckHit.heroId].luck = Math.min(luckHit.cap, before + 1);
          Resolver.pushStep(resolution, { icon: "🟣", label: `Shuriken Toss: удача ${charges[luckHit.heroId].luck}/${luckHit.cap}`, kind: "aghanim" });
        }
      }
      // Скипетр «Duel+» (Legion): точный ласт-хит — Duel stack.
      const duel = s.flags.chargeOnLastHit;
      if (duel) {
        const charges = state.run.heroCharges;
        charges[duel.heroId] = charges[duel.heroId] || {};
        const before = charges[duel.heroId].count || 0;
        if (before < duel.cap) {
          charges[duel.heroId].count = Math.min(duel.cap, before + 1);
          Resolver.pushStep(resolution, { icon: "🟣", label: `Duel stack: ${charges[duel.heroId].count}/${duel.cap}`, kind: "aghanim" });
        }
      }
    }
    if (commit && commit.gold) {
      gold += commit.gold;
      Resolver.pushStep(resolution, { icon: "💰", label: `Харас (1 герой): +${commit.gold} золото`, kind: "gold" });
    }
    resolution.goldGained = gold;
    state.run.gold += gold;
    if (greedSteal && state.run.gold > 0) {
      state.run.gold -= 1;
    }

    state.stats.totalDamage += damage;
    if (damage > state.stats.biggestHit) state.stats.biggestHit = damage;

    // Скипетр «Shatter» (AA): зачистка волны ослабляет следующую башню акта.
    if (!state.simulate && resolution.killed && s.flags.nextWaveHpPct) {
      state.run.nextWaveHpPct = Math.min(30, (state.run.nextWaveHpPct || 0) + s.flags.nextWaveHpPct);
      Resolver.pushStep(resolution, { icon: "🟣", label: `Shatter: следующая башня акта начнёт с −${state.run.nextWaveHpPct}% HP`, kind: "aghanim" });
    }

    // Аудит силы: итоги боя в структурный след (tests/audit.mjs).
    state.combat.scoring.trace.damage = damage;
    state.combat.scoring.trace.gold = gold;
    resolution.trace = state.combat.scoring.trace;

    // Cycle: played cards go to discard (illusions vanish), draw back to hand size.
    DeckSys.moveToDiscard(state, state.combat.selectedUids);
    state.combat.selectedUids = [];
    DeckSys.draw(state, Rng.current());
    state.player.fightsLeft -= 1;
    state.combat.fightIndex += 1;
    state.combat.lastComboType = combo.type; // для проклятия «Адаптация» и памяти башен
    // Разнообразие и серии комбо за забег: Zeus/Kunkka читают набор типов,
    // Juggernaut — длину серии одинаковых подряд.
    state.run.comboTypes = state.run.comboTypes || {};
    state.run.comboTypes[combo.type] = 1;
    state.run.comboStreak = state.run.lastComboTypeRaw === combo.type ? (state.run.comboStreak || 1) + 1 : 1;
    state.run.lastComboTypeRaw = combo.type;
    // Память слотов: скипетр «Overload» (Storm, шаг 3) сравнивает позицию
    // героя с прошлым боем.
    state.combat.lastSlot = state.combat.lastSlot || {};
    for (const card of played) state.combat.lastSlot[card.heroId] = card.slotIndex;
    // Последовательность (#47): состав пачки для запрета повтора.
    state.combat.wave.lastFightHeroes = played.map((c) => c.heroId);
    // Плавающие позиции (#64): рука перемешивается после боя.
    if (state.combat.wave.floatingHands && state.player.handUids.length > 1) {
      state.player.handUids = Rng.current().shuffle(state.player.handUids.slice());
    }
    // Ранги Легенда/Титан: мир считает, чем ты играешь — усталость героев,
    // охота на героя и адаптация мира читают эти счётчики.
    state.run.comboUses[combo.type] = (state.run.comboUses[combo.type] || 0) + 1;
    for (const card of played) {
      state.run.heroUses[card.heroId] = (state.run.heroUses[card.heroId] || 0) + 1;
    }
    // XP героев (спек §7.2): бой +1, добивший +2; Вдохновение (#30) — близкая
    // победа (точный ласт-хит или оверкилл <10% maxHp) добавляет ещё всем.
    if (!state.simulate) {
      let xpGain = resolution.killed ? 2 : 1;
      const closeWin = resolution.killed && (overkill === 0 || overkill < tower.maxHp * 0.1);
      if (closeWin) xpGain += Upgrades.sum(state, "inspireXp");
      // Скипетр «Burn the Racks» (Huskar): зачистка с потерянной казармой — +XP.
      const grantXp = state.combat.scoring.flags.grantXpOnClear;
      const racksBurned = grantXp && resolution.killed && state.run.barracks < Game.BARRACKS_MAX;
      for (const card of played) {
        const hid = card.heroId;
        const before = Game.heroLevel(state, hid);
        state.run.heroXp = state.run.heroXp || {};
        state.run.heroXp[hid] = (state.run.heroXp[hid] || 0) + xpGain + (racksBurned ? grantXp : 0);
        const after = Game.heroLevel(state, hid);
        if (after > before) {
          Resolver.pushStep(resolution, { icon: "🌱", label: `${Content.heroes.byId[hid].name} растёт: уровень ${after} (+1 сила)`, kind: "info" });
        }
      }
      if (racksBurned) {
        Resolver.pushStep(resolution, { icon: "🟣", label: `Burn the Racks: казармы = опыт, героям боя +${grantXp} XP`, kind: "aghanim" });
      }
    }
    state.combat.lastResolution = resolution;
    state.combat.scoring = null;
    return resolution;
  }

  function runTriggers(state, resolution, payload, kinds) {
    Triggers.runEvent(state, null, "ON_PLAY", { ...payload, onlyKinds: kinds }, resolution);
    Triggers.runEvent(state, null, "COMBO_DETECTED", { ...payload, onlyKinds: kinds }, resolution);
    Triggers.runEvent(state, null, "FIGHT_SCORING", { ...payload, onlyKinds: kinds }, resolution);
  }

  function round2(v) {
    return Math.round(v * 100) / 100;
  }

  return { resolveFight, realPlayedCards, buildEffectiveSet, HAND_SIZE, MAX_SLOTS, COMMIT_TIERS, MOMENTUM_STEP, MOMENTUM_CAP };
})();
