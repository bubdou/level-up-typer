import { GAME_CONFIG } from './config';

/** XP needed to go from level n to n + 1. */
export const levelCost = (n: number) => GAME_CONFIG.levelBase + GAME_CONFIG.levelStep * (n - 1);

/** Total XP at which level n starts. Level 1 starts at 0, level 2 at 500, level 3 at 1,250. */
export function levelStart(n: number): number {
  const k = n - 1;
  return GAME_CONFIG.levelBase * k + (GAME_CONFIG.levelStep * k * (k - 1)) / 2;
}

/** Level for a total XP. No cap. */
export function levelOf(xp: number): number {
  let n = 1;
  while (xp >= levelStart(n + 1)) n++;
  return n;
}

export interface LevelProgress {
  level: number;
  /** XP earned inside this level. */
  into: number;
  /** XP this level takes in all. */
  need: number;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelOf(xp);
  return { level, into: xp - levelStart(level), need: levelCost(level) };
}
