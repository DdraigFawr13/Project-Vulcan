import { expect, test } from '@playwright/test';

// The lamp on screen (P5.13) on a phone, apart from the smoke so the smoke keeps its time: the
// Stock sheet has a Candles plate with three level buttons (42 px or more) and a stores line, and
// the Work sheet's day strip names the hours worked indoors by light.
test('the Candles plate and the day strip show the lamp at 390 px', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?seed=smoke&debug');
  await expect(page.locator('[data-card]')).toHaveCount(3, { timeout: 20_000 });
  await page.getByTestId('valley-2').click();
  await page.getByRole('button', { name: 'Settle here' }).click();
  await page.getByTestId('arrive').click();
  await expect(page.locator('.pslot').first()).toBeVisible();
  const panel = page.getByTestId('panel');

  await page.getByRole('button', { name: 'More' }).click();
  await page.getByTestId('open-stock').click();
  const candles = panel.getByTestId('stock-candles');
  await expect(candles).toContainText(/^Candles: \d+ of \d+ wanted/);
  await expect(candles).toContainText('in store');
  await expect(candles).toContainText('To make more:');
  const sides = await candles
    .getByRole('button')
    .evaluateAll((all) =>
      all.map((b) => Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height)),
    );
  expect(sides).toHaveLength(3);
  for (const side of sides) expect(side).toBeGreaterThanOrEqual(42);

  await page.getByRole('button', { name: 'More' }).click();
  await page.getByTestId('open-work').click();
  await expect(panel).toContainText("The colony's day");
  await expect(panel.locator('.legend')).toContainText('indoors by light');
  await expect(panel.locator('.legend')).toContainText('work in daylight');
  await expect(panel.locator('.day')).toHaveAttribute(
    'aria-label',
    /daylight \d\d:\d\d to \d\d:\d\d/,
  );
  await expect(panel.locator('.day i')).toHaveCount(96);
});
