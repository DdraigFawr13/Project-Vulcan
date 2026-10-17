import { expect, test } from '@playwright/test';

// The one browser smoke (RULES.md VR-23): the game boots with no page errors.
// P0.4 and P0.5 extend it to run, save and reload.
test('the game boots', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/');
  await expect(page.getByTestId('game').locator('canvas')).toBeVisible();
  expect(errors).toEqual([]);
});
