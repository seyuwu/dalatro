// Dalatro — event bus.
// Actions produce events; triggers listen to events. The bus is synchronous and
// every emitted event is appended to the state log (used by UI + debug inspector).
const Events = (function () {
  function createBus(logSink) {
    const listeners = new Map(); // eventName -> Set<handler>
    return {
      on(eventName, handler) {
        if (!listeners.has(eventName)) listeners.set(eventName, new Set());
        listeners.get(eventName).add(handler);
        return () => listeners.get(eventName).delete(handler);
      },
      emit(state, eventName, payload = {}) {
        if (logSink) logSink(state, eventName, payload);
        const set = listeners.get(eventName);
        if (!set) return;
        // Snapshot: handlers may subscribe/unsubscribe during emit.
        for (const handler of Array.from(set)) {
          handler(state, payload);
        }
      },
    };
  }

  return { createBus };
})();
