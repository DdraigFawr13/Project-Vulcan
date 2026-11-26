// The reeve's page (6C Slice 4, V-237): a tap on the lord's man on the map opens who he is, what he
// is doing, when he came and leaves, the lord's favour and his lines this visit. Rows and lines are
// words from the worker (GAME-02); nothing here orders him or anyone (V-041), and he is no colonist.
import type { LedgerLine, ReevePage } from '../worker/index.ts';
import { el } from './dom.ts';
import { why } from './standingrows.ts';

export function reeveRows(
  page: ReevePage,
  lineRow: (line: LedgerLine) => HTMLElement,
): HTMLElement[] {
  const rows = page.rows.map((r) => {
    const row = el('div', { class: 'prow animal', 'data-testid': 'reeve-row' });
    const text = el('span', {}, r.text);
    if (r.why) text.append(' ', why(r.why));
    row.append(el('b', {}, r.name), text);
    return row;
  });
  return [
    el('p', { class: 'pwho', 'data-testid': 'reeve-who' }, page.who),
    ...rows,
    ...page.lines.map((line) => lineRow(line)),
  ];
}

/** Shown when the reeve has gone (left the valley) before the page came. */
export const reeveGone = (): HTMLElement[] => [el('p', { class: 'muted' }, 'He has gone home.')];
