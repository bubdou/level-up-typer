import { useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardLevel } from '../engine';
import { COPY } from './copy';
import { FINGER, HOME, HOME_KEYS, ROWS } from './keyboardLayout';

interface Props {
  lit: string | null;
  /** labels: letters on the keys; blank: finger colours only; tucked: hidden until `popped`. */
  level: KeyboardLevel;
  popped: boolean;
  /** The key just pressed by mistake: red frame for a moment. */
  wrong: string | null;
  /** The line under the keyboard: which finger, or where the wrong key was. */
  line: string;
  hintLabel?: string;
  onHide?: () => void;
  /** The first-run card: only the eight home keys in colour. */
  homeOnly?: boolean;
}

type Arrow = { x1: number; y1: number; x2: number; y2: number; w: number; h: number };

/**
 * Mac US layout, letter rows and space. F and J carry bumps like the real keys; the eight home keys
 * have a small dot. A lit key gets an arrow from its finger's home key.
 */
export function Keyboard({ lit, level, popped, wrong, line, hintLabel, onHide, homeOnly }: Props) {
  const kbdRef = useRef<HTMLDivElement>(null);
  const [arrow, setArrow] = useState<Arrow | null>(null);
  const tucked = level === 'tucked' && !popped;
  const from = lit && lit !== ' ' && FINGER[lit] ? HOME[FINGER[lit]] : null;

  useLayoutEffect(() => {
    const kbd = kbdRef.current;
    if (!kbd || !lit || !from || from === lit) {
      setArrow(null);
      return;
    }
    const box = kbd.getBoundingClientRect();
    const a = kbd.querySelector(`[data-k="${from}"]`)!.getBoundingClientRect();
    const b = kbd.querySelector(`[data-k="${lit}"]`)!.getBoundingClientRect();
    const x1 = a.left + a.width / 2 - box.left;
    const y1 = a.top + a.height / 2 - box.top;
    const x2 = b.left + b.width / 2 - box.left;
    const y2 = b.top + b.height / 2 - box.top;
    // Stop short of the target's centre so the arrow head does not cover its letter.
    const len = Math.hypot(x2 - x1, y2 - y1);
    const cut = Math.min(14, len / 3);
    setArrow({ x1, y1, x2: x2 - ((x2 - x1) / len) * cut, y2: y2 - ((y2 - y1) / len) * cut, w: box.width, h: box.height });
  }, [lit, from, tucked]);

  const keyClass = (k: string) =>
    [
      'key',
      FINGER[k],
      k === 'f' || k === 'j' ? 'home' : '',
      HOME_KEYS.has(k) ? 'rest' : '',
      lit === k ? 'lit' : '',
      wrong === k ? 'wrong' : '',
      homeOnly && !HOME_KEYS.has(k) ? 'dim' : '',
    ]
      .filter(Boolean)
      .join(' ');

  return (
    <div className="kbdbox">
      <div className={`kbdwrap${tucked ? ' collapsed' : ''}`} data-testid="keyboard" data-level={level} data-tucked={tucked}>
        <div className={`kbd${level !== 'labels' ? ' nolabels' : ''}`} ref={kbdRef}>
          {arrow && (
            <svg className="reach" width={arrow.w} height={arrow.h} aria-hidden="true" data-testid="reach" data-from={from ?? ''}>
              <defs>
                <marker id="reach-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                  <path d="M0 0L10 5L0 10z" fill="var(--ink)" />
                </marker>
              </defs>
              <circle cx={arrow.x1} cy={arrow.y1} r="5" fill="var(--ink)" opacity=".55" />
              <line x1={arrow.x1} y1={arrow.y1} x2={arrow.x2} y2={arrow.y2} stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" opacity=".55" markerEnd="url(#reach-head)" />
            </svg>
          )}
          {ROWS.map((r, i) => (
            <div key={r} className={`krow r${i + 1}`}>
              {[...r].map((k) => (
                <div key={k} data-k={k} className={keyClass(k)}>
                  <span className="lbl">{k}</span>
                </div>
              ))}
            </div>
          ))}
          <div className="krow r4">
            <div data-k=" " className={`key space${lit === ' ' ? ' lit' : ''}${wrong === ' ' ? ' wrong' : ''}`}>space</div>
          </div>
        </div>
        <div className="kbdnote">{COPY.practice.tucked}</div>
      </div>
      {!homeOnly && <p className="finger" data-testid="finger-line">{tucked ? '' : line}</p>}
      {onHide && (
        <div className="kfoot">
          <span>{COPY.practice.keyboardNote}</span>
          <span>
            {hintLabel} · <button onClick={onHide}>{COPY.practice.hideKeyboard}</button>
          </span>
        </div>
      )}
    </div>
  );
}
