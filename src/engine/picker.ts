import { CONFIG } from './config';
import type { Item, TrackId } from './content';
import { ITEM_BY_KEY, STAGES, TRACK_ITEMS, unlockedItems } from './content';
import type { Profile } from './profile';

export type Rng = () => number;

export function weightedPick<T>(rng: Rng, options: readonly T[], weight: (t: T) => number): T | undefined {
  const ws = options.map(weight);
  const total = ws.reduce((a, b) => a + b, 0);
  if (options.length === 0 || total <= 0) return undefined;
  let r = rng() * total;
  for (let i = 0; i < options.length; i++) {
    r -= ws[i];
    if (r < 0) return options[i];
  }
  return options[options.length - 1];
}

export const pickOne = <T>(rng: Rng, options: readonly T[]): T | undefined =>
  options.length ? options[Math.floor(rng() * options.length)] : undefined;

/**
 * What a track practices now: every item in the newest unlocked batch, plus older
 * unlocked items that are not mastered yet.
 */
export function trackPool(p: Profile, track: TrackId): Item[] {
  const { all, latest } = unlockedItems(track, p.unlocked[track]);
  const latestKeys = new Set(latest.map((i) => i.key));
  return all.filter((i) => latestKeys.has(i.key) || !p.items[i.key]?.mastered);
}

/** Weak chunks and words: missed or slow and not mastered since. */
export function weakItems(p: Profile, tracks: readonly TrackId[]): Item[] {
  return Object.entries(p.items)
    .filter(([, r]) => r.weak && !r.mastered)
    .map(([k]) => ITEM_BY_KEY.get(k))
    .filter((i): i is Item => !!i && tracks.includes(i.track));
}

/** Weak x2, contains a hunting letter x2, mastered x0.5. */
export function itemWeight(p: Profile, item: Item, hunt: ReadonlySet<string>): number {
  const r = p.items[item.key];
  let w = 1;
  if (r?.weak && !r.mastered) w *= CONFIG.weightWeak;
  if ([...item.text].some((c) => hunt.has(c))) w *= CONFIG.weightHunt;
  if (r?.mastered) w *= CONFIG.weightMastered;
  return w;
}

/** Pick from a pool, never the same text twice in a row. */
export function pickItem(
  rng: Rng,
  p: Profile,
  pool: readonly Item[],
  hunt: ReadonlySet<string>,
  exclude: ReadonlySet<string>,
): Item | undefined {
  const options = pool.filter((i) => !exclude.has(i.text));
  return weightedPick(rng, options.length ? options : pool, (i) => itemWeight(p, i, hunt));
}

/** Words the learner has typed in the words track at least once. */
export function practicedWords(p: Profile): Set<string> {
  return new Set(TRACK_ITEMS.words.filter((i) => (p.items[i.key]?.seen ?? 0) > 0).map((i) => i.text));
}

/** Phrases and sentences from the flow track whose words have all been practiced. */
export function eligibleFlowItems(p: Profile, practiced: ReadonlySet<string>): Item[] {
  return trackPool(p, 'flow').filter((i) => i.text.split(' ').every((w) => practiced.has(w)));
}

/** Short practice items (up to 4 letters, no spaces) that contain one of the given letters. */
export function keysItems(letters: readonly string[]): Item[] {
  const set = new Set(letters);
  return STAGES.filter((s) => s.track !== 'flow')
    .flatMap((s) => TRACK_ITEMS[s.track].filter((i) => i.stage === s.id))
    .filter((i) => i.text.length <= 4 && [...i.text].some((c) => set.has(c)));
}
