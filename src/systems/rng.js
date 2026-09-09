// Dalatro — deterministic RNG.
// Same seed + same action sequence = same run. Never use Math.random() in game logic.
const Rng = (function () {
  // Fast, tiny PRNG. Good enough for a card game, fully reproducible.
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return h >>> 0;
  }

  function randomSeedCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 5; i++) {
      s += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return s;
  }

  function normalizeSeedCode(input) {
    const raw = String(input || "").trim().toUpperCase();
    const match = raw.match(/([A-Z0-9]{4,8})$/);
    return match ? match[1] : null;
  }

  // Module-level "active" rng for the current run. Kept out of game state so
  // state stays structuredClone-able (simulator) and pure-serializable.
  let active = null;
  let suppressDepth = 0;

  function setActive(instance) {
    active = instance;
  }

  function current() {
    return active;
  }

  function create(seedCode) {
    const code = seedCode || randomSeedCode();
    const raw = mulberry32(hashString("DALATRO-" + code));
    let draws = 0; // consumed draws; persisted so a restored run stays deterministic

    function next() {
      // While suppressed (preview simulation), streams return a constant
      // WITHOUT consuming real draws — so previews never desync the run.
      if (suppressDepth > 0) return 0.5;
      draws++;
      return raw();
    }

    return {
      seedCode: code,
      drawCount() {
        return draws;
      },
      fastForward(n) {
        draws = n;
        for (let i = 0; i < n; i++) raw();
      },
      // float in [0, 1)
      next() {
        return next();
      },
      // int in [min, max] inclusive
      int(min, max) {
        return min + Math.floor(next() * (max - min + 1));
      },
      chance(probability) {
        return next() < probability;
      },
      shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
          const j = Math.floor(next() * (i + 1));
          [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
      },
      pick(array) {
        return array[Math.floor(next() * array.length)];
      },
    };
  }

  function suppress(fn) {
    suppressDepth++;
    try {
      return fn();
    } finally {
      suppressDepth--;
    }
  }

  return { create, randomSeedCode, normalizeSeedCode, hashString, setActive, current, suppress };
})();
