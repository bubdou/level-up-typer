import { describe, expect, it } from 'vitest';
import type { ChunkEvent, JudgeMode, Profile, RoundSummary } from '../engine';
import { ALL_ITEMS, Round, TRACK_ITEMS, newProfile } from '../engine';
import {
  GAME_CONFIG,
  RoundScorer,
  applyHeadStart,
  collection,
  collectionTotal,
  daysThisWeek,
  finishRound,
  levelOf,
  levelStart,
  masteredCount,
  newGameState,
  syncEverMastered,
  unlocksBetween,
  weekKey,
  weekStreak,
} from './index';

type OutcomeType = 'smooth' | 'slow' | 'error';
const ev = (
  type: OutcomeType,
  o: { segment?: JudgeMode; start?: number | null; median?: number | null; text?: string } = {},
): ChunkEvent => {
  const start = o.start === undefined ? 400 : o.start;
  const medianStart = o.median === undefined ? null : o.median;
  return {
    type,
    text: o.text ?? 'the',
    itemKey: null,
    segment: o.segment ?? 'chunks',
    start,
    medianStart,
    quickStart: start === null || medianStart === null ? null : start < medianStart,
  };
};
const fixed: ChunkEvent = { type: 'fixed', text: 'the', itemKey: null, segment: 'chunks' };
const mastered = (text = 'the'): ChunkEvent => ({ type: 'mastered', text, itemKey: `short:${text}` });

const L = (n: number) => levelStart(n);
const feed = (s: RoundScorer, events: ChunkEvent[]) => events.forEach((e) => s.onEvent(e));
const times = <T,>(n: number, x: T) => Array.from({ length: n }, () => x);

function summaryOf(over: Partial<RoundSummary> = {}): RoundSummary {
  return {
    id: over.id ?? 'r1',
    date: over.date ?? '2026-10-21T10:00:00.000Z',
    minutes: 7,
    segments: ['chunks', 'flow'],
    chunks: 50,
    medStart: 500,
    medPerKey: 200,
    cleanRate: 90,
    fixed: [],
    huntLetters: [],
    huntLettersAtStart: [],
    slowChunks: [],
    flowMedStart: null,
    repairs: 0,
    ...over,
  };
}

describe('XP for each event', () => {
  it('matches the table: smooth 10, clean but slow 5, error 0, fixed 15, mastered 20', () => {
    const s = new RoundScorer(0);
    feed(s, [ev('smooth'), ev('slow'), ev('error'), fixed, mastered()]);
    expect(s.xp).toMatchObject({ smooth: 10, slowClean: 5, fixed: 15, mastered: 20, comboBonus: 0 });
    expect(s.gained).toBe(50);
  });

  it('gives nothing for repair tries: only the fixed event scores, once', () => {
    // The engine sends no events for repair tries, only "fixed" when the bay is left.
    const s = new RoundScorer(0);
    feed(s, [ev('error'), fixed]);
    expect(s.gained).toBe(15);
  });

  it('a chunk missed on purpose and fixed earns less than typing it smoothly', () => {
    const cheat = new RoundScorer(L(2));
    feed(cheat, [ev('error'), fixed]);
    const honest = new RoundScorer(L(2));
    feed(honest, times(4, ev('smooth')));
    expect(cheat.gained).toBeLessThan(honest.gained);
  });
});

