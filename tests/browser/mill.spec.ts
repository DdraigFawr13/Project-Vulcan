import { expect, test } from '@playwright/test';

// 5B Bundle 4 on a phone, apart from the smoke so the smoke keeps its time: the Work sheet has a
// Mill heading (Milling, Baking) and the Stock sheet a Flour plate. The quern, the mill and the
// oven are the colonists' own choice; these rows and the plate are the levers (V-041). The mill's
// page and its wheel are checked in src/worker/mill.test.ts.
test('the Work sheet has a Mill heading and the Stock sheet a Flour plate', async ({ page }) => {
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
  await page.getByTestId('open-work').click();
  await expect(panel.locator('[data-heading="Mill"]').first()).toContainText('Milling, Baking');
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByTestId('open-stock').click();
  await expect(panel.getByTestId('stock-flour')).toContainText(/flour/i);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
