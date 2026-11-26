// The Lord law's block on the Laws sheet (6C Slice 4, V-237): who the lord is, his favour as a bar
// like standing's with every step of the ladder marked and said, then its causes with their
// numbers. Read-only but "why?" (V-041); every word and number is the worker's `LordView`, the
// marks from content (GAME-02).
import type { LordView } from '../worker/index.ts';
import { el } from './dom.ts';
import { signed, why } from './standingrows.ts';

export function lordRows(view: LordView): HTMLElement[] {
  const who = el('p', { 'data-line': String(view.whoWhy), 'data-testid': 'lord-who' });
  who.append(`${view.who} `, why(view.whoWhy));
  const head = el('div', { class: 'standing', 'data-testid': 'favour' });
  head.append(el('h3', {}, 'His favour'), el('span', { class: 'sword' }, `${view.favour} of 100`));
  const bar = el('div', {
    class: 'sbar',
    role: 'img',
    'aria-label': `Favour ${view.favour} of 100`,
  });
  bar.append(el('span', { style: `width:${view.favour}%` }));
  const ticks = el('div', { class: 'fticks' });
  for (const at of view.steps) {
    bar.append(el('b', { style: `left:${at}%` }));
    ticks.append(el('span', { style: `left:${at}%` }, String(at)));
  }
  const causes = view.causes.map((c) => {
    const row = el('p', { class: 'scause', 'data-line': String(c.why) });
    row.append(el('b', {}, signed(c.by)), ` ${c.text} `, why(c.why));
    return row;
  });
  return [
    who,
    head,
    bar,
    ticks,
    el('p', { class: 'aside', 'data-testid': 'favour-steps' }, view.ladder),
    ...(causes.length ? causes : [el('p', { class: 'muted' }, 'Nothing has moved it yet.')]),
  ];
}
