// The colony's mood (P6.6, V-146): the word under the clock opens this page, its three biggest
// causes, each with how many it touches, how far it moves their mood, and why?. Read only; the
// words and numbers are the worker's `MoodView` (GAME-02).
import type { MoodView } from '../worker/index.ts';
import { el } from './dom.ts';

export function moodRows(view: MoodView): HTMLElement[] {
  const rows: HTMLElement[] = [
    el('p', { class: 'moodhead', 'data-rank': String(view.rank) }, view.word),
    el('p', { class: 'aside' }, "Everyone's mood together. What moves it most:"),
  ];
  for (const c of view.causes) {
    const row = el('div', { class: 'memrow', 'data-line': String(c.why) });
    const by = c.by > 0 ? `+${c.by}` : `−${-c.by}`;
    row.append(
      el('span', { class: 'band' }, by),
      el('span', { class: 't' }, c.name),
      el('button', { type: 'button', class: 'why', 'data-why': String(c.why) }, 'why?'),
      el('span', { class: 'r' }, `${c.people} ${c.people === 1 ? 'person' : 'people'}`),
    );
    rows.push(row);
  }
  if (!view.causes.length) rows.push(el('p', { class: 'muted' }, 'Nothing much moves it now.'));
  return rows;
}
