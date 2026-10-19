import { CONFIG } from './config';
import type { Item, StageId, TrackId } from './content';
import { ITEM_BY_KEY, batchCount, stageById, unlockedItems } from './content';
import type { Rng } from './picker';
import { eligibleFlowItems, keysItems, pickItem, pickOne, practicedWords, trackPool, weakItems } from './picker';
import type { Segment, SegmentKind } from './plan';
import { planRound } from './plan';
import type { Profile, RoundSummary } from './profile';
import {
  addBaseline,
  addLetterPause,
  huntLetters,
  itemRecord,
  keysLetters,
  slowBaseline,
  updateKnownStreaks,
} from './profile';
import type { Keystroke } from './stats';
import { measureChunk, median } from './stats';

/** How a chunk is judged. Keys: misses go to repair, nothing is slow. Flow: same, and only known words. */
export type JudgeMode = 'keys' | 'chunks' | 'flow';

export type Outcome = 'smooth' | 'slow' | 'error';

/** The five events the game layer (M2) can subscribe to. */
export type ChunkEvent =
  | { type: 'smooth' | 'slow' | 'error'; text: string; itemKey: string | null }
  | { type: 'fixed'; text: string; itemKey: string | null }
  | { type: 'mastered'; text: string; itemKey: string };

interface Entry {
  text: string;
  itemKey: string | null;
  mode: JudgeMode;
  revisit?: boolean;
  /** Words of a sentence are chunks; the sentence is the item. */
  sentence?: { key: string; last: boolean };
}

interface Repair {
  clean: number;
  tries: number;
}

export interface ChunkResult {
  text: string;
  outcome: Outcome;
  mode: JudgeMode;
  start: number | null;
  perKey: number | null;
}

export interface RoundOptions {
  minutes: number;
  choose?: StageId | null;
  now: number;
  rng?: Rng;
  /** Wall clock for dates and round ids. */
  wallClock?: () => number;
  onEvent?: (e: ChunkEvent) => void;
  /** Use a fixed plan instead of planRound (tests). */
  segments?: Segment[];
}

export interface RoundView {
  segments: Segment[];
  segIndex: number;
  /** While set, the next segment's name shows and keys are ignored. */
  interstitial: SegmentKind | null;
  mode: JudgeMode;
  text: string;
  pos: number;
  expected: string;
  /** When the expected key became the next key (for hint delays). */
  charSince: number;
  /** Increases on every wrong key, so the UI can replay the shake. */
  errorTick: number;
  repair: Repair | null;
  prev: { text: string; outcome: Outcome } | null;
  next: string[];
  /** True once the first key of the current chunk is down: the next chunk lights up a little. */
  readAhead: boolean;
  toast: { kind: 'fixed' | 'giveUp'; until: number } | null;
  paused: boolean;
  finished: boolean;
  activeMs: number;
  limitMs: number;
  /** Index of the current chunk within its segment (0 = first). */
  chunkInSegment: number;
  /** Changes every time a chunk (or a repair try) starts. */
  seq: number;
}

export type KeyResult = 'ignored' | 'correct' | 'wrong' | 'done';

export class Round {
  readonly segments: Segment[];
  readonly id: string;
  readonly limitMs: number;
  private p: Profile;
  private rng: Rng;
  private wall: () => number;
  private onEvent?: (e: ChunkEvent) => void;

  private segIndex = 0;
  private segStartMs = 0;
  private activeMs = 0;
  private lastTick: number;
  private lastKeyAt: number;
  private interstitialUntil = 0;
  private paused = false;
  private finished = false;
  private summary: RoundSummary | null = null;

  private current!: Entry;
  private upcoming: Entry[] = [];
  private segMode: JudgeMode = 'chunks';
  private generate: (exclude: Set<string>) => Entry = () => ({ text: 'f', itemKey: null, mode: 'keys' });
  private chunkInSegment = 0;

  private pos = 0;
  private strokes: Keystroke[] = [];
  private shownAt = 0;
  private charSince = 0;
  private errorBeforePause = false;
  private errorTick = 0;
  private seq = 0;
  private repair: Repair | null = null;
  private toast: RoundView['toast'] = null;

  /** Count of main (non-repair) chunks finished this round; the n-th chunk has index n. */
  private mainCount = 0;
  private fixedAt = new Map<string, number>();
  private sentenceClean = true;
  private openingPicks = 0;
  private hunt: Set<string>;
  private keysLetters: string[];

