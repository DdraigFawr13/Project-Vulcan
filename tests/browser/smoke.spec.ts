import { expect, test, type Page } from '@playwright/test';

// The one browser smoke (RULES.md VR-23): the game boots with no page errors, draws the map,
// starts paused, runs at 3x and stops dead when paused; the inspector answers "why?"; a save
// survives a page reload and carries on; the ledger exports.
const tick = async (page: Page) =>
  Number(await page.getByTestId('debug').getAttribute('data-tick'));

test('the game boots, runs, pauses, inspects, saves, reloads, loads and exports', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?seed=smoke');
  await expect(page.getByTestId('game').locator('canvas')).toBeVisible();
  await expect(page.getByTestId('clock')).toContainText('06:00 · Day 1 of Thawmonth, Year 1');
  await expect(page.getByText('Paused')).toBeVisible();

  // Paused at the start: the tick does not move.
  const start = await tick(page);
  await page.waitForTimeout(500);
  expect(await tick(page)).toBe(start);

  // 3x runs 100 game minutes a second; allow for timer jitter in a busy CI runner.
  await page.getByTestId('speed-3').click();
  await page.waitForTimeout(1000);
  const ran = (await tick(page)) - start;
  expect(ran).toBeGreaterThan(50);
  expect(ran).toBeLessThan(130);

  // Pause stops the tick: one snapshot may still be on its way, then nothing moves.
  await page.keyboard.press('Space');
  await expect(page.getByText('Paused')).toBeVisible();
  await page.waitForTimeout(100);
  const paused = await tick(page);
  await page.waitForTimeout(1000);
  expect(await tick(page)).toBe(paused);

  // The inspector: a tap names the tile and the line that laid it out, a world-generation line
  // with no "why?". In the ledger, the first season's "why?" walks back to the root.
  const panel = page.getByTestId('panel');
  await page.getByTestId('game').locator('canvas').click();
  await expect(panel).toContainText('Tile');
  await expect(panel).toContainText("The valley's ground was laid out");
  await expect(panel.getByRole('button', { name: 'why?' })).toHaveCount(0);
  await page.getByTestId('open-ledger').click();
  const spring = panel.locator('[data-line]', { hasText: 'Spring came to the valley.' });
  await spring.getByRole('button', { name: 'why?' }).click();
  await expect(spring.getByTestId('chain')).toContainText('Thawmonth began.');
  await expect(spring.getByTestId('chain')).toContainText('A new world began from seed "smoke".');

  // Save, export, reload the page, load: the clock picks up at the saved tick and keeps going.
  await page.getByTestId('open-saves').click();
  await panel.getByRole('button', { name: 'Save now' }).click();
  await expect(panel.getByTestId('save')).toHaveCount(1);
  await expect(panel.getByTestId('save')).toContainText('smoke · Day 1 of Thawmonth, Year 1');
  const download = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Export ledger' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(`smoke-tick-${paused}.ndjson`);
  const { readFile } = await import('node:fs/promises');
  const first = JSON.parse((await readFile(await file.path(), 'utf8')).split('\n')[0]!);
  expect(first).toMatchObject({ id: 1, type: 'world.begun', data: { seed: 'smoke' } });

  await page.reload();
  await expect(page.getByTestId('clock')).toContainText('06:00 · Day 1 of Thawmonth, Year 1');
  await page.getByTestId('open-saves').click();
  await panel.getByRole('button', { name: 'Load' }).first().click();
  await expect.poll(() => tick(page)).toBe(paused);
  await expect(page.getByText('Paused')).toBeVisible();
  await page.getByTestId('speed-3').click();
  await expect.poll(() => tick(page)).toBeGreaterThan(paused);
  expect(errors).toEqual([]);
});
