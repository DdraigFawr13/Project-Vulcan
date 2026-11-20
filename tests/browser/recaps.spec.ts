import { expect, test, type Page } from '@playwright/test';
import { phoneRules, settle } from './helpers';

// Season and year recaps on screen at 390 px (Phase 6T slice 3, V-191): a season jump lands on the
// spring recap; its "why?" shows the lines it tells and their chains; Turn off recaps and the two
// switches are kept on the device; the Ledger's Chronicle tab lists every recap. A season's turn at
// a running speed is a month of play (1.8 min at 6× here, PR #170), so that it pauses, which recap a
// year jump shows and the speed Carry on resumes at are src/worker/annals.test.ts and
// src/ui/recaps.test.ts.
test.describe.configure({ mode: 'serial', timeout: 90_000 });

let page: Page;
const errors: string[] = [];
const panel = () => page.getByTestId('panel');
const recapOpen = () => expect(panel()).toHaveAttribute('data-kind', 'recap', { timeout: 60_000 });
const kept = () => page.evaluate(() => JSON.parse(localStorage.getItem('vulcan.recaps')!));
const jump = async (span: string) => {
  await page.getByTestId('jump-open').click();
  await page.getByTestId(`jump-${span}`).click();
};

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await settle(page, 'smoke', 2, true, 'note', {}, true);
});
test.afterAll(() => page.context().close());

test('a season jump lands on the recap, whose "why?" shows the lines it tells', async () => {
  await jump('season');
  await recapOpen();
  await expect(panel().locator('h2')).toHaveText('The chronicle · Spring, year 1');
  await expect(panel().locator('.recaptitle')).not.toBeEmpty();
  await expect(panel()).toContainText('Who came');
  expect(await phoneRules(page)).toEqual([]);
  await page.getByTestId('recap-why').first().click();
  const cited = page.getByTestId('recap-cited').first();
  await expect(cited).toBeVisible();
  await expect(cited.locator('.line').first()).toContainText('Day 1 of Thawmonth');
  await panel().locator('[data-testid="recap-cited"] .why').first().click();
  await expect(panel().getByTestId('chain').first()).toBeVisible();
  // Turn off recaps turns both switches off, kept on the device; a jump ends paused and stays so.
  await page.getByTestId('recap-off').click();
  await expect(panel()).toBeHidden();
  await expect(page.getByTestId('speed-0')).toHaveAttribute('aria-pressed', 'true');
  expect(await kept()).toEqual({ season: false, year: false });
});

test('the Ledger has a Chronicle tab listing every recap', async () => {
  await page.getByRole('button', { name: 'Ledger' }).click();
  await page.getByTestId('ledger-chronicle').click();
  await expect(page.getByTestId('chronicle-entry')).toHaveCount(1);
  await expect(page.getByTestId('chronicle-entry')).toContainText('Spring, year 1');
  expect(await phoneRules(page)).toEqual([]);
  await page.getByTestId('chronicle-entry').click();
  await recapOpen();
  await expect(page.getByTestId('recap-carry')).toBeHidden();
  await page.getByTestId('recap-back').click();
  await expect(page.getByTestId('ledger-chronicle')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('ledger-lines').click();
  await expect(panel().locator('.line').first()).toBeVisible();
  await page.getByRole('button', { name: 'Close panel' }).click();
});

test('What stops play has the two recap switches, kept on the device', async () => {
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByTestId('open-stops').click();
  await expect(page.getByTestId('recaps-season-off')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('recaps-season-on').click();
  await page.getByTestId('recaps-year-on').click();
  await page.getByTestId('recaps-year-off').click();
  await expect(page.getByTestId('recaps-season-on')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('recaps-year-on')).toHaveAttribute('aria-pressed', 'false');
  expect(await kept()).toEqual({ season: true, year: false });
  await page.getByTestId('recaps-season').scrollIntoViewIfNeeded();
  expect(await phoneRules(page)).toEqual([]);
  await page.getByRole('button', { name: 'Close panel' }).click();
});

test('the switches hold in a new game on the same device', async () => {
  const other = await page.context().newPage();
  await settle(other, 'smoke', 1, true, 'note', {}, true);
  await other.getByRole('button', { name: 'More' }).click();
  await other.getByTestId('open-stops').click();
  await expect(other.getByTestId('recaps-season-on')).toHaveAttribute('aria-pressed', 'true');
  await expect(other.getByTestId('recaps-year-off')).toHaveAttribute('aria-pressed', 'true');
  await other.close();
});

test('no page error on the way', () => {
  expect(errors).toEqual([]);
});