  readonly results: ChunkResult[] = [];
  private fixed: string[] = [];
  private repairs = 0;
  private chunkStarts: number[] = [];
  private chunkPerKeys: number[] = [];
  private flowStarts: number[] = [];

  constructor(profile: Profile, opts: RoundOptions) {
    this.p = profile;
    this.rng = opts.rng ?? Math.random;
    this.wall = opts.wallClock ?? Date.now;
    this.onEvent = opts.onEvent;
    this.id = `r${this.wall().toString(36)}${Math.floor(this.rng() * 1e6).toString(36)}`;
    this.segments = opts.segments ?? planRound(profile, opts.minutes, opts.choose ?? null);
    this.limitMs = this.segments.reduce((a, s) => a + s.ms, 0);
    this.hunt = new Set(huntLetters(profile));
    this.keysLetters = keysLetters(profile);
    this.lastTick = opts.now;
    this.lastKeyAt = opts.now;
    this.startSegment(0, opts.now, false);
  }

  // ---------- public API ----------

  view(now: number): RoundView {
    const text = this.text();
    return {
      segments: this.segments,
      segIndex: this.segIndex,
      interstitial: now < this.interstitialUntil ? this.segments[this.segIndex].kind : null,
      mode: this.current.mode,
      text,
      pos: this.pos,
      expected: this.pos < text.length ? text[this.pos] : ' ',
      charSince: this.charSince,
      errorTick: this.errorTick,
      repair: this.repair ? { ...this.repair } : null,
      prev: this.results.length
        ? { text: this.results[this.results.length - 1].text, outcome: this.results[this.results.length - 1].outcome }
        : null,
      next: this.peek(2).map((e) => e.text),
      readAhead: this.pos > 0,
      toast: this.toast && now < this.toast.until ? this.toast : null,
      paused: this.paused,
      finished: this.finished,
      activeMs: this.activeMs,
      limitMs: this.limitMs,
      chunkInSegment: this.chunkInSegment,
      seq: this.seq,
    };
  }

  key(rawKey: string, now: number): KeyResult {
    if (this.finished || this.paused || now < this.interstitialUntil) return 'ignored';
    if (rawKey.length !== 1) return 'ignored';
    this.tick(now);
    const k = rawKey.toLowerCase();
    const text = this.text();
    const expected = this.pos < text.length ? text[this.pos] : ' ';
    const correct = k === expected;
    this.strokes.push({ index: this.pos, key: k, t: now, correct });
    this.lastKeyAt = now;
    if (!correct) {
      this.errorTick++;
      return 'wrong';
    }
    this.pos++;
    this.charSince = now;
    if (this.pos <= text.length) return 'correct';
    this.complete(now);
    return 'done';
  }

  /** Advance the clock. Only typing time counts: not paused, not between segments, not away. */
  tick(now: number) {
    const dt = now - this.lastTick;
    this.lastTick = now;
    if (this.paused || this.finished || dt <= 0) return;
    if (now < this.interstitialUntil) return;
    const from = Math.max(now - dt, this.interstitialUntil);
    if (now - this.lastKeyAt < CONFIG.awayMs) this.activeMs += now - from;
  }

  pause(now: number) {
    if (this.finished || this.paused) return;
    this.tick(now);
    this.paused = true;
  }

  /** Resume restarts the current chunk so its timing has no pause in it. A miss before the pause still counts. */
  resume(now: number) {
    if (!this.paused) return;
    this.paused = false;
    this.lastTick = now;
    if (!this.repair) this.errorBeforePause ||= this.strokes.some((s) => !s.correct);
    this.resetChunk(now, true);
  }

  get isPaused() {
    return this.paused;
  }

  get isFinished() {
    return this.finished;
  }

