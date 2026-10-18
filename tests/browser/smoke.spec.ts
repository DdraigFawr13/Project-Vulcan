import { expect, test, type Page } from '@playwright/test';

// The one browser smoke (RULES.md VR-23): a seed opens the site picker, a valley is settled, the
// game draws the map, starts paused, runs at 3x and stops dead when paused; the inspector answers "why?"; a save
// survives a page reload and carries on; the ledger exports; a shaft opens the level below; a reload
// continues where the game was, shaft and all.
const tick = async (page: Page) =>
  Number(await page.getByTestId('debug').getAttribute('data-tick'));
/** The last snapshot's tick and the worker's clock when it was sent (ms). */
const reading = async (page: Page) => {
  const debug = page.getByTestId('debug');
  return {
    tick: Number(await debug.getAttribute('data-tick')),
    at: Number(await debug.getAttribute('data-at')),
  };
};

test('the game boots, runs, pauses, inspects, saves, reloads, loads and exports', async ({
  page,
}) => {
  // The whole round makes the world three times (boot, reload, load) and takes about 17 s here; CI's
  // runner takes about 1.5 to 2 times as long, past Playwright's default 30 s per test once P1.2's
  // water joined each generation (P1.1's green run already used about 26 s). The steps keep their
  // own waits; this is the round's overall budget.
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  // The picker: the region's map and three valleys; tapping a number chooses, then settle there.
  await page.goto('/?seed=smoke');
  const picker = page.getByTestId('picker');
  await expect(picker.locator('[data-card]')).toHaveCount(3);
  await page.getByTestId('valley-2').click();
  await picker.getByRole('button', { name: 'Settle here' }).click();
  await expect(picker).toBeHidden();
  await expect(page).toHaveURL(/seed=smoke&site=2/);
  await expect(page.getByTestId('game').locator('canvas')).toBeVisible();
  await expect(page.getByTestId('clock')).toContainText('06:00 · Day 1 of Thawmonth, Year 1');
  await expect(page.getByText('Paused')).toBeVisible();

  // Paused at the start: the tick does not move.
  const start = await tick(page);
  await page.waitForTimeout(500);
  expect(await tick(page)).toBe(start);

  // 3x runs 100 game minutes a second; allow for timer jitter in a busy CI runner. Time it by the
  // worker's own clock on each snapshot: the page can show a snapshot late when its thread is busy,
  // and a late first reading made a correct rate look 45% fast in CI.
  await page.getByTestId('speed-3').click();
  const from = await reading(page);
  await page.waitForTimeout(1000);
  const to = await reading(page);
  const ran = ((to.tick - from.tick) * 1000) / (to.at - from.at);
  expect(ran, `${to.tick - from.tick} ticks in ${to.at - from.at} ms`).toBeGreaterThan(50);
  expect(ran, `${to.tick - from.tick} ticks in ${to.at - from.at} ms`).toBeLessThan(130);

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
  await expect(panel).toContainText('The valley took shape');
  await expect(panel).toContainText('fertility');
  await expect(panel.getByRole('button', { name: 'why?' })).toHaveCount(0);
  await page.getByTestId('open-ledger').click();
  const spring = panel.locator('[data-line]', { hasText: 'Spring came to the valley.' });
  await spring.getByRole('button', { name: 'why?' }).click();
  await expect(spring.getByTestId('chain')).toContainText('Thawmonth began.');
  await expect(spring.getByTestId('chain')).toContainText('A new world began from seed "smoke/2".');
  await expect(panel).toContainText('The band chose');
  // The Region panel shows the region again with the settled valley only.
  await page.getByTestId('open-region').click();
  await expect(panel.getByTestId('valley-2')).toBeVisible();
  await expect(panel.getByTestId('valley-1')).toHaveCount(0);

  // Save, export, reload the page, load: the clock picks up at the saved tick and keeps going.
  await page.getByTestId('open-saves').click();
  await panel.getByRole('button', { name: 'Save now' }).click();
  await expect(panel.getByTestId('save')).toHaveCount(1);
  await expect(panel.getByTestId('save')).toContainText('smoke/2 · Day 1 of Thawmonth, Year 1');
  const download = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Export ledger' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(`smoke-2-tick-${paused}.ndjson`);
  const { readFile } = await import('node:fs/promises');
  const first = JSON.parse((await readFile(await file.path(), 'utf8')).split('\n')[0]!);
  expect(first).toMatchObject({ id: 1, type: 'world.begun', data: { seed: 'smoke/2' } });

  // A reload continues the newest save of this valley rather than beginning a new Day 1.
  await page.reload();
  await expect.poll(() => tick(page)).toBe(paused);
  await expect(page.getByText('Paused')).toBeVisible();
  await page.getByTestId('open-saves').click();
  await panel.getByRole('button', { name: 'Load' }).first().click();
  await expect.poll(() => tick(page)).toBe(paused);
  await expect(page.getByText('Paused')).toBeVisible();
  await page.getByTestId('speed-3').click();
  await expect.poll(() => tick(page)).toBeGreaterThan(paused);

  // The levels below: level 1 is blank until a shaft reaches it, then it opens and inspects.
  await page.keyboard.press('>');
  await expect(page.getByTestId('level')).toHaveText('−1');
  await expect(page.getByTestId('unreached')).toBeVisible();
  await page.keyboard.press('<');
  // A shaft cannot go down through a tree or water, so tap around the centre for open ground.
  const canvas = page.getByTestId('game').locator('canvas');
  const box = (await canvas.boundingBox())!;
  for (const [dx, dy] of [0, 40, -40, 80, -80].flatMap((dx) =>
    [0, 40, -40].map((dy) => [dx, dy]),
  )) {
    await canvas.click({ position: { x: box.width / 2 + dx!, y: box.height / 2 + dy! } });
    await expect(panel).toContainText('ground');
    const text = await panel.innerText();
    if (!/on it|water/.test(text)) break;
  }
  await panel.getByRole('button', { name: 'Sink a shaft to −4' }).click();
  await page.keyboard.press('>');
  await expect(page.getByTestId('unreached')).toBeHidden();
  await page.getByTestId('game').locator('canvas').click();
  await expect(panel).toContainText('1 level down');
  await expect(panel).toContainText('shaft');

  // Closing or reloading keeps the play since the last save: the page holds a standby copy taken
  // every 5 s of play and writes it as the page goes. Wait for one past the shaft, then reload.
  await page.waitForTimeout(6000);
  const before = await tick(page);
  await page.reload();
  await expect.poll(() => tick(page)).toBeGreaterThan(paused);
  expect(await tick(page)).toBeLessThanOrEqual(before);
  await page.keyboard.press('>');
  await expect(page.getByTestId('unreached')).toBeHidden();
  expect(errors).toEqual([]);
});
