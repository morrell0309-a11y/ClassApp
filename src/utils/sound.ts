// Pure Web Audio API sound effects for classroom use (no external audio assets required)

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    void sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
}

export function playTickSound(progress: number, muted: boolean, volume = 0.7): void {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // Rising pitch marimba-like click as selection slows down
  const baseFreq = 420 + Math.min(1, Math.max(0, progress)) * 300;
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.75, now + 0.045);

  const peakGain = 0.16 * volume;
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(peakGain, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.055);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.06);
}

export function playRevealFanfare(muted: boolean, volume = 0.7): void {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  // Bright major-9th celebratory chime arpeggio (C5 - E5 - G5 - B5 - C6)
  const notes = [523.25, 659.25, 783.99, 987.77, 1046.5];

  notes.forEach((freq, idx) => {
    const start = now + idx * 0.065;
    const duration = idx === notes.length - 1 ? 0.75 : 0.38;

    const osc = ctx.createOscillator();
    const harmonic = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);

    harmonic.type = 'triangle';
    harmonic.frequency.setValueAtTime(freq * 2, start);

    const harmonicGain = ctx.createGain();
    harmonicGain.gain.setValueAtTime(0.18, start);

    const peak = (idx === notes.length - 1 ? 0.22 : 0.15) * volume;
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0008, start + duration);

    osc.connect(gain);
    harmonic.connect(harmonicGain);
    harmonicGain.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    harmonic.start(start);
    osc.stop(start + duration + 0.02);
    harmonic.stop(start + duration + 0.02);
  });
}

export function playShuffleSound(muted: boolean, volume = 0.7): void {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [392.0, 440.0, 523.25, 659.25];

  notes.forEach((freq, idx) => {
    const start = now + idx * 0.045;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(0.12 * volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(start + 0.15);
  });
}

export function playSwapSound(muted: boolean, volume = 0.7): void {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  [523.25, 659.25].forEach((freq, idx) => {
    const start = now + idx * 0.05;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(0.1 * volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.11);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(start + 0.12);
  });
}
