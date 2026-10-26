// The potter (5B Bundle 3, V-041, V-132): the Potter row of the Work sheet, crafting's skill.
// Nobody is told to throw pots. While a kiln stands and grain, oats and beans in the walled
// stores outrun the pots under them (`potter.holds` of it a pot), or planned house walls want more
// bricks than the colony has, a free able person takes it up: fetches `potter.clay` clay and
// `potter.fuel` firewood from the stores, works beside the kiln (shorter with crafting skill,
// practising it) and either lays `brick.per` bricks around it for haulers, or carries the pot to
// the store tile whose grain is least covered, where it goes under the stack (`cask` row). A pot
// already made and lying about is carried first. Taking up, each firing and each pot set are
// ledger lines; trips are not. The miner digs clay for it when the stores hold too little
// (`clayWanted`, clay.ts).
import type { EntityRow, WorldState } from '../core/index.ts';
import { bricksWanted, kilnOf } from '../build/index.ts';
import { addEntity } from '../entity/index.ts';
import { potsAt } from '../keep/index.ts';
import { depotAt, inStore, itemsOf, layItem, takeFrom } from '../goods/index.ts';
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
  ctx.content.jobs.find((j) => j.id === ctx.content.work.potter.job)?.skill ?? '';

const nameOf = (ctx: SystemContext, kind: string): string =>
  ctx.content.items.find((i) => i.id === kind)?.name ?? kind;

const sum = (rows: readonly EntityRow[]): number =>
  rows.reduce((n, r) => n + (r['count'] as number), 0);

/** Only what lies in a store (the home store or a built one) is fired. */
const stored =
  (world: WorldState) =>
  (i: EntityRow): boolean =>
    inStore(world, i['x'] as number, i['y'] as number, i['z'] as number);

/** The grain, oats and beans lying in walled stores. */
const grainIn = (ctx: SystemContext): EntityRow[] =>
  itemsOf(ctx.world).filter(
    (i) =>
      !i['holder'] &&
      ctx.content.work.potter.kinds.includes(i['kind'] as string) &&
      !!depotAt(ctx.world, i['x'] as number, i['y'] as number, i['z'] as number),
  );

/** The stack with the most grain beyond what its pots cover, ties in tile order. */
function neediest(ctx: SystemContext): EntityRow | undefined {
  const { world, content } = ctx;
  let best: EntityRow | undefined;
  let most = 0;
  const rows = [...grainIn(ctx)].sort(
    (a, b) => (a['y'] as number) - (b['y'] as number) || (a['x'] as number) - (b['x'] as number),
  );
  for (const i of rows) {
    const over =
      (i['count'] as number) -
      content.work.potter.holds * potsAt(world, i['x'] as number, i['y'] as number, 0);
    if (over > most) [best, most] = [i, over];
  }
  return best;
}

/** Pots the grain in walled stores wants beyond those set under it and those lying about. */
function potsWanted(ctx: SystemContext): number {
  const { world, content } = ctx;
  const def = content.work.potter;
  const placed = (world.entities['cask'] ?? []).reduce(
    (n, c) => n + ((c['pots'] as number) ?? 0),
    0,
  );
  const free = sum(itemsOf(world).filter((i) => i['kind'] === def.pot.item));
  return Math.ceil(sum(grainIn(ctx)) / def.holds) - placed - free;
}

/** The clay the pots and bricks wanted would take (the miner digs it when the stores hold less). */
export function clayWanted(ctx: SystemContext): number {
  const { world, content } = ctx;
  const def = content.work.potter;
  if (!kilnOf(world)) return 0;
  const pots = neediest(ctx) ? Math.max(0, potsWanted(ctx)) : 0;
  const batches = Math.ceil(bricksWanted(world, content).count / def.brick.per);
  return (pots + batches) * def.clay;
}

type Task = 'carry' | 'pot' | 'brick';

/** What `p` would do: carry a pot that lies about to the grain that wants one, else throw a pot
 * for it, else fire bricks for the walls; the fuel and the clay must be reachable in the stores. */
function choose(ctx: SystemContext, p: EntityRow): Task | undefined {
  const { world, content } = ctx;
  const def = content.work.potter;
  if (!kilnOf(world)) return undefined;
  const only = stored(world);
  const free = sum(itemsOf(world).filter((i) => i['kind'] === def.pot.item));
  if (free > 0 && neediest(ctx) && reachableOf(ctx, p, def.pot.item) > 0) return 'carry';
  if (reachableOf(ctx, p, def.fuelItem, only) < def.fuel) return undefined;
  if (reachableOf(ctx, p, def.clayItem, only) < def.clay) return undefined;
  if (neediest(ctx) && potsWanted(ctx) > 0) return 'pot';
  return bricksWanted(world, content).count > 0 ? 'brick' : undefined;
}

/** The reason given for taking it up. */
function whyOf(ctx: SystemContext, task: Task): string {
  const { world, content } = ctx;
  if (task !== 'brick')
    return `${sum(grainIn(ctx))} grain and roots in the stores would keep longer in pots`;
  const plan = bricksWanted(world, content).plan;
  const house = (world.entities['house'] ?? []).find((h) => h.id === plan?.['house']);
  return `the ${(house?.['size'] as string | undefined) ?? 'house'} wants bricks for its walls`;
}

