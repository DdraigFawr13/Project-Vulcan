import { expect, test } from '@playwright/test';

// P5.6 on a phone, apart from the smoke so the smoke keeps its time (CI, PR #70): the test-mode
// Hurt tool gives a colonist a deep wound to the left leg; their Health tab shows the wound and the
// Blood bar, and the strip badges them. Nothing but the test-mode row can hurt anyone (V-041).
test('a hurt colonist shows on the Health tab and the strip', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?seed=smoke&debug');
  await expect(page.locator('[data-card]')).toHaveCount(3, { timeout: 20_000 });
  await page.getByTestId('valley-2').click();
  await page.getByRole('button', { name: 'Settle here' }).click();
  await page.getByTestId('arrive').click();
  await expect(page.locator('.pslot').last()).toBeVisible();
  const panel = page.getByTestId('panel');
  await page.locator('.pslot').last().click();
  await panel.getByRole('button', { name: 'Health' }).click();
  await expect(panel.getByTestId('blood')).toBeVisible();
  await panel.getByLabel('Part').selectOption('left-leg');
  await panel.getByLabel('Severity').selectOption('deep');
  await panel.getByTestId('hurt-go').click();
  await expect(panel.getByTestId('wound')).toContainText('left leg · deep');
  await expect(page.locator('.pslot.hurt').last().locator('.hbadge')).toHaveText('+');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
