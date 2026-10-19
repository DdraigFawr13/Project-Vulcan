import { expect, test, type Page } from '@playwright/test';

// The one browser smoke (RULES.md VR-23): the bare link shows the title, a seed opens the site
// picker, a valley is settled, the band's arrival screen names who can build and cook, the
// game draws the map, starts paused, runs at 3x and stops dead when paused; the inspector answers "why?"; a save
// survives a page reload and carries on; the ledger exports; stairs cut while paused open the level
// below once time runs and the inspector leads down them on a phone, then a shaft; a reload
// continues where the game was, shaft and all; the title's Continue names the valley and loads it.
// P2.5 to P2.7: a person's tabs, the Work sheet's stepper, Skip to a notable line and the alerts.
const tick = async (page: Page) =>
  Number(await page.getByTestId('debug').getAttribute('data-tick'));
/** The alert line's newest notable line. */
const alertText = async (page: Page) =>
  (await page.getByTestId('alert').getAttribute('aria-label')) ?? '';
/** The last snapshot's tick and the worker's clock when it was sent (ms). */
// Both read in one step: read one at a time, a busy page can update `at` from a newer snapshot
// between the two, which made a correct 100 a second read as 148 in CI.
const reading = (page: Page) =>
  page
    .getByTestId('debug')
    .evaluate((d) => ({ tick: Number(d.dataset['tick']), at: Number(d.dataset['at']) }));

/** What breaks the phone rules on the screen as shown: small tap targets or text, or overflow. */
const phoneRules = (page: Page) =>
  page.evaluate(() => {
    const shown = (e: Element) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
    };
    const bad: string[] = [];
    for (const b of document.querySelectorAll('#hud button')) {
      const r = b.getBoundingClientRect();
      if (shown(b) && !b.closest('svg') && Math.min(r.width, r.height) < 44)
        bad.push(`tap ${Math.round(Math.min(r.width, r.height))} px: ${b.textContent}`);
    }
    const text = document.createTreeWalker(document.getElementById('hud')!, NodeFilter.SHOW_TEXT);
    while (text.nextNode()) {
      const parent = text.currentNode.parentElement;
      if (!parent || !text.currentNode.textContent!.trim() || parent.closest('svg')) continue;
      const size = parseFloat(getComputedStyle(parent).fontSize);
      if (shown(parent) && size < 11) bad.push(`text ${size} px: ${text.currentNode.textContent}`);
    }
    if (document.documentElement.scrollWidth > innerWidth) bad.push('wider than the screen');
    return bad;
  });

