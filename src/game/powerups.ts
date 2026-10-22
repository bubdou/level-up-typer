import type { LookId } from './config';
import { GAME_CONFIG } from './config';

export type PowerUpId = 'combo' | 'spark' | 'keyFinder' | 'flowChain' | 'shield';

/** In unlock order. */
export const POWER_UPS: { id: PowerUpId; level: number }[] = (
  ['combo', 'spark', 'keyFinder', 'flowChain', 'shield'] as const
).map((id) => ({ id, level: GAME_CONFIG[id].level }));

export const hasPowerUp = (level: number, id: PowerUpId) => level >= GAME_CONFIG[id].level;

export const lookUnlocked = (level: number, id: LookId) => level >= (GAME_CONFIG.looks.find((l) => l.id === id)?.level ?? Infinity);

export type Unlock = { kind: 'powerUp'; id: PowerUpId; level: number } | { kind: 'look'; id: LookId; level: number };

/** Everything that unlocks at levels above `from` up to and including `to`. */
export function unlocksBetween(from: number, to: number): Unlock[] {
  const all: Unlock[] = [
    ...POWER_UPS.map((p) => ({ kind: 'powerUp' as const, id: p.id, level: p.level })),
    ...GAME_CONFIG.looks.filter((l) => l.level > 1).map((l) => ({ kind: 'look' as const, id: l.id, level: l.level })),
  ];
  return all.filter((u) => u.level > from && u.level <= to).sort((a, b) => a.level - b.level);
}

/** The next thing to unlock above `level`, or null if there is nothing left. */
export const nextUnlock = (level: number): Unlock | null => unlocksBetween(level, Infinity)[0] ?? null;
