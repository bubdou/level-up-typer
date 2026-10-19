import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CONFIG,
  Round,
  TRACK_ITEMS,
  TestRun,
  chartHeadline,
  chartSeries,
  compareTest,
  huntLetters,
  itemKey,
  letterState,
  measureChunk,
  newProfile,
  planRound,
  saveTest,
  testScore,
  updateKnownStreaks,
} from './index';
import type { ChunkEvent, Profile, Segment } from './index';
import { COMMON_WORDS, MORE_WORDS, PHRASES, SENTENCES } from '../data/wordlists';

function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const wrongFor = (ch: string) => (ch === 'q' ? 'w' : 'q');

interface TypeOpts {
  start?: number;
  gap?: number;
  wrong?: boolean;
}

/** Types the current chunk (and its closing space). Returns the time after the last key. */
function typeCurrent(r: Round, t: number, { start = 300, gap = 150, wrong = false }: TypeOpts = {}): number {
  const v = r.view(t);
  let now = t + start;
  if (wrong) {
    r.key(wrongFor(v.expected), now);
    now += 50;
  }
  for (const ch of v.text.slice(v.pos)) {
    r.key(ch, now);
    now += gap;
  }
  r.key(' ', now);
  return now;
}

const longChunks: Segment[] = [{ kind: 'chunks', ms: 60 * 60_000 }];

function roundOf(p: Profile, opts: { seed?: number; wall?: number; segments?: Segment[]; events?: ChunkEvent[] } = {}) {
  const wall = opts.wall ?? Date.parse('2026-10-19T10:00:00Z');
  return new Round(p, {
    minutes: 60,
    now: 0,
    rng: seeded(opts.seed ?? 1),
    wallClock: () => wall,
    segments: opts.segments ?? longChunks,
    onEvent: (e) => opts.events?.push(e),
  });
}

function withBaseline(p: Profile, start = 300, perKey = 150) {
  p.baseline.start = Array(CONFIG.baselineMinChunks).fill(start);
  p.baseline.perKey = Array(CONFIG.baselineMinChunks).fill(perKey);
  return p;
}

describe('measuring a chunk', () => {
  it('matches the hand-worked example', () => {
    const m = measureChunk('the', 1000, [
      { index: 0, key: 't', t: 1800, correct: true },
      { index: 1, key: 'h', t: 2000, correct: true },
      { index: 2, key: 'e', t: 2300, correct: true },
      { index: 3, key: ' ', t: 2500, correct: true },
    ]);
    expect(m.startDelay).toBe(800);
    expect(m.perKey).toBe(250);
    expect(m.letterPauses).toEqual([
      { letter: 'h', ms: 200 },
      { letter: 'e', ms: 300 },
    ]);
    expect(m.clean).toBe(true);
    expect(m.away).toBe(false);
  });

  it('marks a miss, and skips the pause of the missed letter', () => {
    const m = measureChunk('ing', 0, [
      { index: 0, key: 'i', t: 500, correct: true },
      { index: 1, key: 'm', t: 700, correct: false },
      { index: 1, key: 'n', t: 900, correct: true },
      { index: 2, key: 'g', t: 1100, correct: true },
      { index: 3, key: ' ', t: 1200, correct: true },
    ]);
    expect(m.clean).toBe(false);
    expect(m.perKey).toBe(300);
    expect(m.letterPauses).toEqual([{ letter: 'g', ms: 200 }]);
  });

  it('counts a wrong key in place of the closing space as a miss', () => {
    const m = measureChunk('an', 0, [
      { index: 0, key: 'a', t: 300, correct: true },
      { index: 1, key: 'n', t: 450, correct: true },
      { index: 2, key: 't', t: 600, correct: false },
      { index: 2, key: ' ', t: 800, correct: true },
    ]);
    expect(m.clean).toBe(false);
  });

  it('flags pauses over 10 s as away and drops them', () => {
    const m = measureChunk('of', 0, [
      { index: 0, key: 'o', t: 11_000, correct: true },
      { index: 1, key: 'f', t: 11_200, correct: true },
      { index: 2, key: ' ', t: 11_300, correct: true },
    ]);
    expect(m.away).toBe(true);
    const m2 = measureChunk('of', 0, [
      { index: 0, key: 'o', t: 500, correct: true },
      { index: 1, key: 'f', t: 12_000, correct: true },
      { index: 2, key: ' ', t: 12_100, correct: true },
    ]);
    expect(m2.away).toBe(true);
    expect(m2.letterPauses).toEqual([]);
  });

  it('has no ms per key for a one-letter chunk', () => {
    const m = measureChunk('q', 0, [
      { index: 0, key: 'q', t: 400, correct: true },
      { index: 1, key: ' ', t: 600, correct: true },
    ]);
    expect(m.perKey).toBeNull();
    expect(m.startDelay).toBe(400);
  });

  it('does not count letter pauses across the space inside a phrase', () => {
    const strokes = [...'in a'].map((key, index) => ({ index, key, t: 100 * (index + 1), correct: true }));
    const m = measureChunk('in a', 0, strokes);
    expect(m.letterPauses.map((l) => l.letter)).toEqual(['n']);
  });
});

