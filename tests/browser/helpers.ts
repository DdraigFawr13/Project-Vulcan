import { expect, type Page } from '@playwright/test';

// Shared by the browser specs, so a browser lesson is applied once (audit 2026-11-18 F12).

/** The last snapshot's tick, as the test-mode readout shows it. */
export const tick = async (page: Page) =>
  Number(await page.getByTestId('debug').getAttribute('data-tick'));

/** The alert line's text. */
export const alertText = async (page: Page) =>
  (await page.getByTestId('alert').getAttribute('aria-label')) ?? '';

type StopAct = 'pause' | 'slow' | 'note';

/** Sets every stop kind on this page's device (V-191) before it loads, but for the kinds named in
 * `except`: `slow` makes Next event stop at every notable line, as these specs were written for;
 * `note` lets play run unpaused. Season and year recaps are off unless `recaps` (recaps.spec.ts),
 * so a run past a season's turn is not paused by its recap. */
export const stopsAll = (
  page: Page,
  act: StopAct,
  except: Record<string, StopAct> = {},
  recaps = false,
) =>
  page.addInitScript(
    ([a, but, on]) => {
      const kinds = ['death', 'attack', 'food', 'family', 'comings', 'sickness', 'quarrel'];
      const all = [...kinds, 'danger', 'mood', 'works', 'world'];
      localStorage.setItem(
        'vulcan.stops',
        JSON.stringify({ ...Object.fromEntries(all.map((k) => [k, a])), ...but }),
      );
      // Only before the first load: a reload keeps what the spec switched since.
      if (localStorage.getItem('vulcan.recaps') === null)
        localStorage.setItem('vulcan.recaps', JSON.stringify({ season: on, year: on }));
    },
    [act, except, recaps] as const,
  );

/** Sets one stop kind from the jump tray's "Change what stops play", as a player would. */
export async function setStop(page: Page, kind: string, act: StopAct) {
  await page.getByTestId('jump-open').click();
  await page.getByTestId('tray-stops').click();
  await page.getByTestId(`stop-${kind}-${act}`).click();
  await expect(page.getByTestId(`stop-${kind}-${act}`)).toHaveAttribute('aria-pressed', 'true');
}

/** Chooses a running speed from the speed plate's list. */
export async function chooseSpeed(page: Page, speed: number, how: 'click' | 'tap' = 'click') {
  await page.getByTestId('speed-plate')[how]();
  await page.getByTestId(`speed-${speed}`)[how]();
}

/** Opens `/?seed=<seed>` at 390 x 844, settles valley `site` and arrives, paused on Day 1. Every
 * stop kind but those in `except` is set to `stops` (Slow unless named: Next event stops at every
 * notable line). */
export async function settle(
  page: Page,
  seed: string,
  site: number,
  debug = true,
  stops: StopAct = 'slow',
  except: Record<string, StopAct> = {},
  recaps = false,
) {
  await stopsAll(page, stops, except, recaps);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/?seed=${seed}${debug ? '&debug' : ''}`);
  // The picker waits on the seed's Story Generator world and its history (P1.6): about 5 s here.
  await expect(page.locator('[data-card]')).toHaveCount(3, { timeout: 20_000 });
  await page.getByTestId(`valley-${site}`).click();
  await page.getByRole('button', { name: 'Settle here' }).click();
  await page.getByTestId('arrive').click();
  await expect(page.locator('.pslot').first()).toBeVisible();
}

/** Next event once: runs to the next notable line set to Pause or Slow (with `settle`'s Slow, any
 * notable line) and waits until it has stopped there, paused. */
export async function skipOnce(page: Page) {
  const from = await tick(page);
  // The buttons are in place (the bar never moves, the tray opens at once), so the clicks skip
  // Playwright's wait for two still frames, and the tick is polled every 50 ms: on a slow runner
  // mid-skip frames are slow, and those waits cost about a second a skip, which took the smoke past
  // its CI limit (PR #69).
  await page.getByTestId('jump-open').click({ force: true });
  await page.getByTestId('jump-next').click({ force: true });
  await expect.poll(() => tick(page), { intervals: [50] }).toBeGreaterThan(from);
  await expect(page.getByTestId('jump-open')).toHaveAttribute('aria-pressed', 'false', {
    timeout: 30_000,
  });
}

/** Each button's smallest side (px) in the sheet's row for `job`, found and measured in one page
 * call (VR-73): the game runs while the Work sheet is open, and a snapshot that redraws it between
 * finding a button and measuring it leaves a detached button with no box (0,0 in CI on PR #101). */
export const buttonSides = (page: Page, job: string) =>
  page.evaluate(
    (selector) =>
      [...document.querySelectorAll(selector)].map((b) =>
        Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height),
      ),
    `[data-testid="panel"] .prio[data-job="${job}"] button`,
  );

/** What breaks the phone rules on the screen as shown: tap targets under 44 px, text under 11 px,
 * or a page wider than the screen (UI_STYLE.md). Empty when the screen keeps them. */
export const phoneRules = (page: Page) =>
  page.evaluate(() => {
    const shown = (e: Element) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
    };
    const bad: string[] = [];
    for (const b of document.querySelectorAll('#hud button')) {
      const r = b.getBoundingClientRect();
      if (shown(b) && !b.closest('svg') && Math.min(r.width, r.height) < 44)
        bad.push(`tap ${Math.round(Math.min(r.width, r.height))} px: ${b.textContent}`);
    }
    const text = document.createTreeWalker(document.getElementById('hud')!, NodeFilter.SHOW_TEXT);
    while (text.nextNode()) {
      const parent = text.currentNode.parentElement;
      if (!parent || !text.currentNode.textContent!.trim() || parent.closest('svg')) continue;
      const size = parseFloat(getComputedStyle(parent).fontSize);
      if (shown(parent) && size < 11) bad.push(`text ${size} px: ${text.currentNode.textContent}`);
    }
    if (document.documentElement.scrollWidth > innerWidth) bad.push('wider than the screen');
    return bad;
  });
