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
  /** Set challenges are not rounds: they are not stored in `rounds` and never count as a day. */
  kind?: 'round' | 'challenge';
  date: string;
  minutes: number;
  segments: string[];
  chunks: number;
  medStart: number | null;
  medPerKey: number | null;
  /** Percent of chunks typed without a wrong key (repair tries not counted). */
  cleanRate: number;
  fixed: string[];
  /** Hunting letters at the end of the round. */
  huntLetters: string[];
  /** Hunting letters when the round started. Missing on rounds from before M2. */
  huntLettersAtStart?: string[];
  slowChunks: string[];
  flowMedStart: number | null;
  repairs: number;
  /** No-stop starts (⚡) and how many chunks were judged for one. Missing on older rounds. */
  handoffs?: number;
  handoffJudged?: number;
  /** Catch-the-star in the Keys warm-up. Missing on older rounds. */
  starsShown?: number;
  starsCaught?: number;
  /** This round turned stars off for good. */
  starsTurnedOff?: boolean;
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
  /** Practice chunks only; this is what "slow" compares with. */
  baseline: { start: number[]; perKey: number[] };
  /** Ms per key from test words. Used for letter judgments until practice has its own baseline, never for "slow". */
  testPerKey: number[];
  unlocked: Record<TrackId, number>;
  /** Most-missed keys from the last test, practiced in the next round's Keys segment. */
  pendingTestKeys: string[];
  rounds: RoundSummary[];
  tests: TestRecord[];
  settings: Settings;
  /** Recent ⚡ judgments (true = no stop), kept apart for chunks and words, and for flow. */
  handoff: Record<HandoffKind, boolean[]>;
  /** Catch-the-star: recent rounds with enough stars, and whether stars are off for good. */
  stars: { off: boolean; rounds: { shown: number; caught: number }[] };
  /** Saw the first-run cards (how to sit, home keys, eyes up). */
  seenBasics: boolean;
}

/** Short chunks are easier to join than flow, so their ⚡ rates are kept apart. */
export type HandoffKind = 'chunks' | 'flow';

export function newProfile(now = new Date()): Profile {
  return {
    version: 1,
    createdAt: now.toISOString(),
    items: {},
    letters: {},
    baseline: { start: [], perKey: [] },
    testPerKey: [],
    unlocked: { chunks: 1, words: 1, flow: 1 },
    pendingTestKeys: [],
    rounds: [],
    tests: [],
    handoff: { chunks: [], flow: [] },
    stars: { off: false, rounds: [] },
    seenBasics: false,
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

export function addTestPerKey(p: Profile, perKey: number) {
  pushCapped(p.testPerKey, perKey, CONFIG.baselineWindow);
}

/**
 * Personal ms per key for letter judgments. Practice data once it has enough chunks;
 * before that, practice and test data together, so a first test can find hunting letters.
 */
export function perKeyBaseline(p: Profile): number | null {
  if (p.baseline.perKey.length >= CONFIG.baselineMinChunks) return median(p.baseline.perKey);
  const all = [...p.baseline.perKey, ...(p.testPerKey ?? [])];
  return all.length >= CONFIG.perKeyBaselineMinSamples ? median(all) : null;
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

export function addHandoff(p: Profile, kind: HandoffKind, value: boolean) {
  const arr = (p.handoff ??= { chunks: [], flow: [] })[kind];
  arr.push(value);
  if (arr.length > CONFIG.handoffWindow) arr.splice(0, arr.length - CONFIG.handoffWindow);
}

export type Cue = 'strong' | 'soft' | null;

/** How strongly the next chunk lights up, from the recent ⚡ rate. Strong until there is enough data. */
export function cueFor(p: Profile, kind: HandoffKind): Cue {
  const arr = p.handoff?.[kind] ?? [];
  if (arr.length < CONFIG.handoffMinJudged) return 'strong';
  const rate = arr.filter(Boolean).length / arr.length;
  return rate < CONFIG.cueSoftAt ? 'strong' : rate < CONFIG.cueOffAt ? 'soft' : null;
}

export type KeyboardLevel = 'labels' | 'blank' | 'tucked';

/**
 * How much of the on-screen keyboard shows, by the share of known letters: letters on the keys,
 * then colours only, then tucked away (it pops up when stuck).
 */
export function keyboardLevel(p: Profile): KeyboardLevel {
  const share = knownShare(p);
  return share >= CONFIG.keyboardQuietKnownShare ? 'tucked' : share >= CONFIG.keyboardBlankKnownShare ? 'blank' : 'labels';
}

/** Saves one round's stars and turns stars off after enough rounds caught at a high rate. Returns true when it turned them off. */
export function recordStars(p: Profile, shown: number, caught: number): boolean {
  const st = (p.stars ??= { off: false, rounds: [] });
  if (st.off || shown < CONFIG.starMinShown) return false;
  st.rounds.push({ shown, caught });
  if (st.rounds.length > CONFIG.starOffRounds) st.rounds.splice(0, st.rounds.length - CONFIG.starOffRounds);
  const allHigh = st.rounds.length >= CONFIG.starOffRounds && st.rounds.every((r) => r.caught / r.shown >= CONFIG.starOffRate);
  if (allHigh) st.off = true;
  return allHigh;
}
