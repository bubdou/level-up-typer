import { useEffect, useRef, useState } from 'react';
import type { RoundView } from '../engine';
import { CONFIG, Round, keysLetters, knownShare, letterState } from '../engine';
import type { ScreenProps } from './App';
import { roundMinutesOverride } from './params';
import { COPY, fmtClock } from './copy';
import { Keyboard } from './Keyboard';
import { hasCommandModifier, isImeKey, useKeydown, useLeave } from './keys';

const MARK = { smooth: '✓', slow: '◷', error: '✕' } as const;
const MARK_CLASS = { smooth: 'good', slow: 'slow', error: 'bad' } as const;

export function Practice({ profile, go, changed, update }: ScreenProps) {
  const s = profile.settings;
  const [round] = useState(() => new Round(profile, { minutes: roundMinutesOverride() ?? s.roundMinutes, choose: s.choose, now: performance.now() }));
  const [keysToFind] = useState(() => keysLetters(profile));
  const [now, setNow] = useState(() => performance.now());
  const [ime, setIme] = useState(false);
  const [caps, setCaps] = useState(false);
  const [litStamp, setLitStamp] = useState<number | null>(null);
  const [errAt, setErrAt] = useState<{ tick: number; pos: number; seq: number } | null>(null);
  const endedRef = useRef(false);
  const rerender = () => setNow(performance.now());

  const end = () => {
    if (endedRef.current) return;
    endedRef.current = true;
    const summary = round.finish();
    changed({ now: true });
    go(summary ? { name: 'summary', summary } : { name: 'home' });
  };

  useEffect(() => {
    const id = setInterval(() => {
      round.tick(performance.now());
      if (round.isFinished) end();
      else rerender();
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLeave(() => {
    if (!round.isFinished && !round.isPaused) {
      round.pause(performance.now());
      rerender();
    }
  });

  useKeydown((e) => {
    if (isImeKey(e)) {
      setIme(true);
      return;
    }
    if (hasCommandModifier(e)) return;
    setCaps(e.getModifierState?.('CapsLock') ?? false);
    const now = performance.now();
    if (e.key === 'Escape') {
      e.preventDefault();
      if (round.isPaused) end();
      else {
        round.pause(now);
        rerender();
      }
      return;
    }
    if (e.key === ' ' || e.key === 'Backspace' || e.key === 'Tab' || e.key.length === 1) e.preventDefault();
    if (e.key.length !== 1) return;
    setIme(false);
    if (round.isPaused) {
      if (e.key === ' ') {
        round.resume(now);
        rerender();
      }
      return;
    }
    const before = round.view(now);
    const res = round.key(e.key, now);
    if (res === 'wrong') setErrAt({ tick: before.errorTick + 1, pos: before.pos, seq: before.seq });
    if (res === 'done') changed();
    if (round.isFinished) end();
    else rerender();
  });

  const v: RoundView = round.view(now);
  const hintDelay =
    s.hints === 'off'
      ? null
      : s.hints === 'always' || v.mode === 'keys'
        ? 0
        : v.expected === ' '
          ? CONFIG.hintDelayMs.learning
          : CONFIG.hintDelayMs[letterState(profile, v.expected)];

  useEffect(() => {
    if (hintDelay === null || hintDelay === 0 || v.paused || v.interstitial) return;
    const wait = Math.max(0, hintDelay - (performance.now() - v.charSince));
    const stamp = v.charSince;
    const id = setTimeout(() => setLitStamp(stamp), wait);
    return () => clearTimeout(id);
  }, [hintDelay, v.charSince, v.paused, v.interstitial]);

  const lit = v.interstitial || v.paused || hintDelay === null ? null : hintDelay === 0 || litStamp === v.charSince ? v.expected : null;
  const segLabel = (i: number) => {
    const seg = v.segments[i];
    return seg.kind === 'chosen' ? COPY.stages[seg.stage!] : COPY.segments[seg.kind];
  };
  const err = errAt && errAt.pos === v.pos && errAt.seq === v.seq ? errAt : null;

  const chars = [...v.text].map((ch, i) => {
    const isErr = err && i === v.pos;
    return (
      <span
        key={isErr ? `${i}-${err.tick}` : i}
        className={`ch${i < v.pos ? ' done' : ''}${i === v.pos ? ' at' : ''}${isErr ? ' err' : ''}`}
      >
        {ch === ' ' ? ' ' : ch}
      </span>
    );
  });
  const spaceAt = v.pos >= v.text.length;
  const cur = (
    <div className="cur" data-testid="current" data-text={v.text} data-pos={v.pos}>
      {chars}
      <span className={`sp${spaceAt ? ' at' : ''}${err && spaceAt ? ' err' : ''}`}>·</span>
    </div>
  );

  const prompt =
    v.chunkInSegment === 0 && !v.repair ? (v.mode === 'keys' ? COPY.practice.keysTip : COPY.practice.readIt) : '';
  const toast = v.toast ? (v.toast.kind === 'fixed' ? COPY.practice.fixed : COPY.practice.giveUp) : null;
  const firstChunk = v.segIndex === 0 && v.chunkInSegment === 0 && v.pos === 0;

  return (
    <section className="panel practice" data-testid="practice" data-expected={v.expected} data-mode={v.mode} data-paused={v.paused} data-interstitial={v.interstitial ?? ''}>
      <div className="topbar">
        <span className="mode">
          {v.segments.map((_, i) => (
            <span key={i}>
              {i > 0 && ' · '}
              {i === v.segIndex ? <b>{segLabel(i)}</b> : segLabel(i)}
            </span>
          ))}
        </span>
        <div className="bar"><i style={{ width: `${Math.min(100, (v.activeMs / v.limitMs) * 100)}%` }} /></div>
        <span>{fmtClock(Math.max(0, v.limitMs - v.activeMs))}</span>
      </div>

      {ime && <div className="banner big" role="alert">{COPY.warn.ime}</div>}
      {caps && !ime && <div className="banner" role="alert">{COPY.warn.caps}</div>}
      {v.paused && (
        <div className="banner big" role="status" data-testid="paused">
          {COPY.practice.paused}
          <span className="paused-sub">{COPY.practice.pausedStop}</span>
        </div>
      )}

      {v.mode === 'keys' && !v.interstitial && (
        <div className="keys-letters">
          <span>{COPY.practice.keysTitle}</span>
          <span className="chips">{keysToFind.map((k) => <span key={k} className="chip hunt">{k}</span>)}</span>
        </div>
      )}

      <div className="stripwrap">
        {v.interstitial ? (
          <div className="seg" data-testid="segment-name">{COPY.segments[v.interstitial] ?? ''}</div>
        ) : (
          <>
            {toast && <div className="toast" role="status">{toast}</div>}
            {v.repair ? (
              <div className="repair" data-testid="repair">
                <h2>{COPY.practice.repairTitle}</h2>
                <div className="strip">{cur}</div>
                <div className="dots">
                  {Array.from({ length: CONFIG.repairCleanNeeded }, (_, i) => <i key={i} className={i < v.repair!.clean ? 'on' : ''} />)}
                </div>
                <div className="tries">{COPY.practice.tryOf(v.repair.tries + 1, CONFIG.repairMaxTries)}</div>
              </div>
            ) : (
              <>
                <div className="prompt">{firstChunk ? `${prompt} ${COPY.practice.fingers}` : prompt}</div>
                <div className="strip">
                  <div className="prev" data-testid="prev">
                    {v.prev && (
                      <>
                        <span>{v.prev.text}</span>
                        <span className={`mk ${MARK_CLASS[v.prev.outcome]}`} aria-label={v.prev.outcome}>{MARK[v.prev.outcome]}</span>
                      </>
                    )}
                  </div>
                  {cur}
                  <div className="next" data-testid="next">
                    <span className={`n1${v.readAhead ? ' lit' : ''}`}>{v.next[0] ?? ''}</span>
                    <span className="n2">{v.next[1] ?? ''}</span>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {s.keyboardHidden ? (
        <div className="hidden-kbd">
          <button className="linkbtn" onClick={(e) => { e.currentTarget.blur(); update((p) => (p.settings.keyboardHidden = false)); }}>{COPY.practice.showKeyboard}</button>
        </div>
      ) : (
        <Keyboard
          lit={lit}
          quiet={knownShare(profile) >= CONFIG.keyboardQuietKnownShare}
          hintLabel={COPY.practice.hints(COPY.settings.hintModes[s.hints])}
          onHide={() => { (document.activeElement as HTMLElement | null)?.blur(); update((p) => (p.settings.keyboardHidden = true)); }}
        />
      )}
    </section>
  );
}
