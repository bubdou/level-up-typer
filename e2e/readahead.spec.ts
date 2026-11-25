import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { editProfile, open, testStep, typeChunk, wrongFor } from './helpers';

/** Boxes of the window, the current chunk and the chunks ahead, in page pixels. */
async function geometry(page: Page) {
  return page.evaluate(() => {
    const box = (e: Element) => {
      const r = e.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    };
    const win = box(document.querySelector('[data-testid="tape"]')!);
    const cur = box(document.querySelector('[data-testid="current"]')!);
    const ahead = Array.from(document.querySelectorAll('[data-testid="ahead"]')).map(box);
    return { win, cur, ahead };
  });
}

/** Wait for the line change (real time: CSS transitions do not follow the fake clock). */
const moveDone = (page: Page) =>
  page.evaluate(() => Promise.all(document.querySelector('.tape')!.getAnimations().map((a) => a.finished)));

async function startPractice(page: Page) {
  await open(page);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('tape')).toBeVisible();
}

const inside = (r: { left: number; right: number; top: number; bottom: number }, w: { left: number; right: number; top: number; bottom: number }) =>
  r.left >= w.left - 1 && r.right <= w.right + 1 && r.top >= w.top - 1 && r.bottom <= w.bottom + 1;

test('at a line break the text stays still; it moves up one line after the first chunk of the new line', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await startPractice(page);
  const near = (a: number, b: number) => Math.abs(a - b) <= 1;
  let breaks = 0;
  let moves = 0;
  let lastWasBreak = false;
  for (let i = 0; i < 60 && (breaks < 3 || moves < 1); i++) {
    const before = await geometry(page);
    const row = (before.win.bottom - before.win.top) / 3;
    const isBreak = before.ahead[0].top - before.cur.top > 10;
    await typeChunk(page);
    await moveDone(page);
    const after = await geometry(page);
    expect(inside(after.cur, after.win), `step ${i}`).toBe(true);
    expect(near(after.cur.left, before.ahead[0].left), `step ${i}`).toBe(true);
    if (isBreak) {
      // the eyes go to the start of the next line and the text does not move under them
      expect(near(after.cur.top, before.ahead[0].top), `step ${i}`).toBe(true);
      breaks++;
    } else if (!near(after.cur.top, before.ahead[0].top)) {
      // the only move: one line up, right after the first chunk of a new line
      expect(lastWasBreak, `step ${i}`).toBe(true);
      expect(Math.abs(before.ahead[0].top - after.cur.top - row), `step ${i}`).toBeLessThanOrEqual(2);
      moves++;
    }
    // apart from the chunk right after a break, the current line is one of the top two rows
    if (!isBreak) expect(after.cur.top - after.win.top, `step ${i}`).toBeLessThan(2 * row);
    lastWasBreak = isBreak;
  }
  expect(breaks).toBeGreaterThanOrEqual(3);
  expect(moves).toBeGreaterThanOrEqual(1);
});

test('with reduced motion the text moves at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startPractice(page);
  for (let i = 0; i < 25; i++) {
    await typeChunk(page);
    const anims = await page.evaluate(() => document.querySelector('.tape')!.getAnimations().length);
    expect(anims).toBe(0);
    const g = await geometry(page);
    expect(inside(g.cur, g.win)).toBe(true);
  }
});

test('1024x768 shows several whole chunks ahead; 400px has no sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await startPractice(page);
  let g = await geometry(page);
  const clear = (x: typeof g) => x.ahead.filter((r) => inside(r, x.win)).length;
  // Letter pairs and short words: at least 6 whole ones in view.
  expect(clear(g)).toBeGreaterThanOrEqual(6);

  await page.setViewportSize({ width: 400, height: 760 });
  await expect.poll(async () => clear(await geometry(page))).toBeGreaterThanOrEqual(3);
  g = await geometry(page);
  expect(inside(g.cur, g.win)).toBe(true);
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(scroll).toBeLessThanOrEqual(0);
});

test('chunks already shown ahead never change while the strip shows', async ({ page }) => {
  await startPractice(page);
  const ahead = () =>
    page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('[data-testid="ahead"]')).map((e) => `${e.dataset.id}:${e.textContent}`));
  let before = await ahead();
  for (let i = 0; i < 20; i++) {
    if (!(await page.getByTestId('tape').isVisible())) break;
    await typeChunk(page);
    const now = await ahead();
    expect(now.slice(0, -1)).toEqual(before.slice(1));
    before = now;
  }
});

test('the Keys warm-up shows only 3 chunks ahead, with no cue', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Enter');
  await typeChunk(page);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Enter');
  await editProfile(page, `p.pendingTestKeys = ['q', 'z'];`);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('practice')).toHaveAttribute('data-mode', 'keys');
  await expect(page.getByTestId('ahead')).toHaveCount(3);
  const text = (await page.getByTestId('current').getAttribute('data-text'))!;
  await page.keyboard.press(text[0]);
  await expect(page.locator('[data-testid="ahead"][data-cue]')).toHaveCount(0);
});

test('a space is blank; when it is next a space-bar shape shows, red after a miss', async ({ page }) => {
  await startPractice(page);
  await expect(page.locator('.stripwrap')).not.toContainText('·');
  const text = (await page.getByTestId('current').getAttribute('data-text'))!;
  await expect(page.locator('.tape .sp.at')).toHaveCount(0);
  for (const ch of text) await page.keyboard.press(ch);
  await expect(page.locator('.tape .sp.at')).toHaveCount(1);
  const shape = await page.evaluate(() => {
    const s = getComputedStyle(document.querySelector('.tape .sp.at')!, '::after');
    return { content: s.content, height: parseFloat(s.height), color: s.backgroundColor };
  });
  expect(shape.content).toBe('""');
  expect(shape.height).toBeGreaterThan(6);
  await page.keyboard.press('q');
  await expect(page.locator('.tape .sp.at.err')).toHaveCount(1);
  const red = await page.evaluate(() => getComputedStyle(document.querySelector('.tape .sp.at')!, '::after').backgroundColor);
  expect(red).not.toBe(shape.color);
  await page.keyboard.press('Space');
  await expect(page.locator('.tape .sp.at')).toHaveCount(0);

  // the repair bay draws the space the same way
  const next = (await page.getByTestId('current').getAttribute('data-text'))!;
  await page.keyboard.press(wrongFor(next[0]));
  await typeChunk(page);
  await expect(page.getByTestId('repair')).toBeVisible();
  await expect(page.getByTestId('repair')).not.toContainText('·');
  for (const ch of next) await page.keyboard.press(ch);
  await expect(page.locator('[data-testid="repair"] .sp.at')).toHaveCount(1);
});

test('the test page draws the space the same way', async ({ page }) => {
  await open(page);
  await page.keyboard.press('t');
  await expect(page.getByTestId('test')).toBeVisible();
  await expect(page.locator('.testtext')).not.toContainText('·');
  for (let i = 0; i < 40; i++) {
    if ((await page.getByTestId('test').getAttribute('data-expected')) === ' ') break;
    await testStep(page, i);
  }
  await expect(page.locator('.testtext span.sp.at')).toHaveCount(1);
  const content = await page.evaluate(() => getComputedStyle(document.querySelector('.testtext span.sp.at')!, '::after').content);
  expect(content).toBe('""');
});
