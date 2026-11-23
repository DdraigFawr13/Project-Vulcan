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
  // within the first day on tallow (hour 9; anvil not for a week). A look waits two frames, so
  // the renderer has written its answer, and returns the animal's map spot (null with none drawn).
  const look = async () => {
    await game.evaluate(async (g) => {
      g.dispatchEvent(new Event('vulcan:find-animal'));
      for (let i = 0; i < 2; i += 1) await new Promise((done) => requestAnimationFrame(done));
    });
    return game.getAttribute('data-animal-map');
  };
  // Play until one is drawn, then pause. Until the pause lands it may walk on, even onto unseen
  // land where it is no longer drawn (CI on PRs #192 and #193 tapped bare marsh), so look until
  // two looks find it on the same spot; if it is gone, play on and try again.
  let still = false;
  for (let tries = 0; tries < 5 && !still; tries += 1) {
    await chooseSpeed(page, 3);
    await expect.poll(look, { timeout: 30_000 }).not.toBeNull();
    await page.getByTestId('speed-0').click();
    let last: string | null = null;
    let state = 'moving';
    await expect
      .poll(async () => {
        const at = await look();
        state = at === null ? 'gone' : at === last ? 'still' : 'moving';
        last = at;
        return state;
      })
      .not.toBe('moving');
    still = state === 'still';
  }
  expect(still, 'an animal stays drawn once play is paused').toBe(true);
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
