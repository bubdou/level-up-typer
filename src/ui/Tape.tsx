import { useEffect, useLayoutEffect, useRef } from 'react';
import type { ChunkResult, Cue, Outcome } from '../engine';
import { COPY } from './copy';

const MARK: Record<Outcome, string> = { smooth: '✓', slow: '◷', error: '✕' };
const MARK_CLASS: Record<Outcome, string> = { smooth: 'good', slow: 'slow', error: 'bad' };

/**
 * The chunks as still text, wrapped over lines like a page, three lines tall: done ones, the
 * current one, the ones ahead. The text never moves while a line is typed; only the underline moves
 * on. The current line is normally the middle one, with the line just typed above it and the next
 * line below to read ahead.
 *
 * At a line break the text stays still and the current chunk is simply the first one on the bottom
 * line, where the eyes already are, as when reading a book. Only when that first chunk is done does
 * the text move up one line. So the eyes never jump back to the start of a line while the text is
 * moving (Wei, 2026-11-25). Within a segment chunks are only ever added at the end; the parent
 * remounts the strip for a new segment, which places it at once.
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
  /** Offset (px inside the tape) of the line shown at the top of the window. */
  const top = useRef(0);

  /**
   * `instant` places the text at once (first placement, a new width, fonts loaded) and never holds
   * a line break back. Otherwise a chunk that starts a new line on the bottom row keeps the text
   * still; the move up comes with the next chunk.
   */
  const place = (instant: boolean) => {
    const tape = tapeRef.current;
    const cur = tape?.querySelector<HTMLElement>('.unit.cur');
    if (!tape || !cur) return;
    const lineH = cur.offsetHeight;
    const wanted = Math.max(0, cur.offsetTop - lineH);
    const prev = cur.previousElementSibling as HTMLElement | null;
    const startsLine = !!prev && prev.offsetTop < cur.offsetTop;
    const onBottomRow = cur.offsetTop - top.current <= 2 * lineH + 1;
    const hold = !instant && startsLine && wanted > top.current && onBottomRow;
    if (!hold) top.current = wanted;
    const y = -top.current;
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
