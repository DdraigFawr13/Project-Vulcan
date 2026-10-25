import { expect, test } from '@playwright/test';

// Phase 5A Bundle 4 on a phone, apart from the smoke so the smoke keeps its time: the Laws page
// folds Work hours to one line and holds the Strangers law, a custom for the whole colony with
// three 44 px settings, Those in need from the start (V-117). It names no stranger and admits no
// one (V-041); the band's word and each answer come from the worker (worker/strangers.test.ts).
test('the Strangers law is a colony-wide setting under a folded Work hours law', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?seed=smoke');
  await expect(page.locator('[data-card]')).toHaveCount(3, { timeout: 20_000 });
  await page.getByTestId('valley-2').click();
  await page.getByRole('button', { name: 'Settle here' }).click();
  await page.getByTestId('arrive').click();
  await expect(page.locator('.pslot').first()).toBeVisible();
  const panel = page.getByTestId('panel');
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByTestId('open-laws').click();
  await expect(panel.getByRole('group', { name: 'Work hours law' })).toHaveCount(0);
  const fold = panel.getByRole('button', { name: 'Show the work hours law' });
  expect((await fold.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const strangers = panel.getByRole('group', { name: 'Strangers law' }).getByRole('button');
  await expect(strangers).toHaveText(['Open door', 'Those in need', 'Closed']);
  for (const b of await strangers.all())
    expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(strangers.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(panel).toContainText('If the band is split, the law decides');
  // Paused, the lever applies at once and the page follows the snapshot.
  await strangers.nth(2).click();
  await expect(strangers.nth(2)).toHaveAttribute('aria-pressed', 'true');
  await expect(panel).toContainText('Set to Closed on');
  await fold.click();
  await expect(panel.getByRole('group', { name: 'Work hours law' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
