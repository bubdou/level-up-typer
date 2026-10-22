import type { RoundSummary } from '../engine';
import type { ChallengeResult } from '../game';
import type { ChallengeSpec, ScreenProps } from './App';
import { COPY } from './copy';
import { LevelBlock, UnlockCards } from './GameParts';
import { onControl, useKeydown } from './keys';
import { pointRows } from './points';

export function ChallengeResultPage({
  go,
  game,
  challenge,
  summary,
  result,
}: ScreenProps & { challenge: ChallengeSpec; summary: RoundSummary; result: ChallengeResult }) {
  useKeydown((e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || onControl(e)) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      go({ name: 'collection' });
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      go({ name: 'challenge', challenge });
    }
  });
  const p = result.points;
  return (
    <section className="panel sum" data-testid="challenge-result">
      <div className="row between">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h1>{COPY.game.challengeTitle(challenge.label)}</h1>
          <p className="muted">{COPY.game.challengeSub(summary.chunks, summary.cleanRate)}</p>
        </div>
        {result.medal ? (
          <div className={`medalbig ${result.medal}`} data-testid="medal">{COPY.game.medals[result.medal]}</div>
        ) : (
          <p className="muted" data-testid="medal">{COPY.game.noMedal}</p>
        )}
      </div>
      {result.improved && result.best && <span className="best" style={{ alignSelf: 'flex-start' }}>{COPY.game.newBestMedal}</span>}
      {!result.improved && result.best && <p className="note" style={{ margin: 0 }}>{COPY.game.bestMedal(COPY.game.medals[result.best])}</p>}
      <p className="note" style={{ margin: 0 }}>{COPY.game.medalRules}</p>
      <LevelBlock xp={p.xpAfter} fromXp={p.xpBefore} />
      <UnlockCards fromXp={p.xpBefore} toXp={p.xpAfter} />
      <div>
        <div className="label">{COPY.game.pointsTitle}</div>
        <table className="xptable" data-testid="points">
          <tbody>
            {pointRows(p, game.settings.weekGoalDays).map(([k, label, detail, xp]) => (
              <tr key={k} data-row={k}>
                <td>{label}</td>
                <td>{detail}</td>
                <td>+{xp}</td>
              </tr>
            ))}
            <tr className="total">
              <td>{COPY.game.total}</td>
              <td />
              <td data-testid="points-total">+{p.total}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="row">
        <button className="btn" onClick={() => go({ name: 'collection' })}>{COPY.game.backToCollection}</button>
        <button className="btn ghost" onClick={() => go({ name: 'challenge', challenge })}>{COPY.game.tryAgain}</button>
        <span className="help">{COPY.game.challengeHelp}</span>
      </div>
    </section>
  );
}
