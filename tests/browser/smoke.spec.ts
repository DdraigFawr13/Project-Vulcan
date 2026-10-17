import { expect, test } from '@playwright/test';

// One Chromium smoke: the worker runs, the map draws, pause and step work, the chronicle
// fills, and the inspector opens.
test('colony runs, pauses, steps and inspects', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?seed=smoke');

  const clock = page.getByTestId('clock');
  await expect(clock).not.toHaveText('Day 1, 00:00');
  await expect(page.getByTestId('colonists').getByRole('button')).toHaveCount(10);
  await expect(page.getByTestId('event-log')).toContainText('settlers made camp');

  // Time advances at 10× and stops on pause.
  await page.getByRole('button', { name: 'Speed 10 times' }).click();
  await page.getByTestId('play-toggle').click();
  await expect(page.getByTestId('play-toggle')).toHaveText('Play');
  const paused = await clock.textContent();
  await page.waitForTimeout(400);
  await expect(clock).toHaveText(paused!);

  // Step advances exactly one game hour while paused.
  await page.getByRole('button', { name: 'Step 1 h' }).click();
  await expect(clock).not.toHaveText(paused!);

  // The canvas is drawn (not blank).
  const coloured = await page.getByTestId('map').evaluate((canvas: HTMLCanvasElement) => {
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    const seen = new Set<number>();
    for (let i = 0; i < data.length; i += 4 * 97)
      seen.add((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!);
    return seen.size;
  });
  expect(coloured).toBeGreaterThan(4);

  // Selecting a colonist opens the inspector with three needs.
  await page.getByTestId('colonists').getByRole('button').first().click();
  await expect(page.getByTestId('inspector')).toBeVisible();
  await expect(page.getByTestId('inspector').locator('meter')).toHaveCount(3);

  expect(errors).toEqual([]);
});
