// The tile inspector's rows (panel.ts `showTile`): what lies here first, then the tile's facts,
// its ways up and down, its Send back buttons, the test levers and its lines. Shows the worker's
// `TileView`; decides nothing (GAME-02).
import type { LedgerLine, TileView } from '../worker/index.ts';
import { el } from './dom.ts';
import { landFacts } from './landrows.ts';
import type { PanelActions } from './panel.ts';
import { placeHead, placeTitle } from './placerows.ts';
import { shaftBack, shaftTitle } from './shaftrows.ts';
import { testTools } from './testtools.ts';
import { STAIN_NOTE, standingFacts, standingLines } from './tilerows.ts';
import { worksBack, worksDoing } from './worksrows.ts';

/** What the tile rows need from the panel. */
export interface TileDeps {
  actions: PanelActions;
  /** Test mode: the test tools and developer rows. */
  debug: boolean;
  lineRow(line: LedgerLine, prefix?: string): HTMLElement;
}

/** The inspector's title: the works, place, field, store or shaft here, else the tile. */
export function tileTitle(tile: TileView): string {
  const where = tile.z === 0 ? '' : ` · ${tile.z} level${tile.z > 1 ? 's' : ''} down`;
  return (
    tile.works?.name ??
    (placeTitle(tile) || undefined) ??
    tile.field?.name ??
    tile.store?.name ??
    (shaftTitle(tile) || `Tile ${tile.x}, ${tile.y}${where}`)
  );
}

/** The tile's record, its ways up and down, and the test levers. `notice` is what became of the
 * last dig order here: a line saying it waits for time to run, or the ledger line refusing it. */
export function tileRows(
  tile: TileView,
  depth: number,
  notice: string | LedgerLine | undefined,
  deps: TileDeps,
): HTMLElement[] {
  const { actions } = deps;
  const facts = el('dl', { class: 'kv' });
  for (const [key, value] of factsOf(tile, deps.debug))
    facts.append(el('dt', {}, key), el('dd', {}, value));
  const rows = [...placeHead(tile), facts, ...worksDoing(tile, (id) => actions.item(id))];
  if (tile.stain && !tile.piece && !tile.field && !tile.shaft)
    rows.push(el('p', { class: 'aside' }, STAIN_NOTE));
  rows.push(...waysOf(tile, actions), ...backsOf(tile, actions));
  if (deps.debug)
    rows.push(...testTools(tile, depth, (kind, arg) => actions.test(tile, kind, arg)));
  rows.push(...linesOf(tile, notice, deps));
  return rows;
}

/** The facts list: what lies here comes first, as it is usually what a tap was after (Morgan,
 * Phase 3 playtest). */
const factsOf = (tile: TileView, debug: boolean): string[][] => [
  ...(tile.goods ?? []).map((g) => ['lying here', g.text]),
  ...(tile.piece || tile.field || tile.shaft || tile.works || tile.place ? [] : landFacts(tile)),
  ...(tile.feature ? [[tile.z ? 'vein' : 'on it', tile.feature]] : []),
  ...storeFacts(tile),
  ...standingFacts(tile),
  ...(tile.below && !tile.piece && !tile.works ? [['below', tile.below]] : []),
  ...(debug ? [['chunk', `${tile.chunkX}, ${tile.chunkY} · version ${tile.version}`]] : []),
];

const storeFacts = ({ store }: TileView): string[][] =>
  store
    ? [
        ['store', `${store.name.toLowerCase()}: ${store.takes}`],
        ['holds', store.holds],
        ...(store.spoiled ? [['spoiled', store.spoiled]] : []),
      ]
    : [];

/** The Go down and Go up buttons where the tile has stairs or a shaft. */
function waysOf(tile: TileView, actions: PanelActions): HTMLElement[] {
  if (!tile.ways) return [];
  const go = el('div', { class: 'row' });
  if (tile.ways.down) {
    const down = el('button', { type: 'button', class: 'solid' }, `Go down to −${tile.z + 1}`);
    down.addEventListener('click', () => actions.go(tile, tile.z + 1));
    go.append(down);
  }
  if (tile.ways.up) {
    const label = tile.z === 1 ? 'Go up to the surface' : `Go up to −${tile.z - 1}`;
    const up = el('button', { type: 'button', class: 'solid' }, label);
    up.addEventListener('click', () => actions.go(tile, tile.z - 1));
    go.append(up);
  }
  return [go];
}

/** Send back, once, for a house, a shaft or the mill here. */
function backsOf(tile: TileView, actions: PanelActions): HTMLElement[] {
  const rows: HTMLElement[] = [];
  if (tile.house?.back) {
    const back = el('button', { type: 'button', 'data-testid': 'send-back-tile' }, 'Send back');
    back.addEventListener('click', () => actions.sendBack(tile, tile.house!.id, 'sendBack'));
    const row = el('div', { class: 'row' });
    row.append(back);
    rows.push(row);
  }
  return [
    ...rows,
    ...shaftBack(tile, () => actions.sendBack(tile, tile.shaft!.id, 'sendBackShaft')),
    ...worksBack(tile, (id) => actions.sendBack(tile, id, 'sendBackMill')),
  ];
}

/** The notice, then the lines behind what is here, and the line that last changed the tile. */
function linesOf(
  tile: TileView,
  notice: string | LedgerLine | undefined,
  { lineRow }: TileDeps,
): HTMLElement[] {
  const rows: HTMLElement[] = [];
  if (typeof notice === 'string') rows.push(el('p', { class: 'note' }, notice));
  else if (notice) rows.push(lineRow(notice, 'Not done · '));
  for (const [line, label] of standingLines(tile)) rows.push(lineRow(line, label));
  for (const g of tile.goods ?? []) if (g.made) rows.push(lineRow(g.made, 'Made by · '));
  if (tile.store?.made) rows.push(lineRow(tile.store.made, 'Store · '));
  if (tile.store?.built) rows.push(lineRow(tile.store.built, 'Built · '));
  if (tile.piece || tile.works || tile.place) return rows;
  rows.push(
    tile.changedBy
      ? lineRow(tile.changedBy, 'Last changed · ')
      : el('p', { class: 'muted' }, 'The line that last changed it is gone.'),
  );
  return rows;
}
