import { expect, test } from '@playwright/test';

// P5.7 on a phone, in its own spec so the smoke keeps its time: the test-mode Make sick tool gives a
// colonist the chill; their Health tab shows the Illness box with its course and cause, and the
// strip badges them. Nothing but the test-mode row can make anyone ill (V-041).
test('a sick colonist shows the Illness box and the strip badge', async ({ page }) => {
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
  await panel.getByLabel('Illness').selectOption('chill');
  await panel.getByTestId('sicken-go').click();
  const box = panel.getByTestId('illness');
  await expect(box).toContainText('The chill');
  await expect(box).toContainText('by a test-mode order');
  await expect(box.locator('.course i')).not.toHaveCount(0);
  await expect(panel.getByTestId('health-state')).toContainText('Sick.');
  await expect(page.locator('.pslot.hurt').last().locator('.hbadge')).toHaveText('+');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
