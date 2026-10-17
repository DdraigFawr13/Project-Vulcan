import { expect, test, type Page } from '@playwright/test';

// The one browser smoke (RULES.md VR-23): the game boots with no page errors, draws the map,
// starts paused, runs at 3x and stops dead when paused. P0.5 extends it to save and reload.
const tick = async (page: Page) =>
  Number(await page.getByTestId('debug').getAttribute('data-tick'));

test('the game boots, runs at 3x and pause stops the tick', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?seed=smoke');
  await expect(page.getByTestId('game').locator('canvas')).toBeVisible();
  await expect(page.getByTestId('clock')).toContainText('06:00 · Day 1 of Thawmonth, Year 1');
  await expect(page.getByText('Paused')).toBeVisible();

  // Paused at the start: the tick does not move.
  const start = await tick(page);
  await page.waitForTimeout(500);
  expect(await tick(page)).toBe(start);

  // 3x runs 100 game minutes a second; allow for timer jitter in a busy CI runner.
  await page.getByTestId('speed-3').click();
  await page.waitForTimeout(1000);
  const ran = (await tick(page)) - start;
  expect(ran).toBeGreaterThan(50);
  expect(ran).toBeLessThan(130);

  // Pause stops the tick: one snapshot may still be on its way, then nothing moves.
  await page.keyboard.press('Space');
  await expect(page.getByText('Paused')).toBeVisible();
  await page.waitForTimeout(100);
  const paused = await tick(page);
  await page.waitForTimeout(1000);
  expect(await tick(page)).toBe(paused);
  expect(errors).toEqual([]);
});
