// Sinking a shaft (P4.1, V-087): a ladder of logs fetched, stack by stack, for the first level,
// then each level worked from beside the shaft (or at its foot) and sunk under a line naming the
// sinker.
import { itemsOf, layItem, loadOf, takeFrom } from '../goods/index.ts';
import { sinkShaftAt } from '../map/index.ts';
import { shaftsOf } from '../mine/index.ts';
import type { EngineContent, EntityRow } from '../core/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { reachableStacks, stackOf } from './build.ts';
import { nameOf, practiseMining, start, stop } from './minetask.ts';
import { goBeside, same, spotOf } from './spots.ts';
import { walkTo } from './walk.ts';

/** The ladder: the item and count the first level takes (the first entry of `mine.ladder`). */
export function ladderOf(content: EngineContent): { kind: string; count: number } | undefined {
  const first = Object.entries(content.work.mine.ladder)[0];
  return first ? { kind: first[0], count: first[1] } : undefined;
}

/** Whether the logs for the ladder can be had: what `p` holds and the stacks they can reach make
 * up its count. When they do not, `mine.noLadder` says so once for each change of the plate. */
export function laddered(
  ctx: SystemContext,
  p: EntityRow,
  metal: string,
  ladder: { kind: string; count: number },
  plate: number | undefined,
): boolean {
  const held = loadOf(ctx.world, p.id);
  const have =
    (held?.['kind'] === ladder.kind ? (held['count'] as number) : 0) +
    reachableStacks(ctx, p, ladder.kind).reduce((n, s) => n + (s.item['count'] as number), 0);
  if (have >= ladder.count) return true;
  const mark = `noLadder-${metal}`;
  if (ctx.state[mark] !== (plate ?? 0))
    ctx.emit('mine.noLadder', {
      causes: plate ? [plate] : [],
      data: { metal, logs: ladder.count },
    });
  ctx.state[mark] = plate ?? 0;
  return false;
}

/** Sinking a shaft a level: fetch the ladder for the first, stand by (or in) the shaft, work the
 * minutes, and the level is sunk under a line naming them and citing the plan. */
export function sinking(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const shaft = shaftsOf(world).find((s) => s.id === p['plan']);
  if (!shaft || ['sent', 'spent', 'done'].includes(shaft['state'] as string)) return stop(ctx, p);
  const depth = shaft['depth'] as number;
  const [x, y] = [shaft['x'] as number, shaft['y'] as number];
  const ladder = depth === 0 ? ladderOf(content) : undefined;
  let held = loadOf(world, p.id);
  // Anything else in hand (a bedroll still held after a night in a new bed) is set down here and
  // the ladder fetched (5B Bundle 3: at dawn it made the sinker a hauler and the shaft waited).
  if (ladder && held && held['kind'] !== ladder.kind) {
    Object.assign(held, { ...spotOf(p), holder: 0 });
    held = undefined;
  }
  // Fetch until the ladder's count is held, however small the stacks lying about.
  if (ladder && (!held || (held['count'] as number) < ladder.count))
    return fetchLadder(ctx, p, ladder.kind, ladder.count);
  const here = spotOf(p);
  const there =
    depth === 0
      ? here.z === 0 && Math.abs(here.x - x) + Math.abs(here.y - y) === 1
      : same(here, { x, y, z: depth });
  if (!there)
    return (
      (depth === 0 ? goBeside(ctx, p, x, y) : walkTo(ctx, p, { x, y, z: depth })) || stop(ctx, p)
    );
  p['work'] = (p['work'] as number) - 1;
  practiseMining(ctx, p);
  if ((p['work'] as number) > 0) return true;
  const level = depth + 1;
  const used = ladder && held ? Math.min(ladder.count, held['count'] as number) : 0;
  if (held && used) takeFrom(world, held, used);
  const line = ctx.emit('mine.sank', {
    causes: [p['took'] as number, shaft['line'] as number],
    actors: [p.id],
    data: {
      name: p['name'] as string,
      x,
      y,
      level,
      ladder: used ? ` with ${used} ${nameOf(content, ladder!.kind)} for a ladder` : '',
    },
  });
  sinkShaftAt(ctx, x, y, depth, level, line);
  shaft['depth'] = level;
  shaft['state'] = level >= (shaft['to'] as number) ? 'done' : 'sinking';
  if (shaft['state'] === 'done') return stop(ctx, p);
  start(ctx, p, {
    kind: 'sink',
    what: shaft['metal'] as string,
    plan: shaft.id,
    target: -1,
    minutes: content.work.mine.shaft,
    causes: [],
    word: '',
    good: '',
    have: 0,
    want: 0,
  });
  return true;
}

/** Goes for the ladder's wood and picks it up: the nearest stack, up to what the ladder still
 * lacks, added to what is already held. */
function fetchLadder(ctx: SystemContext, p: EntityRow, kind: string, count: number): boolean {
  const { world } = ctx;
  let item = itemsOf(world).find((i) => i.id === p['target'] && !i['holder']);
  if (!item) {
    item = stackOf(ctx, p, kind);
    if (!item) return stop(ctx, p);
    p['target'] = item.id;
  }
  if (!same(spotOf(item), spotOf(p))) return walkTo(ctx, p, spotOf(item)) || stop(ctx, p);
  const held = loadOf(world, p.id);
  const n = Math.min(
    count - ((held?.['count'] as number | undefined) ?? 0),
    item['count'] as number,
  );
  if (held) held['count'] = (held['count'] as number) + takeFrom(world, item, n);
  else if (n === (item['count'] as number)) item['holder'] = p.id;
  else {
    takeFrom(world, item, n);
    const id = layItem(world, { kind, count: n, ...spotOf(p), made: item['made'] as number });
    itemsOf(world).find((i) => i.id === id)!['holder'] = p.id;
  }
  p['target'] = -1;
  return true;
}
