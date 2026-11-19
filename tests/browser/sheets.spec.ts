import { expect, test, type Page } from '@playwright/test';
import { buttonSides, phoneRules, settle, skipOnce } from './helpers';

// The phone sheets on one settled valley (smoke/2, test mode on), one page for the whole file
// (audit 2026-11-18 F2): each check used to settle its own world, about 5 s of boot apiece. The
// checks run in order on the same game, so the ones that only read come first and the ones that
// skip time, hurt or sicken someone come last. Every lever here is a level, a row or a law, never
// an order to one person or tile (V-041). The smoke (smoke.spec.ts) keeps boot, save and reload.
test.describe.configure({ mode: 'serial', timeout: 90_000 });

let page: Page;
const errors: string[] = [];
const panel = () => page.getByTestId('panel');
const more = (sheet: string) =>
  page
    .getByRole('button', { name: 'More' })
    .click()
    .then(() => page.getByTestId(`open-${sheet}`).click());

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await settle(page, 'smoke', 2);
});
test.afterAll(() => page.close());

test('a face fills its ring, and the person sheet shows what they wear', async () => {
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
  // 5B Bundle 5: the Needs tab ends in Wearing, a row per garment, read-only.
  await page.locator('.pslot').first().click();
  const rows = panel().getByTestId('wearing-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('Everyday');
  await expect(rows.first()).toContainText(/Wool tunic, plain/);
  await expect(rows.first()).toContainText(/came with them · worn \d+% · warms 2°/);
  await expect(rows.last()).toContainText('Outer');
  await expect(rows.last()).toContainText(/Wool cloak, plain/);
  await expect(rows.last()).toContainText(/worn \d+% · warms 4° outdoors/);
  await panel().getByRole('button', { name: 'Skills' }).click();
  await expect(panel()).toContainText('Trade:');
  await panel().getByRole('button', { name: 'Work' }).click();
  await expect(panel()).toContainText('Felling');
  expect(await phoneRules(page)).toEqual([]);
});

test('the Stock sheet has a plate for each good, and a level is a ledger line', async () => {
  await more('stock');
  const p = panel();
  // P2.4: asking for plenty of wood is a ledger line, with no order to anyone.
  await expect(p.getByTestId('stock-logs')).toContainText('of 50 wanted');
  await p.getByTestId('stock-logs').getByRole('button', { name: 'Plenty (200)' }).click();
  await expect(p.getByTestId('stock-logs')).toContainText('of 200 wanted');
  const firewood = p.getByTestId('stock-firewood');
  await expect(firewood).toContainText(/^Firewood: \d+ of 20 wanted/);
  await expect(firewood.getByRole('button', { name: 'Plenty (60)' })).toBeVisible();
  for (const plate of ['Iron ingots', 'Copper ingots', 'Tin ingots', 'Bronze ingots'])
    await expect(p).toContainText(plate);
  await expect(p.getByTestId('stock-iron-ingot')).toContainText(/ iron ore in the store\./);
  await expect(p.getByTestId('stock-stone')).toContainText('comes up as stone.');
  await expect(p).not.toContainText('join this sheet when quarrying');
  await expect(p.getByTestId('stock-seed')).toContainText(/^Seed: \d+ of 100 wanted/);
  await expect(
    p.getByTestId('stock-seed').getByRole('button', { name: 'Plenty (200)' }),
  ).toBeVisible();
  // 5B Bundle 5: the Clothes plate lists the spares and what is held to make more.
  const clothes = p.getByTestId('stock-clothes');
  await expect(clothes).toContainText(/^Clothes: \d+ of \d+ wanted/);
  await expect(clothes.getByRole('button', { name: 'Some (3)' })).toBeVisible();
  for (const kind of ['everyday', 'outer'])
    await expect(clothes.locator('[data-clothes]')).toContainText(kind);
  await expect(clothes.locator('[data-clothes]')).toContainText(/to make them: .*flax/);
  // P5.13: the Candles plate, three levels and a stores line.
  const candles = p.getByTestId('stock-candles');
  await expect(candles).toContainText(/^Candles: \d+ of \d+ wanted/);
  await expect(candles).toContainText('in store');
  await expect(candles).toContainText('To make more:');
  await expect(candles.getByRole('button')).toHaveCount(3);
  // 5B Bundle 4 and 5A Bundle 6: Flour and Herbs plates (the gathering is the colonists' own).
  await expect(p.getByTestId('stock-flour')).toContainText(/flour/i);
  await expect(p.getByTestId('stock-herbs')).toContainText(/herbs/i);
  for (const plate of ['stock-clothes', 'stock-candles']) {
    await p.getByTestId(plate).scrollIntoViewIfNeeded();
    expect(await phoneRules(page)).toEqual([]);
  }
  await page.getByTestId('open-ledger').click();
  await expect(p).toContainText('The colony now wants plenty of wood.');
});

test('the Work sheet: the day strip, headings that fold, and steppers that are ledger lines', async () => {
  await more('work');
  const p = panel();
  await expect(p).toContainText("The colony's day");
  await expect(p.locator('[data-day]')).toHaveCount(0);
  // P5.13: the day strip names the hours worked indoors by light.
  await expect(p.locator('.legend')).toContainText('indoors by light');
  await expect(p.locator('.legend')).toContainText('work in daylight');
  await expect(p.locator('.day')).toHaveAttribute('aria-label', /daylight \d\d:\d\d to \d\d:\d\d/);
  await expect(p.locator('.day i')).toHaveCount(96);
  // 5B Bundle 4: the Mill heading.
  await expect(p.locator('[data-heading="Mill"]').first()).toContainText('Milling, Baking');
  // Bundle 2 (V-071): a folded heading's stepper sets every row under it, one priority each.
  const land = p.locator('.prio.head[data-heading="Land"]');
  await expect(p.locator('.prio[data-job="farm"]')).toBeHidden();
  await land.getByRole('button', { name: /^Land, every row, for .+: raise$/ }).click();
  await land.locator('.fold').click();
  for (const job of ['farm', 'forage'])
    await expect(p.locator(`.prio[data-job="${job}"] .val`)).toContainText('2');
  await p.locator('.prio.head[data-heading="Wood"] .fold').click();
  const carpentry = p.locator('.prio[data-job="carpentry"]');
  await expect(carpentry).toContainText(/crafting \d+, can reach \d+/);
  // A heading over one row (Food, Care) is a label with no stepper or fold.
  await expect(p.locator('.prio.head[data-heading="Food"] button')).toHaveCount(0);
  await expect(p.locator('.prio.head[data-heading="Care"] button')).toHaveCount(0);
  await expect(p.getByTestId('care-note')).toContainText('Binding a bleeding wound');
  for (const [job, name] of [
    ['farm', 'Farming'],
    ['cook', 'Cooking'],
    ['heal', 'Healing'],
    ['tend', 'Tending'],
  ] as const)
    await expect(p.locator(`.prio[data-job="${job}"]`)).toContainText(name);
  await expect(p.locator('.prio[data-job="tend"]')).toContainText('no skill needed');
  for (const job of ['carpentry', 'tend']) {
    const sides = await buttonSides(page, job);
    expect(sides.length).toBeGreaterThan(0);
    expect(
      sides.every((n) => n >= 44),
      `${job} ${sides}`,
    ).toBe(true);
  }
  expect(await phoneRules(page)).toEqual([]);
  // Scrolled to its foot, the sheet keeps its title and ✕ in view.
  await p.evaluate((el) => (el.scrollTop = el.scrollHeight));
  const sheet = (await p.boundingBox())!;
  const close = (await p.getByRole('button', { name: 'Close panel' }).boundingBox())!;
  expect(close.y).toBeGreaterThanOrEqual(sheet.y);
  expect(close.y + close.height).toBeLessThanOrEqual(sheet.y + sheet.height);
  await p.getByRole('button', { name: /^Hauling for .+: raise$/ }).click();
  await page.getByTestId('open-ledger').click();
  await expect(p).toContainText(/ now puts hauling second\./);
});

test('the Build sheet and the Laws page are levels and laws, 44 px each', async () => {
  await more('build');
  const p = panel();
  const fields = p.getByTestId('build-fields');
  await expect(fields).toContainText('Fields');
  await expect(p.getByTestId('build-field-need')).toContainText('tiles of crops');
  const houses = p.getByTestId('build-houses');
  await expect(houses).toContainText('Houses');
  await expect(p.getByTestId('build-need')).toContainText('Need:');
  await expect(p.getByTestId('build-pasture-need')).toContainText('Need:');
  await expect(houses).toContainText('first');
  await houses.getByRole('button', { name: 'Houses: lower' }).click();
  await expect(houses).toContainText('second');
  expect(await phoneRules(page)).toEqual([]);
  // P5.9, P6.5: the Laws page folds every law to one line, one open at a time. The Strangers law
  // is Those in need from the start (V-117); it names no stranger and admits no one.
  await more('laws');
  await expect(p.locator('.lawfold')).toHaveCount(5);
  await expect(p.getByRole('group', { name: 'Work hours law' })).toHaveCount(0);
  await p.getByRole('button', { name: 'Show the strangers law' }).click();
  const strangers = p.getByRole('group', { name: 'Strangers law' }).getByRole('button');
  await expect(strangers).toHaveText(['Open door', 'Those in need', 'Closed']);
  await expect(strangers.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(p).toContainText('If the band is split, the law decides');
  await strangers.nth(2).click();
  await expect(strangers.nth(2)).toHaveAttribute('aria-pressed', 'true');
  await expect(p).toContainText('Set to Closed on');
  await p.getByRole('button', { name: 'Show the work hours law' }).click();
  await expect(p.getByRole('group', { name: 'Strangers law' })).toHaveCount(0);
  const hours = p.getByRole('group', { name: 'Work hours law' }).getByRole('button');
  expect(await hours.count()).toBeGreaterThanOrEqual(3);
  expect(await phoneRules(page)).toEqual([]);
  // P6.5: Short rations is answered by everyone, and the fold line carries the tally.
  await p.getByRole('button', { name: 'Show the rations law' }).click();
  await p
    .getByRole('group', { name: 'Rations law' })
    .getByRole('button', { name: 'Short rations' })
    .click();
  await expect(p.locator('.lawfold[data-law="rations"]')).toContainText(/obey|grumble|refuse/);
  await expect(p).toContainText('days for everyone at full plates');
  expect(await phoneRules(page)).toEqual([]);
  // Back to the custom, so the later tests' valley runs at full plates: nobody answers it.
  await p
    .getByRole('group', { name: 'Rations law' })
    .getByRole('button', { name: 'Full plates' })
    .click();
  await expect(p.locator('.lawfold[data-law="rations"]')).not.toContainText(/obey|grumble|refuse/);
  await page.getByTestId('open-ledger').click();
  await expect(p).toContainText(/ now puts Houses second\./);
});

test('wanting iron plans a shaft the alert shows, and the plan can be sent back once', async () => {
  test.setTimeout(150_000);
  const p = panel();
  await more('stock');
  await p.getByTestId('stock-iron-ingot').getByRole('button', { name: 'Some (10)' }).click();
  // The plan is a notable line, so Skip stops paused on it, before a miner takes it up. Worn tools
  // plan copper and tin shafts first, so skip until iron's rust stain is in the Alerts sheet
  // (another alert on the same tick can take the alert line, as it did in CI).
  const ironPlan = p
    .locator('[data-line]')
    .filter({ hasText: 'planned a shaft by the rust stain' });
  const planned = async () => {
    await page.getByTestId('alert').click();
    return (await ironPlan.count()) > 0;
  };
  for (let skips = 0; skips < 20 && !(await planned()); skips++) await skipOnce(page);
  await ironPlan.first().getByTestId('alert-show').click();
  // Show centres the tile in the part of the screen below the bar.
  const canvas = page.getByTestId('game').locator('canvas');
  const mid = (await canvas.boundingBox())!;
  const bar = await page
    .locator('#hud')
    .evaluate((e) => parseFloat(e.style.getPropertyValue('--bar-h')));
  await canvas.click({ position: { x: mid.width / 2, y: mid.height / 2 + bar / 2 } });
  await expect(p).toContainText('Shaft, planned');
  await expect(p).toContainText('a shaft with a ladder, down to level');
  await expect(p).toContainText('2 logs for the ladder');
  await expect(p).toContainText('A plan can be sent back once');
  await p.getByTestId('send-back-shaft').click();
  await expect(p.getByTestId('send-back-shaft')).toBeHidden();
  await page.getByTestId('open-ledger').click();
  await expect(p).toContainText('The shaft plan for iron was sent back');
});

test('days on, a pasture is laid out with its reason, Herding joins Work, and Yesterday has figures', async () => {
  test.setTimeout(150_000);
  await more('build');
  // Skip stops on every notable line; the pasture's plan comes on day 10 or so on this seed.
  const planned = panel().getByTestId('build-pasture');
  for (let skips = 0; skips < 30 && !(await planned.count()); skips++) await skipOnce(page);
  await expect(planned).toContainText(/pasture/i);
  await expect(panel().getByTestId('send-back-pasture')).toBeVisible();
  // 5A Bundle 3 and 6: with the flock come the Herding row under Land and its watch note.
  await more('work');
  const fold = panel().getByRole('button', { name: '▸ Land' });
  if (await fold.count()) await fold.click();
  await expect(panel().locator('.prio[data-job="herd"]')).toBeVisible();
  await expect(panel().getByTestId('watch-note')).toContainText('Herding also keeps watch');
  // P2.9: the sheet says what they are doing; ⋯ → Yesterday opens the dawn page.
  await page.locator('.pslot').first().click();
  await expect(panel().getByTestId('doing-now')).toContainText('Doing now');
  await more('dawn');
  await expect(panel().getByTestId('dawn-tally')).toContainText('Logs felled');
  expect(await phoneRules(page)).toEqual([]);
  await panel().getByRole('button', { name: 'Carry on' }).click();
  await expect(panel()).toBeHidden();
});

test('a face finds its person on the map, and the names button toggles', async () => {
  // Zoomed all the way out, a face opens their sheet and brings the camera to them, clear of the
  // bar and the sheet (Morgan, 2026-10-25). A view aid only (V-015).
  for (let i = 0; i < 6; i += 1) await page.keyboard.press('-');
  await page.locator('.pslot').nth(2).click();
  await expect(panel()).toBeVisible();
  const game = page.locator('#game');
  await expect(game).toHaveAttribute('data-found', /\d+,\d+/);
  const [x, y] = (await game.getAttribute('data-found'))!.split(',').map(Number);
  const bar = (await page.locator('.strip').boundingBox())!;
  const sheet = (await panel().boundingBox())!;
  expect(x).toBeGreaterThan(390 * 0.3);
  expect(x).toBeLessThan(390 * 0.7);
  expect(y).toBeGreaterThan(bar.y + bar.height);
  expect(y).toBeLessThan(sheet.y);
  const names = page.getByTestId('names');
  await names.click();
  await expect(names).toHaveAttribute('aria-pressed', 'true');
  await names.click();
  await expect(names).toHaveAttribute('aria-pressed', 'false');
  expect(await phoneRules(page)).toEqual([]);
});

test('a hurt and then a sick colonist show on the Health tab and the strip', async () => {
  // P5.6 and P5.7: only the test-mode rows can hurt or sicken anyone (V-041).
  const p = panel();
  await page.locator('.pslot').last().click();
  await p.getByRole('button', { name: 'Health' }).click();
  await expect(p.getByTestId('blood')).toBeVisible();
  await p.getByLabel('Part').selectOption('left-leg');
  await p.getByLabel('Severity').selectOption('deep');
  await p.getByTestId('hurt-go').click();
  await expect(p.getByTestId('wound')).toContainText('left leg · deep');
  await expect(page.locator('.pslot.hurt').last().locator('.hbadge')).toHaveText('+');
  await p.getByLabel('Illness').selectOption('chill');
  await p.getByTestId('sicken-go').click();
  const box = p.getByTestId('illness');
  await expect(box).toContainText('The chill');
  await expect(box).toContainText('by a test-mode order');
  await expect(box.locator('.course i')).not.toHaveCount(0);
  await expect(p.getByTestId('health-state')).toContainText('Sick.');
  expect(await phoneRules(page)).toEqual([]);
});

test('no page error on the way', () => {
  expect(errors).toEqual([]);
});
