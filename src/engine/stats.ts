import { CONFIG } from './config';

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** One key press while a chunk is current. `index` is the position in the chunk it was aimed at. */
export interface Keystroke {
  index: number;
  key: string;
  t: number;
  correct: boolean;
}

export interface ChunkMeasure {
  /** From the chunk becoming current to the first key press. */
  startDelay: number;
  /** Mean ms per key from the first letter to the last letter. Null for one-letter chunks. */
  perKey: number | null;
  /** Pause before each letter inside the chunk, only for letters hit on the first try. */
  letterPauses: { letter: string; ms: number }[];
  /** No wrong key at any point, including the space that ends the chunk. */
  clean: boolean;
  /** A pause over CONFIG.awayMs happened, so start delay and ms per key are not used. */
  away: boolean;
}

/**
 * Measures one chunk from its key presses. `strokes` covers the letters and the closing
 * space (index === text.length). The space is not part of the chunk's timing.
 *
 * Example: "the" shown at 1000, t at 1800, h at 2000, e at 2300, space at 2500
 * gives startDelay 800, perKey 250, pauses h 200 and e 300.
 */
export function measureChunk(text: string, shownAt: number, strokes: readonly Keystroke[]): ChunkMeasure {
  const awayMs = CONFIG.awayMs;
  const first = strokes[0];
  const startDelay = first ? first.t - shownAt : 0;
  const clean = strokes.every((s) => s.correct);

  const hitAt: number[] = [];
  const missed = new Set<number>();
  for (const s of strokes) {
    if (s.index >= text.length) continue;
    if (s.correct) hitAt[s.index] = s.t;
    else missed.add(s.index);
  }

  let away = startDelay > awayMs;
  for (let i = 1; i < strokes.length; i++) {
    if (strokes[i].index < text.length && strokes[i].t - strokes[i - 1].t > awayMs) away = true;
  }

  const last = text.length - 1;
  const perKey =
    text.length > 1 && hitAt[0] !== undefined && hitAt[last] !== undefined ? (hitAt[last] - hitAt[0]) / last : null;

  const letterPauses: { letter: string; ms: number }[] = [];
  for (let i = 1; i < text.length; i++) {
    const ch = text[i];
    if (ch === ' ' || text[i - 1] === ' ') continue;
    if (missed.has(i)) continue;
    if (hitAt[i] === undefined || hitAt[i - 1] === undefined) continue;
    const ms = hitAt[i] - hitAt[i - 1];
    if (ms > awayMs) continue;
    letterPauses.push({ letter: ch, ms });
  }

  return { startDelay, perKey, letterPauses, clean, away };
}

/** Typing.com's definition: WPM = correct characters / 5 / minutes. Accuracy = correct keys / all keys. */
export function testScore(correctChars: number, wrongKeys: number, ms: number): { wpm: number; accuracy: number } {
  const minutes = ms / 60_000;
  const wpm = minutes > 0 ? correctChars / 5 / minutes : 0;
  const total = correctChars + wrongKeys;
  const accuracy = total > 0 ? (100 * correctChars) / total : 100;
  return { wpm, accuracy };
}
