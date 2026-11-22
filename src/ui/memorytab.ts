// The Memories tab (P6.2, V-154): every memory a person holds, strongest first, each with its
// band, its name, a why? to the line that made it and the worker's line on why it matters and
// how long it stays; then the tales they know, their version beside the truth, and what they
// believe (P6.3, V-155). Above them, who they are: the roles they see themselves in and their
// ambition (P6.4, V-156), and how far a grievance has carried them (P6.7). Read only: nothing here is a lever (V-041).
import type { WalkerView } from '../worker/index.ts';
import { el } from './dom.ts';

const why = (line: number): HTMLElement =>
  line
    ? el('button', { type: 'button', class: 'why', 'data-why': String(line) }, 'why?')
    : el('span');

/** The tales they know, newest first, and what they believe, strongest first. */
function taleRows(w: WalkerView): HTMLElement[] {
  const out: HTMLElement[] = [];
  // Their byname (6B Bundle 5): the tale as it stuck, beside what happened.
  if (w.byname) {
    const { word, text, truth, why: line } = w.byname;
    const row = el('div', { class: 'memrow', 'data-testid': 'byname' });
    const note = truth && truth !== text ? `What happened: ${truth}` : 'It is what happened.';
    row.append(
      el('span', { class: 'band' }, 'Byname'),
      el('span', { class: 't' }, `Folk call them “${word}”: ${text}`),
      why(line),
      el('span', { class: 'r' }, note),
    );
    out.push(el('h3', {}, 'What folk call them'), row);
  }
  if (w.tales.length) out.push(el('h3', {}, 'Tales they know'));
  for (const t of w.tales) {
    const row = el('div', { class: 'memrow', 'data-testid': 'tale', 'data-line': String(t.why) });
    const note = t.truth ? `${t.from}. What happened: ${t.truth}` : `${t.from}.`;
    row.append(
      el('span', { class: 'band' }, t.how),
      el('span', { class: 't' }, t.text),
      why(t.why),
      el('span', { class: 'r' }, note),
    );
    out.push(row);
  }
  if (w.beliefs.length) out.push(el('h3', {}, 'What they believe'));
  for (const b of w.beliefs) {
    const row = el('div', { class: 'memrow belief', 'data-testid': 'belief' });
    row.append(el('span', { class: 't' }, b.text), why(b.why));
    out.push(row);
  }
  return out;
}

/** One "who they are" row: its words, a why? to its line, and a note under it if any. */
function selfRow(id: string, item: { text: string; note?: string; why: number }): HTMLElement {
  const row = el('div', { class: 'memrow belief', 'data-testid': id });
  row.append(el('span', { class: 't' }, item.text), why(item.why));
  if (item.note) row.append(el('span', { class: 'r' }, item.note));
  return row;
}

/** Who they are: their calling and faith, roles strongest first, ambition, teaching (6B Bundle
 * 6: their master or apprentice, who taught them and whom they taught) and defiance (P6.7: how
 * far a grievance has carried them, and the memory and belief behind it). */
function selfRows(w: WalkerView): HTMLElement[] {
  const { roles, ambition, defiance, faith, calling, teaching = [] } = w.self;
  const rows = [
    ...(calling ? [selfRow('calling', calling)] : []),
    ...(faith ? [selfRow('faith', faith)] : []),
    ...roles.map((r) => selfRow('role', r)),
    ...(ambition ? [selfRow('ambition', ambition)] : []),
    ...teaching.map((t) => selfRow('teaching', t)),
    ...(defiance ? [selfRow('defiance', defiance)] : []),
  ];
  if (!rows.length) return [];
  return [el('h3', {}, 'Who they are'), ...rows, el('h3', {}, 'Memories')];
}

export function memoryRows(w: WalkerView | undefined): HTMLElement[] {
  const intro = el(
    'p',
    { class: 'aside' },
    'Strongest first. Light memories fade in days, heavy ones over a season, the heaviest stay for life.',
  );
  if (!w) return [intro];
  const tales = taleRows(w);
  const self = selfRows(w);
  if (!w.memories.length)
    return [intro, ...self, el('p', { class: 'muted' }, 'Nothing weighs on them now.'), ...tales];
  return [
    intro,
    ...self,
    ...w.memories.map((m) => {
      const row = el('div', {
        class: 'memrow',
        'data-testid': 'memory',
        'data-line': String(m.why),
      });
      row.append(
        el('span', { class: `band ${m.band.toLowerCase()}` }, m.band),
        el('span', { class: 't' }, m.text),
        why(m.why),
        el('span', { class: 'r' }, m.note),
      );
      return row;
    }),
    ...tales,
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