describe('repair bay', () => {
  it('sends a missed chunk to repair, needs 3 clean in a row, and resets on a miss', () => {
    const events: ChunkEvent[] = [];
    const r = roundOf(newProfile(), { events });
    const target = r.view(0).text;
    let t = typeCurrent(r, 0, { wrong: true });
    expect(r.view(t).repair).toEqual({ clean: 0, tries: 0 });
    expect(r.view(t).text).toBe(target);

    t = typeCurrent(r, t);
    t = typeCurrent(r, t);
    expect(r.view(t).repair?.clean).toBe(2);
    t = typeCurrent(r, t, { wrong: true });
    expect(r.view(t).repair?.clean).toBe(0);
    t = typeCurrent(r, t);
    t = typeCurrent(r, t);
    t = typeCurrent(r, t);
    expect(r.view(t).repair).toBeNull();
    expect(r.view(t).toast?.kind).toBe('fixed');
    expect(events.filter((e) => e.type === 'fixed').map((e) => e.text)).toEqual([target]);
  });

  it('lets go after the 6th try', () => {
    const r = roundOf(newProfile());
    let t = typeCurrent(r, 0, { wrong: true });
    for (let i = 0; i < CONFIG.repairMaxTries - 1; i++) {
      t = typeCurrent(r, t, { wrong: true });
      expect(r.view(t).repair?.tries).toBe(i + 1);
    }
    t = typeCurrent(r, t, { wrong: true });
    expect(r.view(t).repair).toBeNull();
    expect(r.view(t).toast?.kind).toBe('giveUp');
  });

  it('does not judge slowness in repair', () => {
    const r = roundOf(withBaseline(newProfile()));
    let t = typeCurrent(r, 0, { wrong: true });
    for (let i = 0; i < 3; i++) t = typeCurrent(r, t, { start: 5000 });
    expect(r.view(t).repair).toBeNull();
  });
});

describe('revisits', () => {
  it('brings a fixed chunk back after the 4th and the 12th chunk', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const r = roundOf(newProfile(), { seed });
      const target = r.view(0).text;
      let t = typeCurrent(r, 0, { wrong: true });
      for (let i = 0; i < 3; i++) t = typeCurrent(r, t);
      const seen: string[] = [];
      for (let i = 0; i < 13; i++) {
        seen.push(r.view(t).text);
        t = typeCurrent(r, t);
      }
      expect(seen[4], `seed ${seed}`).toBe(target);
      expect(seen[12], `seed ${seed}`).toBe(target);
      for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
    }
  });

  it('brings an unfixed chunk back after the 2nd chunk', () => {
    const r = roundOf(newProfile(), { seed: 3 });
    const target = r.view(0).text;
    let t = typeCurrent(r, 0, { wrong: true });
    for (let i = 0; i < CONFIG.repairMaxTries; i++) t = typeCurrent(r, t, { wrong: true });
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      seen.push(r.view(t).text);
      t = typeCurrent(r, t);
    }
    expect(seen[2]).toBe(target);
  });
});

