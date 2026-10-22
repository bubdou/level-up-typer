import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { open, practiceStep, testStep, typeChunk } from './helpers';

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
  await page.keyboard.press('Enter');
  let seen = false;
  for (let i = 0; i < 80 && !seen; i++) {
    await typeChunk(page, { gap: 100 });
    seen = (await page.getByTestId('bubble').count()) > 0;
  }
  const bubble = page.getByTestId('bubble');
  await expect(bubble).toHaveText('Level 2! Combo unlocked');
  // the bubble sits in the game line, not on the chunk strip, and keys still go through
  const pos = await page.getByTestId('current').getAttribute('data-pos');
  await page.keyboard.press((await page.getByTestId('practice').getAttribute('data-expected'))!);
  await expect(page.getByTestId('current')).not.toHaveAttribute('data-pos', pos!);
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
  await expect(c.locator('svg.dot')).toHaveCount(476 + 3);
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
