import { COPY } from './copy';

/** Mac US letter rows. `;` is shown as the right pinky's home key; practice has no `;` yet. */
export const ROWS = ['qwertyuiop', 'asdfghjkl;', 'zxcvbnm'] as const;
/** How far each row starts to the right of the one above, in keys. */
const OFFSET = [0, 0.28, 0.85];

export type Finger = 'l5' | 'l4' | 'l3' | 'l2' | 'r2' | 'r3' | 'r4' | 'r5';

/** Finger for each key: l5 = left little ... l2 = left index, r2 = right index ... r5 = right little. */
export const FINGER: Record<string, Finger> = {};
for (const [keys, f] of [
  ['qaz', 'l5'],
  ['wsx', 'l4'],
  ['edc', 'l3'],
  ['rfvtgb', 'l2'],
  ['yhnujm', 'r2'],
  ['ik', 'r3'],
  ['ol', 'r4'],
  ['p;', 'r5'],
] as const) {
  for (const k of keys) FINGER[k] = f;
}

/** Where each finger rests. */
export const HOME: Record<Finger, string> = { l5: 'a', l4: 's', l3: 'd', l2: 'f', r2: 'j', r3: 'k', r4: 'l', r5: ';' };
export const HOME_KEYS = new Set(Object.values(HOME));

function where(k: string): { r: number; x: number } | null {
  for (let r = 0; r < ROWS.length; r++) {
    const i = ROWS[r].indexOf(k);
    if (i >= 0) return { r, x: i + OFFSET[r] };
  }
  return null;
}

const COUNT = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** Where `target` is from `pressed`, in words: "one key to the left", "one row up and one key to the left". */
export function direction(pressed: string, target: string): string | null {
  const a = where(pressed);
  const b = where(target);
  if (!a || !b) return null;
  const parts: string[] = [];
  const dr = b.r - a.r;
  const n = Math.round(Math.abs(b.x - a.x));
  if (dr !== 0) parts.push(`${COUNT[Math.abs(dr)]} ${Math.abs(dr) === 1 ? 'row' : 'rows'} ${dr < 0 ? 'up' : 'down'}`);
  if (n >= 1) parts.push(`${COUNT[n] ?? n} ${n === 1 ? 'key' : 'keys'} to the ${b.x > a.x ? 'right' : 'left'}`);
  return parts.length ? parts.join(' and ') : 'right next to it';
}

/** The line under the keyboard after a wrong key. It stays until the right key is pressed. */
export function wrongLine(pressed: string, target: string): string {
  const p = COPY.practice;
  if (pressed === ' ') return p.pressedSpace(target);
  if (target === ' ') return p.pressedNowSpace(pressed);
  const dir = direction(pressed, target);
  return dir ? p.pressedDir(pressed, target, dir) : p.pressedFind(pressed, target);
}

/** The line under the keyboard while a key is lit: which finger. */
export function fingerLine(target: string): string {
  if (target === ' ') return COPY.practice.thumb;
  const f = FINGER[target];
  if (!f) return '';
  return HOME[f] === target ? `${COPY.practice.fingers5[f]}. ${COPY.practice.onHome}` : COPY.practice.fingers5[f];
}
