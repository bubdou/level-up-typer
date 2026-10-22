import type { Profile, RoundSummary } from '../engine';
import { ALL_ITEMS } from '../engine';
import { GAME_CONFIG } from './config';
import { levelOf } from './levels';
import { hasPowerUp } from './powerups';
import type { RoundScorer } from './scorer';
import type { GameState, RoundPoints } from './state';
import { daysThisWeek, weekKey } from './week';

const DAY_MS = 86_400_000;

/**
 * Closes a round for the game: adds the end-of-round bonuses (Key Finder, week goal) and
 * records the points. Writes only the game state; reads the profile and the round summary.
 */
export function finishRound(g: GameState, profile: Profile, summary: RoundSummary, scorer: RoundScorer, now: number): RoundPoints {
  const xp = { ...scorer.xp };
  const levelNow = levelOf(scorer.xpBefore + scorer.gained);

  // Key Finder: letters that were hunted at the start of the round and are not any more.
  const keysFound: string[] = [];
  if (hasPowerUp(levelNow, 'keyFinder')) {
    const endHunt = new Set(summary.huntLetters);
    for (const l of summary.huntLettersAtStart ?? []) {
      if (endHunt.has(l)) continue;
      const last = g.keyFinder[l];
      if (last && now - Date.parse(last) < GAME_CONFIG.keyFinder.repeatDays * DAY_MS) continue;
      keysFound.push(l);
      g.keyFinder[l] = new Date(now).toISOString();
      xp.keyFinder += GAME_CONFIG.keyFinder.xp;
    }
  }

  // Week goal: once a week, on the round that makes the count.
  const week = weekKey(now);
  if (!g.weekGoalsPaid.includes(week) && daysThisWeek(profile.rounds, now) >= g.settings.weekGoalDays) {
    g.weekGoalsPaid.push(week);
    xp.weekGoal += GAME_CONFIG.xp.weekGoal;
  }

  const total = Object.values(xp).reduce((a, b) => a + b, 0);
  const points: RoundPoints = {
    roundId: summary.id,
    date: summary.date,
    counts: { ...scorer.counts },
    xp,
    newlyMastered: [...new Set(scorer.newlyMastered)],
    keysFound,
    shieldUsed: scorer.shieldUsed,
    xpBefore: g.xp,
    xpAfter: g.xp + total,
    total,
  };
  g.xp = points.xpAfter;
  g.rounds[summary.id] = points;
  for (const k of scorer.firstMastered) if (!g.everMastered.includes(k)) g.everMastered.push(k);
  syncEverMastered(g, profile);
  return points;
}

/**
 * Adds every item the engine marks mastered now to the game's ever-mastered list. Used when an
 * old profile first meets the game, and after each round so nothing is missed. Never removes.
 */
export function syncEverMastered(g: GameState, profile: Profile): number {
  const have = new Set(g.everMastered);
  let added = 0;
  for (const i of ALL_ITEMS) {
    if (profile.items[i.key]?.mastered && !have.has(i.key)) {
      g.everMastered.push(i.key);
      added++;
    }
  }
  return added;
}

/**
 * The first time the game meets a profile: +300 XP for each round already played. Mastered items
 * need nothing here, because dots are always read from the engine. Returns the XP given (0 when
 * it was given before).
 */
export function applyHeadStart(g: GameState, profile: Profile, now: number): number {
  if (g.headStart) return 0;
  const rounds = profile.rounds.filter((r) => !g.rounds[r.id]).length;
  const xp = rounds * GAME_CONFIG.xp.headStartPerRound;
  g.xp += xp;
  g.headStart = { rounds, xp, at: new Date(now).toISOString() };
  return xp;
}