test('the game boots, runs, pauses, inspects, saves, reloads, loads and exports', async ({
  page,
}) => {
  // The whole round makes the world three times (boot, reload, load) and takes about 17 s here; CI's
  // runner takes about 1.5 to 2 times as long, past Playwright's default 30 s per test once P1.2's
  // water joined each generation (P1.1's green run already used about 26 s). The steps keep their
  // own waits; this is the round's overall budget. Since P1.6 each fresh worker that needs the
  // region (the picker, the reload) first makes the seed's Story Generator world: the round went
  // from about 26 s to 42 s here, so up to about 85 s on CI's runner.
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
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
  await expect(page.getByTestId('speed-0')).toHaveAttribute('aria-pressed', 'true');

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
  await expect(page.getByTestId('speed-0')).toHaveAttribute('aria-pressed', 'true');
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
  await expect(panel.getByTestId('save')).toHaveCount(1);
  await expect(panel.getByTestId('save')).toContainText('smoke/2 · Day 1 of Thawmonth, Year 1');
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
  await expect.poll(() => tick(page)).toBe(paused);
  await expect(page.getByTestId('speed-0')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('open-saves').click();
  await panel.getByRole('button', { name: 'Load' }).first().click();
  await expect.poll(() => tick(page)).toBe(paused);
  await expect(page.getByTestId('speed-0')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('speed-3').click();
  await expect.poll(() => tick(page)).toBeGreaterThan(paused);

  // The Stock lever (P2.4): asking for plenty of wood is a ledger line, with no order to anyone.
  await page.getByTestId('open-stock').click();
  await expect(panel.getByTestId('stock-logs')).toContainText('of 50 wanted');
  await panel.getByTestId('stock-logs').getByRole('button', { name: 'Plenty (200)' }).click();
  await expect(panel.getByTestId('stock-logs')).toContainText('of 200 wanted');
  // P3.6: Firewood is its own plate, with the same three levels as Wood (V-048).
  const firewood = panel.getByTestId('stock-firewood');
  await expect(firewood).toContainText(/^Firewood: \d+ of 20 wanted/);
  await expect(firewood.getByRole('button', { name: 'Plenty (60)' })).toBeVisible();
  // P4.5: the Bronze plate is one of the four ingot plates.
  await expect(panel.getByTestId('stock-bronze-ingot')).toContainText('Bronze ingots');
  // P4.7: the Seed plate sits above Food with its own three levels (none, some 100, plenty 200).
  await expect(panel.getByTestId('stock-seed')).toContainText(/^Seed: \d+ of 100 wanted/);
  await expect(
    panel.getByTestId('stock-seed').getByRole('button', { name: 'Plenty (200)' }),
  ).toBeVisible();
  // Food is a stock level too (P2.9). Wanting none means nobody forages, so the band goes hungry
  // when the cart runs out, which the "why?" step below needs.
  await panel.getByTestId('stock-food').getByRole('button', { name: /^None/ }).click();
  await expect(panel.getByTestId('stock-food')).toContainText('none wanted');
  await page.getByTestId('open-ledger').click();
  await expect(panel).toContainText('The colony now wants plenty of wood.');

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
    await expect(panel.getByTestId('test-mode')).toBeVisible();
    const text = await panel.innerText();
    if (!/on it|water/.test(text)) break;
  }
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
  await page.getByTestId('speed-3').click();
  await expect(page.getByTestId('level')).toHaveText('−1');
  await expect(panel).toContainText('1 level down');
  await expect(panel).toContainText('stairs up');
  // From the foot of the stairs a shaft to the deepest level, which the sheet then leads down.
  await panel.getByRole('button', { name: 'Sink a shaft to −4' }).click();
  await panel.getByRole('button', { name: 'Go down to −2' }).click();
  await expect(page.getByTestId('level')).toHaveText('−2');
  await expect(panel).toContainText('shaft');

  // Each face fills its ring exactly, so the head sits centred (Morgan's playtests, twice).
  const faces = await page.locator('.pslot .face').evaluateAll((all) =>
    all.map((f) => {
      const ring = f.getBoundingClientRect();
      const pic = f.querySelector('canvas')!.getBoundingClientRect();
      return (
        Math.abs(pic.x + pic.width / 2 - (ring.x + ring.width / 2)) + pic.width - f.clientWidth
      );
    }),
  );
  expect(
    faces.every((off) => Math.abs(off) < 0.5),
    `face offsets ${faces}`,
  ).toBe(true);

  // P2.5 to P2.7 on a phone. A face opens that person's sheet in tabs; the Work sheet's stepper
  // ranks hauling higher, which is a ledger line naming the person, never an order to a tile.
  await page.locator('.pslot').first().click();
  await panel.getByRole('button', { name: 'Skills' }).click();
  await expect(panel).toContainText('Trade:');
  await panel.getByRole('button', { name: 'Work' }).click();
  await expect(panel).toContainText('Felling');
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByTestId('open-work').click();
  await expect(panel).toContainText("The colony's day");
  await expect(panel.locator('[data-day]')).toHaveCount(0);
  // Bundle 2 (V-071): trades sit under headings; the first begins open and the rest folded. A
  // folded heading's stepper sets every row under it, one priority each, and unfolding shows them.
  const land = panel.locator('.prio.head[data-heading="Land"]');
  await expect(panel.locator('.prio[data-job="farm"]')).toBeHidden();
  await land.getByRole('button', { name: /^Land, every row, for .+: raise$/ }).click();
  await land.locator('.fold').click();
  for (const job of ['farm', 'forage'])
    await expect(panel.locator(`.prio[data-job="${job}"] .val`)).toContainText('2');
  await panel.locator('.prio.head[data-heading="Wood"] .fold').click();
  // P3.4: Carpentry comes from content like the other rows, with its skill line and 44 px steppers.
  const carpentry = panel.locator('.prio[data-job="carpentry"]');
  await expect(carpentry).toContainText(/crafting \d+, can reach \d+/);
  for (const b of await carpentry.getByRole('button').all()) {
    const box = (await b.boundingBox())!;
    expect([box.width, box.height].every((n) => n >= 44)).toBe(true);
  }
  // P4.7: Farming and Cooking come from content with the same steppers.
  await panel.locator('.prio.head[data-heading="Food"] .fold').click();
  for (const [job, name] of [
    ['farm', 'Farming'],
    ['cook', 'Cooking'],
  ] as const)
    await expect(panel.locator(`.prio[data-job="${job}"]`)).toContainText(name);
  // P3.6: Tending is its own row beside Felling and Hauling, with the same four-step priority.
  const tend = panel.locator('.prio[data-job="tend"]');
  await expect(tend).toContainText('Tending');
  await expect(tend).toContainText('no skill needed');
  for (const b of await tend.getByRole('button').all()) {
    const box = (await b.boundingBox())!;
    expect([box.width, box.height].every((n) => n >= 44)).toBe(true);
  }
  expect(await phoneRules(page)).toEqual([]);
  // Scrolled to its foot, the sheet keeps its title and ✕ in view.
  await panel.evaluate((p) => (p.scrollTop = p.scrollHeight));
  const sheet = (await panel.boundingBox())!;
  const close = (await panel.getByRole('button', { name: 'Close panel' }).boundingBox())!;
  expect(close.y).toBeGreaterThanOrEqual(sheet.y);
  expect(close.y + close.height).toBeLessThanOrEqual(sheet.y + sheet.height);
  await panel.getByRole('button', { name: /^Hauling for .+: raise$/ }).click();
  await page.getByTestId('open-ledger').click();
  await expect(panel).toContainText(/ now puts hauling second\./);
  // Skip runs to the next notable line and stops there paused; the alert line opens the feed.
  await page.getByTestId('speed-skip').click();
  await expect(page.getByTestId('speed-0')).toHaveAttribute('aria-pressed', 'true', {
    timeout: 30_000,
  });
  await expect(page.getByTestId('speed-skip')).toHaveAttribute('aria-pressed', 'false');
  await page.getByTestId('alert').click();
  await expect(panel.locator('[data-line]').first()).toBeVisible();
  expect(await phoneRules(page)).toEqual([]);
  // Skips on to the band going hungry (the cart's food lasts about four weeks). Paused, the
  // person sheet's "why?" holds still under a tap (it was rebuilt on every snapshot, so a tap
  // slipped off it) and names the line that ate the last of the food.
  await page.locator('.pslot').first().click();
  await panel.getByRole('button', { name: 'Needs' }).click();
  // Only the Food row's "why?" (VR-63): the "Doing now" line (P2.9) and another low need, such as
  // sleeping in the open before the house stands (P3.7), have their own, which matched first.
  const hungry = panel
    .locator('.need')
    .filter({ hasText: 'Food' })
    .getByRole('button', { name: 'why?' });
  // Skip stops on every notable line, and Phase 3 added many before the food runs out (privacy,
  // boredom, a second room: 14 skips on this seed), so the loop first waits for the line that
  // ate the last of the food on the alert line, then for the hunger it causes.
  const skipOnce = async () => {
    const from = await tick(page);
    await page.getByTestId('speed-skip').click();
    await expect.poll(() => tick(page)).toBeGreaterThan(from);
    await expect(page.getByTestId('speed-skip')).toHaveAttribute('aria-pressed', 'false', {
      timeout: 30_000,
    });
  };
  const foodGone = /ate the last of the band's food/;
  for (let skips = 0; skips < 30 && !foodGone.test(await alertText(page)); skips++)
    await skipOnce();
  expect(await alertText(page)).toMatch(foodGone);
  // Seed grain is eaten under the warning line first (Bundle 1), and Bundle 3's notable lines
  // (a stone tool breaking) stop the skip too: 7 skips on this seed after the merge.
  for (let skips = 0; skips < 10 && (await hungry.count()) === 0; skips++) await skipOnce();
  await hungry.first().click({ timeout: 5000 });
  await expect(panel.getByTestId('chain')).toContainText("ate the last of the band's food");
  // P2.9: the sheet says what they are doing; ⋯ → Yesterday opens the dawn page with the
  // day's figures.
  await expect(panel.getByTestId('doing-now')).toContainText('Doing now');
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByTestId('open-dawn').click();
  await expect(panel.getByTestId('dawn-tally')).toContainText('Logs felled');
  expect(await phoneRules(page)).toEqual([]);
  await panel.getByRole('button', { name: 'Carry on' }).click();
  await expect(panel).toBeHidden();
  // P3.7: the Build sheet under ⋯ has the Houses stepper (the colony's need, never a tile) and
  // the colony's need. A level is a lever that applies at once while paused. Last, so the
  // changed priority does not alter the world the hunger wait above runs in.
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByTestId('open-build').click();
  // P4.7: Fields is a row like Houses, with its need in tiles of crops.
  const fields = page.getByTestId('build-fields');
  await expect(fields).toContainText('Fields');
  await expect(page.getByTestId('build-field-need')).toContainText('tiles of crops');
  for (const b of await fields.getByRole('button').all())
    expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const houses = page.getByTestId('build-houses');
  await expect(houses).toContainText('Houses');
  await expect(page.getByTestId('build-need')).toContainText('Need:');
  for (const b of await houses.getByRole('button').all())
    expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(houses).toContainText('first');
  await houses.getByRole('button', { name: 'Houses: lower' }).click();
  await expect(houses).toContainText('second');
  expect(await phoneRules(page)).toEqual([]);
  // P4.8: ⋯ → Laws has the work-hours law's settings as 44 px buttons, and the Work sheet's day
  // is read-only (no steppers).
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByTestId('open-laws').click();
  await expect(panel).toContainText('Work hours');
  const settings = panel.getByRole('group', { name: 'Work hours law' }).getByRole('button');
  expect(await settings.count()).toBeGreaterThanOrEqual(3);
  for (const b of await settings.all())
    expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await phoneRules(page)).toEqual([]);
  await page.getByTestId('open-ledger').click();
  await expect(panel).toContainText(/ now puts Houses second\./);

  // Bundle 2 mining: wanting some iron ingots (the Stock sheet shows the three ingot plates and
  // their asides) gets the miners to plan a shaft by a stain, an alert whose Show leads to the
  // plan's tile page: its rows, Send back (once) and the aside. Last, so the wanted iron does not alter the world the hunger wait above runs in.
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByTestId('open-stock').click();
  for (const plate of ['Iron ingots', 'Copper ingots', 'Tin ingots'])
    await expect(panel).toContainText(plate);
  await expect(panel.getByTestId('stock-iron-ingot')).toContainText(/ iron ore in the store\./);
  await expect(panel.getByTestId('stock-stone')).toContainText('comes up as stone.');
  await expect(panel).not.toContainText('join this sheet when quarrying');
  await panel.getByTestId('stock-iron-ingot').getByRole('button', { name: 'Some (10)' }).click();
  await page.getByTestId('speed-3').click();
  // The miners look every hour; later alerts (hunger) may sit above the plan, so find its line.
  await page.waitForTimeout(3000);
  await page.getByTestId('speed-0').click();
  await page.getByTestId('alert').click();
  await panel
    .locator('[data-line]')
    .filter({ hasText: 'planned a shaft by the' })
    .first()
    .getByTestId('alert-show')
    .click();
  // Show centres the tile in the part of the screen below the bar.
  const canvas2 = page.getByTestId('game').locator('canvas');
  const mid = (await canvas2.boundingBox())!;
  const bar = await page
    .locator('#hud')
    .evaluate((e) => parseFloat(e.style.getPropertyValue('--bar-h')));
  await canvas2.click({ position: { x: mid.width / 2, y: mid.height / 2 + bar / 2 } });
  await expect(panel).toContainText('Shaft, planned');
  await expect(panel).toContainText('a shaft with a ladder, down to level');
  await expect(panel).toContainText('2 logs for the ladder');
  await expect(panel).toContainText('A plan can be sent back once');
  await panel.getByTestId('send-back-shaft').click();
  await expect(panel.getByTestId('send-back-shaft')).toBeHidden();
  await page.getByTestId('open-ledger').click();
  await expect(panel).toContainText('The shaft plan for iron was sent back');
  await page.getByTestId('speed-3').click();
  await page.setViewportSize({ width: 1280, height: 720 });

  // Closing or reloading keeps the play since the last save: the page holds a standby copy taken
  // every 5 s of play and writes it as the page goes. Wait for one past the shaft, then pause and
  // reload. Paused, so `before` is the worker's own tick: read while running, the page's last
  // snapshot lags the worker, and a standby taken in that gap came back 5 ticks past it in CI.
  await page.waitForTimeout(6000);
  await page.getByTestId('speed-0').click();
  await expect(page.getByTestId('speed-0')).toHaveAttribute('aria-pressed', 'true');
  let before = -1;
  await expect.poll(async () => before === (before = await tick(page))).toBe(true);
  await page.reload();
  await expect.poll(() => tick(page)).toBeGreaterThan(paused);
  expect(await tick(page)).toBeLessThanOrEqual(before);
  await page.keyboard.press('>');
  await expect(page.getByTestId('unreached')).toBeHidden();

  // The bare link now shows the title over the last valley, and Continue carries on there.
  await page.goto('/');
  const resume = page.getByRole('button', { name: /Continue/ });
  // Skip ahead above carried the valley past the first month, so any month of Year 1.
  await expect(resume).toContainText(/\w · Day \d+ of \w+, Year 1/, { timeout: 20_000 });
  await resume.click();
  await expect.poll(() => tick(page)).toBeGreaterThan(paused);
  expect(errors).toEqual([]);
});
