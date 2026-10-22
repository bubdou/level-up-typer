import type { RoundSummary, TestRecord } from '../engine';
import { GAME_CONFIG } from './config';
import type { CollectionSet } from './collection';
import type { RoundScorer } from './scorer';
import type { GameState, Medal, RoundPoints } from './state';

const RANK: Record<Medal, number> = { bronze: 1, silver: 2, gold: 3 };

export const setId = (s: Pick<CollectionSet, 'track' | 'index'>) => `${s.track}-${s.index}`;

/** A set can be challenged once 8 of its 10 items are mastered. */
export const canChallenge = (s: CollectionSet) => s.open && s.mastered >= GAME_CONFIG.challengeMinMastered;

/**
 * Gold: 95% clean on the first try, silver 85% (both with at least 10 chunks), bronze for
 * finishing the 45 s. Stopping early wins nothing.
 */
export function medalFor(summary: RoundSummary, finished: boolean): Medal | null {
  const enough = summary.chunks >= GAME_CONFIG.medalMinChunks;
  if (finished && enough && summary.cleanRate >= GAME_CONFIG.medalGold) return 'gold';
  if (finished && enough && summary.cleanRate >= GAME_CONFIG.medalSilver) return 'silver';
  return finished ? 'bronze' : null;
}

export interface ChallengeResult {
  points: RoundPoints;
  medal: Medal | null;
  /** The set's best medal after this try. */
  best: Medal | null;
  /** This try beat the set's best medal before it. */
  improved: boolean;
}

/**
 * Closes a set challenge. Points count as usual, but a challenge is not a round: no week-goal
 * day and no Key Finder. The best medal stays on the set.
 */
export function finishChallenge(
  g: GameState,
  set: string,
  summary: RoundSummary,
  scorer: RoundScorer,
  finished: boolean,
): ChallengeResult {
  const xp = { ...scorer.xp };
  const total = Object.values(xp).reduce((a, b) => a + b, 0);
  const points: RoundPoints = {
    roundId: summary.id,
    date: summary.date,
    counts: { ...scorer.counts },
    xp,
    newlyMastered: [...new Set(scorer.newlyMastered)],
    keysFound: [],
    shieldUsed: scorer.shieldUsed,
    xpBefore: g.xp,
    xpAfter: g.xp + total,
    total,
  };
  g.xp = points.xpAfter;
  for (const k of scorer.firstMastered) if (!g.everMastered.includes(k)) g.everMastered.push(k);
  const medal = medalFor(summary, finished);
  const before = g.medals[set] ?? null;
  const improved = !!medal && (!before || RANK[medal] > RANK[before]);
  if (improved) g.medals[set] = medal!;
  return { points, medal, best: g.medals[set] ?? null, improved };
}

/**
 * The usual pace for a test length: the average wpm of the last 3 tests of that length, or null
 * with fewer. Pass the tests from before the one being taken.
 */
export function usualPace(tests: readonly TestRecord[], minutes: number): number | null {
  const same = tests.filter((t) => t.minutes === minutes).sort((a, b) => a.date.localeCompare(b.date));
  if (same.length < GAME_CONFIG.paceTests) return null;
  const last = same.slice(-GAME_CONFIG.paceTests);
  return last.reduce((a, t) => a + t.wpm, 0) / last.length;
}

/** How many characters the pace line has covered after `ms` of typing. WPM counts 5 characters a word. */
export const paceChars = (wpm: number, ms: number) => Math.floor((wpm * 5 * ms) / 60_000);
