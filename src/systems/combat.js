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
    return Content.heroes.byId[heroId].attr;
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
      if (hero.ability && hero.ability.event === "PRE_DETECT") {
        effects.push({ effect: hero.ability.effects[0], card, slotIndex, sourceName: hero.name });
      }
    });
    state.player.items.forEach((itemId) => {
      const item = Content.items.byId[itemId];
      if (item.ability && item.ability.event === "PRE_DETECT") {
        effects.push({ effect: item.ability.effects[0], card: null, slotIndex: -1, sourceName: item.name });
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

    for (const { effect, card, slotIndex, sourceName } of collectPreDetectEffects(state, effective)) {
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
              effective[slotIndex].attr = neighbor.attr;
            }
          break;
        }
        case "CREATE_ILLUSION": {
          const strongest = effective.reduce((a, b) => (b.power > a.power ? b : a), effective[0]);
          if (strongest) {
            pendingIllusions.push({ sourceName, of: strongest, ratio: effect.powerRatio || 0.5 });
          }
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
    for (const { sourceName, of, ratio } of pendingIllusions) {
      const illusionPower = Math.floor(of.power * ratio);
      effective.push({
        uid: "illusion_" + of.uid,
        heroId: of.heroId,
        power: illusionPower,
        detectPower: of.detectPower != null ? of.detectPower : of.power,
        attr: of.attr,
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

  // Числовая защита цели (formation): TOWER_DEFENSE по id башни. BKB обнуляет —
  // он и так выключает волновые модификаторы и проклятия.
  function towerDefenseOf(state) {
    if (state.combat.scoring && state.combat.scoring.flags.bkbBlocksMods) return { armor: 0, mr: 0 };
    return Content.towerDefense.byId[state.combat.wave.towerId] || { armor: 0, mr: 0 };
  }

  function towerDamageMult(state, resolution, playedCount) {
    const tower = state.combat.wave;
    if (state.combat.scoring.flags.bkbBlocksMods) return 1;
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
        }
      }
      if (mod.id === "glyph" && state.combat.fightIndex % 3 === 2) {
        // every 3rd fight: #3, #6, ...
        Resolver.pushStep(resolution, { icon: "☠", label: "Glyph T3: бой заблокирован полностью!", kind: "modifier" });
        return 0;
      }
      // Мутации башен (ранги Божество+).
      if (mod.id === "reflection" && state.combat.fightIndex % 2 === 1) {
        mult *= 0.75;
        Resolver.pushStep(resolution, { icon: "☠", label: "Отражение: чётный бой — урон ×0.75", kind: "modifier" });
      }
      if (mod.id === "thorns" && playedCount >= 4) {
        mult *= 0.85;
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
    state.combat.scoring.power += cardPowerSum;
    state.combat.scoring.mult = combo.baseMult;
    state.combat.scoring.effective = effective;
    state.combat.scoring.copyLog = copyLog;

    // 4. Hero triggers.
    runTriggers(state, resolution, { playedCards: effective, combo, scoring: state.combat.scoring, simulate: state.simulate }, silenced ? [] : ["hero"]);

    // 5. Item triggers.
    runTriggers(state, resolution, { playedCards: effective, combo, scoring: state.combat.scoring, simulate: state.simulate }, ["item"]);

    // 6. Refresher: hero triggers again.
    if (state.combat.scoring.flags.refreshHeroTriggers && !silenced) {
      runTriggers(state, resolution, { playedCards: effective, combo, scoring: state.combat.scoring, simulate: state.simulate, onlyKinds: ["hero"], refreshed: true }, ["hero"]);
    }

    // 6.5 Ставка: чем больше отряд, тем жирнее удар.
    const commit = COMMIT_TIERS[played.length];
    if (commit && commit.finalMult !== 1) {
      state.combat.scoring.finalMult *= commit.finalMult;
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
      Resolver.pushStep(resolution, {
        icon: "🔥",
        label: `Импульс ${momentumStacks} волн подряд: ×${round2(momentumMult)} к урону`,
        kind: "info",
      });
    }

    // 6.7 Проклятие забега «Кровоток»: весь урон ×1.15.
    if (Ranks.hasCurse(state, "blood")) {
      state.combat.scoring.finalMult *= 1.15;
      Resolver.pushStep(resolution, { icon: "🩸", label: "Кровоток: урон ×1.15", kind: "modifier" });
    }

    // 7. Tower modifiers + проклятия элиты + правила ранга.
    let curseMultiplier = 1;
    if (curses.includes("adaptation") && state.combat.lastComboType === combo.type) {
      curseMultiplier *= 0.5;
      Resolver.pushStep(resolution, { icon: "☠", label: "Адаптация: повтор комбинации ×0.5", kind: "modifier" });
    }
    if (curses.includes("bastion") && (state.rules === "formation" ? combo.tier <= 1 : Content.combos.byId[combo.type].rank <= 2)) {
      curseMultiplier *= 0.5;
      Resolver.pushStep(resolution, { icon: "☠", label: "Фортификация: малое комбо ×0.5", kind: "modifier" });
    }
    // Память башен (Рыцарь): тот же тип удара, что в прошлом бою волны, — ×0.9.
    if (Ranks.has(state, "memory") && state.combat.lastComboType === combo.type) {
      curseMultiplier *= 0.9;
      Resolver.pushStep(resolution, { icon: "☠", label: "Память башен: тот же тип удара — ×0.9", kind: "modifier" });
    }
    // Адаптация мира (Титан): самое частое комбо забега — ×0.85. BKB не снимает:
    // это правило лиги, а не модификатор башни.
    if (Ranks.has(state, "adaptive")) {
      const hunted = Ranks.mostUsedCombo(state);
      if (hunted && hunted.id === combo.type) {
        curseMultiplier *= 0.85;
        Resolver.pushStep(resolution, { icon: "☠", label: "Адаптация мира: изученное комбо — ×0.85", kind: "modifier" });
      }
    }
    const towerMult = towerDamageMult(state, resolution, played.length) * enemyShieldMult(state) * curseMultiplier;
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

    // Cycle: played cards go to discard (illusions vanish), draw back to hand size.
    DeckSys.moveToDiscard(state, state.combat.selectedUids);
    state.combat.selectedUids = [];
    DeckSys.draw(state, Rng.current());
    state.player.fightsLeft -= 1;
    state.combat.fightIndex += 1;
    state.combat.lastComboType = combo.type; // для проклятия «Адаптация» и памяти башен
    // Ранги Легенда/Титан: мир считает, чем ты играешь — усталость героев,
    // охота на героя и адаптация мира читают эти счётчики.
    state.run.comboUses[combo.type] = (state.run.comboUses[combo.type] || 0) + 1;
    for (const card of played) {
      state.run.heroUses[card.heroId] = (state.run.heroUses[card.heroId] || 0) + 1;
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
