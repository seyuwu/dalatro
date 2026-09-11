// dotora — simulator. Preview = the SAME dispatch on a cloned state.
// No separate preview logic, ever. RNG is suppressed so a preview never
// consumes draws or rolls from the real run.
const Sim = (function () {
  function simulate(state, action) {
    let clone;
    try {
      clone = structuredClone(state);
    } catch (e) {
      console.error("[simulate] clone failed", e);
      return null;
    }
    clone.simulate = true;
    return Rng.suppress(() => {
      try {
        return Game.dispatch(clone, action);
      } catch (e) {
        console.error("[simulate] dispatch failed", e);
        return null;
      }
    });
  }

  return { simulate };
})();
