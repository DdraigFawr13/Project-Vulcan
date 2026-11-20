import { expect, test } from '@playwright/test';
import { phoneRules, settle, skipOnce } from './helpers';

// 6B Bundle 4 (P6.8, V-187), in its own spec so the smoke keeps its time: from the first hour
// everyone holds their home people's faith, shown on the Memories tab with what it holds sacred;
// the Feasts law sits on the Laws sheet, Customary by custom, and lists its feast days, the harvest
// home first. The shrine's own rows are checked in the worker test (faithview.test.ts): a shrine
// needs the colony's first death, wedding or harvest home, weeks into a run.
test('a person holds a faith, and the Feasts law lists its feast days', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await settle(page, 'smoke', 2);
  await skipOnce(page);
  const panel = page.getByTestId('panel');
  await page.locator('.pslot').first().click();
  await panel.locator('[data-tab="memories"]').click();
  const faith = panel.getByTestId('faith');
  await expect(faith).toContainText(/ · (lukewarm|faithful|devout)/);
  await expect(faith).toContainText(/sacred; abhors/);
  expect(await phoneRules(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByTestId('open-laws').click();
  await expect(panel.locator('.lawfold[data-law="feasts"]')).toContainText('Customary');
  await panel.getByRole('button', { name: 'Show the feasts law' }).click();
  const options = panel.getByRole('group', { name: 'Feasts law' }).getByRole('button');
  await expect(options).toHaveText(['Few', 'Customary', 'Many']);
  await expect(panel).toContainText('The harvest home and up to 2 more feast days a year.');
  const days = panel.getByTestId('feastday');
  await expect(days.first()).toContainText('Harvest home, when the last field is in');
  expect(await phoneRules(page)).toEqual([]);
  expect(errors).toEqual([]);
});
