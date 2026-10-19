// The day as a 24-hour strip (sleep, work, free time), shared by the Work sheet and the Laws
// sheet. It only draws the hours the worker hands it (GAME-02).
import type { HoursView } from '../worker/index.ts';
import { el } from './dom.ts';

const hh = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;

/** The strip, its hour marks and its legend. */
export function dayStrip(d: HoursView): HTMLElement[] {
  const label = `Work ${hh(d.workFrom)} to ${hh(d.workTo)}, bed at ${hh(d.sleepFrom)}`;
  const strip = el('div', { class: 'day', role: 'img', 'aria-label': label });
  for (let h = 0; h < 24; h += 1)
    strip.append(
      el('i', { class: h < d.workFrom || h >= d.sleepFrom ? 's' : h < d.workTo ? 'w' : 'f' }),
    );
  const hours = el('div', { class: 'dayk' });
  for (const h of [0, 6, 12, 18, 24]) hours.append(el('span', {}, String(h).padStart(2, '0')));
  const legend = el('p', { class: 'legend' });
  for (const [k, word] of [
    ['s', 'sleep'],
    ['w', 'work'],
    ['f', 'free time'],
  ] as const)
    legend.append(el('b', { class: k }), word);
  return [strip, hours, legend];
}