describe('mastery', () => {
  it('needs smooth results in 2 different rounds', () => {
    const p = newProfile();
    const smoothIn = [new Set<string>(), new Set<string>()];
    for (let round = 0; round < 2; round++) {
      const events: ChunkEvent[] = [];
      const r = roundOf(p, { seed: 10 + round, wall: Date.parse('2026-10-19T10:00:00Z') + round * 86_400_000, events });
      let t = 0;
      for (let i = 0; i < 60; i++) t = typeCurrent(r, t);
      for (const e of events) if (e.type === 'smooth' && e.itemKey) smoothIn[round].add(e.itemKey);
      if (round === 0) for (const k of smoothIn[0]) expect(p.items[k].mastered).toBe(false);
      r.finish();
    }
    const keys = new Set([...smoothIn[0], ...smoothIn[1]]);
    expect(keys.size).toBeGreaterThan(5);
    for (const k of keys) expect(p.items[k].mastered, k).toBe(smoothIn[0].has(k) && smoothIn[1].has(k));
  });

  it('does not count the result right after a fix, and a miss resets progress', () => {
    const p = newProfile();
    const r = roundOf(p, { seed: 5 });
    const v0 = r.view(0);
    let t = typeCurrent(r, 0, { wrong: true });
    for (let i = 0; i < 3; i++) t = typeCurrent(r, t);
    // the fixed chunk is an item in one of the two tracks; find its record
    const recKey = Object.keys(p.items).find((k) => k.endsWith(`:${v0.text}`))!;
    expect(recKey).toBeDefined();
    for (let i = 0; i < 5; i++) t = typeCurrent(r, t);
    // the first revisit (5th chunk after the fix) was smooth but does not count
    expect(p.items[recKey].smoothRounds).toEqual([]);
    for (let i = 0; i < 8; i++) t = typeCurrent(r, t);
    // the second revisit (13th) counts
    expect(p.items[recKey].smoothRounds).toEqual([r.id]);

    p.items[recKey].smoothRounds = ['older-round'];
    // a later miss resets
    let guard = 0;
    while (r.view(t).text !== v0.text && guard++ < 500) t = typeCurrent(r, t);
    t = typeCurrent(r, t, { wrong: true });
    expect(p.items[recKey].smoothRounds).toEqual([]);
    expect(p.items[recKey].weak).toBe(true);
  });

  it('unlocks the next batch when 80% of the newest batch is mastered', () => {
    const p = newProfile();
    const batch = TRACK_ITEMS.chunks.slice(0, CONFIG.batchSize);
    for (const it of batch.slice(0, 7)) p.items[it.key] = { history: [], seen: 3, smoothRounds: ['a', 'b'], mastered: true, weak: false };
    for (const it of batch.slice(7)) p.items[it.key] = { history: [], seen: 1, smoothRounds: ['old'], mastered: false, weak: false };
    const r = roundOf(p, { seed: 2 });
    let t = 0;
    for (let i = 0; i < 300 && p.unlocked.chunks === 1; i++) t = typeCurrent(r, t);
    expect(p.unlocked.chunks).toBe(2);
    expect(batch.filter((b) => p.items[b.key].mastered).length).toBeGreaterThanOrEqual(8);
  });
});

describe('slow chunks', () => {
  it('judges slow only against the personal median, after 20 clean chunks', () => {
    const fresh = roundOf(newProfile());
    const t0 = typeCurrent(fresh, 0, { start: 5000 });
    expect(fresh.view(t0).repair).toBeNull();

    const p = withBaseline(newProfile(), 300, 150);
    const r = roundOf(p);
    let t = typeCurrent(r, 0, { start: 400 });
    expect(r.view(t).repair).toBeNull();
    t = typeCurrent(r, t, { start: 460 });
    expect(r.results.at(-1)?.outcome).toBe('slow');
    expect(r.view(t).repair).not.toBeNull();
  });

  it('judges slow ms per key too', () => {
    const p = withBaseline(newProfile(), 300, 150);
    const r = roundOf(p, { seed: 4 });
    let t = 0;
    while (r.view(t).text.length < 2) t = typeCurrent(r, t);
    t = typeCurrent(r, t, { gap: 230 });
    expect(r.results.at(-1)?.outcome).toBe('slow');
  });

  it('ignores a start delay over 10 s', () => {
    const p = withBaseline(newProfile(), 300, 150);
    const r = roundOf(p);
    const before = p.baseline.start.length;
    const t = typeCurrent(r, 0, { start: 10_500 });
    expect(r.results.at(-1)?.outcome).toBe('smooth');
    expect(r.results.at(-1)?.start).toBeNull();
    expect(p.baseline.start.length).toBe(before);
    void t;
  });
});

