import { useState } from 'react';
import type { TestComparison, TestRecord } from '../engine';
import type { ScreenProps } from './App';
import { ProgressChart } from './Chart';
import { COPY } from './copy';
import { onControl, useKeydown } from './keys';

interface Props {
  record: TestRecord;
  comparison: TestComparison;
  missed: string[];
}

export function TestResult({ profile, go, record, comparison, missed }: ScreenProps & Props) {
  const [minutes, setMinutes] = useState(record.minutes);
  useKeydown((e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || onControl(e)) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      go({ name: 'home' });
    } else if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      go({ name: 'progress', minutes });
    }
  });
  const prev = comparison.previous;
  return (
    <section className="panel sum" data-testid="test-result">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>{COPY.test.resultTitle(record.minutes)}</h1>
        {comparison.newBest && <span className="best" data-testid="new-best">{COPY.test.newBest}</span>}
      </div>
      <div className="big2">
        <div><b data-testid="wpm">{Math.round(record.wpm)}</b> <span>{COPY.test.wpm}</span></div>
        <div><b data-testid="accuracy">{Math.round(record.accuracy)}%</b> <span>{COPY.test.accuracy}</span></div>
      </div>
      {prev && <p className="muted" style={{ margin: 0 }}>{COPY.test.lastTime(Math.round(prev.wpm))}</p>}
      <div>
        <div className="label">{COPY.test.missedMost}</div>
        <div className="chips" style={{ marginTop: 6 }} data-testid="missed">
          {missed.length ? missed.map((c) => <span key={c} className="chip hunt">{c === ' ' ? 'space' : c}</span>) : <span className="muted">{COPY.test.noMissed}</span>}
        </div>
        {missed.some((c) => c !== ' ') && <p className="note">{COPY.test.missedNote}</p>}
      </div>
      <ProgressChart tests={profile.tests} minutes={minutes} onMinutes={setMinutes} small />
      <div className="row">
        <button className="btn" onClick={() => go({ name: 'home' })}>{COPY.test.done}</button>
        <button className="btn ghost" onClick={() => go({ name: 'progress', minutes })}>{COPY.test.seeProgress}</button>
        <span className="help">{COPY.test.keysHelp}</span>
      </div>
    </section>
  );
}
