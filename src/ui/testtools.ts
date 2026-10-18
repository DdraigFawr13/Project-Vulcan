// The test tools row (test mode only, badged TEST MODE): the direct levers kept for trying things
// out, never shown in the ordinary game, where colonists choose their own work (V-015). Cut
// stairs or sink a shaft, mark a tree to fell, add a tile to the store.
import type { TileView } from '../worker/index.ts';
import { el } from './dom.ts';

export type TestOrder = 'cutStairs' | 'sinkShaft' | 'markFell' | 'markStore';

/** The row for `tile`, or nothing when no tool applies there; `depth` levels lie below. */
export function testTools(
  tile: TileView,
  depth: number,
  order: (kind: TestOrder, to?: number) => void,
): HTMLElement[] {
  const tools: HTMLElement[] = [];
  const add = (label: string, kind: TestOrder, to?: number) => {
    const button = el('button', { type: 'button' }, label);
    button.addEventListener('click', () => order(kind, to));
    tools.push(button);
  };
  if (tile.z < depth && !tile.ways?.down) {
    add('Cut stairs down', 'cutStairs');
    add(`Sink a shaft to −${depth}`, 'sinkShaft', depth);
  }
  if (tile.tree && !tile.marked) add('Mark to fell', 'markFell');
  if (tile.open) add('Add to store', 'markStore');
  if (!tools.length && !tile.marked) return [];
  const head = el('p', {}, 'Test tools');
  head.append(el('span', { class: 'tag', 'data-testid': 'test-mode' }, 'TEST MODE'));
  const row = el('div', { class: 'row' });
  row.append(...tools);
  return [
    head,
    ...(tile.marked
      ? [el('p', { class: 'note' }, 'Marked to fell: the next free feller takes it.')]
      : []),
    row,
    el(
      'p',
      { class: 'muted' },
      'Direct orders for testing only. In the game the band chooses its own work from the Stock levels.',
    ),
  ];
}