describe('single letters earn about half', () => {
  const letter = (type: OutcomeType) => ev(type, { segment: 'keys', text: 'q' });
  const fixedLetter: ChunkEvent = { type: 'fixed', text: 'q', itemKey: null, segment: 'keys' };

  it('smooth letter 5, fixed letter 10, a 2-letter chunk still 10', () => {
    const s = new RoundScorer(0);
    s.onEvent(letter('smooth'));
    expect(s.take().xp).toBe(5);
    s.onEvent(fixedLetter);
    expect(s.take().xp).toBe(10);
    expect(s.lastFixedXp).toBe(10);
    s.onEvent(ev('smooth', { text: 'th' }));
    expect(s.take().xp).toBe(10);
    expect(s.counts).toMatchObject({ letters: 1, fixedLetters: 1, smooth: 1, fixed: 0 });
    expect(s.xp).toMatchObject({ letters: 5, fixedLetters: 10, smooth: 10 });
  });

  it('the word "a" outside the warm-up is a whole word: 10, Spark and 15 for Fixed', () => {
    const s = new RoundScorer(L(3));
    s.onEvent(ev('smooth', { segment: 'chunks', text: 'a', start: 200, median: 500 }));
    expect(s.take().xp).toBe(15);
    s.onEvent(ev('smooth', { segment: 'flow', text: 'a' }));
    expect(s.take().xp).toBe(10);
    s.onEvent({ type: 'fixed', text: 'a', itemKey: null, segment: 'chunks' });
    expect(s.take().xp).toBe(15);
    expect(s.counts).toMatchObject({ letters: 0, fixedLetters: 0, smooth: 2, quick: 1, fixed: 1 });
  });

  it('letters count toward Combo and their 5 is doubled', () => {
    const s = new RoundScorer(L(2));
    for (let i = 0; i < 10; i++) s.onEvent(letter('smooth'));
    s.take();
    s.onEvent(letter('smooth'));
    expect(s.take().xp).toBe(10);
  });

  it('the round total adds up across letters and chunks', () => {
    const g = newGameState();
    const s = new RoundScorer(0);
    feed(s, [letter('smooth'), letter('smooth'), fixedLetter, ev('smooth'), fixed]);
    const p = finishRound(g, newProfile(), summaryOf({ minutes: 1 }), s, Date.parse('2026-10-21T10:00:00Z'));
    expect(p.total).toBe(5 + 5 + 10 + 10 + 15);
    expect(g.xp).toBe(p.total);
  });
});

describe('levels', () => {
  it('500 XP to level 2, 1,250 to 3, 13,500 to 10', () => {
    expect(levelStart(2)).toBe(500);
    expect(levelStart(3)).toBe(1250);
    expect(levelStart(10)).toBe(13_500);
    expect(levelOf(499)).toBe(1);
    expect(levelOf(500)).toBe(2);
    expect(levelOf(1249)).toBe(2);
    expect(levelOf(1250)).toBe(3);
    expect(levelOf(13_500)).toBe(10);
    expect([4, 5, 6, 7, 9, 11].map(levelStart)).toEqual([2250, 3500, 5000, 6750, 11_000, 16_250]);
  });

  it('power-ups unlock at 2 to 6 and looks at 7, 9, 11', () => {
    expect(unlocksBetween(1, 11).map((u) => `${u.level}:${u.id}`)).toEqual([
      '2:combo',
      '3:spark',
      '4:keyFinder',
      '5:flowChain',
      '6:shield',
      '7:ocean',
      '9:forest',
      '11:night',
    ]);
  });

  it('a level-up in the middle of a round shows a bubble with what it unlocks', () => {
    const s = new RoundScorer(L(3) - 5);
    s.onEvent(ev('smooth'));
    const f = s.take();
    expect(f.bubbles).toEqual([{ kind: 'level', level: 3, unlocks: [{ kind: 'powerUp', id: 'spark', level: 3 }] }]);
    expect(s.take().bubbles).toEqual([]);
  });
});