describe('letters and key hints', () => {
  it('switches between hunting, learning and known by the rule table', () => {
    const p = withBaseline(newProfile(), 300, 200);
    expect(letterState(p, 'q')).toBe('learning');
    p.letters.q = { pauses: Array(5).fill(700), knownStreak: 0 };
    expect(letterState(p, 'q')).toBe('hunt');
    expect(huntLetters(p)).toEqual(['q']);
    // twice the median but under the 600 ms floor: not hunting
    p.baseline.perKey = Array(20).fill(250);
    p.letters.z = { pauses: Array(5).fill(560), knownStreak: 0 };
    expect(letterState(p, 'z')).toBe('learning');

    p.letters.e = { pauses: Array(5).fill(200), knownStreak: 0 };
    expect(letterState(p, 'e')).toBe('learning');
    updateKnownStreaks(p);
    expect(letterState(p, 'e')).toBe('learning');
    updateKnownStreaks(p);
    expect(letterState(p, 'e')).toBe('known');
    // falls back at once when it gets slow again
    p.letters.e.pauses.push(...Array(10).fill(400));
    expect(letterState(p, 'e')).toBe('learning');
  });

  it('uses only the last 10 pauses and needs 5 of them', () => {
    const p = withBaseline(newProfile(), 300, 200);
    p.letters.x = { pauses: Array(4).fill(900), knownStreak: 0 };
    expect(letterState(p, 'x')).toBe('learning');
    p.letters.x.pauses = [...Array(20).fill(900), ...Array(10).fill(250)];
    expect(letterState(p, 'x')).toBe('learning');
  });

  it('collects letter pauses from practice', () => {
    const p = newProfile();
    const r = roundOf(p);
    let t = 0;
    for (let i = 0; i < 20; i++) t = typeCurrent(r, t, { gap: 120 });
    const all = Object.values(p.letters).flatMap((l) => l.pauses);
    expect(all.length).toBeGreaterThan(0);
    expect(new Set(all)).toEqual(new Set([120]));
  });
});

