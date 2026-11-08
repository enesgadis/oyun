let ctx = null;

function ensure() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq, duration, type = 'square', gain = 0.03, when = 0) {
  const audio = ensure();
  if (!audio) return;
  const osc = audio.createOscillator();
  const vol = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  vol.gain.setValueAtTime(gain, audio.currentTime + when);
  vol.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + when + duration);
  osc.connect(vol);
  vol.connect(audio.destination);
  osc.start(audio.currentTime + when);
  osc.stop(audio.currentTime + when + duration + 0.02);
}

export function playSound(name = 'tap', settings = {}) {
  if (settings.sound === false) return;
  if (name === 'tap') tone(440, 0.05, 'square', 0.018);
  else if (name === 'open') {
    tone(330, 0.05, 'square', 0.02);
    tone(494, 0.06, 'square', 0.02, 0.05);
  } else if (name === 'good') {
    tone(523, 0.07, 'square', 0.025);
    tone(659, 0.07, 'square', 0.025, 0.08);
    tone(784, 0.12, 'square', 0.025, 0.16);
  } else if (name === 'bad') {
    tone(220, 0.1, 'sawtooth', 0.02);
    tone(164, 0.16, 'sawtooth', 0.02, 0.1);
  } else if (name === 'levelup') {
    [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.1, 'square', 0.026, i * 0.09));
  } else if (name === 'alert') {
    [880, 660].forEach((f, i) => tone(f, 0.08, 'square', 0.02, i * 0.12));
  }
}

export function haptic(pattern = 8, settings = {}) {
  if (settings.haptics === false) return;
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern);
}
