import { expect, test, type Page } from '@playwright/test';
import { phoneRules, settle, setStop } from './helpers';

// A jump that stops early on a Pause line at 390 px (6T fix A): the card names the line, no recap
// opens over it, and Jump on lands where the jump was going with the recap it passed. That recaps
// a jump passes wait while it is stopped, and go to the Chronicle on Stay here or Stop, is
// src/ui/recaps.test.ts; the worker's loop at a season turn is src/worker/clock.test.ts.
test.describe.configure({ mode: 'serial', timeout: 90_000 });

let page: Page;
const errors: string[] = [];
const card = () => page.getByTestId('jump-stopped');
const seasonJump = async () => {
  await page.getByTestId('jump-open').click();
  await page.getByTestId('jump-season').click();
};

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  // Works lines (built, sited) pause, so a season jump stops in its first days; recaps are on.
  await settle(page, 'smoke', 2, true, 'note', { works: 'pause' }, true);
});
test.afterAll(() => page.context().close());

test('a season jump that stops early shows the line on a card, and no recap', async () => {
  await seasonJump();
  await expect(card()).toBeVisible({ timeout: 30_000 });
  await expect(card()).toContainText('The jump stopped');
  await expect(card().locator('.stopline')).not.toBeEmpty();
  await expect(page.getByTestId('jump-on')).toContainText('to 1 Highsun, summer');
  await expect(page.getByTestId('panel')).not.toHaveAttribute('data-kind', 'recap');
  await expect(page.getByTestId('speed-0')).toHaveAttribute('aria-pressed', 'true');
  expect(await phoneRules(page)).toEqual([]);
  for (const id of ['jump-on', 'jump-stay']) {
    const box = (await page.getByTestId(id).boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(42);
  }
});

test('Stay here closes the card and leaves the game paused', async () => {
  await page.getByTestId('jump-stay').click();
  await expect(card()).toBeHidden();
  await expect(page.getByTestId('speed-0')).toHaveAttribute('aria-pressed', 'true');
});

test('Jump on lands on the first day of summer and opens the spring recap', async () => {
  await seasonJump();
  await expect(card()).toBeVisible({ timeout: 30_000 });
  // Works lines back to Note from the tray, as a player would; the card waits meanwhile.
  await setStop(page, 'works', 'note');
  await page.getByRole('button', { name: 'Close panel' }).click();
  await expect(card()).toBeVisible();
  await page.getByTestId('jump-on').click();
  await expect(card()).toBeHidden();
  await expect(page.getByTestId('panel')).toHaveAttribute('data-kind', 'recap', {
    timeout: 60_000,
  });
  await expect(page.getByTestId('panel').locator('h2')).toHaveText(
    'The chronicle · Spring, year 1',
  );
  await expect(page.getByTestId('clock')).toContainText('Highsun');
});

test('no page error on the way', () => {
  expect(errors).toEqual([]);
});
