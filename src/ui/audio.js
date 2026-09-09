// Dalatro — мини-синтезатор звуков на WebAudio (порт из add1). Никаких файлов.
// Все вызовы безопасны: нет AudioContext / muted / приватный режим — тишина.
const Sfx = (function () {
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem("dalatro-muted") === "1"; } catch (e) { /* ignore */ }

  function ac() {
    if (muted) return null;
    if (!ctx) {
      try {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return null;
        ctx = new Ctor();
      } catch (e) { return null; }
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  }

  function tone(freq, start, dur, type, gain) {
    const a = ac();
    if (!a) return;
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, a.currentTime + start);
    g.gain.setValueAtTime(0, a.currentTime + start);
    g.gain.linearRampToValueAtTime(gain || 0.06, a.currentTime + start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
    osc.connect(g).connect(a.destination);
    osc.start(a.currentTime + start);
    osc.stop(a.currentTime + start + dur + 0.02);
  }

  // attack: широкая «ударная» связка вместо старого одиночного тона
  function attack() {
    tone(180, 0, 0.18, "sawtooth", 0.06);
    tone(90, 0, 0.25, "sawtooth", 0.05);
    tone(440, 0.05, 0.12, "triangle", 0.05);
  }

  const LIB = {
    click: () => tone(320, 0, 0.07, "triangle", 0.04),
    select: () => { tone(520, 0, 0.08, "triangle", 0.05); tone(720, 0.04, 0.08, "triangle", 0.035); },
    discard: () => { tone(260, 0, 0.1, "sine", 0.05); tone(190, 0.06, 0.12, "sine", 0.04); },
    attack,
    buy: () => { tone(660, 0, 0.08, "triangle", 0.05); tone(880, 0.07, 0.1, "triangle", 0.05); },
    gold: () => { tone(990, 0, 0.06, "square", 0.03); tone(1320, 0.06, 0.09, "square", 0.025); },
    level: () => { tone(523, 0, 0.12, "triangle", 0.05); tone(659, 0.1, 0.12, "triangle", 0.05); tone(784, 0.2, 0.18, "triangle", 0.06); },
    path: () => { tone(392, 0, 0.12, "triangle", 0.05); tone(523, 0.1, 0.18, "triangle", 0.05); },
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3, "triangle", 0.06)),
    lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, i * 0.14, 0.3, "sawtooth", 0.045)),
  };

  function play(name) {
    if (muted) return;
    try { (LIB[name] || LIB.click)(); } catch (e) { /* тишина лучше краша */ }
  }

  function isMuted() { return muted; }
  function toggleMuted() {
    muted = !muted;
    try { localStorage.setItem("dalatro-muted", muted ? "1" : "0"); } catch (e) { /* ignore */ }
    if (!muted) play("click");
    return muted;
  }

  return { play, isMuted, toggleMuted };
})();
