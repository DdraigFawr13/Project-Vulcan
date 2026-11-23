import { expect, test } from '@playwright/test';
import { chooseSpeed, settle } from './helpers';

// Phase 5A Bundle 2 on a phone: the valley has animals on its map, and a tap on one opens its
// herd page, a sheet that names the herd, keeps to 40% of the screen and closes with a 44 px ✕.
test('an animal drawn on the map opens its herd page at 390 px', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Stops only note, so a notable line does not slow the play below.
  await settle(page, 'tallow', 1, true, 'note');
  const game = page.getByTestId('game');
  await expect(game.locator('canvas')).toBeVisible();
  // The snapshot carries the animals; the renderer's event centres the view on one.
  await expect.poll(async () => Number(await game.getAttribute('data-animals'))).toBeGreaterThan(0);
  // Only an animal on seen land is drawn (V-213): none is on arrival; one wanders into sight
  // within the first day on tallow (hour 9; anvil not for a week), so play until one is drawn,
  // then pause.
  const find = () => game.evaluate((g) => g.dispatchEvent(new Event('vulcan:find-animal')));
  await chooseSpeed(page, 3);
  await expect
    .poll(async () => (await find(), game.getAttribute('data-animal-at')), { timeout: 30_000 })
    .not.toBeNull();
  await page.getByTestId('speed-0').click();
  // Paused, the animal may still be gliding to its last step: wait until two looks agree.
  let last: string | null = null;
  await expect
    .poll(async () => {
      await find();
      const at = await game.getAttribute('data-animal-at');
      const still = at !== null && at === last;
      last = at;
      return still;
    })
    .toBe(true);
  const [x, y] = (await game.getAttribute('data-animal-at'))!.split(',').map(Number);
  const box = (await game.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + x!, box.y + y!);
  const panel = page.getByTestId('panel');
  await expect(panel.getByTestId('animal-who')).toContainText('A herd of');
  await expect(panel.getByTestId('animal-row').first()).toContainText('Herd');
  const sheet = (await panel.boundingBox())!;
  expect(sheet.height).toBeLessThanOrEqual(844 * 0.4 + 1);
  const close = (await panel.getByRole('button', { name: 'Close panel' }).boundingBox())!;
  expect(Math.min(close.width, close.height)).toBeGreaterThanOrEqual(44);
  await panel.getByRole('button', { name: 'Close panel' }).click();
  await expect(panel).toBeHidden();
  expect(errors).toEqual([]);
});
