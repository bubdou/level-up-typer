import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { RoundSummary } from '../engine';
import type { GameState, PowerUpId } from '../game';
import { GAME_CONFIG, levelProgress, nextUnlock, weekDays, weekStreak } from '../game';
import { COPY, unlockName } from './copy';

const ICON_PATHS: Record<PowerUpId | 'look', ReactNode> = {
  combo: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />,
  keyFinder: (
    <>
      <rect x="3" y="7" width="12" height="12" rx="2" />
      <path d="M15 15l6 6M18 3l-2 3M21 7l-3 1" />
    </>
  ),
  flowChain: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  shield: <path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z" />,
  look: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v16M4 12h16" />
    </>
  ),
};

export function GameIcon({ id }: { id: PowerUpId | 'look' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="gicon">
      {ICON_PATHS[id]}
    </svg>
  );
}

/** Level badge, XP bar and what the next level unlocks. With `fromXp`, the bar grows from there. */
export function LevelBlock({ xp, fromXp }: { xp: number; fromXp?: number }) {
  const lp = levelProgress(xp);
  const start = fromXp === undefined ? null : levelProgress(fromXp);
  const target = (lp.into / lp.need) * 100;
  const initial = start === null ? target : start.level === lp.level ? (start.into / start.need) * 100 : 0;
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setWidth(target)));
    return () => cancelAnimationFrame(id);
  }, [target]);
  const next = nextUnlock(lp.level);
  return (
    <div className="lvl" data-testid="level">
      <div className="badge" aria-label={COPY.game.level(lp.level)}>
        <b>{lp.level}</b>
      </div>
      <div className="lvlinfo">
        <div className="top">
          <b>{COPY.game.level(lp.level)}</b>
          <span className="tnum muted" data-testid="xp">{COPY.game.xpOf(lp.into, lp.need)}</span>
        </div>
        <div className="xpbar" role="progressbar" aria-valuemin={0} aria-valuemax={lp.need} aria-valuenow={lp.into}>
          <i style={{ width: `${width}%` }} />
        </div>
        {next && <span className="nextup" data-testid="next-unlock">{COPY.game.nextUnlock(next.level, unlockName(next))}</span>}
      </div>
    </div>
  );
}

/** Monday to Sunday, a tick on each day with a round of 5 minutes or more. */
export function WeekDots({ game, rounds, now }: { game: GameState; rounds: readonly RoundSummary[]; now: number }) {
  const days = weekDays(rounds, now);
  const count = days.filter((d) => d.done).length;
  const goal = game.settings.weekGoalDays;
  const paid = game.weekGoalsPaid.includes(days[0].key);
  const streak = weekStreak(game, now);
  return (
    <div className="weekbox" data-testid="week">
      <div className="label">{COPY.game.week}</div>
      <div className="week">
        {days.map((d, i) => (
          <div key={d.key} className={`day${d.done ? ' done' : ''}${d.today ? ' today' : ''}`} aria-label={`${COPY.game.dayNames[i]}${d.done ? ', practiced' : ''}`}>
            <i>{d.done ? '✓' : ''}</i>
            {COPY.game.dayLetters[i]}
          </div>
        ))}
      </div>
      <span className="weekgoal" data-testid="week-goal">
        {paid || count >= goal ? (
          <b>{COPY.game.weekDone(GAME_CONFIG.xp.weekGoal)}</b>
        ) : (
          COPY.game.weekProgress(count, goal, GAME_CONFIG.xp.weekGoal)
        )}
      </span>
      {streak >= 2 && <span className="note">{COPY.game.weekStreak(streak)}</span>}
    </div>
  );
}
