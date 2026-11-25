import { expect, test } from '@playwright/test';
import { phoneRules, settle } from './helpers';

// The portrait strip in a large colony (Morgan, 2026-11-23): at 17 colonists each face shrank to a
// sliver and its name to a letter or two. Now the faces scroll sideways: every face keeps a 44 px tap
// and its name, the row fades where more lie past its end, and the Names button stays put. A colony of 17 takes years to
// grow, so the strip is filled with copies of the band's own faces; this checks the layout only.
test('a colony of 17 keeps every face and name readable at 390 px', async ({ page }) => {
  await settle(page, 'smoke', 2);
  await page.keyboard.press('Space');
  const shape = await page.evaluate(() => {
    const row = document.querySelector<HTMLElement>('.facerow')!;
    const slots = [...row.querySelectorAll<HTMLElement>('.pslot')];
    const names = document.querySelector('.namesbtn')!;
    // The band of five fits without scrolling.
    const band = row.scrollWidth <= row.clientWidth;
    for (let i = slots.length; i < 17; i += 1) {
      const copy = slots[i % slots.length]!.cloneNode(true) as HTMLElement;
      copy.querySelector('.pname')!.textContent = i === 16 ? 'Gartnach' : `Bleidd${i}`;
      row.append(copy);
    }
    row.dispatchEvent(new Event('scroll'));
    const all = [...row.querySelectorAll<HTMLElement>('.pslot')];
    const box = names.getBoundingClientRect();
    return {
      band,
      count: all.length,
      narrowest: Math.min(...all.map((s) => s.getBoundingClientRect().width)),
      cut: all
        .map((s) => s.querySelector<HTMLElement>('.pname')!)
        .filter((n) => n.scrollWidth > n.clientWidth)
        .map((n) => n.textContent),
      scrolls: row.scrollWidth > row.clientWidth,
      fades: row.classList.contains('more'),
      namesRight: box.right,
      namesOnTop:
        document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === names,
    };
  });
  expect(shape.band, 'the band of five scrolls').toBe(true);
  expect(shape.count).toBe(17);
  expect(shape.narrowest).toBeGreaterThanOrEqual(44);
  expect(shape.cut, `names cut short (${shape.narrowest} px)`).toEqual([]);
  expect(shape.scrolls).toBe(true);
  expect(shape.fades, 'the row fades where faces lie past its end').toBe(true);
  expect(shape.namesRight).toBeLessThanOrEqual(390);
  expect(shape.namesOnTop).toBe(true);
  expect(await phoneRules(page)).toEqual([]);
  // The last face scrolls into reach and opens its sheet.
  const last = page.locator('.pslot').last();
  await last.scrollIntoViewIfNeeded();
  await expect(last.locator('.pname')).toHaveText('Gartnach');
  await expect(last).toBeInViewport({ ratio: 1 });
  await expect(page.locator('.facerow')).not.toHaveClass(/more/);
});
