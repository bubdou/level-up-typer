// Not a test: `SHOTS=dir npx playwright test e2e/screens.shots.ts` saves screenshots of each screen.
import { test } from '@playwright/test';
import { open, practiceStep, testStep, typeChunk } from './helpers';

const dir = process.env.SHOTS ?? 'test-results/shots';

test('screens', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1100, height: 900 });
  await open(page, '?minutes=2');
  const shot = (name: string) => page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
  await shot('01-home-new');
  await page.keyboard.press('t');
  for (let i = 0; i < 25; i++) await testStep(page, i, 5);
  await shot('02-test');
  await page.clock.runFor(61_000);
  await shot('03-test-result');
  await page.keyboard.press('Enter');
  await shot('04-home-after-test');
  await page.keyboard.press('Enter');
  await page.clock.runFor(200);
  await shot('05-keys');
  for (let i = 0; i < 3000; i++) {
    const st = await practiceStep(page, 250);
    if (!st || st.mode === 'chunks') break;
  }
  await page.clock.runFor(1200);
  await typeChunk(page);
  await page.clock.runFor(1200);
  await shot('06-chunks');
  await typeChunk(page, { wrong: true });
  await typeChunk(page);
  await shot('07-repair');
  await typeChunk(page);
  await typeChunk(page);
  await shot('08-fixed');
  for (let i = 0; i < 3000; i++) {
    const st = await practiceStep(page, 250);
    if (!st || st.mode === 'flow') break;
  }
  await page.clock.runFor(1200);
  await shot('09-flow');
  for (let i = 0; i < 3000; i++) if (!(await practiceStep(page, 250))) break;
  await shot('10-summary');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Progress' }).click();
  await shot('11-progress');
  await page.getByRole('button', { name: 'Settings' }).click();
  await shot('12-settings');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.getByRole('button', { name: 'Home' }).click();
  await page.keyboard.press('Enter');
  await page.clock.runFor(1500);
  await shot('13-dark-practice');
  await page.setViewportSize({ width: 390, height: 844 });
  await shot('14-narrow');
});
