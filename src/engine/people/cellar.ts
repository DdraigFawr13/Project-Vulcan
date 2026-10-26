// Digging the cellar (5B Bundle 3, V-041): the cellar plan is a `shaft` row of the cellar's kind
// (keep/cellar.ts), so miners take it up under the mine row like any shaft: first the stair is
// sunk a level (a ladder of logs for the first, shaft.ts), then the larder's inside tiles on level
// 1 are dug out one by one, each beside an open tile. What the digging gives is hauled to the
// stores as for any mine; the last tile dug makes the cellar a store (keep `finishCellar`).
import type { EntityRow } from '../core/index.ts';
import { cellarKind, finishCellar, toDig } from '../keep/index.ts';
import { layerOf } from '../map/index.ts';
import { shaftFor } from '../mine/index.ts';
import { pack, walkAt } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { ladderOf, laddered } from './shaft.ts';
import { takenBy, type Task } from './minetask.ts';
import { people, spotOf } from './spots.ts';

/** The next cellar work for `p`, or undefined: sinking the stair, or digging the next tile that
 * lies beside open ground (the stair's foot first, then tiles already dug). */
export function cellarWork(ctx: SystemContext, p: EntityRow): Task | undefined {
  const { world, content } = ctx;
  const kind = cellarKind(content);
  const shaft = shaftFor(world, kind);
  if (!shaft) return undefined;
  const mine = content.work.mine;
  const others = people(world).filter((q) => q.id !== p.id && q['job'] === 'mine');
  const base = {
    ...{ what: kind, plan: shaft.id, causes: [shaft['line'] as number], good: 'a cellar' },
    ...{ have: 0, want: 1 },
  };
  if (shaft['state'] !== 'done') {
    if (others.some((q) => q['task'] === 'sink' && q['plan'] === shaft.id)) return undefined;
    const ladder = shaft['depth'] === 0 ? ladderOf(content) : undefined;
    if (ladder && !laddered(ctx, p, kind, ladder, undefined)) return undefined;
    return { ...base, kind: 'sink', target: -1, minutes: mine.shaft, word: mine.words.sink };
  }
  const map = world.map;
  const layer = layerOf(map, 1);
  if (!layer) return undefined;
  const size = map.width * map.height;
  const taken = takenBy(ctx, p);
  const open = (i: number): boolean => walkAt(content, map, 1, i) > 0;
  const from = spotOf({ ...shaft, z: 1 } as EntityRow);
  let best: number | undefined;
  let score = Infinity;
  for (const t of toDig(world, content, shaft)) {
    const [x, y] = [t['x'] as number, t['y'] as number];
    const i = y * map.width + x;
    const beside = [i - 1, i + 1, i - map.width, i + map.width].some((j) => open(j));
    if (!beside || taken.has(size + i)) continue;
    const s = Math.max(Math.abs(x - from.x), Math.abs(y - from.y)) * 1000000 + i;
    if (s < score) [best, score] = [i, s];
  }
  if (best === undefined) return undefined;
  const target = pack(map, { x: best % map.width, y: Math.floor(best / map.width), z: 1 });
  return { ...base, kind: 'tunnel', target, minutes: mine.dig, word: mine.words.cellar };
}

/** A tile on level 1 was dug by `p` at a cellar task: if it was the last, the cellar is a store. */
export function dugCellar(ctx: SystemContext, p: EntityRow, line: number): void {
  const shaft = shaftFor(ctx.world, cellarKind(ctx.content));
  if (shaft && p['what'] === cellarKind(ctx.content))
    finishCellar(ctx, shaft, p['name'] as string, line);
}
