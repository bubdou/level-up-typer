import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { editProfile, freezeClock, open, typeChunk } from './helpers';

const HOME: Record<string, string> = {};
for (const [keys, home] of [['qaz', 'a'], ['wsx', 's'], ['edc', 'd'], ['rfvtgb', 'f'], ['yhnujm', 'j'], ['ik', 'k'], ['ol', 'l'], ['p', ';']] as const) {
  for (const k of keys) HOME[k] = home;
}

/** Store a profile, then give it `known` known letters (of 26) and optionally keys to find. */
async function seed(page: Page, known: number, extra = '') {
  await open(page);
  await page.keyboard.press('Enter');
  await typeChunk(page);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Enter');
  await editProfile(
    page,
    `p.testPerKey = Array(10).fill(200);
     for (const l of 'abcdefghijklmnopqrstuvwxyz'.slice(0, ${known})) p.letters[l] = { pauses: Array(10).fill(100), knownStreak: 2 };
     ${extra}`,
  );
}

const expected = (page: Page) => page.getByTestId('practice').getAttribute('data-expected');
const keyboard = (page: Page) => page.getByTestId('keyboard');

test('the keyboard shows letters, then colours only, then tucks away as letters become known', async ({ page }) => {
  await seed(page, 11);
  await page.keyboard.press('Enter');
  await expect(keyboard(page)).toHaveAttribute('data-level', 'labels');
  await expect(page.locator('.key.rest')).toHaveCount(8);

  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Ready to practice?' })).toBeVisible();
  await editProfile(page, `for (const l of 'abcdefghijklmnop') p.letters[l] = { pauses: Array(10).fill(100), knownStreak: 2 };`);
  await page.keyboard.press('Enter');
  await expect(keyboard(page)).toHaveAttribute('data-level', 'blank');
  await expect(page.locator('.key[data-k="a"] .lbl')).toBeHidden();

  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Ready to practice?' })).toBeVisible();
  await editProfile(page, `for (const l of 'abcdefghijklmnopqrstu') p.letters[l] = { pauses: Array(10).fill(100), knownStreak: 2 };`);
  await page.keyboard.press('Enter');
  await expect(keyboard(page)).toHaveAttribute('data-level', 'tucked');
  await expect(keyboard(page)).toHaveAttribute('data-tucked', 'true');
  await expect(page.getByText('Keyboard tucked away. It pops up if you get stuck.')).toBeVisible();

  // stuck for 2 s: it pops up; the right key tucks it away again
  await freezeClock(page);
  await page.clock.runFor(2300);
  await expect(keyboard(page)).toHaveAttribute('data-tucked', 'false');
  const e1 = (await expected(page))!;
  await page.keyboard.press(e1 === ' ' ? 'Space' : e1);
  await page.clock.runFor(250);
  await expect(keyboard(page)).toHaveAttribute('data-tucked', 'true');

  // a wrong key pops it up at once, with the wrong key framed in red and its letter showing
  const e2 = (await expected(page))!;
  const wrong = e2 === 'q' ? 'w' : 'q';
  await page.keyboard.press(wrong);
  await expect(keyboard(page)).toHaveAttribute('data-tucked', 'false');
  await expect(page.locator(`.key.wrong[data-k="${wrong}"] .lbl`)).toBeVisible();
});

test('a wrong key: red frame for a moment, the right key lights at once, and the line says where it is', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Enter');
  await freezeClock(page);
  const e = (await expected(page))!;
  const wrong = e === 'q' ? 'w' : 'q';
  await page.keyboard.press(wrong);
  await page.clock.runFor(250);
  await expect(page.locator('.key.wrong')).toHaveCount(1);
  await expect(page.locator('.key.wrong')).toHaveAttribute('data-k', wrong);
  await expect(page.locator('.key.lit')).toHaveAttribute('data-k', e);
  await expect(page.getByTestId('finger-line')).toContainText(`You pressed ${wrong}.`);
  await page.clock.runFor(700);
  await expect(page.locator('.key.wrong')).toHaveCount(0);
  await expect(page.getByTestId('finger-line')).toContainText(`You pressed ${wrong}.`);
  await page.keyboard.press(e);
  await page.clock.runFor(250);
  await expect(page.getByTestId('finger-line')).not.toContainText('You pressed');
});

