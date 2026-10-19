import { COMMON_WORDS, LETTER_PAIRS, MORE_WORDS, PHRASES, SENTENCES, SHORT_CHUNKS } from '../data/wordlists';
import { CONFIG } from './config';

export type TrackId = 'chunks' | 'words' | 'flow';
export type StageId = 'pairs' | 'short' | 'common' | 'more' | 'phrases' | 'sentences';

export interface Stage {
  id: StageId;
  track: TrackId;
  items: readonly string[];
}

export const STAGES: readonly Stage[] = [
  { id: 'pairs', track: 'chunks', items: LETTER_PAIRS },
  { id: 'short', track: 'chunks', items: SHORT_CHUNKS },
  { id: 'common', track: 'words', items: COMMON_WORDS },
  { id: 'more', track: 'words', items: MORE_WORDS },
  { id: 'phrases', track: 'flow', items: PHRASES },
  { id: 'sentences', track: 'flow', items: SENTENCES },
];

export const stageById = (id: StageId): Stage => STAGES.find((s) => s.id === id)!;

/** A practice item. `key` is unique across stages ("the" is both a short chunk and a word). */
export interface Item {
  key: string;
  stage: StageId;
  track: TrackId;
  text: string;
}

export const itemKey = (stage: StageId, text: string) => `${stage}:${text}`;

const toItems = (s: Stage): Item[] => s.items.map((text) => ({ key: itemKey(s.id, text), stage: s.id, track: s.track, text }));

/** Each track is its stages' items in order; batches of CONFIG.batchSize unlock one by one. */
export const TRACK_ITEMS: Record<TrackId, Item[]> = {
  chunks: STAGES.filter((s) => s.track === 'chunks').flatMap(toItems),
  words: STAGES.filter((s) => s.track === 'words').flatMap(toItems),
  flow: STAGES.filter((s) => s.track === 'flow').flatMap(toItems),
};

export const ALL_ITEMS: Item[] = STAGES.flatMap(toItems);
export const ITEM_BY_KEY = new Map(ALL_ITEMS.map((i) => [i.key, i]));

export const batchCount = (track: TrackId) => Math.ceil(TRACK_ITEMS[track].length / CONFIG.batchSize);

/** Items in the unlocked batches of a track, plus which of them are in the newest batch. */
export function unlockedItems(track: TrackId, unlocked: number): { all: Item[]; latest: Item[] } {
  const n = Math.max(1, Math.min(unlocked, batchCount(track)));
  const all = TRACK_ITEMS[track].slice(0, n * CONFIG.batchSize);
  const latest = all.slice((n - 1) * CONFIG.batchSize);
  return { all, latest };
}

/** The fixed test word pool: Common words and More words. Never depends on training progress. */
export const TEST_POOL: readonly string[] = [...new Set([...COMMON_WORDS, ...MORE_WORDS])];

export const WORD_SET: ReadonlySet<string> = new Set(TEST_POOL);

export const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
