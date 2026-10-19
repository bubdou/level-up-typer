import { CONFIG } from './config';
import type { Profile, RoundSummary, TestRecord } from './profile';
import { mean } from './stats';

export interface ChartPoint {
  date: string;
  wpm: number;
  accuracy: number;
  /** Mean of this test and up to 2 before it. */
  avg: number;
}

export function chartSeries(tests: readonly TestRecord[], minutes: number): ChartPoint[] {
  const same = tests.filter((t) => t.minutes === minutes).sort((a, b) => a.date.localeCompare(b.date));
  return same.map((t, i) => ({
    date: t.date,
    wpm: Math.round(t.wpm),
    accuracy: t.accuracy,
    avg: mean(same.slice(Math.max(0, i - CONFIG.chartAverageWindow + 1), i + 1).map((x) => Math.round(x.wpm)))!,
  }));
}

export type Headline = { kind: 'up'; wpm: number } | { kind: 'best'; best: number } | null;

/** The chart title only says true things: "Up N wpm" only when the last 3 average beats the first 3. */
export function chartHeadline(points: readonly ChartPoint[]): Headline {
  if (points.length < 2) return null;
  const w = points.map((p) => p.wpm);
  const n = CONFIG.chartAverageWindow;
  const up = Math.round(mean(w.slice(-n))! - mean(w.slice(0, n))!);
  if (up >= 1) return { kind: 'up', wpm: up };
  return { kind: 'best', best: Math.max(...w) };
}

export function daysSince(iso: string, now: number): number {
  return Math.floor((now - Date.parse(iso)) / 86_400_000);
}

export function lastTest(p: Profile): TestRecord | null {
  return p.tests.length ? p.tests[p.tests.length - 1] : null;
}

export function shouldNudgeTest(p: Profile, now: number): boolean {
  const t = lastTest(p);
  return !!t && daysSince(t.date, now) >= CONFIG.testNudgeDays;
}

const sameLocalDay = (iso: string, now: number) => new Date(iso).toDateString() === new Date(now).toDateString();

export function todayStats(rounds: readonly RoundSummary[], now: number): { minutes: number; fixed: number } {
  const today = rounds.filter((r) => sameLocalDay(r.date, now));
  return { minutes: today.reduce((a, r) => a + r.minutes, 0), fixed: today.reduce((a, r) => a + r.fixed.length, 0) };
}

/** Chunks that were clean but slow in their recent attempts and are not mastered yet. */
export function slowChunks(p: Profile, limit = 12): string[] {
  return Object.entries(p.items)
    .filter(([, r]) => !r.mastered && r.history.some((h) => h.slow))
    .map(([k, r]) => ({ text: k.slice(k.indexOf(':') + 1), slow: r.history.filter((h) => h.slow).length }))
    .sort((a, b) => b.slow - a.slow)
    .slice(0, limit)
    .map((x) => x.text)
    .filter((t, i, a) => a.indexOf(t) === i);
}

export function previousRound(p: Profile, beforeId: string): RoundSummary | null {
  const i = p.rounds.findIndex((r) => r.id === beforeId);
  const list = i >= 0 ? p.rounds.slice(0, i) : p.rounds;
  return list.length ? list[list.length - 1] : null;
}
