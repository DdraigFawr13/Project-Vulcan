// The Memories tab (P6.2, V-154): every memory a person holds, strongest first, each with its
// band, its name, a why? to the line that made it and the worker's line on why it matters and
// how long it stays. Read only: nothing here is a lever (V-041).
import type { WalkerView } from '../worker/index.ts';
import { el } from './dom.ts';

export function memoryRows(w: WalkerView | undefined): HTMLElement[] {
  const intro = el(
    'p',
    { class: 'aside' },
    'Strongest first. Light memories fade in days, heavy ones over a season, the heaviest stay for life.',
  );
  if (!w?.memories.length)
    return [intro, el('p', { class: 'muted' }, 'Nothing weighs on them now.')];
  return [
    intro,
    ...w.memories.map((m) => {
      const row = el('div', {
        class: 'memrow',
        'data-testid': 'memory',
        'data-line': String(m.why),
      });
      row.append(
        el('span', { class: `band ${m.band.toLowerCase()}` }, m.band),
        el('span', { class: 't' }, m.text),
        m.why
          ? el('button', { type: 'button', class: 'why', 'data-why': String(m.why) }, 'why?')
          : el('span'),
        el('span', { class: 'r' }, m.note),
      );
      return row;
    }),
  ];
}

/** The Thinking line under Doing now (V-154): the thought in quotes and a why? to its source. */
export function fillThought(box: HTMLElement, t: WalkerView['thought'] | undefined): void {
  const shown = t ? `${t.text}|${t.why}` : '';
  if (box.dataset['shown'] === shown) return;
  box.dataset['shown'] = shown;
  box.replaceChildren();
  if (!t) return;
  const text = el('p', {}, `${t.text} `);
  if (t.why)
    text.append(el('button', { type: 'button', class: 'why', 'data-why': String(t.why) }, 'why?'));
  box.append(el('small', {}, 'Thinking'), text);
}
