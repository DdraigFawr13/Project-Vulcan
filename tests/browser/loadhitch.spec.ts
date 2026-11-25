import { expect, test } from '@playwright/test';
import { chooseSpeed, settle, tick } from './helpers';

// A loaded save plays on without a freeze (2026-11-25): the strangers' hour (07:00) asks for the
// valley's neighbours, which come from the seed's Story Generator world. A reload starts a fresh
// worker that never made it, so it was made in that tick: 2.7 s here, 6 to 8 s under load, and
// the smoke's pause landed in the freeze. The worker now makes it while the save loads. In the
// `alone` lane (playwright.config.ts): it times the page against the wall clock (VER-11).

test('a reloaded save reaches the strangers’ hour without freezing', async ({ page }) => {
  // The picker, the load and the run each wait on the machine: about 25 s alone here.
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Stops left at Note, so 3x holds to the hour; paused on Day 1 at 06:00.
  await settle(page, 'smoke', 2, true, 'note');
  await page.setViewportSize({ width: 1280, height: 720 });
  const start = await tick(page);
  // At 1x (ten minutes a second), so the pause lands well before 07:00.
  await chooseSpeed(page, 1);
  await expect.poll(() => tick(page)).toBeGreaterThan(start + 5);
  await page.getByTestId('speed-0').click();
  await page.getByTestId('open-saves').click();
  await page.getByTestId('panel').getByRole('button', { name: 'Save now' }).click();
  await expect(page.getByTestId('save').filter({ hasNotText: 'AUTO' })).toHaveCount(1);
  const saved = await tick(page);
  // Before the hour, so the run after the reload passes it.
  expect(saved).toBeLessThan(start + 60);

  // A reload continues the save in a fresh worker; then the page notes when each snapshot comes.
  await page.reload();
  await expect.poll(() => tick(page), { timeout: 20_000 }).toBeGreaterThanOrEqual(saved);
  await page.evaluate(() => {
    const seen: number[] = [];
    Object.assign(window, { snapshotTimes: seen });
    const readout = document.querySelector('[data-testid="debug"]')!;
    new MutationObserver(() => seen.push(performance.now())).observe(readout, {
      attributes: true,
      attributeFilter: ['data-tick'],
    });
  });
  await chooseSpeed(page, 3);
  await expect.poll(() => tick(page), { timeout: 30_000 }).toBeGreaterThan(start + 80);
  const longest = await page.evaluate(() => {
    const seen = (window as unknown as { snapshotTimes: number[] }).snapshotTimes;
    return Math.max(...seen.slice(1).map((t, i) => t - seen[i]!));
  });
  // A snapshot comes each frame (at most a few hundred ms apart under load); the old freeze held
  // them for 4.4 s here.
  expect(longest).toBeLessThan(2_000);
  expect(errors).toEqual([]);
});
