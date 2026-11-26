import { expect, test } from '@playwright/test';
import { phoneRules, settle, tick } from './helpers';

// The Asks sheet at 390 px (6C Slice 4, V-237). Every stop kind is on Note but Asks, which keeps
// its default Pause: a season jump stops at the first ask (on anvil's first valley, two dreams ask
// about day 85 in the browser; which ask comes first is read from the sheet, not pinned). With the
// game paused, the red count shows on ⋯ and on Asks; Take up puts the ask in the work at second
// and the stepper moves it to first, each applied while paused and naming nobody (V-041).
test('an ask stops the jump, and is taken up and given a priority while paused', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await settle(page, 'anvil', 1, true, 'note', { asks: 'pause' });
  // Season jumps until one stops early on an ask (the first dreams ask about day 85).
  const stopped = page.getByTestId('jump-stopped');
  for (let n = 0; n < 3 && !(await stopped.isVisible()); n++) {
    await page.getByTestId('jump-open').click();
    await page.getByTestId('jump-season').click();
    await expect(page.getByTestId('jump-line')).toContainText('Jumping to');
    await expect(page.getByTestId('speed-0')).toHaveAttribute('aria-pressed', 'true', {
      timeout: 60_000,
    });
  }
  await expect(stopped).toBeVisible();
  await page.getByTestId('jump-stay').click();
  await expect(page.getByTestId('speed-0')).toHaveAttribute('aria-pressed', 'true');
  const more = page.getByRole('button', { name: /^More/ });
  await expect(more.getByTestId('asks-badge')).toHaveText(/^[1-9]$/);
  const at = await tick(page);
  await more.click();
  await expect(page.getByTestId('open-asks').getByTestId('asks-badge')).toBeVisible();
  await page.getByTestId('open-asks').click();
  const panel = page.getByTestId('panel');
  await expect(panel.getByTestId('asks-waiting')).toBeVisible();
  const card = panel.locator('.ask[data-state="open"]').first();
  const id = await card.getAttribute('data-testid');
  await expect(card.locator('.askwho .why')).toBeVisible();
  for (const b of await card.getByRole('button').all()) {
    const box = (await b.boundingBox())!;
    expect(Math.min(box.width, box.height), (await b.textContent()) ?? '').toBeGreaterThanOrEqual(
      42,
    );
  }
  expect(await phoneRules(page)).toEqual([]);
  // Take up: in at second, under Taken up, with the stepper; still paused.
  await card.getByTestId('ask-take').click();
  const taken = panel.getByTestId(id!);
  await expect(taken).toHaveAttribute('data-state', 'taken');
  await expect(panel.getByTestId('asks-taken')).toBeVisible();
  await expect(taken.locator('.val')).toContainText('second');
  await taken.getByRole('button', { name: /: raise$/ }).click();
  await expect(panel.getByTestId(id!).locator('.val')).toContainText('first');
  expect(await tick(page)).toBe(at);
  await expect(page.getByTestId('speed-0')).toHaveAttribute('aria-pressed', 'true');
  // The ledger has the colony's answers, naming no one.
  await page.keyboard.press('Escape');
  await page.getByTestId('open-ledger').click();
  await expect(panel).toContainText('The colony now takes up the ask of');
  expect(errors).toEqual([]);
});
