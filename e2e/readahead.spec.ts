import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { editProfile, open, testStep, typeChunk, wrongFor } from './helpers';

/** Left edge of the current chunk, and the strip's box, in page pixels. */
async function geometry(page: Page) {
  return page.evaluate(() => {
    const win = document.querySelector<HTMLElement>('[data-testid="tape"]')!.getBoundingClientRect();
    const cur = document.querySelector<HTMLElement>('[data-testid="current"]')!.getBoundingClientRect();
    const ahead = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="ahead"]')).map((e) => e.getBoundingClientRect());
    return { winLeft: win.left, winWidth: win.width, curLeft: cur.left, curRight: cur.right, ahead: ahead.map((r) => ({ left: r.left, right: r.right })) };
  });
}

/** Wait for the strip's slide (real time: CSS transitions do not follow the fake clock). */
const slideDone = (page: Page) =>
  page.evaluate(() => Promise.all(document.querySelector('.tape')!.getAnimations().map((a) => a.finished)));

async function startPractice(page: Page) {
  await open(page);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('tape')).toBeVisible();
}

test('the current chunk sits at 22% of the strip and the strip slides there after each chunk', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await startPractice(page);
  for (let i = 0; i < 3; i++) {
    await typeChunk(page);
    await slideDone(page);
    const g = await geometry(page);
    expect(Math.abs(g.curLeft - g.winLeft - 0.22 * g.winWidth)).toBeLessThanOrEqual(2);
  }

  // Catch the slide halfway: the current chunk is between where it was and where it ends up.
  const text = (await page.getByTestId('current').getAttribute('data-text'))!;
  for (const ch of text) await page.keyboard.press(ch);
  const before = (await geometry(page)).ahead[0].left;
  await page.keyboard.press('Space');
  const mid = await page.evaluate(() => {
    const anims = document.querySelector('.tape')!.getAnimations();
    for (const a of anims) {
      a.pause();
      a.currentTime = 90;
    }
    return { running: anims.length, left: document.querySelector('[data-testid="current"]')!.getBoundingClientRect().left };
  });
  const g = await geometry(page);
  const target = g.winLeft + 0.22 * g.winWidth;
  expect(mid.running).toBeGreaterThan(0);
  expect(mid.left).toBeLessThan(before - 1);
  expect(mid.left).toBeGreaterThan(target + 1);
});

test('with reduced motion the strip moves at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startPractice(page);
  await typeChunk(page);
  const anims = await page.evaluate(() => document.querySelector('.tape')!.getAnimations().length);
  expect(anims).toBe(0);
  const g = await geometry(page);
  expect(Math.abs(g.curLeft - g.winLeft - 0.22 * g.winWidth)).toBeLessThanOrEqual(2);
});

test('1024x768 shows several whole chunks ahead before the fade; 400px has no sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await startPractice(page);
  let g = await geometry(page);
  const clear = (x: typeof g) => x.ahead.filter((r) => r.left >= x.curRight && r.right <= x.winLeft + 0.82 * x.winWidth).length;
  // Letter pairs and short words: at least 4 whole ones before the 82% line.
  expect(clear(g)).toBeGreaterThanOrEqual(4);

  await page.setViewportSize({ width: 400, height: 760 });
  // The strip re-places itself when its own size changes, which can land a frame after the resize.
  await expect
    .poll(async () => {
      const x = await geometry(page);
      return Math.abs(x.curLeft - x.winLeft - 0.22 * x.winWidth);
    })
    .toBeLessThanOrEqual(2);
  g = await geometry(page);
  expect(clear(g)).toBeGreaterThanOrEqual(1);
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
    return { content: s.content, border: s.borderTopWidth, color: s.borderTopColor };
  });
  expect(shape.content).toBe('""');
  expect(shape.border).toBe('3px');
  await page.keyboard.press('q');
  await expect(page.locator('.tape .sp.at.err')).toHaveCount(1);
  const red = await page.evaluate(() => getComputedStyle(document.querySelector('.tape .sp.at')!, '::after').borderTopColor);
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
