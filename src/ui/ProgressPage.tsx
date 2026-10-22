import { useState } from 'react';
import { huntLetters, slowChunks } from '../engine';
import type { ScreenProps } from './App';
import { ProgressChart } from './Chart';
import { COPY, fmtDay } from './copy';
import { onControl, useKeydown } from './keys';

export function ProgressPage({ profile, go, game, initialMinutes }: ScreenProps & { initialMinutes?: number }) {
  const [minutes, setMinutes] = useState(initialMinutes ?? (profile.tests.at(-1)?.minutes ?? 1));
  useKeydown((e) => {
    if (onControl(e)) return;
    if (e.key === 'Escape') go({ name: 'home' });
  });
  const rounds = [...profile.rounds].reverse();
  const hunt = huntLetters(profile);
  const slow = slowChunks(profile);
  const segName = (s: string) => COPY.segments[s] ?? COPY.stages[s] ?? s;

  return (
    <section className="panel sum" data-testid="progress">
      <h1>{COPY.progress.title}</h1>
      <ProgressChart tests={profile.tests} minutes={minutes} onMinutes={setMinutes} />
      <div>
        <div className="label">{COPY.progress.rounds}</div>
        {rounds.length === 0 ? (
          <p className="note">{COPY.progress.noRounds}</p>
        ) : (
          <div className="tablewrap">
            <table data-testid="rounds">
              <thead>
                <tr>{COPY.progress.cols.map((c) => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {rounds.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtDay(r.date)}</td>
                    <td>{r.segments.map(segName).join(' + ')}</td>
                    <td>{r.minutes.toFixed(1)}</td>
                    <td>{r.medStart != null ? `${(r.medStart / 1000).toFixed(2)} s` : '–'}</td>
                    <td>{r.medPerKey != null ? `${r.medPerKey} ms` : '–'}</td>
                    <td>{r.cleanRate}%</td>
                    <td data-testid="round-xp-cell">{game.rounds[r.id] ? `+${game.rounds[r.id].total}` : '–'}</td>
                    <td>{r.huntLetters.length ? r.huntLetters.join(' ') : COPY.progress.none}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="two">
        <div className="card">
          <span className="label">{COPY.progress.keysToFind}</span>
          <p className="note">{COPY.progress.keysToFindNote}</p>
          <div className="chips" data-testid="hunt-list">
            {hunt.length ? hunt.map((c) => <span key={c} className="chip hunt">{c}</span>) : <span className="muted">{COPY.progress.none}</span>}
          </div>
        </div>
        <div className="card">
          <span className="label">{COPY.progress.slowChunks}</span>
          <p className="note">{COPY.progress.slowChunksNote}</p>
          <div className="chips" data-testid="slow-list">
            {slow.length ? slow.map((c) => <span key={c} className="chip">{c}</span>) : <span className="muted">{COPY.progress.none}</span>}
          </div>
        </div>
      </div>
    </section>
  );
}
