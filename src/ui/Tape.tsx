import { useEffect, useLayoutEffect, useRef } from 'react';
import type { ChunkResult, Cue, Outcome } from '../engine';
import { COPY } from './copy';

const MARK: Record<Outcome, string> = { smooth: '✓', slow: '◷', error: '✕' };
const MARK_CLASS: Record<Outcome, string> = { smooth: 'good', slow: 'slow', error: 'bad' };

/**
 * The chunks as still text, wrapped over lines like a page: done ones, the current one, the ones
 * ahead. The text never slides while a line is typed; only the underline moves on. When the current
 * chunk starts a new line, the text moves up one line, so the current line is always the top one
 * and the next line is in view to read ahead. Within a segment chunks are only ever added at the
 * end; the parent remounts the strip for a new segment, which places it at once.
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
    const tape = tapeRef.current;
    const cur = tape?.querySelector<HTMLElement>('.unit.cur');
    if (!tape || !cur) return;
    const y = -cur.offsetTop;
    if (tape.style.transform === `translateY(${y}px)`) return;
    if (instant) tape.classList.add('instant');
    tape.style.transform = `translateY(${y}px)`;
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
    // Watch the strip itself, not the window: a new width can move words to other lines.
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

  // Each chunk and the space after it is one unit, so a line never starts with a space.
  return (
    <div className={`tapewin${keys ? ' keys' : ''}`} ref={winRef} data-testid="tape">
      <div className="tape" ref={tapeRef}>
        {done.map((r) => (
          <span key={r.id} className="unit">
            <span className="w done" data-testid="done-chunk" data-text={r.text}>
              {mark(r)}
              {popFor(r.id)}
              {r.text}
            </span>
            <span className="sp">{' '}</span>
          </span>
        ))}
        <span key={current.id} className="unit cur">
          {current.node}
          <span className={current.spaceClass}>{' '}</span>
        </span>
        {next.map((n, i) => (
          <span key={n.id} className="unit">
            <span
              className={`w later${i === 0 && cue ? ` cue-${cue}` : ''}`}
              data-testid="ahead"
              data-id={n.id}
              data-cue={i === 0 && cue ? cue : undefined}
            >
              {n.text}
            </span>
            <span className="sp">{' '}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
