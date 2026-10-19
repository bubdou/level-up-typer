import { useState } from 'react';
import type { StageId } from '../engine';
import { STAGES, keysLetters, lastTest, planRound, shouldNudgeTest, todayStats } from '../engine';
import type { ScreenProps } from './App';
import { roundMinutesOverride } from './params';
import { COPY, fmtDuration } from './copy';
import { onControl, useKeydown } from './keys';

const STAGE_EXAMPLES: Record<StageId, string> = {
  pairs: 'th he in er',
  short: 'the and ing',
  common: 'look said could',
  more: 'because together',
  phrases: 'of the, look at',
  sentences: 'the dog ran to',
};

export function Home({ profile, go, update }: ScreenProps) {
  const [showChoose, setShowChoose] = useState(false);
  const [now] = useState(() => Date.now());
  const s = profile.settings;
  const minutes = roundMinutesOverride() ?? s.roundMinutes;
  const plan = planRound(profile, minutes, s.choose);
  const total = plan.reduce((a, x) => a + x.ms, 0);
  const keys = keysLetters(profile);
  const today = todayStats(profile.rounds, now);
  const last = lastTest(profile);
  const nudge = shouldNudgeTest(profile, now);

  useKeydown((e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || onControl(e)) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      go({ name: 'practice' });
    } else if (e.key === 't' || e.key === 'T' || e.key === '1') {
      e.preventDefault();
      go({ name: 'test', minutes: 1 });
    } else if (e.key === '3') {
      e.preventDefault();
      go({ name: 'test', minutes: 3 });
    }
  });

  const segName = (k: string, stage?: StageId) => (k === 'chosen' ? COPY.stages[stage!] : COPY.segments[k]);
  const planText = COPY.home.plan(plan.map((p) => `${segName(p.kind, p.stage)} ${fmtDuration(p.ms)}`));
  const choose = (id: StageId | null) => update((p) => (p.settings.choose = id));

  return (
    <section className="panel home">
      <div>
        <h1>{COPY.home.title}</h1>
        <p className="muted">{COPY.home.lead}</p>
      </div>
      <div className="homegrid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <div className="label">{COPY.home.roundLabel}</div>
          <div className="plan" data-testid="plan" aria-label={planText}>
            {plan.map((p, i) => (
              <div key={i} className={`p-${p.kind === 'chosen' ? 'chunks' : p.kind}`} style={{ flex: p.ms }}>
                {segName(p.kind, p.stage)} <small>{fmtDuration(p.ms)}</small>
              </div>
            ))}
          </div>
          <p className="note" style={{ margin: 0 }} data-testid="plan-text">{planText}</p>
          <p className="note" style={{ margin: 0 }}>
            {s.choose ? `${COPY.home.youChose} ` : plan[0]?.kind === 'keys' ? `${COPY.home.keysBecause(keys)} ` : `${COPY.home.noKeys} `}
            {COPY.home.total(fmtDuration(total))}
          </p>
          <div className="row">
            <button className="btn" onClick={() => go({ name: 'practice' })}>{COPY.home.start}</button>
            <span className="note">{COPY.home.orEnter}</span>
          </div>
          <button
            className="linkbtn"
            onClick={() => {
              if (s.choose) {
                choose(null);
                setShowChoose(false);
              } else setShowChoose(!showChoose);
            }}
          >
            {s.choose ? COPY.home.backToToday : COPY.home.choose}
          </button>
          {showChoose && (
            <div className="stages">
              {STAGES.map((st) => (
                <button key={st.id} className="stage" aria-pressed={st.id === s.choose} onClick={() => choose(st.id)}>
                  <b>{COPY.stages[st.id]}</b>
                  <small>{STAGE_EXAMPLES[st.id]}</small>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="testcard">
          <div className="label">{COPY.home.testLabel}</div>
          {nudge ? (
            <span className="nudge">{COPY.home.testNudge}</span>
          ) : last ? (
            <p className="note" style={{ margin: 0 }}>{COPY.home.lastTest(Math.round(last.wpm), Math.round(last.accuracy))}</p>
          ) : (
            <p className="note" style={{ margin: 0 }}>{COPY.home.testIntro}</p>
          )}
          <div className="row">
            <button className="btn ghost" onClick={() => go({ name: 'test', minutes: 1 })}>{COPY.minutes(1)}</button>
            <button className="btn ghost" onClick={() => go({ name: 'test', minutes: 3 })}>{COPY.minutes(3)}</button>
          </div>
          <span className="note">{COPY.home.testKeys}</span>
        </div>
      </div>
      <p className="muted" style={{ margin: 0 }} data-testid="today">{COPY.home.today(today.minutes, today.fixed)}</p>
    </section>
  );
}