describe("today's round", () => {
  it('splits the time about 2:1 when there are no keys to find', () => {
    const segs = planRound(newProfile(), 7);
    expect(segs.map((s) => s.kind)).toEqual(['chunks', 'flow']);
    expect(segs[0].ms).toBe(280_000);
    expect(segs[1].ms).toBe(140_000);
  });

  it('adds Keys only with keys to find, 20 s each, at most 2 minutes', () => {
    const p = withBaseline(newProfile(), 300, 200);
    for (const l of 'qzx') p.letters[l] = { pauses: Array(5).fill(900), knownStreak: 0 };
    let segs = planRound(p, 7);
    expect(segs.map((s) => s.kind)).toEqual(['keys', 'chunks', 'flow']);
    expect(segs[0].ms).toBe(60_000);
    expect(segs[1].ms + segs[2].ms).toBe(360_000);
    expect(segs[1].ms).toBe(240_000);
    for (const l of 'bvjkwyp') p.letters[l] = { pauses: Array(5).fill(900), knownStreak: 0 };
    segs = planRound(p, 7);
    expect(segs[0].ms).toBe(120_000);
  });

  it('puts the most-missed test keys into Keys and clears them after the round', () => {
    const p = newProfile();
    p.pendingTestKeys = ['b', 'v'];
    const segs = planRound(p, 5);
    expect(segs[0]).toEqual({ kind: 'keys', ms: 40_000 });
    const r = new Round(p, { minutes: 5, now: 0, rng: seeded(1) });
    let t = 0;
    for (let i = 0; i < 5; i++) {
      expect([...r.view(t).text].some((c) => 'bv'.includes(c))).toBe(true);
      t = typeCurrent(r, t);
    }
    r.finish();
    expect(p.pendingTestKeys).toEqual([]);
  });

  it('runs Keys, Chunks and Flow in order and ends on time', () => {
    const p = newProfile();
    p.pendingTestKeys = ['q'];
    const r = new Round(p, { minutes: 1, now: 0, rng: seeded(9) });
    const kinds: string[] = [];
    let t = 0;
    for (let i = 0; i < 2000 && !r.isFinished; i++) {
      const v = r.view(t);
      if (v.interstitial) {
        t += CONFIG.segmentBreakMs;
        r.tick(t);
        continue;
      }
      kinds.push(v.segments[v.segIndex].kind);
      t = typeCurrent(r, t, { start: 200, gap: 100 });
      r.tick(t);
    }
    expect(r.isFinished).toBe(true);
    expect([...new Set(kinds)]).toEqual(['keys', 'chunks', 'flow']);
    const summary = p.rounds.at(-1)!;
    expect(summary.minutes).toBeGreaterThanOrEqual(1);
    expect(summary.minutes).toBeLessThan(1.1);
  });

  it('uses only practiced words in Flow', () => {
    const p = newProfile();
    for (const w of ['the', 'and', 'a', 'to', 'in', 'is', 'it']) p.items[itemKey('common', w)] = { history: [], seen: 1, smoothRounds: [], mastered: false, weak: false };
    const r = roundOf(p, { segments: [{ kind: 'flow', ms: 60 * 60_000 }] });
    const practiced = new Set(['the', 'and', 'a', 'to', 'in', 'is', 'it']);
    let t = 0;
    const seen = new Set<string>();
    for (let i = 0; i < 80; i++) {
      const text = r.view(t).text;
      seen.add(text);
      for (const w of text.split(' ')) expect(practiced.has(w), text).toBe(true);
      t = typeCurrent(r, t);
    }
    expect([...seen].every((s) => PHRASES.includes(s))).toBe(true);
  });

  it('builds runs of practiced words when no phrase fits, and never judges Flow slow', () => {
    const p = withBaseline(newProfile());
    const words = ['big', 'blue', 'can', 'come', 'down'];
    for (const w of words) p.items[itemKey('common', w)] = { history: [], seen: 1, smoothRounds: [], mastered: false, weak: false };
    const r = roundOf(p, { segments: [{ kind: 'flow', ms: 60 * 60_000 }] });
    let t = 0;
    for (let i = 0; i < 30; i++) {
      const text = r.view(t).text;
      expect(text.split(' ').length).toBeGreaterThanOrEqual(2);
      for (const w of text.split(' ')) expect(words).toContain(w);
      t = typeCurrent(r, t, { start: 3000 });
      expect(r.view(t).repair).toBeNull();
    }
  });

  it('types a sentence word by word', () => {
    const p = newProfile();
    const r = roundOf(p, { segments: [{ kind: 'chosen', stage: 'sentences', ms: 60 * 60_000 }] });
    let t = 0;
    const words: string[] = [];
    for (let i = 0; i < 40; i++) {
      words.push(r.view(t).text);
      t = typeCurrent(r, t);
    }
    expect(words.every((w) => !w.includes(' '))).toBe(true);
    const first = SENTENCES.find((s) => s.startsWith(words.slice(0, 3).join(' ')));
    expect(first).toBeDefined();
    expect(Object.keys(p.items).some((k) => k.startsWith('sentences:'))).toBe(true);
  });

  it('draws about 30% of the opening chunks from weak chunks', () => {
    let fromWeak = 0;
    let total = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const p = newProfile();
      const weak = itemKey('more', 'squirrel');
      p.items[weak] = { history: [], seen: 2, smoothRounds: [], mastered: false, weak: true };
      const r = roundOf(p, { seed });
      let t = 0;
      for (let i = 0; i < CONFIG.crossRoundOpeningChunks; i++) {
        if (r.view(t).text === 'squirrel') fromWeak++;
        total++;
        t = typeCurrent(r, t);
      }
    }
    expect(fromWeak / total).toBeGreaterThan(0.15);
    expect(fromWeak / total).toBeLessThan(0.4);
  });
});

