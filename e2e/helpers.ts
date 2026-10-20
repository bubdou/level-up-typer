import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/** Open the app with a fake clock so timing is deterministic and fast. */
export async function open(page: Page, query = '') {
  await page.clock.install({ time: new Date('2026-10-19T10:00:00') });
  await page.goto(`/${query}`);
  await expect(page.getByRole('heading', { name: 'Ready to practice?' })).toBeVisible();
}

export const wrongFor = (ch: string) => (ch === 'q' ? 'w' : 'q');

export interface PracticeState {
  mode: string;
  interstitial: string;
  expected: string;
}

export async function practiceState(page: Page): Promise<PracticeState | null> {
  return page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[data-testid="practice"]');
    if (!el) return null;
    return {
      mode: el.dataset.mode ?? '',
      interstitial: el.dataset.interstitial ?? '',
      expected: el.dataset.expected ?? '',
    };
  });
}

/** Type the next expected key in practice. Returns the state before the key, or null when practice is over. */
export async function practiceStep(page: Page, gap = 120): Promise<PracticeState | null> {
  const st = await practiceState(page);
  if (!st) return null;
  if (st.interstitial) {
    await page.clock.runFor(1100);
    return st;
  }
  await page.keyboard.press(st.expected === ' ' ? 'Space' : st.expected);
  await page.clock.runFor(gap);
  return st;
}

/** Type one whole chunk (and its space). */
export async function typeChunk(page: Page, opts: { wrong?: boolean; gap?: number } = {}) {
  const text = (await page.getByTestId('current').getAttribute('data-text'))!;
  const pos = Number(await page.getByTestId('current').getAttribute('data-pos'));
  let first = true;
  for (const ch of text.slice(pos) + ' ') {
    if (first && opts.wrong) await page.keyboard.press(wrongFor(ch));
    first = false;
    await page.keyboard.press(ch === ' ' ? 'Space' : ch);
    await page.clock.runFor(opts.gap ?? 120);
  }
  return text;
}

/** Type in a test. `missEvery` presses a wrong key before every n-th letter. */
export async function testStep(page: Page, i: number, missEvery = 0, gap = 150) {
  const expected = (await page.getByTestId('test').getAttribute('data-expected'))!;
  if (missEvery && i % missEvery === 3 && expected !== ' ') await page.keyboard.press(wrongFor(expected));
  await page.keyboard.press(expected === ' ' ? 'Space' : expected);
  await page.clock.runFor(gap);
}
