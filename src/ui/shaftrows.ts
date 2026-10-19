// A shaft plan's tile page (Bundle 2): what it is, why the miners chose the tile, the work it
// takes, the ground, who is at it, then Send back (a normal lever, once, V-087) and the line that
// planned it. Every value is words from the worker; nothing here decides a rule (GAME-02) or
// names a person or a tile to command (V-041).
import type { LedgerLine, TileView } from '../worker/index.ts';
import { el } from './dom.ts';

/** The page's title: "Shaft, planned" or "Shaft, being sunk". */
export const shaftTitle = (tile: TileView): string =>
  tile.shaft ? `Shaft, ${tile.shaft.state === 'planned' ? 'planned' : 'being sunk'}` : '';

/** The tile page's rows for a shaft plan, key and value. */
export function shaftFacts(tile: TileView): [string, string][] {
  const { shaft } = tile;
  if (!shaft) return [];
  return [
    ['what', shaft.what],
    ['why here', shaft.why],
    ['work', shaft.work],
    ['ground', tile.stain ? `${tile.ground}: ${tile.stain}` : tile.ground],
    ...(shaft.here ? [['here', shaft.here] as [string, string]] : []),
  ];
}

/** Send back, while the plan can still be sent back, and the aside that says what it does. */
export function shaftBack(tile: TileView, sendBack: () => void): HTMLElement[] {
  if (!tile.shaft?.back) return [];
  const button = el(
    'button',
    { type: 'button', class: 'solid', 'data-testid': 'send-back-shaft' },
    'Send back',
  );
  button.addEventListener('click', sendBack);
  const row = el('div', { class: 'row' });
  row.append(button);
  return [
    row,
    el(
      'p',
      { class: 'aside' },
      'A plan can be sent back once; the miners then choose another stain.',
    ),
  ];
}

/** The line that planned the shaft, with its label. */
export function shaftLines(tile: TileView): [LedgerLine, string][] {
  const placed = tile.shaft?.placed;
  return placed ? [[placed, 'Planned · ']] : [];
}
