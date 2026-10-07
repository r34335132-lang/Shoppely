let ctx: AudioContext | null = null;

const tones = {
  scan: [[1320, 0.07]],
  error: [[220, 0.12], [180, 0.16]],
  success: [[880, 0.09], [1175, 0.09], [1568, 0.16]],
  alert: [[988, 0.1], [1319, 0.14]],
} as const;

/** Sonidos cortos de confirmación (escaneo, venta, error). Silencioso si el navegador lo bloquea. */
export function beep(kind: keyof typeof tones = 'scan') {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    let t = ctx.currentTime;
    for (const [freq, dur] of tones[kind]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = kind === 'error' ? 'square' : 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
      t += dur * 0.9;
    }
  } catch {
    // sin audio disponible
  }
}
