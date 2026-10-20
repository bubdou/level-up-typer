import { expect, test } from '@playwright/test';
import { open, practiceStep, testStep, typeChunk, wrongFor } from './helpers';

test('test flow with the keyboard only: home, 1 min test, result, home', async ({ page }) => {
  await open(page);
  await page.keyboard.press('t');
  await expect(page.getByText('The clock starts when you type.')).toBeVisible();
  await page.clock.runFor(5000);
  await expect(page.getByTestId('clock')).toHaveText('1:00');

  // a wrong key does not move the cursor
  const first = (await page.getByTestId('test').getAttribute('data-expected'))!;
  await page.keyboard.press(wrongFor(first));
  await expect(page.getByTestId('test')).toHaveAttribute('data-expected', first);
  await page.keyboard.press('Backspace');
  await expect(page.getByTestId('test')).toHaveAttribute('data-expected', first);

  for (let i = 0; i < 200 && (await page.getByTestId('test').count()); i++) await testStep(page, i, 9, 300);
  await page.clock.runFor(61_000);
  const result = page.getByTestId('test-result');
  await expect(result).toBeVisible();
  await expect(page.getByTestId('wpm')).toHaveText(/^\d+$/);
  await expect(page.getByTestId('accuracy')).toHaveText(/^\d+%$/);
  await expect(page.getByTestId('missed').locator('.chip')).not.toHaveCount(0);
  await expect(page.getByText('Take one more 1 min test to see your curve.')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByText(/Last test: \d+ wpm/)).toBeVisible();
});

test("today's round with the keyboard only: keys, chunks, flow, summary, home", async ({ page }) => {
  test.setTimeout(180_000);
  await open(page, '?minutes=2');
  // a test with misses queues keys for the Keys segment
  await page.keyboard.press('t');
  for (let i = 0; i < 40; i++) await testStep(page, i, 5);
  await page.clock.runFor(61_000);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('plan')).toContainText('Keys');
  await expect(page.getByTestId('plan')).toContainText('Chunks');
  await expect(page.getByTestId('plan')).toContainText('Flow');

  await page.keyboard.press('Enter');
  await expect(page.getByTestId('practice')).toHaveAttribute('data-mode', 'keys');
  await expect(page.getByText('Keys: find these keys')).toBeVisible();
  const modes = new Set<string>();
  const names = new Set<string>();
  for (let i = 0; i < 3000; i++) {
    const st = await practiceStep(page, 250);
    if (!st) break;
    if (st.interstitial) names.add(st.interstitial);
    else modes.add(st.mode);
  }
  expect([...modes]).toEqual(['keys', 'chunks', 'flow']);
  expect([...names]).toEqual(['chunks', 'flow']);
  await expect(page.getByTestId('summary')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Nice work!' })).toBeVisible();
  await expect(page.getByText('Start time')).toBeVisible();
  await expect(page.getByText('Keys you looked for')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Ready to practice?' })).toBeVisible();
  await expect(page.getByTestId('today')).toContainText(/Today: [12] min/);
});

test('chunk strip, wrong keys, repair bay and Fixed!', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Enter');
  const cur = page.getByTestId('current');
  const text = (await cur.getAttribute('data-text'))!;
  await expect(page.getByTestId('next').locator('span')).toHaveCount(2);
  await expect(page.getByTestId('next').locator('.n1')).not.toHaveText('');

  await page.keyboard.press(wrongFor(text[0]));
  await expect(cur).toHaveAttribute('data-pos', '0');
  await expect(cur.locator('.ch.err')).toHaveCount(1);
  await page.keyboard.press(text[0]);
  await expect(cur).toHaveAttribute('data-pos', '1');
  await expect(page.getByTestId('next').locator('.n1.lit')).toHaveCount(1);
  await typeChunk(page);

  await expect(page.getByTestId('repair')).toBeVisible();
  await expect(page.getByText('Again! 3 clean in a row')).toBeVisible();
  await expect(cur).toHaveAttribute('data-text', text);
  await typeChunk(page);
  await typeChunk(page);
  await expect(page.locator('.dots i.on')).toHaveCount(2);
  await typeChunk(page);
  await expect(page.getByText('Fixed!')).toBeVisible();
  await expect(page.getByTestId('repair')).toHaveCount(0);
  await expect(page.getByTestId('prev')).toContainText(text);
  await page.clock.runFor(1000);
  await expect(page.getByText('Fixed!')).toHaveCount(0);
});

