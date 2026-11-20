import { expect, test } from '@playwright/test';
import { settle } from './helpers';

// Seen at Work Part 3 (V-190) on a phone: the villagers on the map can be drawn in each coat and in
// its plain, ragged and fine looks (the looks made in the page from the coat drawings), with no
// page error. When they wear one is the engine's (outdoors below the comfort line), tested in
// src/worker/clothesview.test.ts; spring has no such cold, so this check dresses them directly.
test('villagers are drawn in every coat and look at 390 px', async ({ page }, info) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await settle(page, 'anvil', 1);
  const game = page.getByTestId('game');
  await expect(game.locator('canvas')).toBeVisible();
  for (const art of ['cloak', 'leather', 'hide'])
    for (const look of ['plain', 'ragged', 'fine']) {
      await game.evaluate((g) => delete g.dataset['coats']);
      await game.evaluate(
        (g, detail) => g.dispatchEvent(new CustomEvent('vulcan:try-coat', { detail })),
        { art, look, left: 50, worth: 'plain' },
      );
      await expect
        .poll(async () => Number(await game.getAttribute('data-coats')))
        .toBeGreaterThan(0);
      if (art === 'hide')
        await info.attach(`hide-${look}`, {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
    }
  expect(errors).toEqual([]);
});
