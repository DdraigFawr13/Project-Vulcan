// The − value + control the Work and Build sheets share: 42 px plates with the word under the number.
import { content } from '../content/index.ts';
import { el } from './dom.ts';

/** Levels run 1 (first) to 4 (last); each level's word is content. */
export const WORDS = content.work.priority.words;
export const LEVELS = WORDS.length;

/** − value +. A priority's + means nearer first (a lower number); an hour's + is later.
 * `fits` says whether a value may be stepped to. */
export function stepper(
  value: number,
  word: string,
  label: string,
  onChange: (v: number) => void,
  show: (v: number) => string = String,
  min = 1,
  max = LEVELS,
  fits: (v: number) => boolean = (v) => v >= min && v <= max,
): HTMLElement {
  const box = el('div', { class: 'step', role: 'group', 'aria-label': label });
  const by = max === LEVELS ? -1 : 1;
  const down = el('button', { type: 'button', 'aria-label': `${label}: lower` }, '−');
  const up = el('button', { type: 'button', 'aria-label': `${label}: raise` }, '+');
  down.disabled = !fits(value - by);
  up.disabled = !fits(value + by);
  down.addEventListener('click', () => onChange(value - by));
  up.addEventListener('click', () => onChange(value + by));
  const shown = el('span', { class: 'val' }, show(value));
  if (word) shown.append(el('small', {}, word));
  box.append(down, shown, up);
  return box;
}
