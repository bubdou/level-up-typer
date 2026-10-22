import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { LETTER_PAIRS } from '../src/data/wordlists';
import { freezeClock, open, practiceStep, testStep, typeChunk } from './helpers';

const xpText = (page: Page) => page.getByTestId('level').getByTestId('xp');

test('home shows level, XP bar, next unlock, this week and the collection; tests give no XP', async ({ page }) => {
  await open(page);
  await expect(page.getByTestId('level')).toContainText('Level 1');
  await expect(xpText(page)).toHaveText('0 / 500 XP');
  await expect(page.getByTestId('next-unlock')).toHaveText('Level 2 unlocks Combo');
  await expect(page.getByTestId('week').locator('.day')).toHaveCount(7);
  await expect(page.getByTestId('week-goal')).toHaveText('0 of 4 days. 4 more for +200 XP.');
  await expect(page.getByTestId('home-collection')).toHaveText('0of 476 mastered');
  await expect(page.getByText("Tests don't give XP.")).toBeVisible();

  await page.keyboard.press('t');
  for (let i = 0; i < 40; i++) await testStep(page, i, 7);
  await page.clock.runFor(61_000);
  await expect(page.getByTestId('test-result')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(xpText(page)).toHaveText('0 / 500 XP');
  await expect(page.getByTestId('week-goal')).toHaveText('0 of 4 days. 4 more for +200 XP.');
});

test('practice scores chunks without getting in the way; the summary adds them up', async ({ page }) => {
  await open(page);
  await freezeClock(page);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('round-xp')).toHaveText('+0 XP');
  await expect(page.getByTestId('gamebar')).toContainText('Combo unlocks at level 2');

  await typeChunk(page);
  await expect(page.getByTestId('round-xp')).toHaveText('+10 XP');
  await expect(page.getByTestId('pop')).toHaveText('+10');
  await page.clock.runFor(1000);
  await expect(page.getByTestId('pop')).toHaveCount(0);

  // a miss scores 0, the repair tries score 0, Fixed! scores 15
  await typeChunk(page, { wrong: true });
  await expect(page.getByTestId('round-xp')).toHaveText('+10 XP');
  await typeChunk(page);
  await typeChunk(page);
  await expect(page.getByTestId('round-xp')).toHaveText('+10 XP');
  await typeChunk(page);
  await expect(page.getByText('Fixed! +15')).toBeVisible();
  await expect(page.getByTestId('round-xp')).toHaveText('+25 XP');
  await typeChunk(page);

  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  const points = page.getByTestId('points');
  await expect(page.getByText('Points this round')).toBeVisible();
  await expect(points.locator('tr[data-row="smooth"]')).toContainText('2 × 10');
  await expect(points.locator('tr[data-row="fixed"]')).toContainText('1 × 15');
  await expect(page.getByTestId('points-total')).toHaveText('+35');
  // M1 parts are still there
  await expect(page.getByText('Start time')).toBeVisible();
  await expect(page.getByText('Keys you looked for')).toBeVisible();
  await expect(page.getByTestId('week')).toBeVisible();

  await page.keyboard.press('Enter');
  await expect(xpText(page)).toHaveText('35 / 500 XP');
  await page.getByRole('button', { name: 'Progress', exact: true }).click();
  await expect(page.getByTestId('round-xp-cell')).toHaveText('+35');
});

test('reaching level 2 shows a short bubble and turns on Combo', async ({ page }) => {
  test.setTimeout(180_000);
  await open(page);
  await freezeClock(page);
  await page.keyboard.press('Enter');
  let seen = false;
  for (let i = 0; i < 80 && !seen; i++) {
    await typeChunk(page, { gap: 100 });
    seen = (await page.getByTestId('bubble').count()) > 0;
  }
  const bubble = page.getByTestId('bubble');
  await expect(bubble).toHaveText('Level 2! Combo unlocked');
  // the bubble sits in the game line, away from the chunk strip
  await expect(page.getByTestId('gamebar').getByTestId('bubble')).toBeVisible();
  const box = (await bubble.boundingBox())!;
  const strip = (await page.locator('.stripwrap').boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(strip.y);
  await page.clock.runFor(1500);
  await expect(bubble).toHaveCount(0);
  await expect(page.getByTestId('combo')).toBeVisible();
});

test('the Collection and Power-ups pages', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  const c = page.getByTestId('collection');
  await expect(c.getByRole('heading', { name: 'Collection' })).toBeVisible();
  await expect(page.getByTestId('mastered-count')).toHaveText('0');
  for (const z of ['Letter pairs', 'Short chunks', 'Common words', 'More words', 'Phrases', 'Sentences']) {
    await expect(c.getByRole('heading', { name: z })).toBeVisible();
  }
  await expect(c.locator('svg.dot')).toHaveCount(476 + 4);
  // one open set per track at the start
  await expect(c.locator('.cset:not(:disabled)')).toHaveCount(3);
  await c.locator('.cset:not(:disabled)').first().click();
  await expect(page.getByTestId('set-detail').locator('.chip')).toHaveCount(10);
  await expect(page.getByTestId('set-detail')).toContainText('Letter pairs, set 1');

  await page.getByRole('button', { name: 'Power-ups', exact: true }).click();
  await expect(page.getByText('Power-ups give points or looks. None of them skip a fix.')).toBeVisible();
  for (const id of ['combo', 'spark', 'keyFinder', 'flowChain', 'shield']) {
    await expect(page.getByTestId(`pu-${id}`)).toHaveAttribute('data-unlocked', 'false');
  }
  await expect(page.getByTestId('pu-combo')).toContainText('Level 2');
});

