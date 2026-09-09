// Dalatro — resolution stack.
// One object that serves four consumers: calculation, UI preview, fight
// animation and debugging. Everything the engine does during a fight is
// recorded here as ordered steps.
const Resolver = (function () {
  function createResolution(state) {
    return {
      steps: [],
      combo: null,
      power: 0,
      mult: 1,
      finalMult: 1,
      damage: 0,
      goldGained: 0,
      killed: false,
      blocked: false,
      // tower snapshot after the fight (for preview)
      towerHpAfter: null,
      towerMaxHp: state.combat.wave.maxHp,
    };
  }

  function pushStep(resolution, step) {
    resolution.steps.push(step);
  }

  return { createResolution, pushStep };
})();