describe('Combo', () => {
  it('doubles smooth points after the 10th clean chunk in a row, slow ones count toward it', () => {
    const s = new RoundScorer(L(2));
    feed(s, [...times(9, ev('smooth')), ev('slow')]);
    expect(s.combo).toBe(10);
    expect(s.hot).toBe(true);
    expect(s.xp.comboBonus).toBe(0);
    expect(s.take().bubbles).toContainEqual({ kind: 'combo' });
    s.onEvent(ev('smooth'));
    expect(s.take().xp).toBe(20);
    expect(s.xp.comboBonus).toBe(10);
  });

  it('does not double fixed, mastered or clean-but-slow', () => {
    const s = new RoundScorer(L(2));
    feed(s, times(10, ev('smooth')));
    s.take();
    feed(s, [fixed, mastered(), ev('slow')]);
    expect(s.take().xp).toBe(15 + 20 + 5);
  });

  it('one wrong key clears it; repair tries send nothing so they neither count nor clear', () => {
    const s = new RoundScorer(L(2));
    feed(s, times(12, ev('smooth')));
    s.onEvent(ev('error'));
    expect(s.combo).toBe(0);
    expect(s.hot).toBe(false);
    s.onEvent(fixed);
    expect(s.combo).toBe(0);
  });

  it('does nothing below level 2', () => {
    const s = new RoundScorer(0);
    feed(s, times(12, ev('smooth')));
    expect(s.combo).toBe(0);
    expect(s.xp.comboBonus).toBe(0);
  });
});

describe('Shield', () => {
  it('keeps the Combo once a round; the chunk still scores 0', () => {
    const s = new RoundScorer(L(6));
    feed(s, times(10, ev('smooth')));
    const before = s.gained;
    s.onEvent(ev('error'));
    expect(s.gained).toBe(before);
    expect(s.combo).toBe(10);
    expect(s.shieldUsed).toBe(true);
    expect(s.take().bubbles).toContainEqual({ kind: 'shield' });
    s.onEvent(ev('error'));
    expect(s.combo).toBe(0);
  });

  it('is not spent when there is no Combo to keep', () => {
    const s = new RoundScorer(L(6));
    s.onEvent(ev('error'));
    expect(s.shieldUsed).toBe(false);
  });
});

describe('Spark and Flow Chain use the personal baseline only', () => {
  it('Spark: +5 when the start is below the median, nothing before the baseline exists', () => {
    const s = new RoundScorer(L(3));
    s.onEvent(ev('smooth', { start: 300, median: null }));
    expect(s.xp.quick).toBe(0);
    s.onEvent(ev('smooth', { start: 300, median: 500 }));
    expect(s.xp.quick).toBe(5);
    s.onEvent(ev('smooth', { start: 500, median: 500 }));
    expect(s.xp.quick).toBe(5);
    s.onEvent(ev('smooth', { start: 100, median: 500, segment: 'keys' }));
    expect(s.xp.quick).toBe(5);
  });

  it('Spark is doubled by Combo', () => {
    const s = new RoundScorer(L(3));
    feed(s, times(10, ev('smooth')));
    s.take();
    s.onEvent(ev('smooth', { start: 300, median: 500 }));
    expect(s.take().xp).toBe(30);
  });

  it('Flow Chain: +10 per 5 clean Flow words that start no slower than usual, then counts again', () => {
    const s = new RoundScorer(L(5));
    const quick = ev('smooth', { segment: 'flow', start: 500, median: 500 });
    feed(s, times(4, quick));
    s.onEvent(ev('smooth', { segment: 'flow', start: 900, median: 500 }));
    feed(s, times(4, quick));
    expect(s.xp.flowChain).toBe(0);
    s.onEvent(quick);
    expect(s.xp.flowChain).toBe(10);
    feed(s, times(4, quick));
    expect(s.xp.flowChain).toBe(10);
    s.onEvent(quick);
    expect(s.xp.flowChain).toBe(20);
  });

  it('Flow Chain ignores chunks outside Flow and gives nothing before the baseline', () => {
    const s = new RoundScorer(L(5));
    feed(s, times(10, ev('smooth', { segment: 'chunks', start: 100, median: 500 })));
    feed(s, times(10, ev('smooth', { segment: 'flow', start: 100, median: null })));
    expect(s.xp.flowChain).toBe(0);
  });

  it('Flow Chain is broken by a wrong key', () => {
    const s = new RoundScorer(L(5));
    const quick = ev('smooth', { segment: 'flow', start: 400, median: 500 });
    feed(s, [...times(4, quick), ev('error', { segment: 'flow' }), ...times(4, quick)]);
    expect(s.xp.flowChain).toBe(0);
  });
});

