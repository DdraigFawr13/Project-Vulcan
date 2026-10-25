import { expect, test } from '@playwright/test';

// Finding a colonist on a phone (Morgan, 2026-10-25), apart from the smoke so the smoke keeps its
// time: zoomed all the way out, tapping a face opens their sheet and brings the camera to them,
// clear of the bar and the sheet; the names button lights and goes out. A view aid only (V-015).
test('a face finds its person on the map, and the names button toggles', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?seed=smoke');
  await expect(page.locator('[data-card]')).toHaveCount(3, { timeout: 20_000 });
  await page.getByTestId('valley-2').click();
  await page.getByRole('button', { name: 'Settle here' }).click();
  await page.getByTestId('arrive').click();
  const face = page.locator('.pslot').nth(2);
  await expect(face).toBeVisible();
  for (let i = 0; i < 6; i += 1) await page.keyboard.press('-');
  await face.click();
  await expect(page.getByTestId('panel')).toBeVisible();
  const game = page.locator('#game');
  await expect(game).toHaveAttribute('data-found', /\d+,\d+/);
  const [x, y] = (await game.getAttribute('data-found'))!.split(',').map(Number);
  const bar = (await page.locator('.strip').boundingBox())!;
  const sheet = (await page.getByTestId('panel').boundingBox())!;
  expect(x).toBeGreaterThan(390 * 0.3);
  expect(x).toBeLessThan(390 * 0.7);
  expect(y).toBeGreaterThan(bar.y + bar.height);
  expect(y).toBeLessThan(sheet.y);
  const names = page.getByTestId('names');
  const box = (await names.boundingBox())!;
  expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  await names.click();
  await expect(names).toHaveAttribute('aria-pressed', 'true');
  await names.click();
  await expect(names).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]);
});