describe('time and pauses', () => {
  it('counts only typing time', () => {
    const r = roundOf(newProfile(), { segments: [{ kind: 'chunks', ms: 60_000 }] });
    for (let t = 100; t <= 5000; t += 100) r.tick(t);
    expect(r.view(5000).activeMs).toBe(5000);
    r.pause(5000);
    for (let t = 5100; t <= 9000; t += 100) r.tick(t);
    expect(r.view(9000).activeMs).toBe(5000);
    expect(r.key('x', 9000)).toBe('ignored');
    r.resume(9000);
    // away: no key for more than 10 s stops the clock
    for (let t = 9100; t <= 30_000; t += 100) r.tick(t);
    expect(r.view(30_000).activeMs).toBeLessThanOrEqual(5000 + CONFIG.awayMs);
    expect(r.view(30_000).activeMs).toBeGreaterThan(5000 + CONFIG.awayMs - 200);
  });

  it('restarts the chunk after a pause but keeps a miss made before it', () => {
    const r = roundOf(newProfile());
    const v = r.view(0);
    r.key(wrongFor(v.expected), 300);
    r.key(v.expected, 400);
    r.pause(500);
    r.resume(2000);
    expect(r.view(2000).pos).toBe(0);
    typeCurrent(r, 2000);
    expect(r.results.at(-1)?.outcome).toBe('error');
  });

  it('ignores keys while the next segment name shows', () => {
    const p = newProfile();
    const r = roundOf(p, { segments: [{ kind: 'chunks', ms: 1000 }, { kind: 'flow', ms: 60_000 }] });
    let t = 0;
    while (!r.view(t).interstitial) {
      t = typeCurrent(r, t);
      r.tick(t);
    }
    expect(r.key('a', t + 10)).toBe('ignored');
    expect(r.view(t + CONFIG.segmentBreakMs).interstitial).toBeNull();
  });
});

describe('test mode', () => {
  it('computes WPM and accuracy like the hand-worked example', () => {
    const s = testScore(100, 5, 60_000);
    expect(s.wpm).toBe(20);
    expect(Math.round(s.accuracy)).toBe(95);
  });

  it('starts the clock on the first key and stops the cursor on a miss', () => {
    const run = new TestRun(1, seeded(1));
    expect(run.remainingMs(50_000)).toBe(60_000);
    const first = run.expected;
    expect(run.key(wrongFor(first), 1000)).toBe('wrong');
    expect(run.pos).toBe(0);
    expect(run.key(first, 1200)).toBe('correct');
    expect(run.remainingMs(31_000)).toBe(30_000);
  });

  it('scores a full run and ends at the time limit', () => {
    const run = new TestRun(1, seeded(2));
    let t = 0;
    let typed = 0;
    while (!run.tick(t)) {
      if (typed === 10 || typed === 30) run.key(wrongFor(run.expected), t);
      run.key(run.expected, t);
      typed++;
      t += 200;
    }
    expect(run.pos).toBe(300);
    expect(run.wrongKeys).toBe(2);
    const s = run.score();
    expect(s.wpm).toBe(60);
    expect(s.accuracy).toBeCloseTo((100 * 300) / 302, 5);
    expect(run.key('a', t + 10)).toBe('ignored');
  });

  it('voids a test on a window switch only after it started', () => {
    const run = new TestRun(1);
    run.void();
    expect(run.voided).toBe(false);
    run.key(run.expected, 0);
    run.void();
    expect(run.voided).toBe(true);
  });

  it('saves the record, feeds letter data, and queues the most-missed keys', () => {
    const p = newProfile();
    const run = new TestRun(1, seeded(4));
    let t = 0;
    const misses: Record<string, number> = { q: 0 };
    while (!run.tick(t)) {
      const e = run.expected;
      if (e !== ' ' && run.pos % 7 === 3) {
        run.key(e === 'z' ? 'q' : 'z', t);
        misses[e] = (misses[e] ?? 0) + 1;
      }
      run.key(e, t);
      t += 250;
    }
    const rec = saveTest(p, run, Date.parse('2026-10-19T10:00:00Z'));
    expect(p.tests).toHaveLength(1);
    expect(rec.minutes).toBe(1);
    expect(rec.correctChars).toBe(240);
    expect(Object.values(rec.errorsByKey).reduce((a, b) => a + b, 0)).toBe(rec.wrongKeys);
    expect(p.pendingTestKeys.length).toBeLessThanOrEqual(3);
    expect(p.pendingTestKeys.every((k) => /^[a-z]$/.test(k))).toBe(true);
    expect(p.baseline.perKey.length).toBeGreaterThan(0);
    expect(Object.keys(p.letters).length).toBeGreaterThan(0);
  });

  it('compares with the last test of the same length and spots a new best', () => {
    const mk = (id: string, date: string, minutes: number, wpm: number) => ({
      id, date, minutes, wpm, accuracy: 95, correctChars: 0, keystrokes: 0, wrongKeys: 0, errorsByKey: {},
    });
    const tests = [mk('a', '2026-10-01', 1, 20), mk('b', '2026-10-02', 3, 30), mk('c', '2026-10-03', 1, 18), mk('d', '2026-10-05', 1, 21)];
    const c = compareTest(tests, tests[3]);
    expect(c.previous?.id).toBe('c');
    expect(c.newBest).toBe(true);
    expect(compareTest(tests, tests[2]).newBest).toBe(false);
    expect(compareTest(tests, tests[0]).newBest).toBe(false);
  });
});

