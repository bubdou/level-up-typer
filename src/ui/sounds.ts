// Three short sounds, made with Web Audio so there are no files to load: Fixed!, a new item
// mastered, and a level up. No sound on key presses and none for a wrong key.

export type SoundId = 'fixed' | 'mastered' | 'level';

const NOTES: Record<SoundId, number[]> = {
  fixed: [660, 880],
  mastered: [880, 1175],
  level: [523, 659, 784, 1047],
};

let ctx: AudioContext | null = null;

export function playSound(id: SoundId) {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime;
    NOTES[id].forEach((f, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      const t = t0 + i * 0.09;
      osc.type = 'sine';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  } catch {
    // sound is never required
  }
}