test('Esc and leaving the window pause practice; Space goes on', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Enter');
  await typeChunk(page);
  await page.keyboard.press('Escape');
  await expect(page.getByText('Paused. Press Space to go on.')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('paused')).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByTestId('paused')).toBeVisible();
  await page.keyboard.press('Space');
  await typeChunk(page);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('summary')).toBeVisible();
});

test('leaving the window stops a test; it never reaches the chart', async ({ page }) => {
  await open(page);
  await page.keyboard.press('3');
  await expect(page.getByText('Test · 3 min')).toBeVisible();
  // before the first key, leaving does nothing
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByTestId('test')).toBeVisible();
  for (let i = 0; i < 10; i++) await testStep(page, i);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByText('Test stopped. Try again?')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Test · 3 min')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Progress' }).click();
  await page.getByRole('button', { name: '3 min' }).click();
  await expect(page.getByText('Take two 3 min tests to see your curve.')).toBeVisible();
});

test('key hint lights after 1 s for a new learner, at once in Always mode', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Enter');
  await page.clock.runFor(900);
  await expect(page.locator('.key.lit')).toHaveCount(0);
  await page.clock.runFor(300);
  const expected = (await page.getByTestId('practice').getAttribute('data-expected'))!;
  await expect(page.locator('.key.lit')).toHaveAttribute('data-k', expected);
  await expect(page.locator('.key.home')).toHaveCount(2);

  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Key hints').selectOption('always');
  await page.getByRole('button', { name: 'Home' }).click();
  await page.keyboard.press('Enter');
  await expect(page.locator('.key.lit')).toHaveCount(1);
});

test('input method and Caps Lock warnings', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Enter');
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Process', keyCode: 229, bubbles: true })));
  await expect(page.getByText('Switch your keyboard to ABC to type here.')).toBeVisible();
  await expect(page.getByTestId('current')).toHaveAttribute('data-pos', '0');
  const expected = (await page.getByTestId('practice').getAttribute('data-expected'))!;
  await page.keyboard.press(expected);
  await expect(page.getByText('Switch your keyboard to ABC to type here.')).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'X', modifierCapsLock: true, bubbles: true } as KeyboardEventInit)));
  await expect(page.getByText('Caps Lock is on.')).toBeVisible();
});

test('progress survives a reload, with the curve, rounds and lists', async ({ page }) => {
  await open(page, '?minutes=0.3');
  for (let n = 0; n < 2; n++) {
    await page.keyboard.press('t');
    for (let i = 0; i < 30 + n * 20; i++) await testStep(page, i);
    await page.clock.runFor(61_000);
    await expect(page.getByTestId('test-result')).toBeVisible();
    await page.keyboard.press('Enter');
  }
  await page.keyboard.press('Enter');
  for (let i = 0; i < 2000; i++) if (!(await practiceStep(page, 200))) break;
  await expect(page.getByTestId('summary')).toBeVisible();
  await page.keyboard.press('Enter');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ready to practice?' })).toBeVisible();
  await page.getByRole('button', { name: 'Progress' }).click();
  await expect(page.getByTestId('chart-title')).toHaveText(/Up \d+ wpm since you started|Some days are slower/);
  await expect(page.getByTestId('chart').locator('circle.pt')).toHaveCount(2);
  await expect(page.getByTestId('accuracy-chart')).toBeVisible();
  await expect(page.getByTestId('rounds').locator('tbody tr')).toHaveCount(1);
  await expect(page.getByTestId('rounds').locator('th').last()).toHaveText('Keys to find');
  await expect(page.getByTestId('rounds').locator('tbody tr td').last()).toHaveText(/^(None|[a-z]( [a-z])*)$/);
  await expect(page.getByTestId('hunt-list')).toBeVisible();
  await expect(page.getByTestId('slow-list')).toBeVisible();
});
