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
//   7. Tower mods   — BKB / Butterfly interact, then armor / glyph
//   8. Damage       — power × mult × finalMult × towerMult
//   9. Death/Aegis  — revive once, else killed
//  10. Gold         — overkill (decayed) + exact last hit
const Combat = (function () {
  const HAND_SIZE = DeckSys.HAND_SIZE;
  const MAX_SLOTS = 5;

  function realPlayedCards(state) {
    return state.combat.selectedUids.map((uid) => {
      const card = state.cards[uid];
      const hero = Content.heroes.byId[card.heroId];
      return { uid, heroId: card.heroId, power: hero.power, attr: hero.attr, illusion: false, slotIndex: 0 };
    });
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
          if (effect.target === "left_neighbor" && slotIndex > 0) {
            const neighbor = effective[slotIndex - 1];
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
    for (const candidate of candidates) {
      const combo = PokerSys.evaluate(candidate);
      if (!combo) continue;
      if (!best || betterCombo(combo, best.combo)) {
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

  function towerDamageMult(state, resolution) {
    const tower = state.combat.wave;
    if (state.combat.scoring.flags.bkbBlocksMods) return 1;
    for (const mod of tower.modifiers || []) {
      if (mod.id === "armor" && state.combat.fightIndex === 0) {
        // fightIndex is 0-based: 0 = first fight of the wave.
        // Butterfly evasion, one roll per fight (BKB already handled globally).
        if (state.player.items.includes("butterfly") && Rng.current().chance(0.25)) {
          Resolver.pushStep(resolution, { icon: "🎲", label: "Butterfly: броня башни уклонена!", kind: "item" });
          return 1;
        }
        Resolver.pushStep(resolution, { icon: "☠", label: "Armor T2: первый бой волны — урон ×0.5", kind: "modifier" });
        return 0.5;
      }
      if (mod.id === "glyph" && state.combat.fightIndex % 3 === 2) {
        // every 3rd fight: #3, #6, ...
        Resolver.pushStep(resolution, { icon: "☠", label: "Glyph T3: бой заблокирован полностью!", kind: "modifier" });
        return 0;
      }
    }
    return 1;
  }

  function enemyShieldMult(state) {
    // Enemy picked up the Divine Rapier after a failed wave.
    return (state.combat.wave.enemyItems || []).includes("rapier") ? 0.5 : 1;
  }

  function overkillGold(state, overkill) {
    if (overkill <= 0) return 0;
    const halfCap = Math.floor(state.combat.wave.maxHp * 0.5);
    const fast = Math.min(overkill, halfCap);
    const slow = Math.max(0, overkill - halfCap);
    const raw = Math.floor(fast / 20) + Math.floor(slow / 40);
    return Math.floor(raw * state.combat.scoring.flags.overkillRate);
  }

  // Runs the whole fight against state.combat.wave. Mutates state.
  function resolveFight(state) {
    const resolution = Resolver.createResolution(state);
    const played = realPlayedCards(state);
    played.forEach((c, i) => (c.slotIndex = i));

    state.combat.scoring = { power: 0, mult: 1, finalMult: 1, flags: { ignoreTowerMods: false, overkillRate: 1, refreshHeroTriggers: false, bkbBlocksMods: state.player.items.includes("bkb") } };

    // 1-2. Pre-detect + detection.
    const { effective, combo, copyLog } = buildEffectiveSet(state, played, resolution);
    resolution.combo = combo;
    Resolver.pushStep(resolution, {
      icon: "🃏",
      label: `Комбо: ${combo.name} (база ${combo.basePower} × ${combo.baseMult})`,
      kind: "combo",
    });

    // 3. Base power + played card powers.
    state.combat.scoring.power = combo.basePower;
    let cardPowerSum = 0;
    for (const card of effective) cardPowerSum += card.power;
    state.combat.scoring.power += cardPowerSum;
    state.combat.scoring.mult = combo.baseMult;
    state.combat.scoring.effective = effective;
    state.combat.scoring.copyLog = copyLog;

    // 4. Hero triggers.
    runTriggers(state, resolution, { playedCards: effective, combo, scoring: state.combat.scoring, simulate: state.simulate }, ["hero"]);

    // 5. Item triggers.
    runTriggers(state, resolution, { playedCards: effective, combo, scoring: state.combat.scoring, simulate: state.simulate }, ["item"]);

    // 6. Refresher: hero triggers again.
    if (state.combat.scoring.flags.refreshHeroTriggers) {
      runTriggers(state, resolution, { playedCards: effective, combo, scoring: state.combat.scoring, simulate: state.simulate, onlyKinds: ["hero"], refreshed: true }, ["hero"]);
    }

    // 7. Tower modifiers.
    const towerMult = towerDamageMult(state, resolution) * enemyShieldMult(state);
    resolution.blocked = towerMult === 0;

    // 8. Damage.
    const s = state.combat.scoring;
    const damage = resolution.blocked ? 0 : Math.round(s.power * s.mult * s.finalMult * towerMult);
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
      if (aegis && !tower.aegisUsed) {
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

    // 10. Gold from overkill + exact last hit.
    let gold = overkillGold(state, overkill);
    if (gold > 0) {
      Resolver.pushStep(resolution, { icon: "💰", label: `Overkill +${gold} золота`, kind: "gold" });
    }
    if (!resolution.blocked && damage === hpBefore && hpBefore > 0) {
      gold += 5;
      Resolver.pushStep(resolution, { icon: "🎯", label: "Last Hit! +5 золота", kind: "gold" });
    }
    resolution.goldGained = gold;
    state.run.gold += gold;

    state.stats.totalDamage += damage;
    if (damage > state.stats.biggestHit) state.stats.biggestHit = damage;

    // Cycle: played cards go to discard (illusions vanish), draw back to hand size.
    DeckSys.moveToDiscard(state, state.combat.selectedUids);
    state.combat.selectedUids = [];
    DeckSys.draw(state, Rng.current());
    state.player.fightsLeft -= 1;
    state.combat.fightIndex += 1;
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

  return { resolveFight, realPlayedCards, buildEffectiveSet, HAND_SIZE, MAX_SLOTS };
})();
