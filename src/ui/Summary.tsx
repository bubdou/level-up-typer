import { useState } from 'react';
import type { RoundSummary } from '../engine';
import { previousRound } from '../engine';
import type { RoundPoints } from '../game';
import { GAME_CONFIG, levelOf, unlocksBetween } from '../game';
import type { ScreenProps } from './App';
import { COPY, fmtSeconds, unlockName } from './copy';
import { GameIcon, LevelBlock, WeekDots } from './GameParts';
import { onControl, useKeydown } from './keys';

function pointRows(p: RoundPoints, weekDays: number): [string, string, string, number][] {
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

export function Summary({ profile, go, summary, points, game }: ScreenProps & { summary: RoundSummary; points: RoundPoints | null }) {
  const [now] = useState(() => Date.now());
  const prev = previousRound(profile, summary.id);
  const better = prev?.medStart != null && summary.medStart != null && summary.medStart < prev.medStart;
  const unlocks = points ? unlocksBetween(levelOf(points.xpBefore), levelOf(points.xpAfter)) : [];

  useKeydown((e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || onControl(e)) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      go({ name: 'home' });
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      go({ name: 'practice' });
    }
  });

  return (
    <section className="panel sum" data-testid="summary">
      <div>
        <h1>{COPY.summary.title}</h1>
        <p className="muted">{COPY.summary.sub(summary.chunks, summary.minutes)}</p>
      </div>
      {points && <LevelBlock xp={points.xpAfter} fromXp={points.xpBefore} />}
      {unlocks.map((u) => (
        <div key={u.id} className="unlock" data-testid="unlock">
          <div className="ic"><GameIcon id={u.kind === 'powerUp' ? u.id : 'look'} /></div>
          <div>
            <div className="label">{u.kind === 'powerUp' ? COPY.game.newPowerUp(u.level) : COPY.game.newLook(u.level)}</div>
            <h2>{unlockName(u)}</h2>
            <p className="muted">{u.kind === 'powerUp' ? COPY.game.powerUps[u.id].what : COPY.game.newLookText}</p>
          </div>
        </div>
      ))}
      {points && (
        <div>
          <div className="label">{COPY.game.pointsTitle}</div>
          <table className="xptable" data-testid="points">
            <tbody>
              {pointRows(points, game.settings.weekGoalDays).map(([k, label, detail, xp]) => (
                <tr key={k} data-row={k}>
                  <td>{label}</td>
                  <td>{detail}</td>
                  <td>+{xp}</td>
                </tr>
              ))}
              <tr className="total">
                <td>{COPY.game.total}</td>
                <td />
                <td data-testid="points-total">+{points.total}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <div className="sumgrid">
        <div className="card">
          <span className="label">{COPY.summary.startTime}</span>
          <b data-testid="start-time">{summary.medStart != null ? fmtSeconds(summary.medStart) : '–'}</b>
          {better && <span className="delta">{COPY.summary.was(fmtSeconds(prev!.medStart!))}</span>}
        </div>
        <div className="card">
          <span className="label">{COPY.summary.clean}</span>
          <b>{summary.cleanRate}%</b>
        </div>
        <div className="card">
          <span className="label">{COPY.summary.fixedCount}</span>
          <b>{summary.fixed.length}</b>
        </div>
      </div>
      {points && (
        <div>
          <div className="label">{COPY.game.newlyMastered}</div>
          <div className="chips" style={{ marginTop: 6 }} data-testid="mastered">
            {points.newlyMastered.length ? (
              points.newlyMastered.map((c) => <span key={c} className="chip star">{c}</span>)
            ) : (
              <span className="muted">{COPY.game.noneMastered}</span>
            )}
          </div>
        </div>
      )}
      {points && points.keysFound.length > 0 && (
        <div className="chips" data-testid="keys-found">
          {points.keysFound.map((k) => <span key={k} className="chip star">{COPY.game.keyFound(k, GAME_CONFIG.keyFinder.xp)}</span>)}
        </div>
      )}
      <div>
        <div className="label">{COPY.summary.youFixed}</div>
        <div className="chips" style={{ marginTop: 6 }} data-testid="fixed">
          {summary.fixed.length ? summary.fixed.map((c) => <span key={c} className="chip good">{c}</span>) : <span className="muted">{COPY.summary.nothingFixed}</span>}
        </div>
      </div>
      <div>
        <div className="label">{COPY.summary.keysLookedFor}</div>
        <div className="chips" style={{ marginTop: 6 }} data-testid="hunt">
          {summary.huntLetters.length ? summary.huntLetters.map((c) => <span key={c} className="chip hunt">{c}</span>) : <span className="muted">{COPY.summary.noKeys}</span>}
        </div>
      </div>
      <WeekDots game={game} rounds={profile.rounds} now={now} />
      <div className="row">
        <button className="btn" onClick={() => go({ name: 'home' })}>{COPY.summary.done}</button>
        <button className="btn ghost" onClick={() => go({ name: 'practice' })}>{COPY.summary.oneMore}</button>
        <span className="help">{COPY.summary.keysHelp}</span>
      </div>
    </section>
  );
}
