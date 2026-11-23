import { expect, test, type Page } from '@playwright/test';
import { phoneRules, settle } from './helpers';

// New ways on screen (6C Slice 6, V-221), at 390 px. On smoke's third valley a farmer begins to
// puzzle over a way of farming in the second month and gets a first hint in the fourth (days 47
// and 102 in the engine runs), so month jumps (every stop kind on Note, so each runs to its end)
// reach a puzzle with a hint. The Laws sheet's New Ways law lists what is being puzzled over and
// by whom; that person's Skills tab shows "New ways" with the puzzle and each hint, whose why?
// opens its chain. Who puzzles over what, and when the hint comes, is read from the sheet, not
// pinned. The jumps run months of game, so this runs in the `alone` lane (playwright.config.ts).
const puzzledNote = async (page: Page): Promise<string> => {
  const panel = page.getByTestId('panel');
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByTestId('open-laws').click();
  const fold = panel.getByRole('button', { name: 'Show the new ways law' });
  if (await fold.count()) await fold.click();
  return (await panel.getByTestId('puzzled').locator('.r').textContent()) ?? '';
};

test("the Skills tab shows a puzzle's hints with why?, and the Laws sheet the colony's ways", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await settle(page, 'smoke', 3, true, 'note');
  const hinted = /(?:\(|; )(\S+), [1-9] of \d hints/;
  let note = '';
  for (let months = 0; months < 6 && !hinted.test(note); months++) {
    await page.getByTestId('jump-open').click();
    await page.getByTestId('jump-month').click();
    // Paused before and after: the jump line going is the jump's end.
    await expect(page.getByTestId('jump-line')).toBeHidden({ timeout: 60_000 });
    await expect(page.getByTestId('speed-0')).toHaveAttribute('aria-pressed', 'true');
    note = await puzzledNote(page);
    await page.keyboard.press('Escape');
  }
  const who = hinted.exec(note)?.[1] ?? '';
  expect(who, note).not.toBe('');
  // The New Ways law, under Apprentices: its settings, then the ways known and being puzzled over.
  await puzzledNote(page);
  const panel = page.getByTestId('panel');
  await expect(panel.locator('.lawfold[data-law="new-ways"]')).toContainText('Allowed');
  const options = panel.getByRole('group', { name: 'New Ways law' }).getByRole('button');
  await expect(options).toHaveText(['Old ways only', 'Allowed', 'Encouraged']);
  await expect(panel).toContainText('Ways the colony knows');
  expect(await phoneRules(page)).toEqual([]);
  // Their Skills tab: "New ways" under Trade, the puzzle, and each hint with a why? that opens the
  // chain under its line (where the hint came from, and the puzzle it is for).
  await page.keyboard.press('Escape');
  await page.locator(`.pslot[data-name^="${who}"]`).click();
  await panel.locator('[data-tab="skills"]').click();
  await expect(panel.locator('h4', { hasText: 'New ways' })).toBeVisible();
  await expect(panel.getByTestId('puzzle')).toContainText(/^Puzzling over .+: [1-9] of \d hints\./);
  const hint = panel.getByTestId('hint').first();
  await expect(hint).toContainText(/^Hint 1: /);
  await hint.getByRole('button', { name: 'why?' }).click();
  await expect(hint.getByTestId('chain')).toContainText(`${who} began to puzzle over`);
  expect(await phoneRules(page)).toEqual([]);
  expect(errors).toEqual([]);
});
