import { CONFIG } from './config';
import type { StageId, TrackId } from './content';
import { LETTERS } from './content';
import { median } from './stats';

export interface Attempt {
  /** Start delay in ms, null when the learner was away. */
  start: number | null;
  perKey: number | null;
  clean: boolean;
  slow: boolean;
  at: number;
}

export interface ItemRecord {
  history: Attempt[];
  seen: number;
  /** Round ids with a counted smooth result since the last miss. */
  smoothRounds: string[];
  mastered: boolean;
  /** Missed or slow, and not mastered since. Feeds the weak-chunk list. */
  weak: boolean;
}

export interface LetterRecord {
  pauses: number[];
  /** Rounds in a row that ended with this letter meeting the "known" rule. */
  knownStreak: number;
}

export interface RoundSummary {
  id: string;
  date: string;
  minutes: number;
  segments: string[];
  chunks: number;
  medStart: number | null;
  medPerKey: number | null;
  /** Percent of chunks typed without a wrong key (repair tries not counted). */
  cleanRate: number;
  fixed: string[];
  huntLetters: string[];
  slowChunks: string[];
  flowMedStart: number | null;
  repairs: number;
}

export interface TestRecord {
  id: string;
  date: string;
  minutes: number;
  wpm: number;
  accuracy: number;
  correctChars: number;
  keystrokes: number;
  wrongKeys: number;
  /** Positions where each expected key was missed at least once. */
  errorsByKey: Record<string, number>;
}

export type HintMode = 'auto' | 'always' | 'off';

export interface Settings {
  roundMinutes: number;
  hints: HintMode;
  choose: StageId | null;
  keyboardHidden: boolean;
}

export interface Profile {
  version: 1;
  createdAt: string;
  items: Record<string, ItemRecord>;
  letters: Record<string, LetterRecord>;
  baseline: { start: number[]; perKey: number[] };
  unlocked: Record<TrackId, number>;
  /** Most-missed keys from the last test, practiced in the next round's Keys segment. */
  pendingTestKeys: string[];
  rounds: RoundSummary[];
  tests: TestRecord[];
  settings: Settings;
}

export function newProfile(now = new Date()): Profile {
  return {
    version: 1,
    createdAt: now.toISOString(),
    items: {},
    letters: {},
    baseline: { start: [], perKey: [] },
    unlocked: { chunks: 1, words: 1, flow: 1 },
    pendingTestKeys: [],
    rounds: [],
    tests: [],
    settings: { roundMinutes: CONFIG.defaultRoundMinutes, hints: 'auto', choose: null, keyboardHidden: false },
  };
}

export function itemRecord(p: Profile, key: string): ItemRecord {
  return (p.items[key] ??= { history: [], seen: 0, smoothRounds: [], mastered: false, weak: false });
}

const pushCapped = (arr: number[], v: number, cap: number) => {
  arr.push(v);
  if (arr.length > cap) arr.splice(0, arr.length - cap);
};

export function addBaseline(p: Profile, start: number | null, perKey: number | null) {
  if (start !== null) pushCapped(p.baseline.start, start, CONFIG.baselineWindow);
  if (perKey !== null) pushCapped(p.baseline.perKey, perKey, CONFIG.baselineWindow);
}

export function addLetterPause(p: Profile, letter: string, ms: number) {
  if (ms > CONFIG.awayMs) return;
  const rec = (p.letters[letter] ??= { pauses: [], knownStreak: 0 });
  pushCapped(rec.pauses, ms, CONFIG.letterWindow);
}

/** Medians used for "slow". Null until the baseline has enough clean chunks. */
export function slowBaseline(p: Profile): { start: number | null; perKey: number | null } {
  const ok = (a: number[]) => (a.length >= CONFIG.baselineMinChunks ? median(a) : null);
  return { start: ok(p.baseline.start), perKey: ok(p.baseline.perKey) };
}

/** Personal ms per key for letter judgments. */
export function perKeyBaseline(p: Profile): number | null {
  return p.baseline.perKey.length >= CONFIG.perKeyBaselineMinSamples ? median(p.baseline.perKey) : null;
}

export type LetterState = 'hunt' | 'learning' | 'known';

function letterRule(p: Profile, letter: string): { hunt: boolean; knownNow: boolean } {
  const rec = p.letters[letter];
  const base = perKeyBaseline(p);
  if (!rec || rec.pauses.length < CONFIG.letterMinSamples || base === null) return { hunt: false, knownNow: false };
  const m = median(rec.pauses.slice(-CONFIG.letterWindow))!;
  return {
    hunt: m > CONFIG.huntFactor * base && m > CONFIG.huntFloorMs,
    knownNow: m < CONFIG.knownFactor * base,
  };
}

/** Hint state: hunting lights at once, learning after 1 s, known after 3 s. New letters start as learning. */
export function letterState(p: Profile, letter: string): LetterState {
  const r = letterRule(p, letter);
  if (r.hunt) return 'hunt';
  if (r.knownNow && (p.letters[letter]?.knownStreak ?? 0) >= CONFIG.knownRoundsNeeded) return 'known';
  return 'learning';
}

export const huntLetters = (p: Profile): string[] => LETTERS.filter((l) => letterState(p, l) === 'hunt');

/** Called at the end of each round: "known" needs the rule to hold at the end of 2 rounds in a row. */
export function updateKnownStreaks(p: Profile) {
  for (const l of LETTERS) {
    const rec = p.letters[l];
    if (!rec) continue;
    rec.knownStreak = letterRule(p, l).knownNow ? rec.knownStreak + 1 : 0;
  }
}

export function knownShare(p: Profile): number {
  return LETTERS.filter((l) => letterState(p, l) === 'known').length / LETTERS.length;
}

/** Letters for the Keys segment: hunting letters plus the most-missed keys from the last test. */
export function keysLetters(p: Profile): string[] {
  return [...new Set([...huntLetters(p), ...p.pendingTestKeys.filter((k) => LETTERS.includes(k))])].sort();
}
