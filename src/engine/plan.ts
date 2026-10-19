import { CONFIG } from './config';
import type { StageId } from './content';
import type { Profile } from './profile';
import { keysLetters } from './profile';

export type SegmentKind = 'keys' | 'chunks' | 'flow' | 'chosen';

export interface Segment {
  kind: SegmentKind;
  ms: number;
  /** Only for 'chosen'. */
  stage?: StageId;
}

/**
 * Today's round: Keys (only when there are keys to find, ~20 s per letter, max 2 min),
 * then the remaining time split about 2:1 between Chunks and Flow.
 * A manual choice replaces all of it with one segment.
 */
export function planRound(p: Profile, minutes: number, choose: StageId | null = null): Segment[] {
  const total = Math.round(minutes * 60_000);
  if (choose) return [{ kind: 'chosen', ms: total, stage: choose }];
  const n = keysLetters(p).length;
  const keys = n > 0 ? Math.min(n * CONFIG.keysMsPerLetter, CONFIG.keysMaxMs, total) : 0;
  const rest = total - keys;
  const chunks = Math.round(rest * CONFIG.chunksShare);
  const segs: Segment[] = [];
  if (keys > 0) segs.push({ kind: 'keys', ms: keys });
  segs.push({ kind: 'chunks', ms: chunks });
  segs.push({ kind: 'flow', ms: rest - chunks });
  return segs.filter((s) => s.ms > 0);
}