describe('progress chart', () => {
  const mk = (date: string, minutes: number, wpm: number) => ({
    id: date, date, minutes, wpm, accuracy: 95, correctChars: 0, keystrokes: 0, wrongKeys: 0, errorsByKey: {},
  });

  it('keeps 1 and 3 minute tests apart and averages the last 3', () => {
    const tests = [mk('2026-10-01', 1, 10), mk('2026-10-02', 3, 50), mk('2026-10-03', 1, 13), mk('2026-10-04', 1, 16), mk('2026-10-05', 1, 22)];
    const s = chartSeries(tests, 1);
    expect(s.map((p) => p.wpm)).toEqual([10, 13, 16, 22]);
    expect(s.map((p) => p.avg)).toEqual([10, 11.5, 13, 17]);
    expect(chartHeadline(s)).toEqual({ kind: 'up', wpm: 4 });
  });

  it('says "Some days are slower" when the average is not up', () => {
    const tests = [mk('2026-10-01', 1, 20), mk('2026-10-03', 1, 24), mk('2026-10-04', 1, 18)];
    expect(chartHeadline(chartSeries(tests, 1))).toEqual({ kind: 'best', best: 24 });
    expect(chartHeadline(chartSeries(tests.slice(0, 1), 1))).toBeNull();
  });
});

describe('content and boundaries', () => {
  it('uses only lowercase letters and spaces, and phrases use listed words', () => {
    const words = new Set([...COMMON_WORDS, ...MORE_WORDS]);
    for (const list of Object.values(TRACK_ITEMS)) for (const it of list) expect(it.text).toMatch(/^[a-z]+( [a-z]+)*$/);
    for (const s of [...PHRASES, ...SENTENCES]) for (const w of s.split(' ')) expect(words.has(w), `${s}: ${w}`).toBe(true);
    expect(COMMON_WORDS).toHaveLength(132);
    expect(MORE_WORDS).toHaveLength(179);
    expect(new Set([...COMMON_WORDS, ...MORE_WORDS]).size).toBe(311);
  });

  it('keeps the engine free of UI code', () => {
    const dir = join(__dirname);
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.ts') && !n.endsWith('.test.ts'))) {
      const src = readFileSync(join(dir, f), 'utf8');
      expect(src, f).not.toMatch(/from ['"](react|react-dom)|from ['"]\.\.\/(ui|storage)/);
      expect(src, f).not.toMatch(/\bdocument\.|\bwindow\./);
    }
  });
});
