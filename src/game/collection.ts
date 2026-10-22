import type { Profile, StageId, TrackId } from '../engine';
import { ALL_ITEMS, CONFIG, STAGES, TRACK_ITEMS } from '../engine';

export type DotState = 'mastered' | 'open' | 'locked';

export interface CollectionSet {
  track: TrackId;
  /** Batch number within the track, from 0. */
  index: number;
  items: { key: string; text: string; state: DotState }[];
  mastered: number;
  open: boolean;
}

export interface Zone {
  stage: StageId;
  track: TrackId;
  sets: CollectionSet[];
  mastered: number;
  total: number;
}

export const masteredCount = (p: Profile) => ALL_ITEMS.filter((i) => p.items[i.key]?.mastered).length;

export const collectionTotal = ALL_ITEMS.length;

/**
 * The Collection, read straight from the engine. One dot per item; sets of 10 are the engine's
 * batches, open once the engine unlocked them. A set that spans two stages is drawn in the stage
 * that holds most of it (the first one on a tie).
 */
export function collection(p: Profile): Zone[] {
  const zones = new Map<StageId, Zone>(
    STAGES.map((s) => [
      s.id,
      { stage: s.id, track: s.track, sets: [], mastered: 0, total: s.items.length },
    ]),
  );
  for (const track of ['chunks', 'words', 'flow'] as const) {
    const items = TRACK_ITEMS[track];
    for (let b = 0; b * CONFIG.batchSize < items.length; b++) {
      const batch = items.slice(b * CONFIG.batchSize, (b + 1) * CONFIG.batchSize);
      const open = b < p.unlocked[track];
      const set: CollectionSet = {
        track,
        index: b,
        open,
        mastered: 0,
        items: batch.map((i) => {
          const m = !!p.items[i.key]?.mastered;
          return { key: i.key, text: i.text, state: m ? 'mastered' : open ? 'open' : 'locked' };
        }),
      };
      set.mastered = set.items.filter((i) => i.state === 'mastered').length;
      const byStage = new Map<StageId, number>();
      for (const i of batch) byStage.set(i.stage, (byStage.get(i.stage) ?? 0) + 1);
      const home = [...byStage.entries()].reduce((a, c) => (c[1] > a[1] ? c : a))[0];
      zones.get(home)!.sets.push(set);
      for (const i of batch) if (p.items[i.key]?.mastered) zones.get(i.stage)!.mastered++;
    }
  }
  return [...zones.values()];
}
