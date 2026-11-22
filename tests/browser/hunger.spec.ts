import { expect, test } from '@playwright/test';
import { alertText, setStop, settle, skipOnce } from './helpers';
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
// runs out (about eleven weeks). Its first Next event runs those weeks in one jump, which takes as
// long as the runner is busy, so it runs in the `alone` lane after the rest (playwright.config.ts,
// PR #186). Paused, the person sheet's "why?" holds still under a tap (it was rebuilt on every
// snapshot, so a tap slipped off it) and names the line that ate the last of it.
test('a hungry colonist\'s Food "why?" names the line that ate the last of the food', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Moods, works and firsts only note their lines on the way (V-191), so Next event runs from one
  // food, family or danger line to the next: with every kind on Slow the band's bored, crowded and
  // built lines made about 75 stops, about a second each, and took this past its limit in CI
  // (PR #155, after #151 put Next event in the jump tray).
  const quiet = { mood: 'note', works: 'note', world: 'note' } as const;
  await settle(page, 'smoke', 2, true, 'slow', quiet);
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
  // The cart lasts about 70 days. On smoke Next event runs straight to the line that ate the last
  // of the food; a food, family or danger line on the way may stop it first, so the loop waits for
  // that line on the alert line.
  const foodGone = /ate the last of the band's food/;
  for (let skips = 0; skips < 30 && !foodGone.test(await alertText(page)); skips++)
    await skipOnce(page);
  expect(await alertText(page)).toMatch(foodGone);
  // Then, with moods stopping play again, the first "is hungry" line and that person's sheet: who
  // gets hungry first depends on who ate when, so the check follows the alert rather than a fixed
  // face (a bored line may come first).
  await setStop(page, 'mood', 'slow');
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
