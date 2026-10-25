import { expect, test, type Page } from '@playwright/test';

// Phase 5A Bundle 3 on a phone, apart from the smoke so the smoke keeps its time: with wild sheep
// in the valley the Build sheet has a Pasture row (a level and the colony's need, never a tile),
// the colony lays out a pasture with its reason and the plan can be sent back, and the Work sheet
// has a Herding row (V-041: the levers are rows, not orders).
const tick = async (page: Page) =>
  Number(await page.getByTestId('debug').getAttribute('data-tick'));

test('the Pasture and Herding rows are levers, and a laid-out pasture names its reason', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?seed=smoke&debug');
  await expect(page.locator('[data-card]')).toHaveCount(3, { timeout: 20_000 });
  await page.getByTestId('valley-2').click();
  await page.getByRole('button', { name: 'Settle here' }).click();
  await page.getByTestId('arrive').click();
  await expect(page.locator('.pslot').first()).toBeVisible();
  const panel = page.getByTestId('panel');
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByTestId('open-build').click();
  await expect(panel.getByTestId('build-pasture-need')).toContainText('Need:');
  // Skip stops on every notable line; the pasture's plan comes on day 10 or so on this seed.
  const planned = panel.getByTestId('build-pasture');
  for (let skips = 0; skips < 30 && !(await planned.count()); skips++) {
    const from = await tick(page);
    await page.getByTestId('speed-skip').click({ force: true });
    await expect.poll(() => tick(page), { intervals: [50] }).toBeGreaterThan(from);
    await expect(page.getByTestId('speed-skip')).toHaveAttribute('aria-pressed', 'false', {
      timeout: 30_000,
    });
  }
  await expect(planned).toContainText(/pasture/i);
  await expect(panel.getByTestId('send-back-pasture')).toBeVisible();
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByTestId('open-work').click();
  // Herding sits under the Land heading, folded until opened.
  await panel.getByRole('button', { name: '▸ Land' }).click();
  await expect(panel.locator('.prio[data-job="herd"]')).toBeVisible();
  expect(errors).toEqual([]);
});
