import { expect, test } from '@playwright/test';

// Phase 5A Bundle 6 on a phone, apart from the smoke so the smoke keeps its time: the Stock sheet
// has a Herbs plate (the gathering is the colonists' own; the lever is the plate, V-041). The
// Work sheet's watch note shows with the Herding row, in flock.spec.ts.
test('the Stock sheet has a Herbs plate', async ({ page }) => {
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
  await page.getByTestId('open-stock').click();
  await expect(panel.getByTestId('stock-herbs')).toContainText(/herbs/i);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
