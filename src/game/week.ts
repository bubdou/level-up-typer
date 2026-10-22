import type { RoundSummary } from '../engine';
import { GAME_CONFIG } from './config';
import type { GameState } from './state';

const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Local calendar date, YYYY-MM-DD. */
export const dayKey = (t: number | string) => keyOf(new Date(t));

/** Local midnight of the Monday that starts the week of `t`. */
function monday(t: number | string): Date {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** The week's key is its Monday's date. Weeks start on Monday, by the computer's local date. */
export const weekKey = (t: number | string) => keyOf(monday(t));

/** Days with at least one round of 5 minutes or more. Tests are not rounds, so they never count. */
export function practiceDays(rounds: readonly RoundSummary[]): Set<string> {
  return new Set(rounds.filter((r) => r.minutes >= GAME_CONFIG.weekRoundMinMinutes).map((r) => dayKey(r.date)));
}

export interface WeekDay {
  key: string;
  done: boolean;
  today: boolean;
}

/** Monday to Sunday of the week of `now`. */
export function weekDays(rounds: readonly RoundSummary[], now: number): WeekDay[] {
  const done = practiceDays(rounds);
  const today = dayKey(now);
  const start = monday(now);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = keyOf(d);
    return { key, done: done.has(key), today: key === today };
  });
}

export const daysThisWeek = (rounds: readonly RoundSummary[], now: number) => weekDays(rounds, now).filter((d) => d.done).length;

/** Weeks in a row with the goal met: this week if it is met already, then back from last week. */
export function weekStreak(g: GameState, now: number): number {
  const paid = new Set(g.weekGoalsPaid);
  const d = monday(now);
  if (!paid.has(keyOf(d))) d.setDate(d.getDate() - 7);
  let n = 0;
  while (paid.has(keyOf(d))) {
    n++;
    d.setDate(d.getDate() - 7);
  }
  return n;
}
