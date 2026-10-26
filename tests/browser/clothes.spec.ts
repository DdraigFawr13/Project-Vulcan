import { expect, test } from '@playwright/test';

// Phase 5B Bundle 5 on a phone, apart from the smoke so the smoke keeps its time: a person's Needs
// tab ends in Wearing with a row per garment (slot, "Wool tunic, plain", and who made it, how worn
// and how warm), and the Stock sheet's Clothes plate lists the spares and what is held to make more.
// Read-only: no button on either but why?, and ✕.
test('the person sheet shows what they wear and the Stock sheet the Clothes plate', async ({
  page,
}) => {
  test.setTimeout(90_000);
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

  await page.locator('.pslot').first().click();
  const rows = panel.getByTestId('wearing-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('Everyday');
  await expect(rows.first()).toContainText(/Wool tunic, plain/);
  await expect(rows.first()).toContainText(/came with them · worn \d+% · warms 2°/);
  await expect(rows.last()).toContainText('Outer');
  await expect(rows.last()).toContainText(/Wool cloak, plain/);
  await expect(rows.last()).toContainText(/worn \d+% · warms 4° outdoors/);
  await rows.last().scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/claude-0/b5/shots/wearing-390.png' });

  await page.getByRole('button', { name: 'More' }).click();
  await page.getByTestId('open-stock').click();
  const clothes = panel.getByTestId('stock-clothes');
  await expect(clothes).toContainText(/^Clothes: \d+ of \d+ wanted/);
  await expect(clothes.getByRole('button', { name: 'Some (3)' })).toBeVisible();
  await expect(clothes.locator('[data-clothes]')).toContainText('everyday');
  await expect(clothes.locator('[data-clothes]')).toContainText('outer');
  await expect(clothes.locator('[data-clothes]')).toContainText(/to make them: .*flax/);
  const side = await clothes
    .getByRole('button')
    .evaluateAll((all) => all.map((b) => Math.min(b.getBoundingClientRect().height, 99)));
  for (const h of side) expect(h).toBeGreaterThanOrEqual(42);
  await clothes.scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/claude-0/b5/shots/clothes-plate-390.png' });
  expect(errors).toEqual([]);
});
