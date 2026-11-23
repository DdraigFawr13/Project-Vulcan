import { expect, test, type Page } from '@playwright/test';
import { chooseSpeed, settle } from './helpers';

// Seen at work Part 1 (V-194) on a phone: on Day 1 someone swings a tool at their work and bits
// fly from it at 1x and at 2x, and people walk about with tools in hand or loads in their arms.
// SHOTS=dir saves the 390 px screenshots for the PR.

/** Asks the renderer to centre on someone at work (or carrying a load) and returns what it wrote. */
async function look(page: Page, what?: 'load') {
  const game = page.getByTestId('game');
  await game.evaluate(
    (g, detail) => g.dispatchEvent(new CustomEvent('vulcan:find-worker', { detail })),
    what,
  );
  await page.waitForTimeout(100);
  const read = async (k: string) => game.getAttribute(`data-${k}`);
  return {
    at: await read('worker-at'),
    bits: Number(await read('bits')),
    tools: Number(await read('tools')),
    loads: Number(await read('loads')),
  };
}

async function shot(page: Page, name: string) {
  const dir = process.env['SHOTS'];
  if (dir) await page.screenshot({ path: `${dir}/${name}.png` });
}

test('a worker swings with bits flying at 1x and 2x, and tools and loads show', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await settle(page, 'anvil', 1, true, 'note');
  await chooseSpeed(page, 1);
  // Someone takes up work with a tool within the first hours of Day 1.
  await expect.poll(async () => (await look(page)).at, { timeout: 60_000 }).not.toBeNull();
  const seen = await look(page);
  expect(seen.tools).toBeGreaterThan(0);
  // A stroke takes about a second: bits are in the air within two.
  await expect.poll(async () => (await look(page)).bits, { timeout: 4_000 }).toBeGreaterThan(0);
  await shot(page, 'work-1x');
  await chooseSpeed(page, 2);
  await expect.poll(async () => (await look(page)).bits, { timeout: 8_000 }).toBeGreaterThan(0);
  await shot(page, 'work-2x');
  // Haulers and builders fetching carry their loads within the day: someone found carrying, and
  // their load drawn, in the same look (two looks apart, the load may be set down between them).
  await expect
    .poll(
      async () => {
        const l = await look(page, 'load');
        return l.at ? l.loads : 0;
      },
      { timeout: 60_000 },
    )
    .toBeGreaterThan(0);
  await shot(page, 'work-load');
  expect(errors).toEqual([]);
});