test('settings: looks stay locked, sounds and animations switch off, the week goal changes', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Look').locator('option[value="ocean"]')).toHaveAttribute('disabled', '');
  await expect(page.getByLabel('Look').locator('option[value="ocean"]')).toHaveText('Ocean (level 7)');
  await page.getByLabel('Sounds').uncheck();
  await page.getByLabel('Animations').uncheck();
  await expect(page.locator('html')).toHaveClass(/no-anim/);
  await page.getByLabel('Week goal').selectOption('3');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ready to practice?' })).toBeVisible();
  await expect(page.getByTestId('week-goal')).toHaveText('0 of 3 days. 3 more for +200 XP.');
  await expect(page.locator('html')).toHaveClass(/no-anim/);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Sounds')).not.toBeChecked();
});

test('an M1 profile gets a head start of 300 XP per round, once', async ({ page }) => {
  await open(page, '?minutes=0.2');
  await page.keyboard.press('Enter');
  for (let i = 0; i < 2000; i++) if (!(await practiceStep(page, 200))) break;
  await expect(page.getByTestId('summary')).toBeVisible();
  await page.keyboard.press('Enter');
  // make it look like a profile from before M2: no game document
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('level-up-typer');
        req.onsuccess = () => {
          const tx = req.result.transaction('kv', 'readwrite');
          tx.objectStore('kv').delete('game-v1');
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      }),
  );
  await page.reload();
  await expect(xpText(page)).toHaveText('300 / 500 XP');
  await expect(page.getByTestId('head-start')).toHaveText('Head start: +300 XP for each round you played.');
  await page.reload();
  await expect(xpText(page)).toHaveText('300 / 500 XP');
});

/** Change the stored profile, as if it had been played this far, then reload. */
async function editProfile(page: Page, fn: string) {
  await page.evaluate(
    (body) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('level-up-typer');
        req.onsuccess = () => {
          const tx = req.result.transaction('kv', 'readwrite');
          const store = tx.objectStore('kv');
          const get = store.get('profile-v1');
          get.onsuccess = () => {
            const p = get.result;
            new Function('p', body)(p);
            store.put(p, 'profile-v1');
          };
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      }),
    fn,
  );
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ready to practice?' })).toBeVisible();
}

test('a set with 8 of 10 mastered can be challenged for a medal (M2b)', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page);
  // play one chunk so a profile is stored, then mark 8 letter pairs mastered
  await page.keyboard.press('Enter');
  await typeChunk(page);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Enter');
  const keys = LETTER_PAIRS.slice(0, 8).map((t) => `pairs:${t}`);
  await editProfile(
    page,
    `for (const k of ${JSON.stringify(keys)}) p.items[k] = { history: [], seen: 2, smoothRounds: ['a', 'b'], mastered: true, weak: false };`,
  );
  await expect(page.getByTestId('home-collection')).toHaveText('8of 476 mastered');

  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await page.getByRole('button', { name: /Letter pairs, set 1/ }).click();
  await page.getByTestId('challenge').click();
  await expect(page.getByTestId('practice')).toBeVisible();
  await expect(page.locator('.topbar .mode')).toHaveText('Letter pairs, set 1 challenge');
  await expect(page.locator('.topbar')).toContainText('0:45');
  const allowed = new Set(LETTER_PAIRS.slice(0, 10));
  for (let i = 0; i < 2000; i++) {
    const text = await page.evaluate(() => document.querySelector('[data-testid="current"]')?.getAttribute('data-text') ?? null);
    if (text !== null) expect(allowed.has(text)).toBe(true);
    if (!(await practiceStep(page, 150))) break;
  }
  await expect(page.getByTestId('challenge-result')).toBeVisible();
  await expect(page.getByTestId('medal')).toHaveText('Gold');
  await expect(page.getByText('New best medal!')).toBeVisible();
  if (process.env.TMP_SHOT) await page.screenshot({ path: `${process.env.TMP_SHOT}/m2b-challenge-result.png`, fullPage: true });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('collection')).toBeVisible();
  await expect(page.getByRole('button', { name: /Letter pairs, set 1: .*Gold/ })).toBeVisible();
  // a challenge is not a round
  await page.getByRole('button', { name: 'Progress', exact: true }).click();
  await expect(page.getByTestId('rounds').locator('tbody tr')).toHaveCount(1);
});

test('after 3 tests, a gold line shows the usual pace; beating it says so (M2b)', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page);
  for (let n = 0; n < 3; n++) {
    await page.keyboard.press('t');
    await expect(page.getByTestId('pace-key')).toHaveCount(0);
    for (let i = 0; i < 40; i++) await testStep(page, i, 0, 200);
    await page.clock.runFor(61_000);
    await expect(page.getByTestId('test-result')).toBeVisible();
    await expect(page.getByTestId('pace-ahead')).toHaveCount(0);
    await page.keyboard.press('Enter');
  }
  await page.keyboard.press('t');
  await expect(page.getByTestId('pace-key')).toContainText('Your usual pace');
  for (let i = 0; i < 80; i++) await testStep(page, i, 0, 200);
  await expect(page.locator('.testtext [data-ghost]')).toHaveCount(1);
  await page.clock.runFor(61_000);
  await expect(page.getByTestId('pace-ahead')).toHaveText('Ahead of your usual pace');
  await page.keyboard.press('Enter');
  // the line can be switched off
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Usual-pace line in tests').uncheck();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.keyboard.press('t');
  await expect(page.getByTestId('pace-key')).toHaveCount(0);
});
