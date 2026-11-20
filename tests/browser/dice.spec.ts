import { expect, test } from '@playwright/test';
import { phoneRules } from './helpers';

// The seed die at 390 px (6W Slice 1, V-192): the title's New game rolls a two-word seed and opens
// its picker, and the picker's die (in place of New seed) rolls another at once. The Saves sheet's
// die, which only fills the box, is checked in sheets.spec.ts on its settled game.
const twoWords = /[?&]seed=([a-z]+-[a-z]+)$/;

test('New game rolls a two-word seed, and the picker die rolls another', async ({ page }) => {
  // Two regions are made from their seeds' Story Generator worlds, about 5 s each here.
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page).toHaveURL(twoWords);
  const first = twoWords.exec(page.url())![1]!;
  const picker = page.getByTestId('picker');
  await expect(picker.locator('[data-card]')).toHaveCount(3, { timeout: 30_000 });
  await expect(picker).toContainText(`Seed ${first}`);
  await expect(picker.getByRole('button', { name: 'New seed', exact: true })).toHaveCount(0);
  await expect(picker.locator('#picker-seed')).toHaveValue(first);
  expect(await phoneRules(page)).toEqual([]);

  const die = picker.getByRole('button', { name: 'Roll a new seed' });
  await expect(die).toHaveCount(1);
  const box = (await die.boundingBox())!;
  expect([box.width, box.height]).toEqual([44, 44]);
  await die.click();
  // A new seed reloads the page on it; the region shows once its world is made.
  await expect(page.locator('[data-card]')).toHaveCount(0, { timeout: 10_000 });
  await expect(page).toHaveURL(twoWords);
  await expect(picker.locator('[data-card]')).toHaveCount(3, { timeout: 30_000 });
  const second = twoWords.exec(page.url())![1]!;
  await expect(picker).toContainText(`Seed ${second}`);
  expect(errors).toEqual([]);
});