describe('Key Finder', () => {
  const profile = newProfile();
  it('pays for letters hunted at the start and not at the end, not again within 7 days', () => {
    const g = newGameState();
    g.xp = L(4);
    const now = Date.parse('2026-10-21T10:00:00Z');
    const s1 = summaryOf({ huntLettersAtStart: ['q', 'z', 'x'], huntLetters: ['z', 'j'] });
    const p1 = finishRound(g, profile, s1, new RoundScorer(g.xp), now);
    expect(p1.keysFound).toEqual(['q', 'x']);
    expect(p1.xp.keyFinder).toBe(100);

    const s2 = summaryOf({ id: 'r2', huntLettersAtStart: ['q'], huntLetters: [] });
    expect(finishRound(g, profile, s2, new RoundScorer(g.xp), now + 6 * 86_400_000).keysFound).toEqual([]);
    const s3 = summaryOf({ id: 'r3', huntLettersAtStart: ['q'], huntLetters: [] });
    expect(finishRound(g, profile, s3, new RoundScorer(g.xp), now + 7 * 86_400_000).keysFound).toEqual(['q']);
  });

  it('does nothing below level 4 or for rounds from before M2', () => {
    const g = newGameState();
    g.xp = L(4) - 1;
    const now = Date.parse('2026-10-21T10:00:00Z');
    expect(finishRound(g, profile, summaryOf({ huntLettersAtStart: ['q'] }), new RoundScorer(g.xp), now).keysFound).toEqual([]);
    g.xp = L(5);
    expect(finishRound(g, profile, summaryOf({ id: 'r2', huntLettersAtStart: undefined }), new RoundScorer(g.xp), now).keysFound).toEqual([]);
  });
});

describe('week goal', () => {
  const at = (iso: string) => new Date(iso).getTime();
  // Local times, so the tests hold in any time zone. 2026-10-19 is a Monday.
  const day = (d: number, h = 10) => new Date(2026, 9, d, h).toISOString();

  function play(g: ReturnType<typeof newGameState>, p: Profile, iso: string, minutes = 7) {
    const s = summaryOf({ id: `r${p.rounds.length}`, date: iso, minutes });
    p.rounds.push(s);
    return finishRound(g, p, s, new RoundScorer(g.xp), at(iso));
  }

  it('4 days with a round of 5 min or more pays 200 XP once a week', () => {
    const g = newGameState();
    const p = newProfile();
    expect(play(g, p, day(19)).xp.weekGoal).toBe(0);
    expect(play(g, p, day(19, 15)).xp.weekGoal).toBe(0); // same day again
    expect(play(g, p, day(20, 10), 4.9).xp.weekGoal).toBe(0); // too short
    expect(play(g, p, day(21)).xp.weekGoal).toBe(0);
    expect(play(g, p, day(22)).xp.weekGoal).toBe(0);
    expect(daysThisWeek(p.rounds, at(day(22)))).toBe(3);
    expect(play(g, p, day(24)).xp.weekGoal).toBe(200);
    expect(play(g, p, day(25)).xp.weekGoal).toBe(0);
    expect(g.weekGoalsPaid).toEqual([weekKey(at(day(24)))]);
  });

  it('a new week starts on Monday', () => {
    const g = newGameState();
    const p = newProfile();
    for (const d of [23, 24, 25]) play(g, p, day(d));
    expect(play(g, p, day(26)).xp.weekGoal).toBe(0); // Monday of the next week
    expect(daysThisWeek(p.rounds, at(day(26)))).toBe(1);
    expect(weekKey(at(day(25, 23)))).toBe('2026-10-19');
    expect(weekKey(at(day(26, 0)))).toBe('2026-10-26');
  });

  it('tests never count and never give XP', () => {
    const g = newGameState();
    const p = newProfile();
    p.tests.push({ id: 't1', date: day(19), minutes: 1, wpm: 20, accuracy: 95, correctChars: 100, keystrokes: 105, wrongKeys: 5, errorsByKey: {} });
    expect(daysThisWeek(p.rounds, at(day(19)))).toBe(0);
    expect(g.xp).toBe(0);
  });

  it('the goal can be set to 3 days', () => {
    const g = newGameState();
    g.settings.weekGoalDays = 3;
    const p = newProfile();
    play(g, p, day(19));
    play(g, p, day(20));
    expect(play(g, p, day(21)).xp.weekGoal).toBe(200);
  });

  it('counts weeks in a row', () => {
    const g = newGameState();
    g.weekGoalsPaid = ['2026-10-05', '2026-10-12'];
    expect(weekStreak(g, at(day(21)))).toBe(2);
    g.weekGoalsPaid.push('2026-10-19');
    expect(weekStreak(g, at(day(21)))).toBe(3);
    g.weekGoalsPaid = ['2026-10-05'];
    expect(weekStreak(g, at(day(21)))).toBe(0);
  });
});

