import { useEffect, useRef, useState } from 'react';
import type { RoundView } from '../engine';
import { CONFIG, Round, keysLetters, knownShare, letterState } from '../engine';
import type { Bubble, LookId } from '../game';
import { GAME_CONFIG, RoundScorer, finishRound, hasPowerUp } from '../game';
import type { ScreenProps } from './App';
import { roundMinutesOverride } from './params';
import { COPY, fmtClock, unlockName } from './copy';
import { GameIcon } from './GameParts';
import { Keyboard } from './Keyboard';
import { playSound } from './sounds';
import { hasCommandModifier, isImeKey, useKeydown, useLeave } from './keys';

const MARK = { smooth: '✓', slow: '◷', error: '✕' } as const;
const MARK_CLASS = { smooth: 'good', slow: 'slow', error: 'bad' } as const;

const bubbleText = (b: Bubble) =>
  b.kind === 'combo'
    ? COPY.game.comboOn
    : b.kind === 'shield'
      ? COPY.game.shieldKept
      : COPY.game.levelUp(b.level, b.unlocks.length ? b.unlocks.map(unlockName).join(', ') : null);

export function Practice({ profile, go, changed, update, game, updateGame, look }: ScreenProps & { look: LookId }) {
  const s = profile.settings;
  // The scorer only listens to the engine's events; it never changes the round.
  const [scorer] = useState(() => new RoundScorer(game.xp, game.everMastered));
  const [round] = useState(
    () =>
      new Round(profile, {
        minutes: roundMinutesOverride() ?? s.roundMinutes,
        choose: s.choose,
        now: performance.now(),
        onEvent: (e) => scorer.onEvent(e),
      }),
  );
  const [pop, setPop] = useState<{ text: string; until: number; id: number } | null>(null);
  const [bubbles, setBubbles] = useState<{ text: string; level: boolean; from: number; until: number }[]>([]);
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
    const points = summary ? finishRound(game, profile, summary, scorer, Date.now()) : null;
    if (points) updateGame(() => {});
    go(summary ? { name: 'summary', summary, points } : { name: 'home' });
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

  function showFeedback(t: number) {
    const f = scorer.take();
    const sounds = game.settings.sounds;
    if (f.xp > 0 && !f.fixed) {
      setPop({ text: f.mastered ? COPY.game.popMastered(f.xp) : COPY.game.pop(f.xp), until: t + GAME_CONFIG.popMs, id: t });
    }
    if (sounds && f.fixed) playSound('fixed');
    if (sounds && f.mastered) playSound('mastered');
    if (sounds && f.bubbles.some((b) => b.kind === 'level')) playSound('level');
    if (f.bubbles.length) {
      // One bubble at a time, each shown for a fixed time after the one before it.
      const queue = bubbles.filter((b) => b.until > t);
      let from = Math.max(t, queue.at(-1)?.until ?? 0);
      for (const b of f.bubbles) {
        queue.push({ text: bubbleText(b), level: b.kind === 'level', from, until: from + GAME_CONFIG.bubbleMs });
        from += GAME_CONFIG.bubbleMs;
      }
      setBubbles(queue);
    }
  }

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
    if (res === 'done') {
      changed();
      showFeedback(now);
    }
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
  const toast = v.toast ? (v.toast.kind === 'fixed' ? COPY.game.fixedPoints(scorer.lastFixedXp) : COPY.practice.giveUp) : null;
  const level = scorer.level;
  const showPop = pop && now < pop.until ? pop : null;
  const bubble = bubbles.find((b) => b.from <= now && now < b.until) ?? null;
  const firstChunk = v.segIndex === 0 && v.chunkInSegment === 0 && v.pos === 0;

  return (
    <section className={`panel practice look-${look}`} data-testid="practice" data-expected={v.expected} data-mode={v.mode} data-paused={v.paused} data-interstitial={v.interstitial ?? ''}>
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

      <div className="gamebar" data-testid="gamebar">
        <span className="gxp" data-testid="round-xp">{COPY.game.roundXp(scorer.gained)}</span>
        {hasPowerUp(level, 'combo') ? (
          <span className={`combo${scorer.hot ? ' hot' : ''}`} data-testid="combo">
            {COPY.game.combo}
            <span className="pips" aria-label={`${Math.min(scorer.combo, GAME_CONFIG.combo.need)} of ${GAME_CONFIG.combo.need}`}>
              {Array.from({ length: GAME_CONFIG.combo.need }, (_, i) => <i key={i} className={i < scorer.combo ? 'on' : ''} />)}
            </span>
            {scorer.hot && <span className="x2">×2</span>}
          </span>
        ) : (
          <span>{COPY.game.comboLocked}</span>
        )}
        {hasPowerUp(level, 'shield') && (
          <span className={`shield${scorer.shieldUsed ? ' used' : ''}`}>
            <GameIcon id="shield" />
            {COPY.game.shield}
          </span>
        )}
        {hasPowerUp(level, 'spark') && <span>{COPY.game.sparkOn}</span>}
        {bubble && (
          <span key={`${bubble.text}-${bubble.from}`} className={`gbubble${bubble.level ? ' lv' : ''}`} role="status" data-testid="bubble">
            {bubble.text}
          </span>
        )}
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
                    {showPop && <span key={showPop.id} className="pop" data-testid="pop">{showPop.text}</span>}
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
