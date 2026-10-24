import { Fragment, useEffect, useLayoutEffect, useRef } from 'react';
import type { ChunkResult, Cue, Outcome } from '../engine';
import { COPY } from './copy';

/** Where the current chunk's left edge sits, as a share of the strip's width. */
export const TAPE_ANCHOR = 0.22;

const MARK: Record<Outcome, string> = { smooth: '✓', slow: '◷', error: '✕' };
const MARK_CLASS: Record<Outcome, string> = { smooth: 'good', slow: 'slow', error: 'bad' };

/**
 * One even line of chunks: done ones on the left, the current one at TAPE_ANCHOR, the ones ahead
 * on the right. After each chunk the whole line glides left (CSS transition on transform), so the
 * eyes never have to jump. Within a segment chunks are only ever added at the right end; the
 * parent remounts the strip for a new segment and after a repair, which places it at once.
 */
export function Tape({
  done,
  current,
  next,
  cue,
  keys,
  pop,
}: {
  done: readonly ChunkResult[];
  current: { id: number; node: React.ReactNode; spaceClass: string };
  next: { id: number; text: string }[];
  cue: Cue;
  /** Keys warm-up: fewer chunks ahead, drawn faint, since the eyes belong on the letter and the keyboard. */
  keys: boolean;
  pop: { chunkId: number; text: string; id: number } | null;
}) {
  const winRef = useRef<HTMLDivElement>(null);
  const tapeRef = useRef<HTMLDivElement>(null);
  const placed = useRef(false);

  const place = (instant: boolean) => {
    const win = winRef.current;
    const tape = tapeRef.current;
    const cur = tape?.querySelector<HTMLElement>('.w.cur');
    if (!win || !tape || !cur) return;
    const x = Math.round(win.clientWidth * TAPE_ANCHOR - cur.offsetLeft);
    if (instant) tape.classList.add('instant');
    tape.style.transform = `translateX(${x}px)`;
    if (instant) {
      void tape.offsetWidth;
      tape.classList.remove('instant');
    }
  };

  useLayoutEffect(() => {
    place(!placed.current);
    placed.current = true;
  }, [current.id]);

  useEffect(() => {
    // Watch the strip itself, not the window: Safari can report the new window size before the
    // strip has its new width, which left the current chunk off its mark after a resize.
    const onResize = () => place(true);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onResize);
    if (ro && winRef.current) ro.observe(winRef.current);
    else window.addEventListener('resize', onResize);
    let live = true;
    document.fonts?.ready.then(() => live && place(true));
    return () => {
      live = false;
      ro?.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const mark = (r: ChunkResult) => (
    <span className="mk">
      <span className={MARK_CLASS[r.outcome]} aria-label={r.outcome}>{MARK[r.outcome]}</span>
      {r.handoff && <span className="zap" aria-label={COPY.practice.noStop} data-testid="zap">⚡</span>}
    </span>
  );
  const popFor = (id: number) =>
    pop && pop.chunkId === id ? <span key={pop.id} className="pop" data-testid="pop">{pop.text}</span> : null;

  return (
    <div className={`tapewin${keys ? ' keys' : ''}`} ref={winRef} data-testid="tape">
      <div className="tape" ref={tapeRef}>
        {done.map((r) => (
          <Fragment key={r.id}>
            <span className="w done" data-testid="done-chunk" data-text={r.text}>
              {mark(r)}
              {popFor(r.id)}
              {r.text}
            </span>
            <span className="sp">{' '}</span>
          </Fragment>
        ))}
        <Fragment key={current.id}>
          {current.node}
          <span className={current.spaceClass}>{' '}</span>
        </Fragment>
        {next.map((n, i) => (
          <Fragment key={n.id}>
            <span
              className={`w later${i === 0 && cue ? ` cue-${cue}` : ''}`}
              data-testid="ahead"
              data-id={n.id}
              data-cue={i === 0 && cue ? cue : undefined}
            >
              {n.text}
            </span>
            <span className="sp">{' '}</span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
