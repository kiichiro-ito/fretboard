let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** 単音を鳴らす */
export function playNote(midi: number, when = 0, duration = 1.2, gain = 0.16): void {
  const ac = getCtx();
  if (!ac) return;
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = 'triangle';
  osc.frequency.value = midiToFreq(midi);
  amp.gain.setValueAtTime(0, t0);
  amp.gain.linearRampToValueAtTime(gain, t0 + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(amp).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

/** コードを軽くアルペジオ気味に鳴らす (Lv4 用) */
export function playChord(midiNotes: number[], strum = 0.045): void {
  midiNotes.forEach((n, i) => playNote(n, i * strum, 1.6, 0.13));
}

/** 正誤フィードバックの短い効果音 */
export function playFeedback(correct: boolean): void {
  const ac = getCtx();
  if (!ac) return;
  if (correct) {
    playNote(84, 0, 0.18, 0.1);
    playNote(91, 0.07, 0.22, 0.08);
  } else {
    playNote(56, 0, 0.22, 0.09);
  }
}

/** ユーザー操作のタイミングで一度呼んでおくと iOS でも鳴るようになる */
export function unlockAudio(): void {
  getCtx();
}
