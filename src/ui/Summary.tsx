import type { RoundSummary } from '../engine';
import { previousRound } from '../engine';
import type { ScreenProps } from './App';
import { COPY, fmtSeconds } from './copy';
import { onControl, useKeydown } from './keys';

export function Summary({ profile, go, summary }: ScreenProps & { summary: RoundSummary }) {
  const prev = previousRound(profile, summary.id);
  const better = prev?.medStart != null && summary.medStart != null && summary.medStart < prev.medStart;

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
      <div className="row">
        <button className="btn" onClick={() => go({ name: 'home' })}>{COPY.summary.done}</button>
        <button className="btn ghost" onClick={() => go({ name: 'practice' })}>{COPY.summary.oneMore}</button>
        <span className="help">{COPY.summary.keysHelp}</span>
      </div>
    </section>
  );
}
