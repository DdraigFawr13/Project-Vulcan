import { expect, test } from '@playwright/test';
import { chooseSpeed, phoneRules, stopsAll, tick } from './helpers';

// The one browser smoke (RULES.md VR-23): the bare link shows the title, a seed opens the site
// picker, a valley is settled, the band's arrival screen names who can build and cook, the game
// draws the map, starts paused, runs at 3x and stops dead when paused; the inspector answers "why?";
// a save survives a page reload and carries on; the ledger exports; stairs cut while paused open the
// level below once time runs, then a shaft; a reload continues where the game was, shaft and all;
// the title's Continue names the valley and loads it. The phone sheets are sheets.spec.ts.

test('the game boots, runs, pauses, inspects, saves, reloads, loads and exports', async ({
  page,
}) => {
  // The round loads the game five times (two links, two reloads and a Load); each fresh worker that
  // needs the region first makes the seed's Story Generator world (P1.6), about 5 s here and up to
  // twice that on CI's runner. The steps keep their own waits; this is the round's overall budget.
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  // Play runs on through every line, as it did before stop kinds (V-191): time.spec.ts has them.
  await stopsAll(page, 'note');
  // The bare link with no save: the title offers a new game only.
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'New game' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Continue/ })).toHaveCount(0);
  // The picker: the region's map and three valleys; tapping a number chooses, then settle there.
  // `?debug` keeps the test tools (TEST MODE) that the dig steps below use.
  await page.goto('/?seed=smoke&debug');
  const picker = page.getByTestId('picker');
  // The picker waits on the seed's Story Generator world and its history (P1.6): about 5 s here.
  await expect(picker.locator('[data-card]')).toHaveCount(3, { timeout: 20_000 });
  await page.getByTestId('valley-2').click();
  await picker.getByRole('button', { name: 'Settle here' }).click();
  await expect(picker).toBeHidden();
  await expect(page).toHaveURL(/seed=smoke&site=2/);
  // The band: five cards, who can build and who can cook, then Arrive opens the paused valley.
  const arrival = page.getByTestId('arrival');
  await expect(arrival.locator('.pcard')).toHaveCount(5);
  await expect(arrival).toContainText('Can build:');
  await expect(arrival).toContainText('Can cook:');
  await page.getByTestId('arrive').click();
  await expect(arrival).toHaveCount(0);
  await expect(page.getByTestId('game').locator('canvas')).toBeVisible();
  await expect(page.getByTestId('clock')).toContainText('06:00 · Day 1 of Thawmonth, Year 1');
  // The build's version stamp sits in the bar (phase.PR, or dev outside a PR merge).
  await expect(page.getByTestId('version')).toHaveText(/^v\d+\.(\d+|dev)$/);
  await expect(page.getByTestId('speed-0')).toHaveAttribute('aria-pressed', 'true');

  // Paused at the start, 3x moves the clock, and Space stops it dead: one snapshot may still be on
  // its way, then nothing moves. The rates themselves are src/worker/pace.test.ts.
  const start = await tick(page);
  await chooseSpeed(page, 3);
  await expect.poll(() => tick(page)).toBeGreaterThan(start);
  await page.keyboard.press('Space');
  await expect(page.getByTestId('speed-0')).toHaveAttribute('aria-pressed', 'true');
  let paused = -1;
  await expect.poll(async () => paused === (paused = await tick(page))).toBe(true);
  await page.waitForTimeout(500);
  expect(await tick(page)).toBe(paused);

  // The inspector: a tap names the tile and the line that laid it out, a world-generation line
  // with no "why?". In the ledger, the first season's "why?" walks back to the root.
  const panel = page.getByTestId('panel');
  // A tap on someone standing there opens their sheet instead (where they stand depends on how
  // far the 3x run went, which varies with the machine's speed), so that spot is passed over.
  const view = page.getByTestId('game').locator('canvas');
  const middle = (await view.boundingBox())!;
  for (const dx of [0, 40, -40, 80, -80]) {
    await view.click({ position: { x: middle.width / 2 + dx, y: middle.height / 2 } });
    await expect(panel).toContainText(/Tile|Doing now/);
    if (!/Doing now/.test(await panel.innerText())) break;
  }
  await expect(panel).toContainText('Tile');
  await expect(panel).toContainText('The valley took shape');
  await expect(panel).toContainText('fertility');
  // The centre is the camp, so the tile may also list goods with their own "why?".
  const changed = panel.locator('[data-line]', { hasText: 'Last changed' });
  await expect(changed.getByRole('button', { name: 'why?' })).toHaveCount(0);
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
  // Beside the autosave, which holds the standby copies written every 5 s of play.
  const saved = panel.getByTestId('save').filter({ hasNotText: 'AUTO' });
  await expect(saved).toHaveCount(1);
  await expect(saved).toContainText('smoke/2 · Day 1 of Thawmonth, Year 1');
  // The Saves page carries the test mode switch, shown on since the URL has `?debug`.
  await expect(panel.getByTestId('test-switch')).toHaveAttribute('aria-pressed', 'true');
  const download = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Export ledger' }).click();
  const file = await download;
  // Gzipped NDJSON since P2.0: the archived days and the recent ones, joined as gzip members.
  expect(file.suggestedFilename()).toBe(`smoke-2-tick-${paused}.ndjson.gz`);
  const { readFile } = await import('node:fs/promises');
  const { gunzipSync } = await import('node:zlib');
  const text = gunzipSync(await readFile(await file.path())).toString('utf8');
  const first = JSON.parse(text.split('\n')[0]!);
  expect(first).toMatchObject({ id: 1, type: 'world.begun', data: { seed: 'smoke/2' } });

  // A reload continues the newest save of this valley rather than beginning a new Day 1.
  await page.reload();
  // The load waits on the valley's Story Generator world, made afresh in the new worker, as the
  // picker does (about 3 s here): hence the picker's wait.
  await expect.poll(() => tick(page), { timeout: 20_000 }).toBe(paused);
  await expect(page.getByTestId('speed-0')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('open-saves').click();
  await panel.getByRole('button', { name: 'Load' }).first().click();
  await expect.poll(() => tick(page)).toBe(paused);
  await expect(page.getByTestId('speed-0')).toHaveAttribute('aria-pressed', 'true');
  await chooseSpeed(page, 3);
  await expect.poll(() => tick(page)).toBeGreaterThan(paused);

  // The levels below: level 1 is blank until a shaft reaches it, then it opens and inspects.
  await page.keyboard.press('>');
  await expect(page.getByTestId('level')).toHaveText('−1');
  await expect(page.getByTestId('unreached')).toBeVisible();
  await page.keyboard.press('<');
  // A shaft cannot go down through a tree or water, so tap around the centre for open ground. A tap
  // on someone standing there opens their sheet instead (where they stand depends on how far the
  // valley ran, which varies with the machine's speed: CI, PR #70), so that spot is passed over.
  const canvas = page.getByTestId('game').locator('canvas');
  const box = (await canvas.boundingBox())!;
  for (const [dx, dy] of [0, 40, -40, 80, -80].flatMap((dx) =>
    [0, 40, -40].map((dy) => [dx, dy]),
  )) {
    await canvas.click({ position: { x: box.width / 2 + dx!, y: box.height / 2 + dy! } });
    await expect(panel).toContainText(/ground|Doing now/);
    const text = await panel.innerText();
    if (/Doing now/.test(text)) continue;
    if (!/on it|water/.test(text)) break;
  }
  await expect(panel).toContainText('ground');
  await expect(panel.getByTestId('test-mode')).toBeVisible();
  // Stairs on a phone, ordered while paused: the order applies at once (Morgan's playtest), so the
  // sheet shows the stairs with a way down before time runs, and follows it (it covers the level
  // buttons). The bar says test mode is on.
  await page.setViewportSize({ width: 390, height: 844 });
  // Hearth and Page on a phone (UI_STYLE.md): every tap target 40 px or more, every text 11 px or
  // more, nothing wider than the screen, and Region and Saves folded under ⋯.
  expect(await phoneRules(page)).toEqual([]);
  await expect(page.getByTestId('open-saves')).toBeHidden();
  await page.getByRole('button', { name: 'More' }).click();
  await expect(page.getByTestId('open-saves')).toBeVisible();
  expect(await phoneRules(page)).toEqual([]);
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByTestId('speed-0').click();
  await expect(page.getByTestId('test-badge')).toBeVisible();
  // A plan placed with the test tools (P3.1) shows on the sheet at once while paused, with its
  // material and builder; taken down before anything was brought, it is dropped.
  await panel.getByRole('button', { name: 'Plan floor (wood)' }).click();
  await expect(panel).toContainText('wood floor, planned');
  await expect(panel).toContainText('0 of 2 here');
  expect(await phoneRules(page)).toEqual([]);
  await panel.getByRole('button', { name: 'Take down' }).click();
  await expect(panel.getByRole('button', { name: 'Plan floor (wood)' })).toBeVisible();
  await panel.getByRole('button', { name: 'Cut stairs down' }).click();
  await panel.getByRole('button', { name: 'Go down to −1' }).click();
  await expect(page.getByTestId('speed-0')).toHaveAttribute('aria-pressed', 'true');
  await chooseSpeed(page, 3);
  await expect(page.getByTestId('level')).toHaveText('−1');
  await expect(panel).toContainText('1 level down');
  await expect(panel).toContainText('stairs up');
  // From the foot of the stairs a shaft to the deepest level, which the sheet then leads down.
  await panel.getByRole('button', { name: 'Sink a shaft to −4' }).click();
  await panel.getByRole('button', { name: 'Go down to −2' }).click();
  await expect(page.getByTestId('level')).toHaveText('−2');
  await expect(panel).toContainText('shaft');
  const copies = async () =>
    Number(await page.evaluate(() => document.documentElement.dataset['standby'] ?? 0));
  const copiesBefore = await copies();
  await chooseSpeed(page, 3);
  await page.setViewportSize({ width: 1280, height: 720 });

  // Closing or reloading keeps the play since the last save: the page holds a standby copy taken
  // every 5 s of play and writes it as the page goes. Wait for one past the shaft (the page counts
  // them), then pause and reload. Paused, so `before` is the worker's own tick: read while running,
  // the page's last snapshot lags the worker, and a standby taken in that gap came back 5 ticks
  // past it in CI.
  await expect.poll(copies, { timeout: 20_000 }).toBeGreaterThan(copiesBefore);
  await page.getByTestId('speed-0').click();
  await expect(page.getByTestId('speed-0')).toHaveAttribute('aria-pressed', 'true');
  let before = -1;
  await expect.poll(async () => before === (before = await tick(page))).toBe(true);
  await page.reload();
  await expect.poll(() => tick(page), { timeout: 20_000 }).toBeGreaterThan(paused);
  expect(await tick(page)).toBeLessThanOrEqual(before);
  await page.keyboard.press('>');
  await expect(page.getByTestId('unreached')).toBeHidden();

  // The bare link now shows the title over the last valley, and Continue carries on there.
  await page.goto('/');
  const resume = page.getByRole('button', { name: /Continue/ });
  // Any day of Year 1: how far the valley ran depends on the machine's speed.
  await expect(resume).toContainText(/\w · Day \d+ of \w+, Year 1/, { timeout: 20_000 });
  await resume.click();
  await expect.poll(() => tick(page)).toBeGreaterThan(paused);
  expect(errors).toEqual([]);
});
