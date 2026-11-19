import { expect, test } from '@playwright/test';
import { alertText, phoneRules, settle, skipOnce } from './helpers';

// P6.6 (V-158, V-159, V-146), in its own spec so the smoke keeps its time: Hunger rations set on
// Day 1 makes the band's grievance shared at once (anvil, smoke and tallow all form a faction by
// day 3 in the engine runs), so a faction forms and its petition reaches the Laws sheet's head with
// its two answers, both 44 px. Letting it stand is a lever on the petition, never on a person. The
// mood word under the clock opens its causes.
test('a faction petitions on the Laws sheet, and the mood word opens its causes', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await settle(page, 'smoke', 2);
  const panel = page.getByTestId('panel');
  const laws = async () => {
    await page.getByRole('button', { name: 'More' }).click();
    await page.getByTestId('open-laws').click();
  };
  await laws();
  await expect(panel.getByTestId('standing')).toContainText('50 · Steady');
  await panel.getByRole('button', { name: 'Show the rations law' }).click();
  await panel
    .getByRole('group', { name: 'Rations law' })
    .getByRole('button', { name: 'Hunger rations' })
    .click();
  await page.keyboard.press('Escape');
  // Skip stops on each notable line; the petition is one (refusals and full plates come first).
  for (let i = 0; i < 20 && !/ask that the Rations law/.test(await alertText(page)); i++)
    await skipOnce(page);
  expect(await alertText(page)).toMatch(/ask that the Rations law be Short rations/);
  await laws();
  const petition = panel.locator('.petition');
  await expect(petition).toContainText('They ask that the Rations law be Short rations');
  await expect(panel.locator('.lawfold[data-law="rations"]')).toContainText(/\(\d\)/);
  expect(await phoneRules(page)).toEqual([]);
  await petition.getByRole('button', { name: 'Let it stand' }).click();
  await expect(petition).toContainText('You let the law stand');
  await expect(panel.locator('.scause').first()).toContainText('The law stood against');
  await page.keyboard.press('Escape');
  await page.getByTestId('mood').click();
  await expect(panel).toContainText("Everyone's mood together");
  await expect(panel.locator('.memrow').first()).toContainText(/people|person/);
  expect(await phoneRules(page)).toEqual([]);
  expect(errors).toEqual([]);
});
