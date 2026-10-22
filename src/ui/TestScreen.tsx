import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TestRun, compareTest, saveTest } from '../engine';
import { paceChars, usualPace } from '../game';
import type { ScreenProps } from './App';
import { COPY, fmtClock } from './copy';
import { hasCommandModifier, isImeKey, onControl, useKeydown, useLeave } from './keys';

const AHEAD = 400;

export function TestScreen({ profile, go, changed, game, minutes }: ScreenProps & { minutes: number }) {
  const [run] = useState(() => new TestRun(minutes));
  // The usual-pace line: the average of the last 3 tests of this length, taken before this one.
  const [pace] = useState(() => (game.settings.paceLine ? usualPace(profile.tests, minutes) : null));
  const [now, setNow] = useState(() => performance.now());
  const [ime, setIme] = useState(false);
  const [caps, setCaps] = useState(false);
  const [errAt, setErrAt] = useState<{ pos: number; tick: number } | null>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);
  const rerender = () => setNow(performance.now());

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    const missed = run.topMissed();
    const record = saveTest(profile, run);
    changed({ now: true });
    go({ name: 'testResult', record, comparison: compareTest(profile.tests, record), missed, pace });
  };

  useEffect(() => {
    const id = setInterval(() => {
      if (run.tick(performance.now())) finish();
      else rerender();
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLeave(() => {
    if (run.startAt === null || run.finished || doneRef.current) return;
    run.void();
    doneRef.current = true;
    go({ name: 'testStopped', minutes });
  });

  useKeydown((e) => {
    if (isImeKey(e)) {
      setIme(true);
      return;
    }
    if (hasCommandModifier(e)) return;
    setCaps(e.getModifierState?.('CapsLock') ?? false);
    if (e.key === 'Escape') {
      e.preventDefault();
      doneRef.current = true;
      go({ name: 'home' });
      return;
    }
    if (e.key === ' ' || e.key === 'Backspace' || e.key === 'Tab' || e.key.length === 1) e.preventDefault();
    if (e.key.length !== 1) return;
    setIme(false);
    const now = performance.now();
    const pos = run.pos;
    const res = run.key(e.key, now);
    if (res === 'wrong') setErrAt({ pos, tick: run.errorTick });
    if (run.finished) finish();
    else rerender();
  });

  useLayoutEffect(() => {
    const box = boxRef.current;
    const inner = innerRef.current;
    const at = inner?.querySelector<HTMLElement>('span.at');
    if (!box || !inner || !at) return;
    const lineH = parseFloat(getComputedStyle(box).lineHeight) || 44;
    const line = Math.round(at.offsetTop / lineH);
    inner.style.transform = `translateY(${-Math.max(0, line - 1) * lineH}px)`;
  });

  const text = run.text.slice(0, run.pos + AHEAD);
  const err = errAt && errAt.pos === run.pos ? errAt : null;
  const ghost = pace !== null && run.startAt !== null ? paceChars(pace, Math.min(now - run.startAt, run.durationMs)) : -1;

  return (
    <section className="panel practice" data-testid="test" data-expected={run.expected} data-started={run.startAt !== null}>
      <div className="topbar">
        <span className="mode">{COPY.test.title(minutes)}</span>
        <div className="bar"><i style={{ width: `${100 - (run.remainingMs(now) / run.durationMs) * 100}%` }} /></div>
        <span className="clock" data-testid="clock">{fmtClock(run.remainingMs(now))}</span>
      </div>
      {ime && <div className="banner big" role="alert">{COPY.warn.ime}</div>}
      {caps && !ime && <div className="banner" role="alert">{COPY.warn.caps}</div>}
      <p className="prompt">{run.startAt === null ? COPY.test.clockStarts : ' '}</p>
      <div className="testtext" ref={boxRef}>
        <div className="inner" ref={innerRef}>
          {[...text].map((ch, i) => (
            <span
              key={err && i === run.pos ? `${i}-${err.tick}` : i}
              className={
                [i < run.pos ? 'done' : i === run.pos ? (err ? 'at err' : 'at') : '', i === ghost && i !== run.pos ? 'ghost' : '']
                  .filter(Boolean)
                  .join(' ') || undefined
              }
              data-ghost={i === ghost ? 'true' : undefined}
            >
              {ch}
            </span>
          ))}
        </div>
      </div>
      <p className="note">{COPY.test.rules}</p>
      {pace !== null && (
        <p className="note pacekey" data-testid="pace-key">
          <i />
          {COPY.game.paceKey} · {COPY.game.paceNote(Math.round(pace))}
        </p>
      )}
    </section>
  );
}

export function TestStopped({ go, minutes }: ScreenProps & { minutes: number }) {
  useKeydown((e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || onControl(e)) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      go({ name: 'test', minutes });
    } else if (e.key === 'Escape') {
      e.preventDefault();
      go({ name: 'home' });
    }
  });
  return (
    <section className="panel practice" data-testid="test-stopped">
      <div className="banner big">{COPY.test.stopped}</div>
      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="btn" onClick={() => go({ name: 'test', minutes })}>{COPY.test.tryAgain}</button>
        <button className="btn ghost" onClick={() => go({ name: 'home' })}>{COPY.nav.home}</button>
      </div>
      <p className="help" style={{ textAlign: 'center' }}>{COPY.test.stoppedHelp}</p>
    </section>
  );
}
