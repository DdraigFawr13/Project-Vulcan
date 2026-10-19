// The item page (P4.6): a tool or an ingot stack, and "Made from" walking its trail back to the
// ore. The mined step's tile is a view-only button that centres the map there; nothing on this
// page orders a person or a tile (V-041). Every value is words from the worker (GAME-02).
import type { ItemView, LedgerLine } from '../worker/index.ts';
import { el } from './dom.ts';

export interface ItemDeps {
  /** A ledger line with its "why?". */
  lineRow(line: LedgerLine, prefix?: string): HTMLElement;
  /** Centres the map on a tile and marks it; changes nothing in the world. */
  look(x: number, y: number, z: number): void;
}

export function itemRows(item: ItemView, deps: ItemDeps): HTMLElement[] {
  const facts = el('dl', { class: 'kv' });
  for (const [key, value] of item.facts) facts.append(el('dt', {}, key), el('dd', {}, value));
  const rows: HTMLElement[] = [facts, el('h3', {}, 'Made from')];
  if (!item.steps.length)
    rows.push(
      el('p', { class: 'muted' }, 'No record of where it came from: it came with the band.'),
    );
  for (const step of item.steps) {
    const p = el('p', { 'data-testid': 'item-step' }, step.text);
    p.style.paddingLeft = `${step.depth * 14}px`;
    if (step.tile) {
      const { x, y, z, label } = step.tile;
      const go = el('button', { type: 'button', class: 'why', 'data-testid': 'item-tile' }, label);
      go.addEventListener('click', () => deps.look(x, y, z));
      p.append(go, step.after ?? '');
    }
    rows.push(p);
  }
  if (item.steps.length)
    rows.push(
      el(
        'p',
        { class: 'aside' },
        'It keeps its own record, so the trail still shows after old ledger days are sealed. A tile button shows the place on the map.',
      ),
    );
  if (item.made) rows.push(deps.lineRow(item.made, 'Made · '));
  return rows;
}