test('a lit key has an arrow from its finger’s home key and names the finger', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Enter');
  await freezeClock(page);
  for (let i = 0; i < 12; i++) {
    await page.clock.runFor(1100);
    const e = (await expected(page))!;
    await expect(page.locator('.key.lit')).toHaveAttribute('data-k', e);
    if (e === ' ') {
      await expect(page.getByTestId('finger-line')).toHaveText('Thumb on the space bar.');
      await expect(page.getByTestId('reach')).toHaveCount(0);
    } else if (HOME[e] === e) {
      await expect(page.getByTestId('finger-line')).toContainText("It's on its home key.");
      await expect(page.getByTestId('reach')).toHaveCount(0);
    } else {
      await expect(page.getByTestId('reach')).toHaveAttribute('data-from', HOME[e]);
      await expect(page.getByTestId('finger-line')).toHaveText(/finger|pinky/);
    }
    await page.keyboard.press(e === ' ' ? 'Space' : e);
  }
});

test('the Keys warm-up keeps the whole keyboard with letters, even when most letters are known', async ({ page }) => {
  await seed(page, 21, `p.pendingTestKeys = ['v', 'w'];`);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('practice')).toHaveAttribute('data-mode', 'keys');
  await expect(keyboard(page)).toHaveAttribute('data-level', 'labels');
  await expect(keyboard(page)).toHaveAttribute('data-tucked', 'false');
});

test('a star in the Keys warm-up: Enter catches it for +5; Enter with no star does nothing', async ({ page }) => {
  await seed(page, 0, `p.pendingTestKeys = ['v', 'w'];`);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('practice')).toHaveAttribute('data-mode', 'keys');
  await freezeClock(page);
  const pos = await page.getByTestId('current').getAttribute('data-pos');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('current')).toHaveAttribute('data-pos', pos!);
  await expect(page.locator('.cur .ch.err, .w.cur .ch.err')).toHaveCount(0);

  for (let i = 0; i < 80 && !(await page.getByTestId('star').count()); i++) {
    const e = (await expected(page))!;
    await page.keyboard.press(e === ' ' ? 'Space' : e);
    await page.clock.runFor(200);
  }
  await expect(page.getByTestId('star')).toBeVisible();
  const xp = Number((await page.getByTestId('round-xp').textContent())!.replace(/\D/g, ''));
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('star')).toHaveCount(0);
  await expect(page.getByTestId('star-caught')).toHaveText('★ +5');
  await expect(page.getByTestId('round-xp')).toContainText(String(xp + 5));
});

test('first-run cards: once before the first practice, and again from Home', async ({ page }) => {
  await open(page, '', { basics: true });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('basics')).toHaveAttribute('data-card', '1');
  await expect(page.getByRole('heading', { name: 'Sit like this' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Fingers home' })).toBeVisible();
  await expect(page.locator('[data-testid="basics"] .key.rest')).toHaveCount(8);
  await expect(page.locator('[data-testid="basics"] .key.rest.dim')).toHaveCount(0);
  await page.getByTestId('basics-next').click();
  await expect(page.getByRole('heading', { name: 'Eyes up' })).toBeVisible();
  await expect(page.getByTestId('basics-next')).toHaveText('Start');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('practice')).toBeVisible();
  await typeChunk(page);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Ready to practice?' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('practice')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  await page.getByTestId('basics-link').click();
  await expect(page.getByTestId('basics')).toBeVisible();
  for (let i = 0; i < 3; i++) await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Ready to practice?' })).toBeVisible();
});

test('a profile from before the cards sees them once too', async ({ page }) => {
  await open(page, '', { basics: true });
  await page.keyboard.press('Enter');
  for (let i = 0; i < 3; i++) await page.keyboard.press('Enter');
  await typeChunk(page);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Enter');
  await editProfile(page, 'delete p.seenBasics;');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('basics')).toBeVisible();
});
