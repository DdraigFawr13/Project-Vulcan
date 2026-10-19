import { expect, test, type CDPSession, type Page } from '@playwright/test';

// A bug that reached Morgan (VR-23), Phase 3 playtest: "I got the zoom and pan stuck somehow and
// couldn't select any tiles or move except zooming in and out." A finger lifted from a line the
// page redrew while it was held (the clock) never told the map it lifted, so every later touch
// read as a pinch. Also: lifting the second finger of a pinch was read as a tap on a tile.
// Touches go through the DevTools protocol with a fresh id per finger, as a phone gives them.

type Finger = [x: number, y: number, id: number];

async function touch(
  cdp: CDPSession,
  type: 'touchStart' | 'touchMove' | 'touchEnd',
  fingers: Finger[],
) {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: fingers.map(([x, y, id]) => ({ x, y, id })),
  });
}

/** The tile the readout names, as [x, y]. */
async function tileShown(page: Page): Promise<[number, number]> {
  const text = (await page.locator('.hud.readout').textContent()) ?? '';
  const m = /Tile (\d+), (\d+)/.exec(text);
  expect(m, `readout "${text}"`).not.toBeNull();
  return [Number(m![1]), Number(m![2])];
}

test('pan and tile taps keep working after a pinch and after a lift off a redrawn line', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto('/?seed=smoke');
  await expect(page.locator('[data-card]')).toHaveCount(3, { timeout: 20_000 });
  await page.getByTestId('valley-2').tap();
  await page.getByRole('button', { name: 'Settle here' }).tap();
  await page.getByTestId('arrive').tap();
  await expect(page.getByTestId('arrive')).toBeHidden();
  await expect(page.locator('.pslot').first()).toBeVisible();
  const cdp = await context.newCDPSession(page);
  let id = 0;
  const tap = async (x: number, y: number) => {
    const f = id++;
    await touch(cdp, 'touchStart', [[x, y, f]]);
    await touch(cdp, 'touchEnd', []);
  };
  const drag = async (x: number, y: number, by: number) => {
    const f = id++;
    await touch(cdp, 'touchStart', [[x, y, f]]);
    for (let k = 1; k <= 10; k++) await touch(cdp, 'touchMove', [[x - k * by, y - k * by, f]]);
    await touch(cdp, 'touchEnd', []);
  };
  const sheet = page.locator('.panel');
  const at: [number, number] = [200, 380];

  // A pinch on the map zooms; lifting its fingers one by one opens no tile.
  const [a, b] = [id++, id++];
  await touch(cdp, 'touchStart', [[170, 350, a]]);
  await touch(cdp, 'touchStart', [
    [170, 350, a],
    [230, 420, b],
  ]);
  for (let k = 1; k <= 6; k++)
    await touch(cdp, 'touchMove', [
      [170 - 4 * k, 350 - 4 * k, a],
      [230 + 4 * k, 420 + 4 * k, b],
    ]);
  await touch(cdp, 'touchEnd', [[146, 326, a]]);
  await touch(cdp, 'touchEnd', []);
  await page.waitForTimeout(200);
  await expect(sheet).toBeHidden();

  // A finger held on the clock while it redraws, then lifted.
  await page.getByTestId('speed-1').tap();
  const clock = await page.evaluate(() => {
    const r = document.querySelector('.clock .time')!.getBoundingClientRect();
    (window as unknown as { held: Element }).held = document.elementFromPoint(r.x + 4, r.y + 4)!;
    return [r.x + 4, r.y + 4];
  });
  const held = id++;
  await touch(cdp, 'touchStart', [[clock[0]!, clock[1]!, held]]);
  await expect
    .poll(() =>
      page.evaluate(() => !document.contains((window as unknown as { held: Element }).held)),
    )
    .toBe(true);
  await touch(cdp, 'touchEnd', []);
  await page.getByTestId('speed-0').tap();

  // One finger still pans: the tile under the same spot moves on by the drag, and a tap selects it.
  await tap(...at);
  await expect(sheet).toBeVisible();
  const before = await tileShown(page);
  await page.locator('.panel-head button').first().tap();
  await drag(...at, 12);
  await tap(...at);
  await expect(sheet).toBeVisible();
  const after = await tileShown(page);
  // 120 screen px up and left at the same zoom: the same few tiles on each axis, give or take the
  // part tile either side. A drag read as a pinch zooms instead, about a point off to one side.
  const moved = [after[0] - before[0], after[1] - before[1]];
  expect(moved.every((d) => d > 0) && Math.abs(moved[0]! - moved[1]!) <= 1, `moved ${moved}`).toBe(
    true,
  );
  await context.close();
});
