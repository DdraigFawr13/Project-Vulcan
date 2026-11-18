import { expect, test } from '@playwright/test';
import { alertText, settle, skipOnce } from './helpers';
import life from '../../src/content/data/life.json' with { type: 'json' };

// Any need's thought line (life.json `needs[].thoughts`), as the sheet shows it in quotes.
const NEED_THOUGHT = new RegExp(
  life.needs
    .flatMap((n) => n.thoughts)
    .map((t) => `“${t.replace(/[.?]/g, '\\$&')}”`)
    .join('|'),
);

// The band going hungry, apart from the smoke so the smoke keeps its time (CI, PR #69, as the Hurt
// check did in PR #70): with Food wanted at none nobody forages, fishes or hunts, so the cart's food
// runs out (about four weeks). Paused, the person sheet's "why?" holds still under a tap (it was
// rebuilt on every snapshot, so a tap slipped off it) and names the line that ate the last of it.
test('a hungry colonist\'s Food "why?" names the line that ate the last of the food', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await settle(page, 'smoke', 2);
  const panel = page.getByTestId('panel');
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByTestId('open-stock').click();
  await panel.getByTestId('stock-food').getByRole('button', { name: /^None/ }).click();
  await expect(panel.getByTestId('stock-food')).toContainText('none wanted');
  // Only the Food row's "why?" (VR-63): the "Doing now" line (P2.9) and another low need, such as
  // sleeping in the open before the house stands (P3.7), have their own, which matched first.
  const hungry = panel
    .locator('.need')
    .filter({ hasText: 'Food' })
    .getByRole('button', { name: 'why?' });
  // Skip stops on every notable line, and many come before the food runs out (privacy, boredom, a
  // second room, craft firsts), so the loop first waits for the line that ate the last of the food
  // on the alert line, then for the hunger it causes (seed grain is eaten under the warning line
  // first, and a stone tool breaking stops the skip too).
  const foodGone = /ate the last of the band's food/;
  // The cart lasts about 70 days; 5B Bundle 2's thirst adds a few more stops on the way (tired,
  // bored), so the loop allows 100.
  for (let skips = 0; skips < 100 && !foodGone.test(await alertText(page)); skips++)
    await skipOnce(page);
  expect(await alertText(page)).toMatch(foodGone);
  // Then the first "is hungry" line, and that person's sheet: who gets hungry first depends on
  // who ate when, so the check follows the alert rather than a fixed face.
  const isHungry = /(\S+) is hungry/;
  for (let skips = 0; skips < 10 && !isHungry.test(await alertText(page)); skips++)
    await skipOnce(page);
  const who = isHungry.exec(await alertText(page))?.[1] ?? '';
  expect(who).not.toBe('');
  await page.locator(`.pslot[data-name^="${who}"]`).click();
  await panel.getByRole('button', { name: 'Needs' }).click();
  await hungry.first().click({ timeout: 5000 });
  await expect(panel.getByTestId('chain')).toContainText("ate the last of the band's food");
  // P6.2 (V-154): under a need's line they think of it, and the Memories tab holds the hunger (which comes
  // first after a winter of it is memoryview.test.ts).
  // Their lowest need under its line speaks (hunger, or privacy in a crowded first house).
  await expect(panel.getByTestId('thinking')).toContainText(NEED_THOUGHT);
  await panel.getByRole('button', { name: 'Memories' }).click();
  await expect(
    panel.getByTestId('memory').filter({ hasText: /Went to bed hungry|The hungry/ }),
  ).toHaveCount(1);
  expect(errors).toEqual([]);
});
