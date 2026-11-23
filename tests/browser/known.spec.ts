import { expect, test } from '@playwright/test';
import { phoneRules, settle } from './helpers';

// 6W Slice 6 (V-213) on a phone: land nobody has seen draws faded at both zooms and its page says
// only "not yet seen"; the Ledger has a Trips tab; the Scouting row says nobody is out, and its
// stepper works while paused. SHOTS=dir saves the 390 px screenshots for the PR.
async function shot(page: import('@playwright/test').Page, name: string) {
  const dir = process.env['SHOTS'];
  if (dir) await page.screenshot({ path: `${dir}/${name}.png` });
}

test('unseen land is faded and not yet seen; Trips tab and the Scouting row', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await settle(page, 'anvil', 1);
  const canvas = page.locator('#game canvas');
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  // Zoomed right out: the overview, the seen patch round the green in full colour.
  for (let k = 0; k < 4; k += 1)
    await page.mouse.wheel(0, 400).then(() => page.waitForTimeout(250));
  await page.waitForTimeout(600);
  await shot(page, 'known-far');
  // Back in to the tiles and south, past the land seen on arrival (20 tiles round the green).
  for (let k = 0; k < 4; k += 1)
    await page.mouse.wheel(0, -400).then(() => page.waitForTimeout(250));
  await page.waitForTimeout(600);
  await page.keyboard.down('s');
  await page.waitForTimeout(1500);
  await page.keyboard.up('s');
  await page.waitForTimeout(300);
  await shot(page, 'known-near');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height - 120);
  const panel = page.getByTestId('panel');
  await expect(panel.locator('dl.kv')).toContainText('not yet seen');
  // Nothing more about it: no biome, height or what lies there.
  for (const key of ['biome', 'height', 'on it'])
    await expect(panel.locator('dl.kv')).not.toContainText(key);
  await expect(panel).not.toContainText('Last changed');
  await panel.getByRole('button', { name: 'Close panel' }).click();

  await page.getByRole('button', { name: 'Ledger' }).click();
  await panel.getByTestId('ledger-trips').click();
  await expect(panel.getByTestId('trips-head')).toContainText('Nobody is out.');
  await expect(panel.getByTestId('ledger-trips')).toHaveAttribute('aria-pressed', 'true');
  expect(await phoneRules(page)).toEqual([]);
  await shot(page, 'known-trips');

  // Paused since arrival: the Scouting row says nobody is out and its stepper still works.
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByTestId('open-work').click();
  const scout = panel.locator('.prio[data-job="scout"]');
  // The heading that holds Scouting may be open already (the sheet keeps what was unfolded).
  const wild = panel.locator('button.fold[data-heading="Wild"]');
  if ((await wild.getAttribute('aria-expanded')) !== 'true') await wild.click();
  await expect(scout).toBeVisible();
  await expect(scout.getByTestId('scouting-about')).toHaveText('nobody out; no trip yet');
  const before = await scout.locator('.val').innerText();
  await scout.getByRole('button', { name: /: raise$/ }).click();
  await expect(scout.locator('.val')).not.toHaveText(before);
  await shot(page, 'known-scouting');
  expect(errors).toEqual([]);
});