  /** End the round now (time is up, or the learner stopped). Returns null if nothing was typed. */
  finish(): RoundSummary | null {
    if (this.finished) return this.summary;
    this.finished = true;
    if (this.results.length === 0) return null;
    updateKnownStreaks(this.p);
    if (this.segments.some((s) => s.kind === 'keys')) this.p.pendingTestKeys = [];
    const clean = this.results.filter((r) => r.outcome !== 'error').length;
    const round = (v: number | null) => (v === null ? null : Math.round(v));
    this.summary = {
      id: this.id,
      date: new Date(this.wall()).toISOString(),
      minutes: this.activeMs / 60_000,
      segments: this.segments.map((s) => (s.kind === 'chosen' ? s.stage! : s.kind)),
      chunks: this.results.length,
      medStart: round(median(this.chunkStarts)),
      medPerKey: round(median(this.chunkPerKeys)),
      cleanRate: Math.round((100 * clean) / this.results.length),
      fixed: [...new Set(this.fixed)],
      huntLetters: huntLetters(this.p),
      slowChunks: [...new Set(this.results.filter((r) => r.outcome === 'slow').map((r) => r.text))],
      flowMedStart: round(median(this.flowStarts)),
      repairs: this.repairs,
    };
    this.p.rounds.push(this.summary);
    return this.summary;
  }

  // ---------- internals ----------

  private text() {
    return this.current.text;
  }

  private peek(n: number): Entry[] {
    this.fill(n);
    return this.upcoming.slice(0, n);
  }

  private fill(n: number) {
    while (this.upcoming.length < n) {
      const prev = this.upcoming.length ? this.upcoming[this.upcoming.length - 1] : this.current;
      const exclude = new Set(prev ? [prev.text] : []);
      const e = this.generate(exclude);
      if (e.sentence) this.upcoming.push(...this.expandSentence(e));
      else this.upcoming.push(e);
    }
  }

  private expandSentence(e: Entry): Entry[] {
    const words = e.text.split(' ');
    return words.map((w, i) => ({ text: w, itemKey: null, mode: e.mode, sentence: { key: e.sentence!.key, last: i === words.length - 1 } }));
  }

  private resetChunk(now: number, keepError = false) {
    this.seq++;
    this.pos = 0;
    this.strokes = [];
    this.shownAt = now;
    this.charSince = now;
    this.lastKeyAt = Math.max(this.lastKeyAt, now);
    if (!keepError) this.errorBeforePause = false;
  }

  private startSegment(i: number, now: number, withBreak: boolean) {
    this.segIndex = i;
    this.segStartMs = this.activeMs;
    this.chunkInSegment = 0;
    this.upcoming = [];
    this.configureGenerator(this.segments[i]);
    this.current = this.generate(new Set());
    if (this.current.sentence) {
      const [first, ...rest] = this.expandSentence(this.current);
      this.current = first;
      this.upcoming.push(...rest);
    }
    const t = withBreak ? now + CONFIG.segmentBreakMs : now;
    this.interstitialUntil = withBreak ? t : 0;
    this.resetChunk(t);
  }

  private configureGenerator(seg: Segment) {
    if (seg.kind === 'keys') return this.useKeys(seg);
    if (seg.kind === 'chosen') {
      const stage = stageById(seg.stage!);
      const pool = stage.items.map((text) => ITEM_BY_KEY.get(`${stage.id}:${text}`)!);
      return stage.track === 'flow' ? this.useFlowItems(pool) : this.useChunkPool(() => pool, false);
    }
    if (seg.kind === 'flow') {
      const practiced = practicedWords(this.p);
      const eligible = eligibleFlowItems(this.p, practiced);
      if (eligible.length >= CONFIG.flowMinItems) return this.useFlowItems(eligible);
      if (practiced.size >= CONFIG.flowMinPracticedWords) return this.usePseudoPhrases([...practiced]);
      return this.useChunks();
    }
    return this.useChunks();
  }

  private useKeys(seg: Segment) {
    this.segMode = 'keys';
    const letters = this.keysLetters.length ? this.keysLetters : ['f', 'j'];
    const groups: string[][] = [];
    for (let i = 0; i < letters.length; i += 3) groups.push(letters.slice(i, i + 3));
    this.generate = (exclude) => {
      const elapsed = this.activeMs - this.segStartMs;
      const g = groups[Math.min(groups.length - 1, Math.floor((elapsed / Math.max(1, seg.ms)) * groups.length))];
      const items = keysItems(g).filter((i) => !exclude.has(i.text));
      const letterOptions = g.filter((l) => !exclude.has(l));
      const useLetter = this.rng() < 0.4 || items.length === 0;
      const text = useLetter ? (pickOne(this.rng, letterOptions) ?? g[0]) : pickOne(this.rng, items)!.text;
      return { text, itemKey: null, mode: 'keys' };
    };
  }

  private useChunks() {
    this.useChunkPool((track) => trackPool(this.p, track));
  }