const rec = (mastered: boolean) => ({ history: [], seen: 2, smoothRounds: mastered ? ['a', 'b'] : ['a'], mastered, weak: false });

describe('Collection', () => {
  it('has 476 dots, filled from what the engine marks mastered', () => {
    expect(collectionTotal).toBe(476);
    const p = newProfile();
    const g = newGameState();
    expect(masteredCount(g)).toBe(0);
    for (const i of ALL_ITEMS.slice(0, 7)) p.items[i.key] = rec(true);
    p.items[ALL_ITEMS[8].key] = rec(false);
    expect(syncEverMastered(g, p)).toBe(7);
    expect(masteredCount(g)).toBe(7);
    const zones = collection(p, g);
    expect(zones.reduce((a, z) => a + z.mastered, 0)).toBe(7);
    expect(zones.reduce((a, z) => a + z.total, 0)).toBe(476);
    expect(zones.map((z) => z.total)).toEqual([30, 35, 132, 179, 60, 40]);
  });

  it('sets are the engine batches, open as far as the engine unlocked', () => {
    const p = newProfile();
    p.unlocked = { chunks: 2, words: 1, flow: 1 };
    const sets = collection(p, newGameState()).flatMap((z) => z.sets);
    const bTrack = (t: string) => sets.filter((s) => s.track === t);
    expect(bTrack('chunks').length).toBe(Math.ceil(TRACK_ITEMS.chunks.length / 10));
    expect(bTrack('chunks').filter((s) => s.open).length).toBe(2);
    expect(bTrack('words').filter((s) => s.open).length).toBe(1);
    expect(sets.flatMap((s) => s.items).length).toBe(476);
    expect(sets.find((s) => !s.open)!.items.every((i) => i.state === 'locked')).toBe(true);
  });

  it('a set across two stages sits in the stage with most of it', () => {
    // chunks track: 30 pairs then 35 short chunks, so batch 3 (items 30-39) is all short chunks;
    // words track: 132 common words, so batch 13 (130-139) has 2 common and 8 more words.
    const zones = collection(newProfile(), newGameState());
    const more = zones.find((z) => z.stage === 'more')!;
    expect(more.sets.some((s) => s.track === 'words' && s.index === 13)).toBe(true);
  });
});

