import { expect, test, type Page } from '@playwright/test';
import { phoneRules, settle, skipOnce, tick } from './helpers';

// 6C Slice 4 (V-237): the lord on screen, at 390 px. On smoke's first valley the reeve first names
// the lord on day 144 (engine run, the second harvest home); month jumps reach day 140, then Next
// event steps to his coming, while he is on the map. Nothing of the lord shows before: the favour
// block on Laws and the tithe block on Stock come once he is named. The jumps run months of game,
// so this runs in the `alone` lane (playwright.config.ts). Set SHOTS=1 to save pictures to
// tmp/shots.
const DAY = 1440;
const shot = (page: Page, name: string) =>
  process.env['SHOTS'] ? page.screenshot({ path: `tmp/shots/${name}.png` }) : undefined;

/** One month jump, waited out: the tick moves and the jump ends (paused again). */
async function monthOnce(page: Page) {
  const from = await tick(page);
  await page.getByTestId('jump-open').click({ force: true });
  await page.getByTestId('jump-month').click({ force: true });
  await expect.poll(() => tick(page), { intervals: [50] }).toBeGreaterThan(from);
  await expect(page.getByTestId('jump-open')).toHaveAttribute('aria-pressed', 'false', {
    timeout: 90_000,
  });
}

test('the lord shows on Laws, Stock and the map once his reeve has named him', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await settle(page, 'smoke', 1, true, 'note', { comings: 'pause' });
  const panel = page.getByTestId('panel');
  const game = page.getByTestId('game');
  // Before he is named, Stock has no tithe and Laws no Lord law.
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByTestId('open-stock').click();
  await expect(panel.getByTestId('stock-food')).toBeVisible();
  await expect(panel.getByTestId('stock-tithe')).toHaveCount(0);
  await page.keyboard.press('Escape');
  while ((await tick(page)) < 140 * DAY) await monthOnce(page);
  // Next event until the reeve is on the map: he speaks the lord's name before he leaves.
  for (let n = 0; n < 12 && (await game.getAttribute('data-reeve')) !== '1'; n += 1)
    await skipOnce(page);
  await expect(game).toHaveAttribute('data-reeve', '1');
  // A tap on him opens his page. Paused, the screen still catches up with him: look until two
  // looks find him on the same spot.
  const look = async () => {
    await game.evaluate(async (g) => {
      g.dispatchEvent(new Event('vulcan:find-reeve'));
      for (let i = 0; i < 2; i += 1) await new Promise((done) => requestAnimationFrame(done));
    });
    return game.getAttribute('data-reeve-at');
  };
  let last: string | null = null;
  await expect
    .poll(async () => {
      const at = await look();
      const still = at !== null && at === last;
      last = at;
      return still;
    })
    .toBe(true);
  const [x, y] = last!.split(',').map(Number);
  const box = (await game.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + x!, box.y + y!);
  await expect(panel.getByTestId('reeve-who')).toContainText(
    /^.+, reeve to .+\. An? \w+ of the .+, here on the lord's business with his cart\.$/,
  );
  const rows = panel.getByTestId('reeve-row');
  await expect(rows).toHaveText([/^Doing now/, /^Came/, /^Leaves/, /^The lord's favour/]);
  await expect(rows.nth(1).getByRole('button', { name: 'why?' })).toBeVisible();
  const close = (await panel.getByRole('button', { name: 'Close panel' }).boundingBox())!;
  expect(Math.min(close.width, close.height)).toBeGreaterThanOrEqual(44);
  await shot(page, 'reeve');
  await page.keyboard.press('Escape');
  // Laws: the Lord law, who he is, and his favour with all five steps marked and said.
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByTestId('open-laws').click();
  await expect(panel.locator('.lawfold[data-law="lord"]')).toContainText('Loyal');
  await panel.getByRole('button', { name: 'Show the lord law' }).click();
  await expect(panel.getByTestId('lord-who')).toContainText(
    /^The valley is held by .+ of the .+\. (His|Her) reeve .+ comes the morning after each harvest home;/,
  );
  await expect(panel.getByTestId('favour')).toContainText(/His favour\s*\d+ of 100/);
  const bar = panel.locator('.sbar[aria-label^="Favour"]');
  await expect(bar.locator('b')).toHaveCount(6);
  await expect(panel.locator('.fticks span')).toHaveText(['10', '20', '35', '70', '80', '85']);
  await expect(panel.getByTestId('favour-steps')).toContainText('Each cause counts for 3 years.');
  await panel.getByTestId('favour-steps').scrollIntoViewIfNeeded();
  await shot(page, 'laws-lord');
  await panel.getByTestId('lord-who').getByRole('button', { name: 'why?' }).click();
  await expect(panel.getByTestId('chain').first()).toBeVisible();
  expect(await phoneRules(page)).toEqual([]);
  // Stock: the tithe block comes first, with what is owed, in the barn and set apart.
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByTestId('open-stock').click();
  const tithe = panel.getByTestId('stock-tithe');
  await expect(tithe).toContainText('The tithe');
  await expect(panel.locator('[data-testid^="stock-"]').first()).toHaveAttribute(
    'data-testid',
    'stock-tithe',
  );
  await expect(tithe.getByTestId('tithe-took')).toContainText(/took|has taken nothing yet/);
  await expect(tithe).toContainText('Owed for the next harvest home');
  await expect(tithe.getByTestId('tithe-barn')).toContainText('In the barn for him now:');
  await expect(tithe.getByTestId('tithe-apart')).toContainText(/asks\.$/);
  expect(await phoneRules(page)).toEqual([]);
  await shot(page, 'stock-tithe');
  expect(errors).toEqual([]);
});
