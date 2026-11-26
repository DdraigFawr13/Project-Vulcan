// The tithe block at the top of the Stock sheet (6C Slice 4, V-237): his last take with "why?", what
// is owed from now, what lies in the barn for him and what is set apart there for asks. Shown once
// the lord is named; read-only (V-041), every word the worker's `TitheView` (GAME-02).
import type { TitheView } from '../worker/index.ts';
import { el } from './dom.ts';
import { why } from './standingrows.ts';

/** The block's lines, redrawn only when the worker's words change, so an open "why?" stays. */
export function fillTithe(box: Element, t: TitheView): Element {
  const key = JSON.stringify(t);
  if (box.getAttribute('data-key') === key) return box;
  box.setAttribute('data-key', key);
  const took = el('p', { 'data-testid': 'tithe-took' });
  took.append(`${t.took} `);
  if (t.why) took.append(why(t.why));
  box.replaceChildren(
    el('p', {}, t.head),
    took,
    el('p', { class: 'aside' }, t.owed),
    el('p', { class: 'aside', 'data-testid': 'tithe-barn' }, t.barn),
    el('p', { class: 'aside', 'data-testid': 'tithe-apart' }, t.apart),
    el('p', { class: 'aside' }, t.note),
  );
  return box;
}

export function titheBlock(t: TitheView): HTMLElement {
  const block = el('div', { class: 'kept', 'data-testid': 'stock-tithe' });
  block.append(el('h3', {}, 'The tithe'), fillTithe(el('div', { 'data-tithe': '' }), t));
  return block;
}