  private useChunkPool(poolFor: (track: TrackId) => Item[], reviewWeak = true) {
    this.segMode = 'chunks';
    this.generate = (exclude) => {
      let item: Item | undefined;
      if (reviewWeak && this.openingPicks < CONFIG.crossRoundOpeningChunks) {
        this.openingPicks++;
        if (this.rng() < CONFIG.crossRoundWeakShare) {
          item = pickOne(this.rng, weakItems(this.p, ['chunks', 'words']).filter((i) => !exclude.has(i.text)));
        }
      }
      if (!item) {
        const track: TrackId = this.rng() < CONFIG.wordTrackShare ? 'words' : 'chunks';
        let pool = poolFor(track);
        if (pool.length === 0) pool = poolFor(track === 'words' ? 'chunks' : 'words');
        item = pickItem(this.rng, this.p, pool, this.hunt, exclude);
      }
      return { text: item!.text, itemKey: item!.key, mode: 'chunks' };
    };
  }

  private useFlowItems(pool: Item[]) {
    this.segMode = 'flow';
    this.generate = (exclude) => {
      const item = pickItem(this.rng, this.p, pool, this.hunt, exclude)!;
      if (item.stage === 'sentences') return { text: item.text, itemKey: null, mode: 'flow', sentence: { key: item.key, last: false } };
      return { text: item.text, itemKey: item.key, mode: 'flow' };
    };
  }

  private usePseudoPhrases(words: string[]) {
    this.segMode = 'flow';
    this.generate = (exclude) => {
      let text = '';
      for (let tries = 0; tries < 5 && (!text || exclude.has(text)); tries++) {
        const n = this.rng() < 0.5 ? 2 : 3;
        const run: string[] = [];
        while (run.length < n) {
          const w = pickOne(this.rng, words)!;
          if (w !== run[run.length - 1]) run.push(w);
          if (words.length < 2) break;
        }
        text = run.join(' ');
      }
      return { text, itemKey: null, mode: 'flow' };
    };
  }

  private complete(now: number) {
    const entry = this.current;
    const m = measureChunk(entry.text, this.shownAt, this.strokes);
    const clean = m.clean && !this.errorBeforePause;

    if (this.repair) return this.repairAttempt(entry, clean, now);

    this.mainCount++;
    const n = this.mainCount;
    for (const lp of m.letterPauses) addLetterPause(this.p, lp.letter, lp.ms);

    const start = m.away ? null : m.startDelay;
    const perKey = m.away ? null : m.perKey;
    const slow = entry.mode === 'chunks' && clean && this.isSlow(start, perKey);
    const outcome: Outcome = !clean ? 'error' : slow ? 'slow' : 'smooth';
    this.results.push({ text: entry.text, outcome, mode: entry.mode, start, perKey });

    if (clean && !m.away) {
      if (entry.mode === 'chunks') {
        addBaseline(this.p, start, perKey);
        if (start !== null) this.chunkStarts.push(start);
        if (perKey !== null) this.chunkPerKeys.push(perKey);
      } else if (entry.mode === 'flow' && start !== null) {
        this.flowStarts.push(start);
      }
    }

    if (entry.itemKey && entry.mode !== 'keys') this.updateItem(entry.itemKey, outcome, start, perKey, n);
    if (entry.sentence) {
      this.sentenceClean &&= clean;
      if (entry.sentence.last) {
        this.updateItem(entry.sentence.key, this.sentenceClean ? 'smooth' : 'error', null, null, n);
        this.sentenceClean = true;
      }
    }

    this.emit({ type: outcome, text: entry.text, itemKey: entry.itemKey });

    if (outcome !== 'smooth') {
      this.repair = { clean: 0, tries: 0 };
      this.repairs++;
      this.resetChunk(now);
      return;
    }
    this.advance(now);
  }

  private isSlow(start: number | null, perKey: number | null): boolean {
    const base = slowBaseline(this.p);
    if (start !== null && base.start !== null && start > CONFIG.slowFactor * base.start) return true;
    if (perKey !== null && base.perKey !== null && perKey > CONFIG.slowFactor * base.perKey) return true;
    return false;
  }

