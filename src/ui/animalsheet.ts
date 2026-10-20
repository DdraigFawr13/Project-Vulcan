// The animal page (Phase 5A Bundle 2): a herd's page for a game animal, the pack's page for a
// wolf or bear, opened by a tap on the map. Rows and lines are words from the worker (GAME-02);
// nothing here orders a person or an animal (V-015).
import type { AnimalPage, LedgerLine } from '../worker/index.ts';
import { el } from './dom.ts';

export function animalRows(
  page: AnimalPage,
  lineRow: (line: LedgerLine) => HTMLElement,
): HTMLElement[] {
  const rows = page.rows.map(([key, value]) => {
    const row = el('div', { class: 'prow animal', 'data-testid': 'animal-row' });
    row.append(el('b', {}, key), el('span', {}, value));
    return row;
  });
  return [
    el('p', { class: 'pwho', 'data-testid': 'animal-who' }, page.who),
    ...rows,
    ...page.lines.map((line) => lineRow(line)),
  ];
}

/** Shown when the animal tapped has gone (killed, or lost to the snow) before the page came. */
export const goneRows = (): HTMLElement[] => [el('p', { class: 'muted' }, 'It is gone.')];
