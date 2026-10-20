// A grave's or the burial ground's tile page (P5.8): the person and a line about them, then the
// rows and the lines behind them (each with "why?"). Nothing on it is a lever (V-041); the one
// Send back is on the Build sheet. Every value is words from the worker (GAME-02).
import type { LedgerLine, TileView } from '../worker/index.ts';
import { el } from './dom.ts';

/** The page's title: "Grave" or "Burial ground", or a sickroom's "Sickroom". */
export const placeTitle = (tile: TileView): string =>
  tile.place?.name ?? (tile.house?.sick && tile.room ? tile.house.sick : '');

/** The aside under the title, the person and the line about them. */
export function placeHead(tile: TileView): HTMLElement[] {
  const { place } = tile;
  if (!place) return [];
  return [
    el('p', { class: 'aside' }, place.sub),
    ...(place.who ? [el('p', {}, el('b', {}, place.who))] : []),
    ...(place.about ? [el('p', {}, place.about)] : []),
  ];
}

/** The rows, key and value. */
export const placeFacts = (tile: TileView): [string, string][] => tile.place?.rows ?? [];

/** The lines behind the page, with their labels. */
export const placeLines = (tile: TileView): [LedgerLine, string][] =>
  (tile.place?.lines ?? []).map((l) => [l.line, l.label]);