  private updateItem(key: string, outcome: Outcome, start: number | null, perKey: number | null, n: number) {
    const rec = itemRecord(this.p, key);
    rec.seen++;
    rec.history.push({ start, perKey, clean: outcome !== 'error', slow: outcome === 'slow', at: this.wall() });
    if (rec.history.length > CONFIG.itemHistory) rec.history.splice(0, rec.history.length - CONFIG.itemHistory);
    if (outcome !== 'smooth') {
      rec.smoothRounds = [];
      rec.mastered = false;
      rec.weak = true;
      return;
    }
    const fixedAt = this.fixedAt.get(key);
    const tooSoon = fixedAt !== undefined && n - fixedAt - 1 <= CONFIG.masteryIgnoreAfterFix;
    if (tooSoon) return;
    if (!rec.smoothRounds.includes(this.id)) rec.smoothRounds.push(this.id);
    if (!rec.mastered && rec.smoothRounds.length >= CONFIG.masteryRounds) {
      rec.mastered = true;
      rec.weak = false;
      const item = ITEM_BY_KEY.get(key);
      this.emit({ type: 'mastered', text: item?.text ?? key, itemKey: key });
      if (item) this.checkUnlock(item.track);
    }
  }

  /** The next batch unlocks when 80% of the newest batch is mastered. */
  private checkUnlock(track: TrackId) {
    if (this.p.unlocked[track] >= batchCount(track)) return;
    const { latest } = unlockedItems(track, this.p.unlocked[track]);
    const mastered = latest.filter((i) => this.p.items[i.key]?.mastered).length;
    if (mastered >= CONFIG.unlockMasteredShare * latest.length) this.p.unlocked[track]++;
  }

  private repairAttempt(entry: Entry, clean: boolean, now: number) {
    const r = this.repair!;
    r.tries++;
    r.clean = clean ? r.clean + 1 : 0;
    const key = entry.itemKey ?? entry.text;
    if (r.clean >= CONFIG.repairCleanNeeded) {
      this.fixed.push(entry.text);
      this.fixedAt.set(key, this.mainCount);
      this.emit({ type: 'fixed', text: entry.text, itemKey: entry.itemKey });
      this.repair = null;
      this.toast = { kind: 'fixed', until: now + CONFIG.fixedToastMs };
      this.scheduleRevisits(entry, CONFIG.revisitAfterFix);
      return this.advance(now);
    }
    if (r.tries >= CONFIG.repairMaxTries) {
      this.repair = null;
      this.toast = { kind: 'giveUp', until: now + CONFIG.giveUpToastMs };
      this.scheduleRevisits(entry, [CONFIG.revisitAfterGiveUp]);
      return this.advance(now);
    }
    this.resetChunk(now);
  }

  /**
   * Put the chunk back into the queue so that `gap` other chunks come before it.
   * Never inside a sentence, and never next to the same text.
   */
  private scheduleRevisits(entry: Entry, gaps: readonly number[]) {
    const revisit: Entry = { text: entry.text, itemKey: entry.itemKey, mode: entry.mode, revisit: true };
    for (const gap of gaps) {
      this.fill(gap + 2);
      let idx = gap;
      while (idx < this.upcoming.length && this.upcoming[idx - 1]?.sentence && !this.upcoming[idx - 1].sentence!.last) idx++;
      this.upcoming.splice(idx, 0, revisit);
      for (const j of [idx - 1, idx + 1]) {
        const nb = this.upcoming[j];
        if (!nb || nb.text !== revisit.text || nb.revisit || nb.sentence) continue;
        const exclude = new Set([revisit.text, this.upcoming[j - 1]?.text, this.upcoming[j + 1]?.text].filter((t): t is string => !!t));
        const replacement = this.generate(exclude);
        if (!replacement.sentence) this.upcoming[j] = replacement;
      }
    }
  }

  private advance(now: number) {
    this.chunkInSegment++;
    if (this.activeMs >= this.limitMs) {
      this.finish();
      return;
    }
    const seg = this.segments[this.segIndex];
    const segDone = this.activeMs - this.segStartMs >= seg.ms;
    const midSentence = this.current.sentence && !this.current.sentence.last;
    if (segDone && this.segIndex < this.segments.length - 1 && !midSentence) {
      this.startSegment(this.segIndex + 1, now, true);
      return;
    }
    this.fill(1);
    this.current = this.upcoming.shift()!;
    this.resetChunk(now);
  }

  private emit(e: ChunkEvent) {
    this.onEvent?.(e);
  }

  /** For tests: the queue the learner will see next. */
  debugUpcoming(n: number): string[] {
    return this.peek(n).map((e) => e.text);
  }

  get segmentMode(): JudgeMode {
    return this.segMode;
  }
}
