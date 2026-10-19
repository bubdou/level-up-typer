import { CONFIG } from './config';
import { LETTERS, TEST_POOL } from './content';
import type { Rng } from './picker';
import { pickOne } from './picker';
import type { Profile, TestRecord } from './profile';
import { addBaseline, addLetterPause } from './profile';
import { testScore } from './stats';

export type TestKeyResult = 'ignored' | 'correct' | 'wrong';

/**
 * A 1 or 3 minute test. Text comes from the fixed test pool, so difficulty is the same every time.
 * The clock starts on the first key. A wrong key stops the cursor until the right key, like practice.
 */
export class TestRun {
  readonly minutes: number;
  readonly durationMs: number;
  text = '';
  pos = 0;
  wrongKeys = 0;
  keystrokes = 0;
  startAt: number | null = null;
  finished = false;
  voided = false;
  errorTick = 0;
  /** Positions missed at least once, keyed by the expected character. */
  readonly errorsByKey: Record<string, number> = {};
  private missed = new Set<number>();
  private hitAt: number[] = [];
  private endAt: number | null = null;
  private rng: Rng;
  private lastWord = '';

  constructor(minutes: number, rng: Rng = Math.random) {
    this.minutes = minutes;
    this.durationMs = minutes * 60_000;
    this.rng = rng;
    this.extend(minutes === 1 ? 80 : 200);
  }

  private extend(words: number) {
    const out: string[] = [];
    while (out.length < words) {
      const w = pickOne(this.rng, TEST_POOL)!;
      if (w === this.lastWord) continue;
      out.push(w);
      this.lastWord = w;
    }
    this.text = this.text ? `${this.text} ${out.join(' ')}` : out.join(' ');
  }

  get expected(): string {
    return this.text[this.pos];
  }

  key(rawKey: string, now: number): TestKeyResult {
    if (this.finished || this.voided || rawKey.length !== 1) return 'ignored';
    if (this.startAt === null) this.startAt = now;
    if (this.tick(now)) return 'ignored';
    const k = rawKey.toLowerCase();
    this.keystrokes++;
    const want = this.text[this.pos];
    if (k !== want) {
      this.wrongKeys++;
      this.errorTick++;
      if (!this.missed.has(this.pos)) {
        this.missed.add(this.pos);
        this.errorsByKey[want] = (this.errorsByKey[want] ?? 0) + 1;
      }
      return 'wrong';
    }
    this.hitAt[this.pos] = now;
    this.pos++;
    if (this.text.length - this.pos < 200) this.extend(40);
    return 'correct';
  }

  /** Returns true once time is up. */
  tick(now: number): boolean {
    if (this.finished || this.voided || this.startAt === null) return this.finished;
    if (now - this.startAt >= this.durationMs) {
      this.finished = true;
      this.endAt = this.startAt + this.durationMs;
    }
    return this.finished;
  }

  /** Switching away during a test voids it; it never reaches the chart. */
  void() {
    if (this.startAt !== null && !this.finished) this.voided = true;
  }

  remainingMs(now: number): number {
    if (this.startAt === null) return this.durationMs;
    return Math.max(0, this.durationMs - (now - this.startAt));
  }

  score(): { wpm: number; accuracy: number } {
    const ms = this.startAt === null ? this.durationMs : (this.endAt ?? this.startAt + this.durationMs) - this.startAt;
    return testScore(this.pos, this.wrongKeys, ms);
  }

  topMissed(n: number = CONFIG.testTopMissedKeys): string[] {
    return Object.entries(this.errorsByKey)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, n)
      .map(([k]) => k);
  }

  /** Letter pauses and ms per key from clean words. The first test seeds the hunting-letter check. */
  measurements(): { letterPauses: { letter: string; ms: number }[]; perKeys: number[] } {
    const letterPauses: { letter: string; ms: number }[] = [];
    const perKeys: number[] = [];
    let wordStart = 0;
    for (let i = 0; i <= this.pos; i++) {
      if (i < this.pos && this.text[i] !== ' ') continue;
      // word is text[wordStart, i)
      const end = i - 1;
      if (end > wordStart && i <= this.pos) {
        let clean = true;
        for (let j = wordStart; j <= end; j++) if (this.missed.has(j)) clean = false;
        for (let j = wordStart + 1; j <= end; j++) {
          if (this.missed.has(j) || this.hitAt[j] === undefined || this.hitAt[j - 1] === undefined) continue;
          const ms = this.hitAt[j] - this.hitAt[j - 1];
          if (ms <= CONFIG.awayMs) letterPauses.push({ letter: this.text[j], ms });
        }
        if (clean && this.hitAt[end] !== undefined && this.hitAt[wordStart] !== undefined) {
          const pk = (this.hitAt[end] - this.hitAt[wordStart]) / (end - wordStart);
          if (pk * (end - wordStart) <= CONFIG.awayMs) perKeys.push(pk);
        }
      }
      wordStart = i + 1;
    }
    return { letterPauses, perKeys };
  }
}

/** Store a finished test: the record, letter data for hunting letters, and missed keys for the next Keys segment. */
export function saveTest(p: Profile, run: TestRun, wallNow: number = Date.now()): TestRecord {
  const { wpm, accuracy } = run.score();
  const record: TestRecord = {
    id: `t${wallNow.toString(36)}`,
    date: new Date(wallNow).toISOString(),
    minutes: run.minutes,
    wpm,
    accuracy,
    correctChars: run.pos,
    keystrokes: run.keystrokes,
    wrongKeys: run.wrongKeys,
    errorsByKey: { ...run.errorsByKey },
  };
  const m = run.measurements();
  for (const lp of m.letterPauses) addLetterPause(p, lp.letter, lp.ms);
  for (const pk of m.perKeys) addBaseline(p, null, pk);
  p.pendingTestKeys = run.topMissed().filter((k) => LETTERS.includes(k));
  p.tests.push(record);
  return record;
}

export interface TestComparison {
  previous: TestRecord | null;
  newBest: boolean;
}

/** Compare with earlier tests of the same length. */
export function compareTest(tests: readonly TestRecord[], record: TestRecord): TestComparison {
  const same = tests.filter((t) => t.minutes === record.minutes && t.id !== record.id && t.date <= record.date);
  const previous = same.length ? same[same.length - 1] : null;
  const best = same.length ? Math.max(...same.map((t) => Math.round(t.wpm))) : null;
  return { previous, newBest: best !== null && Math.round(record.wpm) > best };
}
