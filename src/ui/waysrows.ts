// New ways on screen (6C Slice 6, V-221): the Skills tab's "New ways" (the puzzle, a row for each
// hint with why? to its line, then each way known) and the Laws sheet's "Ways the colony knows"
// under the New Ways law. Read-only but for why? (V-041); every word is the worker's.
import type { ColonyWaysView, PersonWaysView, WayRow } from '../worker/index.ts';
import { el } from './dom.ts';

const why = (line: number): HTMLElement =>
  el('button', { type: 'button', class: 'why', 'data-why': String(line) }, 'why?');

/** A way as a two-line row: its name, why?, and the second line. */
function wayRow(r: WayRow, testid: string): HTMLElement {
  const row = el('div', {
    class: 'memrow belief',
    'data-testid': testid,
    ...(r.why !== undefined && { 'data-line': String(r.why) }),
  });
  row.append(
    el('span', { class: 't' }, r.text),
    r.why !== undefined ? why(r.why) : el('span'),
    el('span', { class: 'r' }, r.note),
  );
  return row;
}

/** A one-line row with why? when it has a line. */
function lineRow(text: string, line: number | undefined, cls: string, testid: string): HTMLElement {
  const row = el('p', {
    class: cls,
    'data-testid': testid,
    ...(line !== undefined && { 'data-line': String(line) }),
  });
  row.append(`${text} `);
  if (line !== undefined) row.append(why(line));
  return row;
}

/** The Skills tab's "New ways": nothing when they puzzle over none and know none. */
export function personWayRows(ways: PersonWaysView | undefined): HTMLElement[] {
  if (!ways) return [];
  const out: HTMLElement[] = [el('h4', {}, 'New ways')];
  const puzzle = ways.puzzle;
  if (puzzle) {
    out.push(lineRow(puzzle.text, puzzle.why, 'lawset', 'puzzle'));
    for (const h of puzzle.hints) out.push(lineRow(h.text, h.why, 'hint', 'hint'));
    if (puzzle.left) out.push(el('p', { class: 'aside' }, puzzle.left));
  }
  out.push(...ways.known.map((r) => wayRow(r, 'way-known')));
  return out;
}

/** "Ways the colony knows" under the New Ways law, then what is being puzzled over. */
export function colonyWayRows(ways: ColonyWaysView | undefined): HTMLElement[] {
  if (!ways) return [];
  return [
    el('h4', {}, 'Ways the colony knows'),
    ...ways.known.map((r) => wayRow(r, 'colony-way')),
    ...(ways.none ? [el('p', { class: 'muted' }, ways.none)] : []),
    wayRow(ways.puzzled, 'puzzled'),
  ];
}
