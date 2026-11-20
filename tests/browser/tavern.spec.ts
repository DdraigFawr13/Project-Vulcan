import { expect, test } from '@playwright/test';
import { phoneRules, settle } from './helpers';

// 6B Bundle 5 (V-188), in its own spec so the smoke keeps its time: the Build sheet has a Tavern
// row from the first hour, its level a lever like the rest, waiting for the first harvest home.
// The tavern's own page, the bard's songs and bynames need a season or more of play: they are
// checked in the worker tests (tavern.test.ts, taleview.test.ts).
test('the Build sheet has a Tavern row that waits for the harvest home', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await settle(page, 'smoke', 2);
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByTestId('open-build').click();
  const panel = page.getByTestId('panel');
  const need = panel.getByTestId('build-tavern-need');
  await need.scrollIntoViewIfNeeded();
  await expect(need).toHaveText('Need: waits for the first harvest home.');
  const row = panel.getByTestId('build-taverns');
  await expect(row).toContainText('third');
  await row.getByRole('button', { name: 'Tavern: raise' }).click();
  await expect(row).toContainText('second');
  expect(await phoneRules(page)).toEqual([]);
  expect(errors).toEqual([]);
});
