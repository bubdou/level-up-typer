import type { LookId } from './config';
import { GAME_CONFIG } from './config';

/** What one round earned, kept so the numbers can be checked against the round's record. */
export interface RoundPoints {
  roundId: string;
  date: string;
  counts: { smooth: number; slowClean: number; quick: number; fixed: number; mastered: number; flowChain: number };
  /** XP by source. Smooth and quick are before doubling; comboBonus is what doubling added. */
  xp: {
    smooth: number;
    slowClean: number;
    quick: number;
    fixed: number;
    mastered: number;
    flowChain: number;
    comboBonus: number;
    keyFinder: number;
    weekGoal: number;
  };
  newlyMastered: string[];
  keysFound: string[];
  shieldUsed: boolean;
  xpBefore: number;
  xpAfter: number;
  total: number;
}

export interface GameSettings {
  look: LookId;
  sounds: boolean;
  animations: boolean;
  weekGoalDays: number;
}

/** The game layer's own block. It never holds engine data: dots and practice days are read from the engine. */
export interface GameState {
  version: 1;
  /** Total XP. Only goes up. */
  xp: number;
  /** By round id. */
  rounds: Record<string, RoundPoints>;
  /** Monday dates (YYYY-MM-DD, local) of weeks whose goal bonus was paid. */
  weekGoalsPaid: string[];
  /**
   * Item keys ever mastered. Never shrinks, so the Collection never goes down even when the
   * engine clears an item's mastery after a later miss. Mastered XP is paid once per key.
   */
  everMastered: string[];
  /** Letter to the ISO time Key Finder last paid for it. */
  keyFinder: Record<string, string>;
  /** Set once, when the game first meets a profile. */
  headStart: { rounds: number; xp: number; at: string } | null;
  settings: GameSettings;
}

export function newGameState(): GameState {
  return {
    version: 1,
    xp: 0,
    rounds: {},
    weekGoalsPaid: [],
    everMastered: [],
    keyFinder: {},
    headStart: null,
    settings: { look: 'classic', sounds: true, animations: true, weekGoalDays: GAME_CONFIG.weekGoalDaysDefault },
  };
}

export function migrateGame(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object' || (raw as GameState).version !== 1) return null;
  const g = raw as GameState;
  const fresh = newGameState();
  return {
    ...fresh,
    ...g,
    rounds: g.rounds ?? {},
    weekGoalsPaid: g.weekGoalsPaid ?? [],
    everMastered: g.everMastered ?? [],
    keyFinder: g.keyFinder ?? {},
    settings: { ...fresh.settings, ...g.settings },
  };
}
