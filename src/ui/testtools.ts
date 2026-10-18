// The test tools row (test mode only, badged TEST MODE): the direct levers kept for trying things
// out, never shown in the ordinary game, where colonists choose their own work (V-015, V-041).
// Cut stairs or sink a shaft, mark a tree to fell, add a tile to the store, and since P3.1 plan
// a part on a tile or order one down (colonists site buildings themselves from P3.7, V-049).
import type { TileView } from '../worker/index.ts';
import { el } from './dom.ts';

export type TestOrder =
  'cutStairs' | 'sinkShaft' | 'markFell' | 'markStore' | 'placeBuilding' | 'deconstruct';

/** The parts the row offers to plan, with their buttons' words. */
const PLANS = [
  ['Plan stone wall', 'wall-stone'],
  ['Plan wood wall', 'wall-wood'],
  ['Plan floor (wood)', 'floor-wood'],
  ['Plan door (wood)', 'door-wood'],
  ['Plan stair down (wood)', 'stair-wood'],
] as const;

/** The row for `tile`, or nothing when no tool applies there; `depth` levels lie below. */
export function testTools(
  tile: TileView,
  depth: number,
  order: (kind: TestOrder, arg?: number | string) => void,
): HTMLElement[] {
  const tools: HTMLElement[] = [];
  const add = (label: string, kind: TestOrder, arg?: number | string) => {
    const button = el('button', { type: 'button' }, label);
    button.addEventListener('click', () => order(kind, arg));
    tools.push(button);
  };
  if (tile.z < depth && !tile.ways?.down && !tile.plan) {
    add('Cut stairs down', 'cutStairs');
    add(`Sink a shaft to −${depth}`, 'sinkShaft', depth);
  }
  if (tile.tree && !tile.marked) add('Mark to fell', 'markFell');
  if (tile.open) add('Add to store', 'markStore');
  if (tile.z === 0 && !tile.plan)
    for (const [label, part] of PLANS) add(label, 'placeBuilding', part);
  if (tile.plan && tile.plan.state !== 'down') add('Take down', 'deconstruct');
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
