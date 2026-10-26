// The cooper (5B Bundle 3, V-041, V-132): the Cooper row of the Work sheet, crafting's skill.
// Nobody is told to make barrels. While food that spoils lies in the walled stores in more than the
// barrels there cover (`keep.barrel.holds` of it a barrel) and a bench stands with spare logs (over
// the Wood plate), a free able person takes it up: fetches `cooper.logs` logs, works `cooper.minutes`
// beside the bench (shorter with crafting skill, practising it), and carries the new barrel to the
// store tile whose food is least covered, where it is put under the stack (`cask` row). A barrel
// that no stack needs is laid at the bench. A barrel already made and lying about is carried first.
import type { EntityRow, WorldState } from '../core/index.ts';
import { benchOf } from '../build/index.ts';
import { addEntity } from '../entity/index.ts';
import { barrelsAt, dailyOf } from '../keep/index.ts';
import { depotAt, haveOf, itemsOf, layItem, takeFrom, wantOf } from '../goods/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { fetchKind, reachableOf, useHeld } from './fetch.ts';
import { practise } from './learn.ts';
import { able, declineIfUnable, outranked, priorityLine } from './priority.ts';
import { canStandBeside, goBeside, layAll, people, same, skillOf, spotOf } from './spots.ts';
import { walkTo } from './walk.ts';

const stop = (p: EntityRow): false => {
  Object.assign(p, { job: '', plan: 0, target: -1, work: 0, make: '', what: '' });
  return false;
};

const skillName = (ctx: SystemContext): string =>
  ctx.content.jobs.find((j) => j.id === ctx.content.work.cooper.job)?.skill ?? '';

/** The spoiling raw food lying in walled stores. */
function foodIn(world: WorldState, ctx: SystemContext): EntityRow[] {
  const { content } = ctx;
  return itemsOf(world).filter(
    (i) =>
      !i['holder'] &&
      dailyOf(content, i['kind'] as string) > 0 &&
      !content.items.find((d) => d.id === i['kind'])?.cooked &&
      !!depotAt(world, i['x'] as number, i['y'] as number, i['z'] as number),
  );
}

const sum = (rows: readonly EntityRow[]): number =>
  rows.reduce((n, r) => n + (r['count'] as number), 0);

/** The stack with the most food beyond what its barrels cover, ties in tile order. */
function neediest(ctx: SystemContext): EntityRow | undefined {
  const { world, content } = ctx;
  const holds = content.work.keep.barrel.holds;
  let best: EntityRow | undefined;
  let most = 0;
  const rows = [...foodIn(world, ctx)].sort(
    (a, b) => (a['y'] as number) - (b['y'] as number) || (a['x'] as number) - (b['x'] as number),
  );
  for (const i of rows) {
    const over =
      (i['count'] as number) - holds * barrelsAt(world, i['x'] as number, i['y'] as number, 0);
    if (over > most) [best, most] = [i, over];
  }
  return best;
}

/** What `p` would do: carry a barrel that lies about, else make one (a bench, logs over the
 * plate and a reachable batch of them), when the stores' food wants more barrels than it has. */
function choose(ctx: SystemContext, p: EntityRow): 'carry' | 'make' | undefined {
  const { world, content } = ctx;
  const def = content.work.cooper;
  const food = sum(foodIn(world, ctx));
  const placed = (world.entities['cask'] ?? []).reduce((n, c) => n + (c['barrels'] as number), 0);
  const needed = Math.ceil(food / content.work.keep.barrel.holds) - placed;
  if (needed <= 0 || !neediest(ctx)) return undefined;
  const free = sum(itemsOf(world).filter((i) => i['kind'] === def.item));
  if (free > 0) return reachableOf(ctx, p, def.item) > 0 ? 'carry' : undefined;
  if (!benchOf(world) || haveOf(world, content, 'logs') <= wantOf(world, content, 'logs'))
    return undefined;
  return reachableOf(ctx, p, 'logs') >= def.logs ? 'make' : undefined;
}

