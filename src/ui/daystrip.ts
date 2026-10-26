// The day as a 24-hour strip in quarter hours (sleep, work in daylight, work indoors by light,
// free time), shared by the Work sheet and the Laws sheet. It only draws the hours the worker
// hands it, today's first light and dusk among them (GAME-02, P5.13).
import type { HoursView } from '../worker/index.ts';
import { el } from './dom.ts';

const QUARTERS = 96;

/** Decimal hours as "07:45". */
const hhmm = (h: number): string => {
  const m = Math.round(h * 60) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** The cell's class: `s` sleep, `w` work in daylight, `l` work indoors by light, `f` free. */
function kindAt(d: HoursView, h: number): 's' | 'w' | 'l' | 'f' {
  if (h < d.workFrom || h >= d.sleepFrom) return 's';
  if (h >= d.workTo) return 'f';
  return h >= d.dawn && h < d.dusk ? 'w' : 'l';
}

/** The strip, its hour marks and its legend. */
export function dayStrip(d: HoursView): HTMLElement[] {
  const label = `Work ${hhmm(d.workFrom)} to ${hhmm(d.workTo)}, daylight ${hhmm(d.dawn)} to ${hhmm(d.dusk)}, bed at ${hhmm(d.sleepFrom)}`;
  const strip = el('div', { class: 'day', role: 'img', 'aria-label': label });
  for (let q = 0; q < QUARTERS; q += 1) strip.append(el('i', { class: kindAt(d, q / 4) }));
  const hours = el('div', { class: 'dayk' });
  for (const h of [0, 6, 12, 18, 24]) hours.append(el('span', {}, String(h).padStart(2, '0')));
  const legend = el('p', { class: 'legend' });
  for (const [k, word] of [
    ['w', 'work in daylight'],
    ['l', 'indoors by light'],
    ['f', 'free time'],
    ['s', 'sleep'],
  ] as const)
    legend.append(el('b', { class: k }), word);
  return [strip, hours, legend];
}
