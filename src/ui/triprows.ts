// The Ledger's Trips tab (6W Slice 6, V-213): whether anyone is out, then each trip, newest first,
// with its lines. A camp's or a find's line has a Show button that moves the camera there and
// picks nothing (V-041). Words from the worker (GAME-02).
import type { LedgerLine, TripsView } from '../worker/index.ts';
import { el } from './dom.ts';

export function tripRows(
  view: TripsView,
  lineRow: (line: LedgerLine) => HTMLElement,
  show: (x: number, y: number) => void,
): HTMLElement[] {
  const rows: HTMLElement[] = [el('p', { class: 'aside', 'data-testid': 'trips-head' }, view.head)];
  for (const trip of view.trips) {
    rows.push(el('h4', { class: 'trip', 'data-testid': 'trip' }, trip.title));
    if (trip.sub) rows.push(el('p', { class: 'aside' }, trip.sub));
    for (const line of trip.lines) {
      const row = lineRow(line);
      const at = line.at;
      if (at) {
        const b = el(
          'button',
          { type: 'button', class: 'show', 'data-testid': 'trip-show' },
          'Show',
        );
        b.addEventListener('click', () => show(at.x, at.y));
        row.lastElementChild!.append(' ', b);
      }
      rows.push(row);
    }
  }
  if (!view.trips.length) rows.push(el('p', { class: 'muted' }, 'No trip yet.'));
  return rows;
}