describe('dots never go down', () => {
  const now = Date.parse('2026-10-21T10:00:00Z');
  const key = ALL_ITEMS[0].key;
  const text = ALL_ITEMS[0].text;
  const m: ChunkEvent = { type: 'mastered', text, itemKey: key };

  it('an item the engine un-masters after a miss stays counted, with a practice-again ring', () => {
    const p = newProfile();
    const g = newGameState();
    p.items[key] = rec(true);
    const s1 = new RoundScorer(g.xp, g.everMastered);
    s1.onEvent(m);
    finishRound(g, p, summaryOf({ id: 'a' }), s1, now);
    expect(masteredCount(g)).toBe(1);
    // a later miss: the engine clears mastered
    p.items[key] = rec(false);
    const s2 = new RoundScorer(g.xp, g.everMastered);
    s2.onEvent(ev('error', { text }));
    finishRound(g, p, summaryOf({ id: 'b' }), s2, now);
    expect(masteredCount(g)).toBe(1);
    const item = collection(p, g).flatMap((z) => z.sets).flatMap((st) => st.items).find((i) => i.key === key)!;
    expect(item).toMatchObject({ state: 'mastered', again: true });
  });

  it('mastering it again removes the ring and gives no second +20', () => {
    const p = newProfile();
    const g = newGameState();
    g.everMastered = [key];
    p.items[key] = rec(true);
    const s = new RoundScorer(g.xp, g.everMastered);
    s.onEvent(m);
    expect(s.xp.mastered).toBe(0);
    expect(s.take().mastered).toBe(false);
    const pts = finishRound(g, p, summaryOf(), s, now);
    expect(pts.newlyMastered).toEqual([]);
    const item = collection(p, g).flatMap((z) => z.sets).flatMap((st) => st.items).find((i) => i.key === key)!;
    expect(item).toMatchObject({ state: 'mastered', again: false });
  });

  it('the same item mastered twice in one round pays once', () => {
    const s = new RoundScorer(0);
    s.onEvent(m);
    s.onEvent(m);
    expect(s.xp.mastered).toBe(20);
  });

  it('an old profile seeds the list from the engine once and keeps it', () => {
    const p = newProfile();
    for (const i of ALL_ITEMS.slice(0, 3)) p.items[i.key] = rec(true);
    const g = newGameState();
    expect(syncEverMastered(g, p)).toBe(3);
    expect(syncEverMastered(g, p)).toBe(0);
    expect(g.xp).toBe(0);
  });
});

describe('head start and old profiles', () => {
  it('gives 300 XP for each round played before M2, only once', () => {
    const p = newProfile();
    p.rounds.push(summaryOf({ id: 'a' }), summaryOf({ id: 'b' }), summaryOf({ id: 'c' }));
    const g = newGameState();
    expect(applyHeadStart(g, p, Date.now())).toBe(900);
    expect(g.xp).toBe(900);
    expect(applyHeadStart(g, p, Date.now())).toBe(0);
    expect(g.xp).toBe(900);
  });

  it('a new player gets none', () => {
    const g = newGameState();
    expect(applyHeadStart(g, newProfile(), Date.now())).toBe(0);
    expect(g.headStart).toMatchObject({ rounds: 0, xp: 0 });
  });
});

describe('the game layer never writes engine data', () => {
  function seeded(seed: number) {
    return () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function playRound(withGame: boolean) {
    const p = newProfile(new Date('2026-10-21T10:00:00Z'));
    const g = newGameState();
    g.xp = L(6);
    const scorer = new RoundScorer(g.xp);
    const r = new Round(p, {
      minutes: 3,
      now: 0,
      rng: seeded(7),
      wallClock: () => Date.parse('2026-10-21T10:00:00Z'),
      onEvent: withGame ? (e) => scorer.onEvent(e) : undefined,
    });
    let t = 0;
    for (let i = 0; i < 4000 && !r.isFinished; i++) {
      const v = r.view(t);
      t += v.interstitial ? 1100 : 180;
      if (v.interstitial) continue;
      if (i % 23 === 5) r.key(v.expected === 'q' ? 'w' : 'q', t);
      r.key(v.expected, t);
      r.tick(t);
    }
    const summary = r.finish()!;
    if (withGame) finishRound(g, p, summary, scorer, Date.parse('2026-10-21T10:00:00Z'));
    return { p, g };
  }

  it('the profile after a round is the same with and without the game listening', () => {
    const a = playRound(true);
    const b = playRound(false);
    expect(JSON.stringify(a.p)).toBe(JSON.stringify(b.p));
    expect(a.g.xp).toBeGreaterThan(L(6));
  });
});

describe('config', () => {
  it('holds every number', () => {
    expect(GAME_CONFIG.xp).toMatchObject({ smooth: 10, slowClean: 5, fixed: 15, mastered: 20, weekGoal: 200, headStartPerRound: 300 });
    expect(GAME_CONFIG.weekGoalDaysDefault).toBe(4);
  });
});
