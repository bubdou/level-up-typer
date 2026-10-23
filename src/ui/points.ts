import type { RoundPoints } from '../game';
import { GAME_CONFIG } from '../game';
import { COPY } from './copy';

/** Rows of the "Points this round" table: [key, label, detail, xp], only those that scored. */
export function pointRows(p: RoundPoints, weekDays: number): [string, string, string, number][] {
  const x = GAME_CONFIG.xp;
  const rows: [string, string, string, number][] = [
    ['smooth', COPY.game.rows.smooth, COPY.game.times(p.counts.smooth, x.smooth), p.xp.smooth],
    ['letters', COPY.game.rows.letters, COPY.game.times(p.counts.letters ?? 0, x.singleLetterSmooth), p.xp.letters ?? 0],
    ['slowClean', COPY.game.rows.slowClean, COPY.game.times(p.counts.slowClean, x.slowClean), p.xp.slowClean],
    ['quick', COPY.game.rows.quick, COPY.game.times(p.counts.quick, GAME_CONFIG.spark.xp), p.xp.quick],
    ['fixed', COPY.game.rows.fixed, COPY.game.times(p.counts.fixed, x.fixed), p.xp.fixed],
    ['fixedLetters', COPY.game.rows.fixedLetters, COPY.game.times(p.counts.fixedLetters ?? 0, x.singleLetterFixed), p.xp.fixedLetters ?? 0],
    ['mastered', COPY.game.rows.mastered, COPY.game.times(p.counts.mastered, x.mastered), p.xp.mastered],
    ['flowChain', COPY.game.rows.flowChain, COPY.game.times(p.counts.flowChain, GAME_CONFIG.flowChain.xp), p.xp.flowChain],
    ['comboBonus', COPY.game.rows.comboBonus, COPY.game.doubled, p.xp.comboBonus],
    ['keyFinder', COPY.game.rows.keyFinder, p.keysFound.join(' '), p.xp.keyFinder],
    ['weekGoal', COPY.game.rows.weekGoal, COPY.game.weekDetail(weekDays), p.xp.weekGoal],
  ];
  return rows.filter((r) => r[3] > 0);
}
