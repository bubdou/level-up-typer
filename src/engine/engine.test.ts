import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CHALLENGE_ID_PREFIX,
  CONFIG,
  Round,
  TRACK_ITEMS,
  TestRun,
  chartHeadline,
  chartSeries,
  compareTest,
  huntLetters,
  itemKey,
  keyboardLevel,
  letterState,
  measureChunk,
  newProfile,
  planChallenge,
  planRound,
  recordStars,
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

const ITEM_TEXT = (key: string) => key.slice(key.indexOf(':') + 1);

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

  it('after the repair bay, typing the repaired chunk again by habit does not count as a miss', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const r = roundOf(newProfile(), { seed });
      const target = r.view(0).text;
      let t = typeCurrent(r, 0, { wrong: true });
      for (let i = 0; i < 3; i++) t = typeCurrent(r, t);
      const v = r.view(t);
      expect(v.repair).toBeNull();
      expect(v.backFromRepair).toBe(true);
      const next = v.text;
      // the hands go on: the repaired chunk once more, and its first letter again
      for (const ch of `${target} ${target[0]}`) {
        t += 150;
        const res = r.key(ch, t);
        expect(['echo', 'correct'], `seed ${seed}`).toContain(res);
        if (res === 'correct') break;
      }
      // then the real chunk: it counts as clean, no new repair
      t = typeCurrent(r, t);
      expect(r.results.at(-1)?.text, `seed ${seed}`).toBe(next);
      expect(r.results.at(-1)?.outcome, `seed ${seed}`).not.toBe('error');
      expect(r.view(t).repair, `seed ${seed}`).toBeNull();
      expect(r.view(t).backFromRepair).toBe(false);
    }
  });

  it('a repair that ends its segment gives no grace in the next segment', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const r = roundOf(newProfile(), { seed, segments: [{ kind: 'chunks', ms: 3000 }, { kind: 'flow', ms: 60 * 60_000 }] });
      const target = r.view(0).text;
      let t = typeCurrent(r, 0, { wrong: true });
      // slow repair tries: the segment's time runs out during the repair
      for (let i = 0; i < 3; i++) t = typeCurrent(r, t, { start: 1500 });
      const v0 = r.view(t);
      expect(v0.segIndex, `seed ${seed}`).toBe(1);
      expect(v0.backFromRepair, `seed ${seed}`).toBe(false);
      if (v0.interstitial) t += CONFIG.segmentBreakMs + 10;
      const v = r.view(t);
      expect(v.backFromRepair, `seed ${seed}`).toBe(false);
      const odd = [...target].find((c) => c !== v.text[0]);
      if (odd) expect(r.key(odd, (t += 150)), `seed ${seed}`).toBe('wrong');
    }
  });

  it('after the repair bay, any other wrong key still counts, and ends the grace', () => {
    const r = roundOf(newProfile(), { seed: 3 });
    const target = r.view(0).text;
    let t = typeCurrent(r, 0, { wrong: true });
    for (let i = 0; i < 3; i++) t = typeCurrent(r, t);
    const next = r.view(t).text;
    const odd = [...'zxqjkv'].find((c) => !target.includes(c) && c !== next[0])!;
    expect(r.key(odd, (t += 150))).toBe('wrong');
    if (target[0] !== next[0]) expect(r.key(target[0], (t += 150))).toBe('wrong');
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

  it('keeps scheduled revisits when the round moves to the next segment', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const p = newProfile();
      const r = roundOf(p, { seed, segments: [{ kind: 'chunks', ms: 5000 }, { kind: 'chunks', ms: 60 * 60_000 }] });
      let t = 0;
      // run the clock almost to the end of the first segment
      while (r.view(t).activeMs < 4900) {
        t += 50;
        r.tick(t);
      }
      const target = r.view(t).text;
      t = typeCurrent(r, t, { wrong: true });
      for (let i = 0; i < 3; i++) t = typeCurrent(r, t);
      expect(r.view(t).segIndex, `seed ${seed}`).toBe(1);
      t += CONFIG.segmentBreakMs;
      r.tick(t);
      const seen: string[] = [];
      for (let i = 0; i < 13; i++) {
        seen.push(r.view(t).text);
        t = typeCurrent(r, t);
      }
      expect(seen[4], `seed ${seed}`).toBe(target);
      expect(seen[12], `seed ${seed}`).toBe(target);
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
    expect(r.view(t).repair).toBeNull();
  });

  it('sends a slow chunk on, not to repair, and brings it back after the chunks already shown', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const p = withBaseline(newProfile(), 300, 150);
      const r = roundOf(p, { seed });
      let t = typeCurrent(r, 0, { start: 300 });
      const target = r.view(t).text;
      const before = r.view(t).next.map((n) => `${n.id}:${n.text}`);
      t = typeCurrent(r, t, { start: 460 });
      expect(r.results.at(-1)?.outcome, `seed ${seed}`).toBe('slow');
      const v = r.view(t);
      expect(v.repair).toBeNull();
      // the strip only moves on by one: what was shown ahead stays, one new chunk at the end
      const after = v.next.map((n) => `${n.id}:${n.text}`);
      expect(`${v.id}:${v.text}`, `seed ${seed}`).toBe(before[0]);
      expect(after.slice(0, -1), `seed ${seed}`).toEqual(before.slice(1));
      const seen: string[] = [];
      for (let i = 0; i < 16; i++) {
        seen.push(r.view(t).text);
        t = typeCurrent(r, t, { start: 300 });
      }
      expect(seen.slice(8).includes(target), `seed ${seed}`).toBe(true);
    }
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

describe('fields for the game layer (M2)', () => {
  it('chunk events carry the segment, the start time and whether it beat the personal median', () => {
    const events: ChunkEvent[] = [];
    const fresh = roundOf(newProfile(), { events });
    typeCurrent(fresh, 0, { start: 200 });
    expect(events.at(-1)).toMatchObject({ type: 'smooth', segment: 'chunks', start: 200, medianStart: null, quickStart: null });

    const p = withBaseline(newProfile(), 300, 150);
    const r = roundOf(p, { events });
    let t = typeCurrent(r, 0, { start: 250 });
    expect(events.at(-1)).toMatchObject({ type: 'smooth', start: 250, medianStart: 300, quickStart: true });
    t = typeCurrent(r, t, { start: 300 });
    expect(events.at(-1)).toMatchObject({ quickStart: false });
    typeCurrent(r, t, { wrong: true });
    expect(events.at(-1)).toMatchObject({ type: 'error', segment: 'chunks' });
  });

  it('the round summary keeps the hunting letters from the start of the round', () => {
    const p = newProfile();
    p.testPerKey = Array(10).fill(150);
    p.letters.q = { pauses: Array(10).fill(900), knownStreak: 0 };
    const r = roundOf(p);
    typeCurrent(r, 0);
    p.letters.q.pauses = Array(10).fill(150);
    const s = r.finish()!;
    expect(s.huntLettersAtStart).toEqual(['q']);
    expect(s.huntLetters).toEqual([]);
  });
});

describe('set challenge (M2b)', () => {
  const set = TRACK_ITEMS.chunks.slice(0, 10).map((i) => i.key);

  it('only uses the set, runs 45 s, and is not stored as a round', () => {
    const p = newProfile();
    const r = new Round(p, { minutes: 7, now: 0, rng: seeded(3), segments: planChallenge(set) });
    expect(r.limitMs).toBe(45_000);
    const texts = new Set(TRACK_ITEMS.chunks.slice(0, 10).map((i) => i.text));
    let t = 0;
    for (let i = 0; i < 500 && !r.isFinished; i++) {
      expect(texts.has(r.view(t).text)).toBe(true);
      t = typeCurrent(r, t, { start: 200, gap: 120 });
      r.tick(t);
    }
    const s = r.finish()!;
    expect(s.kind).toBe('challenge');
    expect(p.rounds).toEqual([]);
  });

  const runChallenge = (p: Profile, seed: number) => {
    const r = new Round(p, { minutes: 7, now: 0, rng: seeded(seed), segments: planChallenge(set) });
    let t = 0;
    for (let i = 0; i < 200 && !r.isFinished; i++) t = typeCurrent(r, t, { start: 200, gap: 120 });
    r.finish();
    return r;
  };

  it('two challenges alone never master an item', () => {
    const p = newProfile();
    const k = set[0];
    const ids = [runChallenge(p, 5).id, runChallenge(p, 6).id];
    expect(ids.every((id) => id.startsWith(CHALLENGE_ID_PREFIX))).toBe(true);
    expect(p.items[k].mastered).toBe(false);
    expect(p.items[k].smoothRounds).toEqual(ids);
  });

  it('a normal round then a challenge masters an item', () => {
    const p = newProfile();
    const k = set[0];
    p.items[k] = { history: [], seen: 3, smoothRounds: ['r-normal'], mastered: false, weak: false };
    runChallenge(p, 5);
    expect(p.items[k].mastered).toBe(true);
  });

  it('a challenge then a normal round masters an item', () => {
    const p = newProfile();
    for (const it of [...TRACK_ITEMS.chunks, ...TRACK_ITEMS.words])
      p.items[it.key] = { history: [], seen: 1, smoothRounds: [`${CHALLENGE_ID_PREFIX}x`], mastered: false, weak: false };
    const r = roundOf(p);
    let t = 0;
    for (let i = 0; i < 6; i++) t = typeCurrent(r, t);
    const counted = Object.entries(p.items).filter(([, rec]) => rec.smoothRounds.includes(r.id));
    expect(counted.length).toBeGreaterThan(0);
    for (const [key, rec] of counted) expect(rec.mastered, key).toBe(true);
  });

  it('a miss in a challenge still clears mastered and marks weak', () => {
    const p = newProfile();
    const k = set[0];
    p.items[k] = { history: [], seen: 3, smoothRounds: ['a', 'b'], mastered: true, weak: false };
    const r = new Round(p, { minutes: 7, now: 0, rng: seeded(9), segments: planChallenge(set) });
    let t = 0;
    while (r.view(t).text !== ITEM_TEXT(k)) t = typeCurrent(r, t, { start: 200, gap: 120 });
    typeCurrent(r, t, { wrong: true });
    expect(p.items[k].mastered).toBe(false);
    expect(p.items[k].weak).toBe(true);
    expect(p.items[k].smoothRounds).toEqual([]);
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
    expect(p.testPerKey.length).toBeGreaterThan(0);
    expect(Object.keys(p.letters).length).toBeGreaterThan(0);
  });

  it('keeps test data out of the slow baseline, so the first round only builds it', () => {
    const p = newProfile();
    const run = new TestRun(1, seeded(6));
    let t = 0;
    while (!run.tick(t)) {
      run.key(run.expected, t);
      t += 100;
    }
    saveTest(p, run);
    expect(p.baseline.start).toEqual([]);
    expect(p.baseline.perKey).toEqual([]);
    const r = roundOf(p);
    t = 0;
    for (let i = 0; i < CONFIG.baselineMinChunks; i++) t = typeCurrent(r, t, { start: 2000, gap: 400 });
    expect(r.results.every((x) => x.outcome === 'smooth')).toBe(true);
  });

  it('can still find hunting letters from a first test', () => {
    const p = newProfile();
    p.testPerKey = Array(30).fill(200);
    p.letters.q = { pauses: Array(5).fill(900), knownStreak: 0 };
    expect(huntLetters(p)).toEqual(['q']);
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
    // fewer than 6 tests: latest compared with the first
    expect(chartHeadline(s)).toEqual({ kind: 'up', wpm: 12 });
  });

  it('compares the latest with the first below 6 tests, and 3-test averages from 6 on', () => {
    expect(chartHeadline(chartSeries([mk('2026-10-01', 1, 10), mk('2026-10-03', 1, 15)], 1))).toEqual({ kind: 'up', wpm: 5 });
    expect(chartHeadline(chartSeries([mk('2026-10-01', 1, 12), mk('2026-10-03', 1, 15), mk('2026-10-05', 1, 12)], 1))).toEqual({ kind: 'best', best: 15 });
    const six = [10, 20, 12, 14, 13, 13].map((w, i) => mk(`2026-10-0${i + 1}`, 1, w));
    // last 3 average 13.33 vs first 3 average 14: not up, even though the latest beats the first
    expect(chartHeadline(chartSeries(six, 1))).toEqual({ kind: 'best', best: 20 });
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

describe('the strip: chunks ahead keep their ids', () => {
  it('shows 8 chunks ahead; each step drops the first and adds one at the end', () => {
    const p = newProfile();
    const r = roundOf(p, { seed: 3 });
    let t = 0;
    let v = r.view(t);
    expect(v.next).toHaveLength(CONFIG.aheadChunks);
    for (let i = 0; i < 20; i++) {
      const before = v;
      t = typeCurrent(r, t);
      v = r.view(t);
      expect(v.id).toBe(before.next[0].id);
      expect(v.text).toBe(before.next[0].text);
      expect(v.next.slice(0, -1)).toEqual(before.next.slice(1));
      expect(v.done.map((d) => d.id).at(-1)).toBe(before.id);
    }
    expect(v.done).toHaveLength(20);
    const ids = [...v.done.map((d) => d.id), v.id, ...v.next.map((n) => n.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('shows only 3 ahead in the Keys warm-up', () => {
    const p = newProfile();
    const r = roundOf(p, { segments: [{ kind: 'keys', ms: 60_000 }] });
    expect(r.view(0).next).toHaveLength(CONFIG.aheadChunksKeys);
  });

  it('a repair keeps the chunk id; the done list starts over in a new segment', () => {
    const p = newProfile();
    const r = roundOf(p, { segments: [{ kind: 'chunks', ms: 3000 }, { kind: 'chunks', ms: 60_000 }] });
    const id = r.view(0).id;
    let t = typeCurrent(r, 0, { wrong: true });
    expect(r.view(t).repair).not.toBeNull();
    expect(r.view(t).id).toBe(id);
    for (let i = 0; i < 3; i++) t = typeCurrent(r, t);
    expect(r.view(t).repair).toBeNull();
    expect(r.view(t).done.map((d) => d.id)).toEqual([id]);
    for (let i = 0; i < 20 && r.view(t).segIndex === 0; i++) t = typeCurrent(r, t);
    t += CONFIG.segmentBreakMs;
    expect(r.view(t).segIndex).toBe(1);
    expect(r.view(t).done).toEqual([]);
  });
});

describe('⚡ no-stop start', () => {
  const judged = (p: Profile, starts: number[], opts: { segments?: Segment[] } = {}) => {
    const events: ChunkEvent[] = [];
    const r = roundOf(p, { events, segments: opts.segments });
    let t = 0;
    for (const start of starts) t = typeCurrent(r, t, { start, gap: 150 });
    return { r, t, handoffs: events.filter((e) => e.type === 'smooth').map((e) => (e as { handoff: boolean | null }).handoff) };
  };

  it('is null until the baseline exists', () => {
    expect(judged(newProfile(), [200, 200]).handoffs).toEqual([null, null]);
  });

  it('1.4 x ms per key is a ⚡, 1.6 x is not; the first chunk of a segment is never judged', () => {
    const p = withBaseline(newProfile());
    const { r, handoffs } = judged(p, [210, 210, 240]);
    expect(handoffs).toEqual([null, true, false]);
    const s = r.finish()!;
    expect(s).toMatchObject({ handoffs: 1, handoffJudged: 2 });
    expect(p.handoff.chunks).toEqual([true, false]);
    expect(p.handoff.flow).toEqual([]);
  });

  it('is not judged after a repair, after a pause, in the Keys warm-up, or on a missed or slow chunk', () => {
    const p = withBaseline(newProfile());
    const events: ChunkEvent[] = [];
    const r = roundOf(p, { events });
    let t = typeCurrent(r, 0, { start: 210 });
    t = typeCurrent(r, t, { start: 210, wrong: true });
    for (let i = 0; i < 3; i++) t = typeCurrent(r, t, { start: 210 });
    t = typeCurrent(r, t, { start: 210 }); // first after the repair
    t = typeCurrent(r, t, { start: 210 }); // judged again
    r.pause(t);
    r.resume(t + 5000);
    t = typeCurrent(r, t + 5000, { start: 210 }); // first after the pause
    t = typeCurrent(r, t, { start: 800 }); // slow
    const main = events.filter((e) => e.type === 'smooth' || e.type === 'slow' || e.type === 'error') as { type: string; handoff: boolean | null }[];
    expect(main.map((e) => [e.type, e.handoff])).toEqual([
      ['smooth', null],
      ['error', null],
      ['smooth', null],
      ['smooth', true],
      ['smooth', null],
      ['slow', null],
    ]);
    expect(judged(withBaseline(newProfile()), [210, 210], { segments: [{ kind: 'keys', ms: 60_000 }] }).handoffs).toEqual([null, null]);
  });

  it('keeps the last handoffWindow judgments per kind', () => {
    const p = withBaseline(newProfile());
    judged(p, Array(CONFIG.handoffWindow + 10).fill(210));
    expect(p.handoff.chunks).toHaveLength(CONFIG.handoffWindow);
  });
});

describe('next-chunk cue', () => {
  const withRate = (rate: number, n = 100) => {
    const p = newProfile();
    p.handoff.chunks = Array.from({ length: n }, (_, i) => i < rate * n);
    return p;
  };

  it('strong under 50% or with fewer than 30 judgments, soft under 70%, off above', () => {
    const cueAfterFirstKey = (p: Profile) => {
      const r = roundOf(p);
      const v = r.view(0);
      expect(r.view(0).cue).toBeNull();
      r.key(v.text[0], 300);
      return r.view(300).cue;
    };
    expect(cueAfterFirstKey(withRate(0.4))).toBe('strong');
    expect(cueAfterFirstKey(withRate(0.6))).toBe('soft');
    expect(cueAfterFirstKey(withRate(0.8))).toBeNull();
    expect(cueAfterFirstKey(withRate(0.9, 29))).toBe('strong');
  });

  it('never shows in the Keys warm-up or a repair, and not when the chunk has a hunting letter', () => {
    const keys = roundOf(newProfile(), { segments: [{ kind: 'keys', ms: 60_000 }] });
    keys.key(keys.view(0).text[0], 300);
    expect(keys.view(300).cue).toBeNull();

    const r = roundOf(newProfile());
    const t = typeCurrent(r, 0, { wrong: true });
    r.key(r.view(t).text[0], t + 300);
    expect(r.view(t + 300).repair).not.toBeNull();
    expect(r.view(t + 300).cue).toBeNull();

    const p = newProfile();
    p.testPerKey = Array(10).fill(150);
    for (const l of 'abcdefghijklmnopqrstuvwxyz') p.letters[l] = { pauses: Array(10).fill(900), knownStreak: 0 };
    const h = roundOf(p);
    h.key(h.view(0).text[0], 300);
    expect(h.view(300).cue).toBeNull();
  });

  it('keeps its strength for the whole segment', () => {
    const p = withRate(0.4);
    const r = roundOf(p);
    p.handoff.chunks = Array(100).fill(true);
    const t = typeCurrent(r, 0);
    r.key(r.view(t).text[0], t + 300);
    expect(r.view(t + 300).cue).toBe('strong');
  });
});

describe('the on-screen keyboard steps away', () => {
  const withKnown = (n: number) => {
    const p = newProfile();
    p.testPerKey = Array(10).fill(200);
    for (const l of 'abcdefghijklmnopqrstuvwxyz'.slice(0, n)) p.letters[l] = { pauses: Array(10).fill(100), knownStreak: 2 };
    return p;
  };
  it('letters, then colours only at half the letters known, then tucked away at 75%', () => {
    expect(keyboardLevel(withKnown(11))).toBe('labels'); // 0.42
    expect(keyboardLevel(withKnown(16))).toBe('blank'); // 0.62
    expect(keyboardLevel(withKnown(21))).toBe('tucked'); // 0.81
  });
});

describe('catch the star (Keys warm-up)', () => {
  const keysOnly: Segment[] = [{ kind: 'keys', ms: 120_000 }];
  /** Keep typing (one correct key every 400 ms) and tick every 100 ms; calls `each` after every tick. */
  const run = (r: Round, from: number, to: number, each?: (t: number) => boolean | void) => {
    let t = from;
    while (t < to) {
      t += 100;
      if (t % 400 === 0) r.key(r.view(t).expected, t);
      r.tick(t);
      if (each?.(t)) break;
    }
    return t;
  };
  const active = (r: Round, t: number) => r.view(t).activeMs;

  it('the first star comes 8 s in, shows 1.6 s, and the next comes 15 to 30 s later', () => {
    const events: ChunkEvent[] = [];
    const r = roundOf(newProfile(), { segments: keysOnly, events });
    const shows: { at: number; star: boolean }[] = [];
    run(r, 0, 70_000, (t) => void shows.push({ at: active(r, t), star: !!r.view(t).star }));
    const starts = shows.filter((s, i) => s.star && !shows[i - 1]?.star).map((s) => s.at);
    const ends = shows.filter((s, i) => !s.star && shows[i - 1]?.star).map((s) => s.at);
    expect(starts[0]).toBeGreaterThanOrEqual(CONFIG.starFirstMs);
    expect(starts[0]).toBeLessThan(CONFIG.starFirstMs + 200);
    expect(ends[0] - starts[0]).toBeGreaterThanOrEqual(CONFIG.starShowMs);
    expect(ends[0] - starts[0]).toBeLessThan(CONFIG.starShowMs + 200);
    expect(starts[1] - ends[0]).toBeGreaterThanOrEqual(CONFIG.starEveryMs[0]);
    expect(starts[1] - ends[0]).toBeLessThanOrEqual(CONFIG.starEveryMs[1] + 200);
    expect(events.filter((e) => e.type === 'star')).toEqual(ends.map(() => ({ type: 'star', caught: false })));
  });

  it('never shows outside the Keys warm-up', () => {
    const r = roundOf(newProfile());
    let seen = false;
    run(r, 0, 60_000, (t) => void (seen ||= !!r.view(t).star));
    expect(seen).toBe(false);
  });

  it('Enter catches a showing star; with no star it does nothing and is not a key', () => {
    const events: ChunkEvent[] = [];
    const r = roundOf(newProfile(), { segments: keysOnly, events });
    const before = r.view(100);
    expect(r.catchStar(100)).toBe(false);
    expect(r.view(100).pos).toBe(before.pos);
    expect(r.view(100).errorTick).toBe(before.errorTick);
    const t = run(r, 100, 20_000, (t) => !!r.view(t).star);
    expect(r.catchStar(t)).toBe(true);
    expect(r.view(t).star).toBeNull();
    expect(events.filter((e) => e.type === 'star')).toEqual([{ type: 'star', caught: true }]);
    const s = r.finish()!;
    expect(s).toMatchObject({ starsShown: 1, starsCaught: 1 });
  });

  it('no stars while paused', () => {
    const r = roundOf(newProfile(), { segments: keysOnly });
    const t = run(r, 0, 20_000, (t) => !!r.view(t).star);
    r.pause(t);
    expect(r.view(t).star).toBeNull();
    expect(r.catchStar(t)).toBe(false);
  });

  it('after two stars in a row fly away, a reminder shows for 3 s', () => {
    const r = roundOf(newProfile(), { segments: keysOnly });
    let warnFrom: number | null = null;
    let warnTo: number | null = null;
    run(r, 0, 120_000, (t) => {
      const w = r.view(t).starWarn;
      if (w && warnFrom === null) warnFrom = active(r, t);
      if (!w && warnFrom !== null && warnTo === null) warnTo = active(r, t);
    });
    expect(warnFrom).not.toBeNull();
    expect(warnTo! - warnFrom!).toBeGreaterThanOrEqual(CONFIG.starWarnMs - 100);
    expect(warnTo! - warnFrom!).toBeLessThan(CONFIG.starWarnMs + 200);
  });

  it('turns off after 3 rounds in a row with 3+ stars, each caught 90% or more', () => {
    const p = newProfile();
    expect(recordStars(p, 2, 2)).toBe(false); // too few stars: not counted
    expect(recordStars(p, 5, 5)).toBe(false);
    expect(recordStars(p, 10, 9)).toBe(false);
    expect(recordStars(p, 4, 3)).toBe(false); // 75% breaks the run
    expect(recordStars(p, 3, 3)).toBe(false);
    expect(recordStars(p, 5, 5)).toBe(false);
    expect(p.stars.off).toBe(false);
    expect(recordStars(p, 10, 9)).toBe(true);
    expect(p.stars.off).toBe(true);
    const r = roundOf(p, { segments: keysOnly });
    let seen = false;
    run(r, 0, 30_000, (t) => void (seen ||= !!r.view(t).star));
    expect(seen).toBe(false);
  });
});

describe('first-run cards', () => {
  it('a new profile has not seen them', () => {
    expect(newProfile().seenBasics).toBe(false);
  });
});
