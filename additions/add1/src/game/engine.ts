import {
  HEROES,
  ITEMS,
  COMBOS,
  DECKS,
  MODIFIERS,
  heroById,
  itemById,
  deckById,
  type DeckId,
  type Modifier,
} from './data';

export type Phase = 'menu' | 'battle' | 'shop' | 'map' | 'won' | 'lost';

export type Game = {
  version: 3;
  deckId: DeckId;
  hand: string[];
  deck: string[];
  discarded: string[];
  seed: number;
  wave: number;
  hp: number;
  hpScale: number;
  hands: number;
  discards: number;
  lives: number;
  gold: number;
  items: string[];
  phase: Phase;
  log: string[];
  levels: number[];
  plays: number[];
  totalDamage: number;
  best: number;
  offer: string[];
  recruits: string[];
  reward: boolean;
  revived: boolean;
  battles: number;
  modifier: string | null;
  elite: boolean;
  treasure: boolean;
  guaranteedRare: boolean;
  usedRemove: boolean;
};

export type EvalResult = {
  combo: number;
  power: number;
  mult: number;
  damage: number;
  effects: string[];
  modifier: number;
  goldGain: number;
};

// ---------- детерминированный ГСЧ (как в оригинале) ----------
function random(seed: number) {
  const next = (seed * 1664525 + 1013904223) >>> 0;
  return { seed: next, value: next / 4294967296 };
}
function shuffle(ids: string[], seed: number) {
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) {
    const r = random(seed);
    seed = r.seed;
    const j = Math.floor(r.value * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return { cards: a, seed };
}

// ---------- волны ----------
export function maxHp(wave: number) {
  return Math.round([300, 500, 750, 1200][wave % 4] * Math.pow(2.1, Math.floor(wave / 4)));
}
export function waveMaxHp(g: Game) {
  return Math.round(maxHp(g.wave) * g.hpScale);
}
export function waveName(wave: number) {
  return ['Башня первой линии', 'Башня второй линии', 'Башня у казарм', 'Рошан'][wave % 4];
}
export function isBossWave(wave: number) {
  return wave % 4 === 3;
}
export function maxSelection(g: Game) {
  return g.modifier === 'disarm' && !g.items.includes('black_king_bar') ? 4 : 5;
}
export function baseDiscards(g: Game) {
  return 3 + (g.deckId === 'emerald' ? 1 : 0) + (g.items.includes('boots') ? 1 : 0);
}
export function recruitPrice(id: string) {
  return heroById(id).rank + 2;
}

// ---------- старт / сохранение ----------
export function menuGame(): Game {
  const base = deckById('azure');
  return {
    version: 3,
    deckId: 'azure',
    hand: base.cards.slice(0, 8),
    deck: base.cards.slice(8),
    discarded: [],
    seed: 74329,
    wave: 0,
    hp: 300,
    hpScale: 1,
    hands: 4,
    discards: 3,
    lives: 6,
    gold: 12,
    items: ['bfury', 'hand_of_midas'],
    phase: 'menu',
    log: [],
    levels: Array(8).fill(1),
    plays: Array(8).fill(0),
    totalDamage: 0,
    best: 0,
    offer: [],
    recruits: [],
    reward: false,
    revived: false,
    battles: 0,
    modifier: null,
    elite: false,
    treasure: false,
    guaranteedRare: false,
    usedRemove: false,
  };
}

export function newGame(deckId: DeckId): Game {
  const d = deckById(deckId);
  const s = shuffle(d.cards, 74329);
  return {
    ...menuGame(),
    deckId,
    hand: s.cards.slice(0, 8),
    deck: s.cards.slice(8),
    seed: s.seed,
    gold: d.gold,
    items: [...d.items],
    discards: 3 + d.bonusDiscards,
    phase: 'battle',
    log: ['Ты на линии. Самое время собрать сильный тимфайт.'],
  };
}

export function loadGame(): Game {
  try {
    const g = JSON.parse(localStorage.getItem('dalatro-v3') || 'null');
    if (
      g?.version === 3 &&
      Array.isArray(g.hand) &&
      g.hand.every((id: string) => HEROES.some((h) => h.id === id)) &&
      ['battle', 'shop', 'map', 'won', 'lost'].includes(g.phase)
    ) {
      return { ...menuGame(), ...g };
    }
  } catch {
    /* битый сейв */
  }
  return menuGame();
}
export function saveGame(g: Game) {
  try {
    localStorage.setItem('dalatro-v3', JSON.stringify(g));
  } catch {
    /* приватный режим */
  }
}

// ---------- кодекс (межзабеговая коллекция) ----------
export type Codex = { heroes: string[]; items: string[]; runs: number; wins: number };
export function loadCodex(): Codex {
  try {
    const c = JSON.parse(localStorage.getItem('dalatro-codex-v1') || 'null');
    if (c) return { heroes: c.heroes || [], items: c.items || [], runs: c.runs || 0, wins: c.wins || 0 };
  } catch {
    /* нет кодекса */
  }
  return { heroes: [], items: [], runs: 0, wins: 0 };
}
export function saveCodex(c: Codex) {
  try {
    localStorage.setItem('dalatro-codex-v1', JSON.stringify(c));
  } catch {
    /* приватный режим */
  }
}

// ---------- раздача ----------
function deal<T extends Game>(g: T): T {
  const all = [...g.hand, ...g.deck, ...g.discarded];
  const s = shuffle(all, g.seed);
  return {
    ...g,
    hand: s.cards.slice(0, 8),
    deck: s.cards.slice(8),
    discarded: [],
    seed: s.seed,
  };
}

function refill(g: Game, selectedIdx: number[]): Game {
  let hand = g.hand.filter((_, i) => !selectedIdx.includes(i));
  let deck = [...g.deck];
  let discarded = [...g.discarded, ...g.hand.filter((_, i) => selectedIdx.includes(i))];
  let seed = g.seed;
  while (hand.length < 8) {
    if (deck.length === 0) {
      if (discarded.length === 0) break;
      const s = shuffle(discarded, seed);
      deck = s.cards;
      discarded = [];
      seed = s.seed;
    }
    hand.push(deck.shift()!);
  }
  return { ...g, hand, deck, discarded, seed };
}

// ---------- лавка ----------
function rollOffers(g: Game): Pick<Game, 'offer' | 'recruits' | 'seed'> {
  let seed = g.seed;
  // предметы
  let itemPool = ITEMS.filter((i) => !g.items.includes(i.id)).map((i) => i.id);
  const s1 = shuffle(itemPool, seed);
  seed = s1.seed;
  let offer = s1.cards.slice(0, 4);
  if (g.guaranteedRare && !offer.some((id) => itemById(id).rarity !== 'Обычный')) {
    const rarePool = itemPool.filter((id) => itemById(id).rarity !== 'Обычный');
    if (rarePool.length) {
      const r = random(seed);
      seed = r.seed;
      offer[0] = rarePool[Math.floor(r.value * rarePool.length)];
    }
  }
  // рекруты: в первую очередь ещё не нанятые герои
  const owned = new Set([...g.hand, ...g.deck, ...g.discarded]);
  const fresh = HEROES.filter((h) => !owned.has(h.id)).map((h) => h.id);
  const s2 = shuffle(fresh.length >= 3 ? fresh : HEROES.map((h) => h.id), seed);
  seed = s2.seed;
  const recruits = s2.cards.slice(0, 3);
  return { offer, recruits, seed };
}

// ---------- расчёт тимфайта ----------
export function evaluate(ids: string[], g: Game): EvalResult {
  const empty: EvalResult = { combo: 0, power: 0, mult: 0, damage: 0, effects: [], modifier: 1, goldGain: 0 };
  if (!ids.length) return empty;
  const cards = ids.map(heroById);

  // атрибуты с учётом Morphling
  const attrs = cards.map((h) => h.attr);
  cards.forEach((h, i) => {
    if (h.id === 'morphling' && i > 0) attrs[i] = attrs[i - 1];
  });

  // --- детектор комбинации: Manta и Shadow Blade меняют ТОЛЬКО определение комбо, но не силу ---
  const detectRanks = cards.map((h) => h.rank);
  const detectAttrs = [...attrs];
  if (g.items.includes('manta') && cards.length > 0 && cards.length < 5) {
    detectRanks.push(cards[0].rank);
    detectAttrs.push(attrs[0]);
  }
  if (g.items.includes('shadow_blade') && cards.length >= 2) {
    let lo = 0;
    let hi = 0;
    cards.forEach((c, i) => {
      if (c.rank < cards[lo].rank) lo = i;
      if (c.rank > cards[hi].rank) hi = i;
    });
    if (lo !== hi) detectRanks[lo] = cards[hi].rank;
  }

  const countMap: Record<number, number> = {};
  detectRanks.forEach((r) => (countMap[r] = (countMap[r] || 0) + 1));
  const counts = Object.values(countMap).sort((a, b) => b - a);
  const ranks = [...new Set(detectRanks)].sort((a, b) => a - b);

  let combo = 0;
  if (counts[0] >= 2) combo = 1;
  if (counts[0] === 2 && counts[1] === 2) combo = 2;
  if (counts[0] >= 3) combo = 3;
  if (ranks.length === 5 && ranks[4] - ranks[0] === 4) combo = 4;
  if (detectAttrs.length === 5 && detectAttrs.every((a) => a === detectAttrs[0])) combo = 5;
  if (counts[0] === 3 && counts[1] === 2) combo = 6;
  if (counts[0] >= 4) combo = 7;

  let rankSum = cards.reduce((s, c) => s + c.rank, 0);
  const fog = g.modifier === 'fog' && !g.items.includes('black_king_bar');
  if (fog) rankSum = cards.filter((c) => c.rank > 4).reduce((s, c) => s + c.rank, 0);

  let power = COMBOS[combo].base + (g.levels[combo] - 1) * 10 + rankSum;
  let mult = COMBOS[combo].mult + (g.levels[combo] - 1);
  const effects: string[] = [
    `${COMBOS[combo].poker}: ${COMBOS[combo].base + (g.levels[combo] - 1) * 10} базы + ${rankSum} от героев`,
  ];
  if (fog) effects.push('Туман войны: герои ранга ≤4 не дают силы');

  const silenced = g.modifier === 'silence' && !g.items.includes('black_king_bar');
  const times = silenced ? 1 : 1 + (g.items.includes('refresher') ? 1 : 0) + (g.items.includes('aghamim') ? 1 : 0);
  if (silenced) effects.push('Безмолвие: способности героев отключены');
  if (times > 1) effects.push(`Способности сработают ×${times}`);

  const realCountMap: Record<number, number> = {};
  cards.forEach((c) => (realCountMap[c.rank] = (realCountMap[c.rank] || 0) + 1));
  const pairGroups = Object.values(realCountMap).filter((n) => n >= 2).length;
  const strCount = attrs.filter((a) => a === 'str').length;
  const agiCount = attrs.filter((a) => a === 'agi').length;
  const usedDiscards = baseDiscards(g) - g.discards;
  let shamanTriggers = 0;

  for (let t = 0; t < times; t++) {
    cards.forEach((h, i) => {
      const last = cards.length - 1;
      switch (h.id) {
        case 'axe':
          if (combo >= 3) {
            power += 10;
            effects.push('Counter Helix: +10 силы');
          }
          break;
        case 'juggernaut':
          if (i === 0) {
            power += 8;
            effects.push('Blade Fury: +8 силы (первая позиция)');
          }
          break;
        case 'riki':
          if (i === 0) {
            power += 10;
            effects.push('Tricks of the Trade: +10 силы (первая позиция)');
          }
          break;
        case 'zuus':
          mult += 2;
          effects.push('Static Field: +2 множителя');
          break;
        case 'pudge': {
          const bonus = strCount * 3 - 3;
          if (bonus > 0) {
            power += bonus;
            effects.push(`Flesh Heap: +${bonus} силы`);
          }
          break;
        }
        case 'sven':
          if (cards.length === 5) {
            power += 12;
            effects.push('God’s Strength: +12 силы');
          }
          break;
        case 'tusk':
          if (i === last) {
            power += 5;
            effects.push('Walrus Punch: +5 силы (последняя позиция)');
          }
          break;
        case 'sniper':
          if (i === last) {
            power += 12;
            effects.push('Assassinate: +12 силы (последняя позиция)');
          }
          break;
        case 'dawnbreaker':
          if (new Set(attrs).size >= 3) {
            mult += 1;
            effects.push('Solar Guardian: +1 множителя');
          }
          break;
        case 'witch_doctor':
          if (pairGroups > 0) {
            power += 4 * pairGroups;
            effects.push(`Maledict: +${4 * pairGroups} силы за группы рангов`);
          }
          break;
        case 'tiny':
          if (cards.every((o) => o.rank >= h.rank) && cards.some((o) => o.rank > h.rank)) {
            power += 14;
            effects.push('Grow: +14 силы (самый младший ранг)');
          }
          break;
        case 'drow_ranger':
          if (attrs.every((a) => a === 'agi')) {
            mult += 3;
            effects.push('Precision Aura: +3 множителя (флеш Ловкости)');
          }
          break;
        case 'marci': {
          const neighbor = [attrs[i - 1], attrs[i + 1]].filter(Boolean);
          if (neighbor.some((a) => a !== h.attr)) {
            power += 8;
            effects.push('Sidekick: +8 силы (контраст соседа)');
          }
          break;
        }
        case 'lion':
          mult += 1;
          effects.push('Finger of Death: +1 множителя');
          if (g.wave % 4 === 3) {
            power += 15;
            effects.push('Finger of Death: +15 силы по Рошану');
          }
          break;
        case 'kunkka':
          if (i === 0 || i === last) {
            power += 10;
            effects.push('Ghostship: +10 силы (крайняя позиция)');
          }
          break;
        case 'slark':
          if (usedDiscards > 0) {
            power += 4 * usedDiscards;
            effects.push(`Essence Shift: +${4 * usedDiscards} силы за сбросы`);
          }
          break;
        case 'lina':
          if (cards.length <= 2) {
            power += 20;
            effects.push('Laguna Blade: +20 силы (1–2 героя)');
          }
          break;
        case 'muerta':
          if (i === 2) {
            power += 12;
            effects.push('Dead Shot: +12 силы (третья позиция)');
          }
          break;
        case 'ringmaster':
          if (new Set(attrs).size === 4) {
            mult += 3;
            effects.push('The Crowd Goes Wild: +3 множителя (все атрибуты)');
          }
          break;
        case 'wraith_king':
          if (strCount > 0) {
            mult += strCount;
            effects.push(`Wraithfire Blast: +${strCount} множителя`);
          }
          break;
        case 'tidehunter':
          if (cards.length === 5) {
            mult += 2;
            effects.push('Kraken Shell: +2 множителя (5 героев)');
          }
          break;
        case 'invoker':
          if (new Set(attrs).size >= 3) {
            mult += 3;
            effects.push('Invoke: +3 множителя (3 атрибута)');
          }
          break;
        case 'medusa':
          if (combo >= 3) {
            mult += 2;
            effects.push('Stone Gaze: +2 множителя');
          }
          break;
        case 'shadow_shaman':
          shamanTriggers++;
          effects.push('Hex: +2 золота');
          break;
        case 'morphling':
          if (i > 0) effects.push('Morph: атрибут скопирован у соседа слева');
          break;
      }
    });
  }

  // --- предметы ---
  for (const id of g.items) {
    switch (id) {
      case 'bfury': {
        const bonus = Math.min(...cards.map((h) => h.rank));
        power += bonus;
        effects.push(`Battle Fury: +${bonus} силы`);
        break;
      }
      case 'heart':
        power += 25;
        effects.push('Heart of Tarrasque: +25 силы');
        break;
      case 'meteor_hammer':
        if (cards.length >= 3) {
          power += 12;
          effects.push('Meteor Hammer: +12 силы');
        }
        break;
      case 'ancient_janggo':
        if (cards.length >= 4) {
          mult += 2;
          effects.push('Drum of Endurance: +2 множителя');
        }
        break;
      case 'radiance':
        power += cards.length * 5;
        effects.push(`Radiance: +${cards.length * 5} силы`);
        break;
      case 'octarine_core':
        mult += g.items.length;
        effects.push(`Octarine Core: +${g.items.length} множителя`);
        break;
      case 'assault':
        power += 12;
        effects.push('Assault Cuirass: +12 силы, броня снята');
        break;
      case 'shiva':
        mult += 2;
        effects.push("Shiva's Guard: +2 множителя, реген заблокирован");
        break;
      case 'butterfly':
        if (agiCount > 0) {
          mult += agiCount;
          effects.push(`Butterfly: +${agiCount} множителя за Ловкость`);
        }
        break;
      case 'daedalus':
        if (combo >= 1) {
          mult += 3;
          effects.push('Daedalus: +3 множителя');
        }
        break;
      case 'bloodstone': {
        const b = Math.floor(g.gold / 5);
        if (b > 0) {
          mult += b;
          effects.push(`Bloodstone: +${b} множителя от золота`);
        }
        break;
      }
      case 'manta':
        if (cards.length < 5) effects.push('Manta Style: иллюзия первого героя добавлена в детектор комбо');
        break;
      case 'shadow_blade':
        if (cards.length >= 2) effects.push('Shadow Blade: ранг слабейшего героя скрыт для детектора');
        break;
    }
  }

  if (cards.some((h) => h.id === 'phantom_assassin') && combo >= 1) {
    mult *= Math.pow(1.5, times);
    effects.push(`Coup de Grace: ×${Math.pow(1.5, times).toFixed(2)} множителя`);
  }
  if (g.items.includes('satanic') && combo >= 1) {
    mult *= 1.5;
    effects.push('Satanic: ×1.5 множителя');
  }

  // --- модификаторы башни ---
  let modMul = 1;
  const immune = g.items.includes('black_king_bar');
  if (g.wave % 4 === 1 && g.battles === 0 && !immune && !g.items.includes('assault')) {
    modMul *= 0.5;
    effects.push('Броня башни: итоговый урон ×0.5');
  }
  if (g.wave % 4 === 2 && g.battles === 2 && !immune) {
    modMul = 0;
    effects.push('Глиф: третья атака не наносит урона!');
  }
  if (g.modifier && !immune) {
    if (g.modifier === 'thorns' && cards.length === 5) {
      modMul *= 0.6;
      effects.push('Шипы: тимфайт из 5 героев ×0.6');
    }
    if (g.modifier === 'backdoor' && g.battles < 2) {
      modMul *= 0.5;
      effects.push('Backdoor Protection: атака ×0.5');
    }
  }
  if (g.items.includes('rapier')) {
    modMul *= 2;
    effects.push('Divine Rapier: итоговый урон ×2');
  }

  return {
    combo,
    power,
    mult: Math.round(mult * 100) / 100,
    damage: Math.floor(power * mult * modMul),
    effects,
    modifier: modMul,
    goldGain: shamanTriggers * 2,
  };
}

// ---------- атака ----------
export function attack(g: Game, selectedIdx: number[]): Game {
  if (g.phase !== 'battle' || !selectedIdx.length || selectedIdx.length > maxSelection(g)) return g;
  const ids = selectedIdx.map((i) => g.hand[i]);
  const r = evaluate(ids, g);
  const hpBefore = g.hp;
  const immune = g.items.includes('black_king_bar');

  let n: Game = {
    ...g,
    hp: Math.max(0, g.hp - r.damage),
    hands: g.hands - 1,
    battles: g.battles + 1,
    totalDamage: g.totalDamage + r.damage,
    best: Math.max(g.best, r.damage),
    gold: g.gold + r.goldGain,
  };
  const messages = [`${COMBOS[r.combo].name} → ${r.damage} урона`];
  if (r.goldGain) messages.push(`Hex Shadow Shaman: +${r.goldGain} золота`);

  if (g.modifier === 'mana_fire' && !immune) {
    n.gold = Math.max(0, n.gold - 1);
    messages.push('Сжигание маны: −1 золота');
  }

  n = refill(n, selectedIdx);
  n.plays = [...g.plays];
  n.plays[r.combo]++;
  n.levels = [...g.levels];
  if (n.plays[r.combo] % 3 === 0) {
    n.levels[r.combo]++;
    messages.unshift(`${COMBOS[r.combo].name}: уровень ${n.levels[r.combo]}!`);
  }

  const boss = isBossWave(g.wave);

  // возрождение Рошана (BKB его не отменяет)
  if (n.hp <= 0 && boss && !n.revived) {
    n.hp = Math.ceil(waveMaxHp(n) * 0.5);
    n.revived = true;
    messages.unshift('Рошан возродился с половиной здоровья!');
    if (n.hands <= 0) return barracksFall(n, messages);
    return { ...n, log: [...messages, ...g.log].slice(0, 40) };
  }

  if (n.hp <= 0) {
    // ПОБЕДА
    const overkill = Math.max(0, r.damage - hpBefore);
    const overkillGold = Math.floor(overkill / 40) * (g.items.includes('hand_of_midas') ? 2 : 1);
    const exactKill = r.damage === hpBefore ? 3 : 0;
    const savedHands = n.hands;
    const interest = Math.min(5, Math.floor(n.gold / 5));
    const gain = 6 + overkillGold + exactKill + savedHands + (g.elite ? 6 : 0) + (g.treasure ? 12 : 0);
    n.gold += gain + interest;
    messages.push(`Башня пала! +${gain} золота`);
    if (overkillGold) messages.push(`Оверкилл: +${overkillGold} золота${g.items.includes('hand_of_midas') ? ' (Midas ×2)' : ''}`);
    if (exactKill) messages.push('Точный ласт-хит: +3 золота');
    if (savedHands) messages.push(`Сохранённые тимфайты: +${savedHands} золота`);
    if (interest) messages.push(`Проценты по золоту: +${interest}`);

    if (g.wave >= 11) {
      n.phase = 'won';
      n.log = [...messages, ...g.log].slice(0, 40);
      return n;
    }
    n.phase = 'shop';
    n.reward = false;
    n.usedRemove = false;
    const rolls = rollOffers(n);
    n = { ...n, ...rolls };
    n.log = [...messages, ...g.log].slice(0, 40);
    return n;
  }

  // регенерация элитной башни
  if (g.modifier === 'regen' && !immune && !g.items.includes('shiva')) {
    const heal = Math.ceil(waveMaxHp(n) * 0.12);
    n.hp = Math.min(waveMaxHp(n), n.hp + heal);
    messages.push(`Регенерация: башня восстановила ${heal} HP`);
  }

  if (n.hands <= 0) return barracksFall(n, messages);
  return { ...n, log: [...messages, ...g.log].slice(0, 40) };
}

function barracksFall(g: Game, messages: string[]): Game {
  let n = { ...g, lives: g.lives - 1 };
  // Divine Rapier теряется при провале
  if (n.items.includes('rapier')) {
    n.items = n.items.filter((i) => i !== 'rapier');
    messages.push('Divine Rapier утеряна при провале!');
  }
  if (n.lives <= 0) {
    n.phase = 'lost';
    messages.unshift('Крепость разрушена.');
    return { ...n, log: [...messages, ...g.log].slice(0, 40) };
  }
  messages.unshift(`Казарма разрушена! Осталось казарм: ${n.lives}. Перегруппировка.`);
  n = deal({ ...n, hands: 4, discards: baseDiscards(n) });
  return { ...n, log: [...messages, ...g.log].slice(0, 40) };
}

// ---------- ТП-сброс ----------
export function discard(g: Game, selectedIdx: number[]): Game {
  if (g.phase !== 'battle' || g.discards <= 0 || !selectedIdx.length || selectedIdx.length > 5) return g;
  const ids = selectedIdx.map((i) => g.hand[i]);
  const cmGold = ids.filter((id) => id === 'crystal_maiden').length * 2;
  const caravanGold = g.deckId === 'emerald' ? 1 : 0;
  let n: Game = { ...g, discards: g.discards - 1, gold: g.gold + cmGold + caravanGold };
  n = refill(n, selectedIdx);
  const msg = [`ТП-сброс: убрано карт — ${ids.length}${cmGold ? `, Frostbite: +${cmGold} золота` : ''}${caravanGold ? ', караван: +1 золота' : ''}`];
  return { ...n, log: [...msg, ...g.log].slice(0, 40) };
}

// ---------- магазин ----------
export function buyItem(g: Game, id: string): Game {
  const item = ITEMS.find((i) => i.id === id);
  if (!item || g.phase !== 'shop' || g.gold < item.price || g.items.length >= 5 || !g.offer.includes(id)) return g;
  return {
    ...g,
    gold: g.gold - item.price,
    items: [...g.items, id],
    offer: g.offer.filter((i) => i !== id),
    log: [`${item.name} добавлен в билд`, ...g.log].slice(0, 40),
  };
}
export function sellItem(g: Game, id: string): Game {
  const item = ITEMS.find((i) => i.id === id);
  if (!item || g.phase !== 'shop' || !g.items.includes(id)) return g;
  return {
    ...g,
    gold: g.gold + Math.floor(item.price / 2),
    items: g.items.filter((i) => i !== id),
    log: [`${item.name} продан за ${Math.floor(item.price / 2)} золота`, ...g.log].slice(0, 40),
  };
}
export function reroll(g: Game): Game {
  if (g.gold < 2 || g.phase !== 'shop') return g;
  const n = { ...g, gold: g.gold - 2, guaranteedRare: false };
  const rolls = rollOffers(n);
  return { ...n, ...rolls, log: ['Ассортимент лавки обновлён', ...g.log].slice(0, 40) };
}
export function recruit(g: Game, id: string): Game {
  if (g.phase !== 'shop' || !g.recruits.includes(id)) return g;
  const price = recruitPrice(id);
  if (g.gold < price) return g;
  return {
    ...g,
    gold: g.gold - price,
    deck: [...g.deck, id],
    recruits: g.recruits.filter((r) => r !== id),
    log: [`${heroById(id).name} завербован в колоду за ${price} золота`, ...g.log].slice(0, 40),
  };
}
export function removeHero(g: Game, id: string): Game {
  if (g.phase !== 'shop' || g.usedRemove || g.gold < 4) return g;
  const total = g.hand.length + g.deck.length + g.discarded.length;
  if (total <= 8) return g;
  const pick = (arr: string[]) => {
    const i = arr.indexOf(id);
    if (i === -1) return null;
    return [...arr.slice(0, i), ...arr.slice(i + 1)];
  };
  let hand = g.hand;
  let deck = g.deck;
  let discarded = g.discarded;
  let next = pick(hand);
  if (next) hand = next;
  else {
    next = pick(deck);
    if (next) deck = next;
    else {
      next = pick(discarded);
      if (!next) return g;
      discarded = next;
    }
  }
  return {
    ...g,
    hand,
    deck,
    discarded,
    gold: g.gold - 4,
    usedRemove: true,
    log: [`${heroById(id).name} отчислен из колоды (−4 золота)`, ...g.log].slice(0, 40),
  };
}
export function claimReward(g: Game, combo: number): Game {
  if (g.reward || g.phase !== 'shop') return g;
  const levels = [...g.levels];
  levels[combo]++;
  return { ...g, levels, reward: true, log: [`Боевой опыт: ${COMBOS[combo].name} → ур. ${levels[combo]}`, ...g.log].slice(0, 40) };
}

// ---------- карта маршрутов ----------
export type PathChoice = {
  type: 'normal' | 'elite' | 'treasure' | 'boss';
  hpScale: number;
  modifier: string | null;
};
export function pathsForNextWave(g: Game): PathChoice[] {
  const nextWave = g.wave + 1;
  if (isBossWave(nextWave)) {
    const bossMod = nextWave === 7 ? 'regen' : nextWave === 11 ? 'silence' : null;
    return [{ type: 'boss', hpScale: 1, modifier: bossMod }];
  }
  const eliteMod: Modifier = MODIFIERS[g.seed % MODIFIERS.length];
  return [
    { type: 'normal', hpScale: 1, modifier: null },
    { type: 'elite', hpScale: 1.6, modifier: eliteMod.id },
    { type: 'treasure', hpScale: 0.85, modifier: null },
  ];
}
export function takePath(g: Game, choice: PathChoice): Game {
  const wave = g.wave + 1;
  let n: Game = {
    ...g,
    wave,
    hp: Math.round(maxHp(wave) * choice.hpScale),
    hpScale: choice.hpScale,
    hands: 4,
    discards: baseDiscards(g),
    battles: 0,
    revived: false,
    phase: 'battle',
    modifier: choice.modifier,
    elite: choice.type === 'elite',
    treasure: choice.type === 'treasure',
    guaranteedRare: choice.type === 'elite',
    offer: [],
    recruits: [],
  };
  n = deal(n);
  const title =
    choice.type === 'boss'
      ? 'БОСС'
      : choice.type === 'elite'
        ? 'ЭЛИТНАЯ БАШНЯ'
        : choice.type === 'treasure'
          ? 'СХРОН'
          : '';
  return {
    ...n,
    log: [`Новая цель: ${waveName(wave)}${title ? ` · ${title}` : ''}`, ...g.log].slice(0, 40),
  };
}

export function waveModTexts(g: Game, wave = g.wave, modifier: string | null = g.modifier): string[] {
  const out: string[] = [];
  if (wave % 4 === 1) out.push('Броня: первая атака наносит половину урона');
  if (wave % 4 === 2) out.push('Глиф: третья атака полностью блокируется');
  if (wave % 4 === 3) out.push('Рошан возродится с половиной здоровья');
  if (modifier) {
    const m = MODIFIERS.find((x) => x.id === modifier);
    if (m) out.push(`${m.name}: ${m.desc}`);
  }
  if (g.elite) out.push('Элита: +6 золота за победу и редкий товар в лавке');
  if (g.treasure) out.push('Схрон: +12 золота за победу');
  return out.length ? out : ['Без модификаторов'];
}

export { DECKS };
