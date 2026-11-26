import { expect, test, type Page } from '@playwright/test';
import { phoneRules, settle, tick } from './helpers';

// The player's clock at 390 px (Phase 6T slice 1, V-191): the speed list and keys 1 to 6, the Jump
// ahead tray with where each jump lands, a month jump landing on the first day at 00:00, a year
// jump's progress bar and Stop, and the What stops play sheet kept on the device. Every stop kind is
// Note here, so jumps run to their end; which line stops play is src/worker/stops.test.ts.
test.describe.configure({ mode: 'serial', timeout: 90_000 });

let page: Page;
const errors: string[] = [];
const plate = () => page.getByTestId('speed-plate');
const paused = () =>
  expect(page.getByTestId('speed-0')).toHaveAttribute('aria-pressed', 'true', { timeout: 60_000 });

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await settle(page, 'smoke', 2, true, 'note');
});
test.afterAll(() => page.close());

test('the speed list sets 1× to 6×, and keys 1 to 6 set them too', async () => {
  await plate().click();
  await expect(page.getByTestId('speed-list')).toBeVisible();
  expect(await phoneRules(page)).toEqual([]);
  await page.getByTestId('speed-5').click();
  await expect(page.getByTestId('speed-list')).toBeHidden();
  await expect(plate()).toHaveText('5× ▾');
  await expect(plate()).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('2');
  await expect(plate()).toHaveText('2× ▾');
  await page.keyboard.press('6');
  await expect(plate()).toHaveText('6× ▾');
  await page.keyboard.press('Space');
  await paused();
  await expect(plate()).toHaveText('6× ▾'); // paused, it names the speed Space resumes to
});

test('the tray names where each jump lands, and a month lands on its first day at 00:00', async () => {
  await page.getByTestId('jump-open').click();
  await expect(page.getByTestId('jump-tray')).toBeVisible();
  await expect(page.getByTestId('jump-month')).toContainText('to 1 Seedmonth');
  await expect(page.getByTestId('jump-season')).toContainText('to 1 Highsun, summer');
  await expect(page.getByTestId('jump-year')).toContainText('to 1 Thawmonth, Year 2');
  expect(await phoneRules(page)).toEqual([]);
  await page.getByTestId('jump-month').click();
  await expect(page.getByTestId('jump-tray')).toBeHidden();
  await expect(page.getByTestId('jump-line')).toContainText('Jumping to 1 Seedmonth');
  await paused();
  await expect(page.getByTestId('jump-line')).toBeHidden();
  await expect(page.getByTestId('clock')).toContainText('00:00 · Day 1 of Seedmonth, Year 1');
});

test('a year jump shows its progress, and Stop leaves the game paused', async () => {
  await page.getByTestId('jump-open').click();
  await page.getByTestId('jump-year').click();
  const line = page.getByTestId('jump-line');
  await expect(line).toContainText('Jumping to 1 Thawmonth, Year 2');
  await expect(page.getByTestId('alert')).toBeHidden(); // the jump line takes the alert line's place
  const fill = () =>
    page.evaluate(() => document.querySelector<HTMLElement>('.jumpline .fill')!.offsetWidth);
  await expect.poll(fill).toBeGreaterThan(0);
  expect(await phoneRules(page)).toEqual([]);
  await page.getByTestId('jump-stop').click();
  await paused();
  await expect(line).toBeHidden();
  let at = -1;
  await expect.poll(async () => at === (at = await tick(page))).toBe(true);
  await page.waitForTimeout(300);
  expect(await tick(page)).toBe(at);
});

test('What stops play has a row per kind, opens from the tray and ⋯, and is kept', async () => {
  await page.getByTestId('jump-open').click();
  await page.getByTestId('tray-stops').click();
  const panel = page.getByTestId('panel');
  await expect(panel).toContainText('What stops play');
  await expect(panel.locator('.stoprow')).toHaveCount(13);
  await expect(page.getByTestId('stop-death-note')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('stop-death-pause').click();
  await expect(page.getByTestId('stop-death-pause')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('stop-death-note')).toHaveAttribute('aria-pressed', 'false');
  const kept = await page.evaluate(() => localStorage.getItem('vulcan.stops'));
  expect(JSON.parse(kept ?? '{}')).toMatchObject({ death: 'pause', attack: 'note' });
  expect(await phoneRules(page)).toEqual([]);
  await page.getByRole('button', { name: 'Close panel' }).click();
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByTestId('open-stops').click();
  await expect(panel).toContainText('What stops play');
  // The tray's note follows the sheet: deaths now end a jump early.
  await page.getByTestId('jump-open').click();
  await expect(page.getByTestId('jump-tray')).toContainText(
    'stops early for deaths and bad wounds',
  );
});

test('no page error on the way', () => {
  expect(errors).toEqual([]);
});
