import { CONFIG } from './config';
import type { Item, StageId, TrackId } from './content';
import { ITEM_BY_KEY, batchCount, stageById, unlockedItems } from './content';
import type { Rng } from './picker';
import { eligibleFlowItems, keysItems, pickItem, pickOne, practicedWords, trackPool, weakItems } from './picker';
import type { Segment, SegmentKind } from './plan';
import { planRound } from './plan';
import type { Cue, HandoffKind, Profile, RoundSummary } from './profile';
import {
  addBaseline,
  addHandoff,
  cueFor,
  letterState,
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
  | {
      type: 'smooth' | 'slow' | 'error';
      text: string;
      itemKey: string | null;
      /** The segment's judging mode: keys, chunks or flow. */
      segment: JudgeMode;
      /** Start delay in ms, null when the learner was away. */
      start: number | null;
      /** The personal median start delay that "slow" uses; null until the baseline is built. */
      medianStart: number | null;
      /** Start below the personal median. Null when either number is missing. */
      quickStart: boolean | null;
      /** No-stop start (⚡): see Round.handoffFor. Null when the chunk was not judged. */
      handoff: boolean | null;
    }
  | { type: 'fixed'; text: string; itemKey: string | null; segment: JudgeMode }
  | { type: 'mastered'; text: string; itemKey: string };

interface Entry {
  /** Stable for as long as the chunk is in the queue, so the strip can key on it. */
  id: number;
  text: string;
  itemKey: string | null;
  mode: JudgeMode;
  revisit?: boolean;
  /** Words of a sentence are chunks; the sentence is the item. */
  sentence?: { key: string; last: boolean };
}

type NewEntry = Omit<Entry, 'id'>;

interface Repair {
  clean: number;
  tries: number;
}

export interface ChunkResult {
  id: number;
  text: string;
  outcome: Outcome;
  mode: JudgeMode;
  start: number | null;
  perKey: number | null;
  handoff: boolean | null;
}

export interface RoundOptions {
  minutes: number;
  choose?: StageId | null;
  now: number;
  rng?: Rng;
  /** Wall clock for dates and round ids. */
  wallClock?: () => number;
  onEvent?: (e: ChunkEvent) => void;
  /** Use a fixed plan instead of planRound (tests, and set challenges via planChallenge). */
  segments?: Segment[];
}

export interface RoundView {
  segments: Segment[];
  segIndex: number;
  /** While set, the next segment's name shows and keys are ignored. */
  interstitial: SegmentKind | null;
  mode: JudgeMode;
  /** The current chunk's id. It stays the same through a repair. */
  id: number;
  text: string;
  pos: number;
  expected: string;
  /** When the expected key became the next key (for hint delays). */
  charSince: number;
  /** Increases on every wrong key, so the UI can replay the shake. */
  errorTick: number;
  repair: Repair | null;
  prev: { text: string; outcome: Outcome } | null;
  /**
   * The chunks after this one (8, or 3 in the Keys warm-up). While the strip shows, these never
   * change: the list only moves on by one and grows at the end. Only the end of a repair and a
   * new segment can change it, and both cover the strip.
   */
  next: { id: number; text: string }[];
  /** Chunks finished in this segment, oldest first (a missed chunk shows once, before its repair). */
  done: readonly ChunkResult[];
  /** How the chunk after this one lights up right now; null when it does not. */
  cue: Cue;
  toast: { kind: 'fixed' | 'giveUp'; until: number } | null;
  /** Just back from the repair bay, nothing typed yet on this chunk: the screen says so. */
  backFromRepair: boolean;
  paused: boolean;
  finished: boolean;
  activeMs: number;
  limitMs: number;
  /** Index of the current chunk within its segment (0 = first). */
  chunkInSegment: number;
  /** Changes every time a chunk (or a repair try) starts. */
  seq: number;
}

/** `echo`: a key of the chunk just repaired, typed again by habit; it is not counted (see Round.echo). */
export type KeyResult = 'ignored' | 'correct' | 'wrong' | 'done' | 'echo';

/** Set challenge ids start with this, so mastery can tell them from normal rounds. */
export const CHALLENGE_ID_PREFIX = 'ch-';
export const isChallengeId = (id: string) => id.startsWith(CHALLENGE_ID_PREFIX);

export class Round {
  readonly segments: Segment[];
  readonly id: string;
  readonly limitMs: number;
  /**
   * A set challenge. Its chunks are judged and repaired like any round and misses count as usual.
   * A smooth result counts as one of the rounds mastery needs, but at least one of them must be a
   * normal round, so two challenges alone never master an item. It is not stored as a round.
   */
  readonly challenge: boolean;
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
  private generate: (exclude: Set<string>) => NewEntry = () => ({ text: 'f', itemKey: null, mode: 'keys' });
  private nextId = 0;
  private segResultStart = 0;
  /** The next-chunk cue for this segment, set when it starts so it never flickers mid-segment. */
  private segCue: Cue = null;
  /** The current chunk has a hunting letter: eyes stay on it, so no cue. */
  private curHasHunt = false;
  /** The chunk before this one was typed smooth in this segment, with no repair or pause between. */
  private handoffPrimed = false;
  private handoffs = 0;
  private handoffJudged = 0;
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
  /**
   * After the repair bay the hands often go on typing the repaired chunk (it was typed 3 times in a
   * row). While every key so far also spells the repaired chunk again (space included), the retype
   * stays possible: a key that is right for the next chunk counts for it, but a key that fits only
   * the retype drops those keys and restarts the next chunk, without a miss. A key that fits only
   * the next chunk ends the grace; a key that fits neither is a miss as usual.
   */
  private echo: { text: string; i: number } | null = null;

  /** Count of main (non-repair) chunks finished this round; the n-th chunk has index n. */
  private mainCount = 0;
  private fixedAt = new Map<string, number>();
  private sentenceClean = true;
  private openingPicks = 0;
  private hunt: Set<string>;
  private huntAtStart: string[];
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
    this.segments = opts.segments ?? planRound(profile, opts.minutes, opts.choose ?? null);
    this.limitMs = this.segments.reduce((a, s) => a + s.ms, 0);
    this.challenge = this.segments.some((s) => s.kind === 'set');
    const stamp = `${this.wall().toString(36)}${Math.floor(this.rng() * 1e6).toString(36)}`;
    this.id = this.challenge ? `${CHALLENGE_ID_PREFIX}${stamp}` : `r${stamp}`;
    this.huntAtStart = huntLetters(profile);
    this.hunt = new Set(this.huntAtStart);
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
      id: this.current.id,
      text,
      pos: this.pos,
      expected: this.pos < text.length ? text[this.pos] : ' ',
      charSince: this.charSince,
      errorTick: this.errorTick,
      repair: this.repair ? { ...this.repair } : null,
      prev: this.results.length
        ? { text: this.results[this.results.length - 1].text, outcome: this.results[this.results.length - 1].outcome }
        : null,
      next: this.peek(this.segMode === 'keys' ? CONFIG.aheadChunksKeys : CONFIG.aheadChunks).map((e) => ({ id: e.id, text: e.text })),
      done: this.results.slice(this.segResultStart),
      cue:
        this.pos > 0 && !this.repair && !this.paused && !this.finished && now >= this.interstitialUntil && !this.curHasHunt
          ? this.segCue
          : null,
      toast: this.toast && now < this.toast.until ? this.toast : null,
      backFromRepair: this.echo !== null && this.pos === 0 && !this.repair,
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
    const fitsEcho = !!this.echo && !this.repair && k === this.echo.text[this.echo.i % this.echo.text.length];
    if (fitsEcho && !correct) {
      // Only the retype fits: this was the old chunk all along. Any keys taken for this chunk (they
      // fitted both) are dropped, and the chunk starts over; its wait starts after this key, so it
      // is not judged slow for the retype.
      this.echo!.i++;
      if (this.pos > 0) this.resetChunk(now);
      this.shownAt = now;
      this.charSince = now;
      this.lastKeyAt = now;
      return 'echo';
    }
    // A key that fits both readings counts for this chunk, and the retype stays possible.
    if (fitsEcho) this.echo!.i++;
    else this.echo = null;
    this.strokes.push({ index: this.pos, key: k, t: now, correct });
    this.lastKeyAt = now;
    if (!correct) {
      this.errorTick++;
      return 'wrong';
    }
    this.pos++;
    this.charSince = now;
    if (this.pos <= text.length) return 'correct';
    this.echo = null;
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
    this.echo = null;
  }

  /** Resume restarts the current chunk so its timing has no pause in it. A miss before the pause still counts. */
  resume(now: number) {
    if (!this.paused) return;
    this.paused = false;
    this.lastTick = now;
    if (!this.repair) this.errorBeforePause ||= this.strokes.some((s) => !s.correct);
    this.handoffPrimed = false;
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
    if (!this.challenge) updateKnownStreaks(this.p);
    if (this.segments.some((s) => s.kind === 'keys')) this.p.pendingTestKeys = [];
    const clean = this.results.filter((r) => r.outcome !== 'error').length;
    const round = (v: number | null) => (v === null ? null : Math.round(v));
    this.summary = {
      id: this.id,
      kind: this.challenge ? 'challenge' : 'round',
      date: new Date(this.wall()).toISOString(),
      minutes: this.activeMs / 60_000,
      segments: this.segments.map((s) => (s.kind === 'chosen' ? s.stage! : s.kind)),
      chunks: this.results.length,
      medStart: round(median(this.chunkStarts)),
      medPerKey: round(median(this.chunkPerKeys)),
      cleanRate: Math.round((100 * clean) / this.results.length),
      fixed: [...new Set(this.fixed)],
      huntLetters: huntLetters(this.p),
      huntLettersAtStart: this.huntAtStart,
      slowChunks: [...new Set(this.results.filter((r) => r.outcome === 'slow').map((r) => r.text))],
      flowMedStart: round(median(this.flowStarts)),
      repairs: this.repairs,
      handoffs: this.handoffs,
      handoffJudged: this.handoffJudged,
    };
    if (!this.challenge) this.p.rounds.push(this.summary);
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
      else this.upcoming.push(this.tag(e));
    }
  }

  private tag(e: NewEntry): Entry {
    return { ...e, id: ++this.nextId };
  }

  private expandSentence(e: NewEntry): Entry[] {
    const words = e.text.split(' ');
    return words.map((w, i) => this.tag({ text: w, itemKey: null, mode: e.mode, sentence: { key: e.sentence!.key, last: i === words.length - 1 } }));
  }

  private resetChunk(now: number, keepError = false) {
    this.seq++;
    this.pos = 0;
    this.strokes = [];
    this.shownAt = now;
    this.charSince = now;
    this.lastKeyAt = Math.max(this.lastKeyAt, now);
    if (!keepError) this.errorBeforePause = false;
    this.curHasHunt = [...this.current.text].some((ch) => ch !== ' ' && letterState(this.p, ch) === 'hunt');
  }

  private startSegment(i: number, now: number, withBreak: boolean) {
    this.echo = null;
    // Revisits already scheduled keep their place when the segment changes.
    const carried = this.upcoming.map((e, idx) => ({ e, idx })).filter((x) => x.e.revisit);
    this.segIndex = i;
    this.segStartMs = this.activeMs;
    this.chunkInSegment = 0;
    this.segResultStart = this.results.length;
    this.handoffPrimed = false;
    this.upcoming = [];
    this.configureGenerator(this.segments[i]);
    this.segCue = this.segMode === 'keys' ? null : cueFor(this.p, this.handoffKind(this.segMode));
    const first = this.generate(new Set());
    if (first.sentence) {
      const [w, ...rest] = this.expandSentence(first);
      this.current = w;
      this.upcoming.push(...rest);
    } else {
      this.current = this.tag(first);
    }
    for (const { e, idx } of carried) {
      if (idx === 0) {
        this.upcoming.unshift(this.current);
        this.current = e;
      } else {
        this.insertRevisit(e, idx - 1);
      }
    }
    const t = withBreak ? now + CONFIG.segmentBreakMs : now;
    this.interstitialUntil = withBreak ? t : 0;
    this.resetChunk(t);
  }

  private configureGenerator(seg: Segment) {
    if (seg.kind === 'keys') return this.useKeys(seg);
    if (seg.kind === 'set') {
      const pool = (seg.items ?? []).map((k) => ITEM_BY_KEY.get(k)).filter((i): i is Item => !!i);
      return pool[0]?.track === 'flow' ? this.useFlowItems(pool) : this.useChunkPool(() => pool, false);
    }
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
    const base = slowBaseline(this.p);
    const medianStart = base.start;
    const slow = entry.mode === 'chunks' && clean && this.isSlow(start, perKey);
    const outcome: Outcome = !clean ? 'error' : slow ? 'slow' : 'smooth';
    const handoff = this.handoffFor(entry, outcome, start, base.perKey);
    this.handoffPrimed = false;
    if (handoff !== null) {
      addHandoff(this.p, this.handoffKind(entry.mode), handoff);
      this.handoffJudged++;
      if (handoff) this.handoffs++;
    }
    this.results.push({ id: entry.id, text: entry.text, outcome, mode: entry.mode, start, perKey, handoff });

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

    const quickStart = start === null || medianStart === null ? null : start < medianStart;
    this.emit({ type: outcome, text: entry.text, itemKey: entry.itemKey, segment: entry.mode, start, medianStart, quickStart, handoff });

    if (outcome === 'error') {
      this.repair = { clean: 0, tries: 0 };
      this.repairs++;
      this.resetChunk(now);
      return;
    }
    // Slow but right: no repair bay (being sent back for typing it right feels unfair), it comes
    // back later in the round instead. A revisit that is slow again is not queued once more.
    if (outcome === 'slow') {
      // No repair screen covers the strip here, so the chunks already shown ahead must stay put.
      if (!entry.revisit) this.scheduleRevisits(entry, CONFIG.revisitAfterSlow, CONFIG.aheadChunks);
      this.advance(now);
      return;
    }
    this.advance(now, true);
  }

  private handoffKind(mode: JudgeMode): HandoffKind {
    return mode === 'flow' ? 'flow' : 'chunks';
  }

  /**
   * ⚡: the first key came within handoffFactor x the personal ms per key after the space before it,
   * so the learner read this chunk while finishing the last one. Judged only for a smooth chunk that
   * follows a smooth chunk of the same segment (not the first in a segment, not after a repair, a
   * give-up or a pause), never in the Keys warm-up, never when away, and only once the baseline exists.
   */
  private handoffFor(entry: Entry, outcome: Outcome, start: number | null, perKey: number | null): boolean | null {
    if (outcome !== 'smooth' || entry.mode === 'keys' || !this.handoffPrimed) return null;
    if (start === null || perKey === null) return null;
    return start <= CONFIG.handoffFactor * perKey;
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
    if (!rec.mastered && rec.smoothRounds.length >= CONFIG.masteryRounds && rec.smoothRounds.some((id) => !isChallengeId(id))) {
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
      this.emit({ type: 'fixed', text: entry.text, itemKey: entry.itemKey, segment: entry.mode });
      this.repair = null;
      this.toast = { kind: 'fixed', until: now + CONFIG.fixedToastMs };
      this.scheduleRevisits(entry, CONFIG.revisitAfterFix);
      // Before advance: a new segment clears it, since the chunk is no longer just behind.
      this.echo = { text: `${entry.text} `, i: 0 };
      this.advance(now);
      return;
    }
    if (r.tries >= CONFIG.repairMaxTries) {
      this.repair = null;
      this.toast = { kind: 'giveUp', until: now + CONFIG.giveUpToastMs };
      this.scheduleRevisits(entry, [CONFIG.revisitAfterGiveUp]);
      // Before advance: a new segment clears it, since the chunk is no longer just behind.
      this.echo = { text: `${entry.text} `, i: 0 };
      this.advance(now);
      return;
    }
    this.resetChunk(now);
  }

  /**
   * Put the chunk back into the queue so that `gap` other chunks come before it.
   * Never inside a sentence, and never next to the same text.
   */
  /** `shown`: this many queued chunks are on screen already; nothing is inserted or replaced among them. */
  private scheduleRevisits(entry: Entry, gaps: readonly number[], shown = 0) {
    for (const gap of gaps) this.insertRevisit(this.tag({ text: entry.text, itemKey: entry.itemKey, mode: entry.mode, revisit: true }), Math.max(gap, shown), shown);
  }

  /** Insert a revisit at queue index `idx` (that many chunks come before it). */
  private insertRevisit(revisit: Entry, idx: number, shown = 0) {
    this.fill(idx + 2);
    while (idx < this.upcoming.length && this.upcoming[idx - 1]?.sentence && !this.upcoming[idx - 1].sentence!.last) idx++;
    this.upcoming.splice(idx, 0, revisit);
    for (const j of [idx - 1, idx + 1]) {
      if (j < shown) continue;
      const nb = this.upcoming[j];
      if (!nb || nb.text !== revisit.text || nb.revisit || nb.sentence) continue;
      const exclude = new Set([revisit.text, this.upcoming[j - 1]?.text, this.upcoming[j + 1]?.text].filter((t): t is string => !!t));
      const replacement = this.generate(exclude);
      if (!replacement.sentence) this.upcoming[j] = this.tag(replacement);
    }
  }

  /** `smooth`: the chunk just typed was smooth, so the next one can be judged for ⚡. */
  private advance(now: number, smooth = false) {
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
    this.handoffPrimed = smooth;
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
