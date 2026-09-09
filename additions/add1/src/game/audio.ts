// Мини-синтезатор звуков на WebAudio — без внешних файлов.
let ctx: AudioContext | null = null;
let muted = localStorage.getItem('dalatro-muted') === '1';

function ac(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.08) {
  const a = ac();
  if (!a) return;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, a.currentTime + start);
  g.gain.setValueAtTime(0, a.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, a.currentTime + start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
  osc.connect(g).connect(a.destination);
  osc.start(a.currentTime + start);
  osc.stop(a.currentTime + start + dur + 0.02);
}

export type Sfx = 'click' | 'select' | 'discard' | 'attack' | 'buy' | 'level' | 'gold' | 'win' | 'lose' | 'path';

export function play(sfx: Sfx) {
  if (muted) return;
  switch (sfx) {
    case 'click':
      tone(320, 0, 0.07, 'triangle', 0.05);
      break;
    case 'select':
      tone(520, 0, 0.08, 'triangle', 0.06);
      tone(720, 0.04, 0.08, 'triangle', 0.04);
      break;
    case 'discard':
      tone(260, 0, 0.1, 'sine', 0.06);
      tone(190, 0.06, 0.12, 'sine', 0.05);
      break;
    case 'attack':
      tone(180, 0, 0.18, 'sawtooth', 0.07);
      tone(90, 0, 0.25, 'sawtooth', 0.06);
      tone(440, 0.05, 0.12, 'triangle', 0.05);
      break;
    case 'buy':
      tone(660, 0, 0.08, 'triangle', 0.06);
      tone(880, 0.07, 0.1, 'triangle', 0.06);
      break;
    case 'gold':
      tone(990, 0, 0.06, 'square', 0.035);
      tone(1320, 0.06, 0.09, 'square', 0.03);
      break;
    case 'level':
      tone(523, 0, 0.12, 'triangle', 0.06);
      tone(659, 0.1, 0.12, 'triangle', 0.06);
      tone(784, 0.2, 0.18, 'triangle', 0.07);
      break;
    case 'path':
      tone(392, 0, 0.12, 'triangle', 0.06);
      tone(523, 0.1, 0.18, 'triangle', 0.06);
      break;
    case 'win':
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3, 'triangle', 0.07));
      break;
    case 'lose':
      [392, 330, 262, 196].forEach((f, i) => tone(f, i * 0.14, 0.3, 'sawtooth', 0.05));
      break;
  }
}

export function isMuted() {
  return muted;
}
export function toggleMuted() {
  muted = !muted;
  localStorage.setItem('dalatro-muted', muted ? '1' : '0');
  if (!muted) play('click');
  return muted;
}