/** Takes up pottery if a kiln stands and pots or bricks are wanted, and nobody free who puts it
 * higher could. */
export function takeUpPottery(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const def = content.work.potter;
  const kiln = kilnOf(world);
  if (!kiln) return false;
  if (!able(content, p, def.job)) {
    declineIfUnable(ctx, p, def.job);
    return false;
  }
  if (people(world).some((q) => q.id !== p.id && q['job'] === 'potter')) return false;
  if (outranked(ctx, p, def.job, (q) => choose(ctx, q) !== undefined)) return false;
  const task = choose(ctx, p);
  if (!task || !canStandBeside(ctx, p, kiln['x'] as number, kiln['y'] as number)) return false;
  const plan = task === 'brick' ? bricksWanted(world, content).plan : undefined;
  p['took'] = ctx.emit('work.tookUpPottery', {
    causes: [
      kiln['made'] as number,
      (plan?.['line'] as number | undefined) ?? 0,
      priorityLine(world, p.id, def.job) ?? 0,
    ].filter((l) => !!l),
    actors: [p.id],
    data: { name: p['name'] as string, why: whyOf(ctx, task) },
  });
  const level = skillOf(world, p, skillName(ctx));
  const minutes = task === 'brick' ? def.brick.minutes : def.pot.minutes;
  Object.assign(p, {
    ...{ job: 'potter', plan: kiln.id, target: -1, make: task },
    work: Math.ceil((minutes * 2 * def.skilled) / (def.skilled + level)),
  });
  return potting(ctx, p);
}

/** Puts the pot `p` holds under the stack, with its line. */
function setPot(ctx: SystemContext, p: EntityRow, stack: EntityRow, pot: EntityRow): void {
  const { world, content } = ctx;
  const [x, y] = [stack['x'] as number, stack['y'] as number];
  const store = depotAt(world, x, y, 0);
  const kind = content.buildings.stores.kinds.find((k) => k.id === store?.['store']);
  const line = ctx.emit('potter.potted', {
    causes: [p['took'] as number],
    actors: [p.id],
    data: {
      name: p['name'] as string,
      what: nameOf(ctx, stack['kind'] as string),
      store: kind?.name ?? 'store',
    },
  });
  const cask = (world.entities['cask'] ?? []).find((c) => c['x'] === x && c['y'] === y);
  if (cask) Object.assign(cask, { pots: ((cask['pots'] as number) ?? 0) + 1, line });
  else addEntity(world, 'cask', { x, y, z: 0, barrels: 0, pots: 1, line });
  takeFrom(world, pot, 1);
}

/** One minute of pottery: fetch clay and firewood, work beside the kiln, then lay the bricks or
 * carry the pot to the grain that wants it; false when done or it cannot be done. */
export function potting(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const def = content.work.potter;
  const kiln = kilnOf(world);
  if (!kiln || kiln.id !== p['plan']) return stop(p);
  if (p['make'] !== 'carry') {
    const only = stored(world);
    for (const [kind, n] of [
      [def.clayItem, def.clay],
      [def.fuelItem, def.fuel],
    ] as const) {
      const got = fetchKind(ctx, p, kind, n, only);
      if (got === 'none') return stop(p);
      if (got === 'walking') return true;
    }
    const [x, y] = [kiln['x'] as number, kiln['y'] as number];
    const here = spotOf(p);
    if (!(here.z === 0 && Math.abs(here.x - x) + Math.abs(here.y - y) === 1))
      return goBeside(ctx, p, x, y) || stop(p);
    p['work'] = (p['work'] as number) - 1;
    practise(ctx, p, skillName(ctx), p['took'] as number);
    if ((p['work'] as number) > 0) return true;
    useHeld(ctx, p, def.clayItem, def.clay);
    useHeld(ctx, p, def.fuelItem, def.fuel);
    if (p['make'] === 'brick') {
      const line = ctx.emit('potter.fired', {
        causes: [p['took'] as number],
        actors: [p.id],
        data: {
          name: p['name'] as string,
          count: def.brick.per,
          what: nameOf(ctx, def.brick.item),
        },
      });
      layAll(ctx, def.brick.item, def.brick.per, here, line);
      stop(p);
      return true;
    }
    const id = layItem(world, { kind: def.pot.item, count: 1, ...here, made: p['took'] as number });
    itemsOf(world).find((i) => i.id === id)!['holder'] = p.id;
    p['make'] = 'carry';
    return true;
  }
  const got = fetchKind(ctx, p, def.pot.item, 1);
  if (got === 'none') return stop(p);
  if (got === 'walking') return true;
  const pot = itemsOf(world).find((i) => i['holder'] === p.id && i['kind'] === def.pot.item)!;
  const stack = neediest(ctx);
  if (!stack) {
    // No stack wants it now: it is laid down where they stand.
    layAll(ctx, def.pot.item, 1, spotOf(p), p['took'] as number);
    takeFrom(world, pot, 1);
    return stop(p);
  }
  const at = spotOf(stack);
  if (!same(at, spotOf(p))) return walkTo(ctx, p, at) || stop(p);
  setPot(ctx, p, stack, pot);
  stop(p);
  return true;
}