/** Takes up coopering if the food wants barrels and nobody free who puts it higher could. */
export function takeUpCoopering(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const def = content.work.cooper;
  if (!able(content, p, def.job)) {
    declineIfUnable(ctx, p, def.job);
    return false;
  }
  if (people(world).some((q) => q.id !== p.id && q['job'] === 'cooper')) return false;
  if (outranked(ctx, p, def.job, (q) => choose(ctx, q) !== undefined)) return false;
  const task = choose(ctx, p);
  const bench = benchOf(world);
  if (
    !task ||
    (task === 'make' && !canStandBeside(ctx, p, bench!['x'] as number, bench!['y'] as number))
  )
    return false;
  p['took'] = ctx.emit('work.tookUpCoopering', {
    causes: [
      ...[
        (bench?.['made'] as number) || (bench?.['line'] as number),
        priorityLine(world, p.id, def.job),
      ],
    ].filter((l): l is number => !!l),
    actors: [p.id],
    data: {
      name: p['name'] as string,
      why: `${sum(foodIn(world, ctx))} food in the stores would keep longer in barrels`,
    },
  });
  const level = skillOf(world, p, skillName(ctx));
  Object.assign(p, {
    ...{ job: 'cooper', plan: bench?.id ?? 0, target: -1, make: task },
    work: Math.ceil((def.minutes * 2 * def.skilled) / (def.skilled + level)),
  });
  return coopering(ctx, p);
}

/** Puts the barrel `p` holds under the stack, with its line. */
function setBarrel(ctx: SystemContext, p: EntityRow, stack: EntityRow, barrel: EntityRow): void {
  const { world, content } = ctx;
  const [x, y] = [stack['x'] as number, stack['y'] as number];
  const store = depotAt(world, x, y, 0);
  const kind = content.buildings.stores.kinds.find((k) => k.id === store?.['store']);
  const line = ctx.emit('cure.barrelled', {
    causes: [p['took'] as number],
    actors: [p.id],
    data: {
      name: p['name'] as string,
      what: content.items.find((i) => i.id === stack['kind'])?.name ?? (stack['kind'] as string),
      store: kind?.name ?? 'store',
    },
  });
  const cask = (world.entities['cask'] ?? []).find((c) => c['x'] === x && c['y'] === y);
  if (cask) Object.assign(cask, { barrels: (cask['barrels'] as number) + 1, line });
  else addEntity(world, 'cask', { x, y, z: 0, barrels: 1, line });
  takeFrom(world, barrel, 1);
}

/** One minute of coopering: fetch logs, work at the bench, make the barrel, carry it to the
 * stack that wants it; false when done or it cannot be done. */
export function coopering(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const def = content.work.cooper;
  const bench = benchOf(world);
  if (p['make'] === 'make') {
    if (!bench) return stop(p);
    const got = fetchKind(ctx, p, 'logs', def.logs);
    if (got === 'none') return stop(p);
    if (got === 'walking') return true;
    const [x, y] = [bench['x'] as number, bench['y'] as number];
    const here = spotOf(p);
    if (!(here.z === 0 && Math.abs(here.x - x) + Math.abs(here.y - y) === 1))
      return goBeside(ctx, p, x, y) || stop(p);
    p['work'] = (p['work'] as number) - 1;
    practise(ctx, p, skillName(ctx), p['took'] as number);
    if ((p['work'] as number) > 0) return true;
    useHeld(ctx, p, 'logs', def.logs);
    const id = layItem(world, { kind: def.item, count: 1, ...here, made: p['took'] as number });
    itemsOf(world).find((i) => i.id === id)!['holder'] = p.id;
    p['make'] = 'carry';
    return true;
  }
  const got = fetchKind(ctx, p, def.item, 1);
  if (got === 'none') return stop(p);
  if (got === 'walking') return true;
  const barrel = itemsOf(world).find((i) => i['holder'] === p.id && i['kind'] === def.item)!;
  const stack = neediest(ctx);
  if (!stack) {
    // No stack wants it now: it is laid down where they stand.
    layAll(ctx, def.item, 1, spotOf(p), p['took'] as number);
    takeFrom(world, barrel, 1);
    return stop(p);
  }
  const at = spotOf(stack);
  if (!same(at, spotOf(p))) return walkTo(ctx, p, at) || stop(p);
  setBarrel(ctx, p, stack, barrel);
  stop(p);
  return true;
}
