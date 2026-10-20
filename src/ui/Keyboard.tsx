import { COPY } from './copy';

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

/** Finger for each key: l5 = left little ... l2 = left index, r2 = right index ... r5 = right little. */
const FINGER: Record<string, string> = {};
for (const [keys, f] of [
  ['qaz', 'l5'],
  ['wsx', 'l4'],
  ['edc', 'l3'],
  ['rfvtgb', 'l2'],
  ['yhnujm', 'r2'],
  ['ik', 'r3'],
  ['ol', 'r4'],
  ['p', 'r5'],
] as const) {
  for (const k of keys) FINGER[k] = f;
}

interface Props {
  lit: string | null;
  quiet: boolean;
  hintLabel: string;
  onHide: () => void;
}

/** Mac US layout, letter rows and space. F and J carry bumps like the real keys. */
export function Keyboard({ lit, quiet, hintLabel, onHide }: Props) {
  return (
    <div className={`kbd${quiet ? ' quiet' : ''}`} data-testid="keyboard" aria-hidden="false">
      {ROWS.map((r, i) => (
        <div key={r} className={`krow r${i + 1}`}>
          {[...r].map((k) => (
            <div key={k} data-k={k} className={`key ${FINGER[k]}${k === 'f' || k === 'j' ? ' home' : ''}${lit === k ? ' lit' : ''}`}>
              {k}
            </div>
          ))}
        </div>
      ))}
      <div className="krow">
        <div data-k=" " className={`key space${lit === ' ' ? ' lit' : ''}`}>space</div>
      </div>
      <div className="kfoot">
        <span>{COPY.practice.keyboardNote}</span>
        <span>
          {hintLabel} · <button onClick={onHide}>{COPY.practice.hideKeyboard}</button>
        </span>
      </div>
    </div>
  );
}
