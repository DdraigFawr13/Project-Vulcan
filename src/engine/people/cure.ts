// Curing (5B Bundle 3, V-041, V-132): the Cure row of the Work sheet, cooking's skill. Nobody is
// told to smoke meat. While a smokehouse stands and a batch of fresh meat, game or fish lies in
// the stores (it would spoil), a free able person takes it up: fetches a batch of one kind and
// firewood from the stores (and a little salt, if any lies there), stands beside the smokehouse,
// works `cure.minutes` (shorter with cooking skill, practising it) and lays the batch around it
// for haulers: salt meat if the salt came too, else smoked meat. Out of hours they keep what they
// fetched and go on next morning. Taking up and each batch are ledger lines; trips are not.
import type { EntityRow, WorldState } from '../core/index.ts';
import { stationsOf } from '../build/index.ts';
import { inStore } from '../goods/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { fetchKind, reachableOf, useHeld } from './fetch.ts';
import { practise } from './learn.ts';
import { able, declineIfUnable, outranked, priorityLine } from './priority.ts';
import { canStandBeside, goBeside, layAll, people, skillOf, spotOf } from './spots.ts';

const stop = (p: EntityRow): false => {
  Object.assign(p, { job: '', plan: 0, target: -1, work: 0, make: '', what: '' });
  return false;
};

const skillName = (ctx: SystemContext): string =>
  ctx.content.jobs.find((j) => j.id === ctx.content.work.cure.job)?.skill ?? '';

const nameOf = (ctx: SystemContext, kind: string): string =>
  ctx.content.items.find((i) => i.id === kind)?.name ?? kind;

/** Only what lies in a store (the home store or a built one) is cured. */
const stored =
  (world: WorldState) =>
  (i: EntityRow): boolean =>
    inStore(world, i['x'] as number, i['y'] as number, i['z'] as number);

/** The built smokehouse, if there is one. */
const houseOf = (world: WorldState): EntityRow | undefined =>
  stationsOf(world).find((s) => s['kind'] === 'smokehouse' && s['state'] === 'built');

/** How much fresh food (any of `cure.from`) lies in the stores. */
const freshIn = (ctx: SystemContext, p: EntityRow): number =>
  ctx.content.work.cure.from.reduce((n, k) => n + reachableOf(ctx, p, k, stored(ctx.world)), 0);

/** What `p` would cure: the first fresh kind with a batch in the stores, with firewood to smoke
 * it; salted if salt lies there too. */
function pick(ctx: SystemContext, p: EntityRow): { kind: string; salted: boolean } | undefined {
  const { world, content } = ctx;
  const def = content.work.cure;
  const only = stored(world);
  if (reachableOf(ctx, p, def.fuelItem, only) < def.fuel) return undefined;
  const kind = def.from.find((k) => reachableOf(ctx, p, k, only) >= def.batch);
  if (!kind) return undefined;
  return { kind, salted: reachableOf(ctx, p, def.salt.item, only) >= def.salt.per };
}

/** Takes up curing if a smokehouse stands and a batch of fresh food would spoil, and nobody free
 * who puts it higher could. */
export function takeUpCuring(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const def = content.work.cure;
  const house = houseOf(world);
  if (!house) return false;
  if (!able(content, p, def.job)) {
    declineIfUnable(ctx, p, def.job);
    return false;
  }
  if (people(world).some((q) => q.id !== p.id && q['job'] === 'cure')) return false;
  if (outranked(ctx, p, def.job, (q) => !!pick(ctx, q))) return false;
  const got = pick(ctx, p);
  if (!got || !canStandBeside(ctx, p, house['x'] as number, house['y'] as number)) return false;
  p['took'] = ctx.emit('work.tookUpCuring', {
    causes: [house['made'] as number, priorityLine(world, p.id, def.job)].filter(
      (l): l is number => !!l,
    ),
    actors: [p.id],
    data: {
      name: p['name'] as string,
      why: `${freshIn(ctx, p)} fresh meat and fish would spoil`,
    },
  });
  const level = skillOf(world, p, skillName(ctx));
  Object.assign(p, {
    ...{ job: 'cure', plan: house.id, target: -1, what: got.kind },
    make: got.salted ? def.salt.makes : def.smoked,
    work: Math.ceil((def.minutes * 2 * def.skilled) / (def.skilled + level)),
  });
  return curing(ctx, p);
}

/** One minute of curing: fetch, go beside the smokehouse, work, lay the batch; false when done or
 * it cannot be done (what is held goes back to the store). */
export function curing(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const def = content.work.cure;
  const house = houseOf(world);
  if (!house || house.id !== p['plan']) return stop(p);
  const only = stored(world);
  const wants: [string, number][] = [
    [p['what'] as string, def.batch],
    [def.fuelItem, def.fuel],
  ];
  for (const [kind, n] of wants) {
    const got = fetchKind(ctx, p, kind, n, only);
    if (got === 'none') return stop(p);
    if (got === 'walking') return true;
  }
  if (p['make'] === def.salt.makes) {
    const got = fetchKind(ctx, p, def.salt.item, def.salt.per, only);
    if (got === 'walking') return true;
    // The salt was used up meanwhile: the batch is smoked after all.
    if (got === 'none') p['make'] = def.smoked;
  }
  const [x, y] = [house['x'] as number, house['y'] as number];
  const here = spotOf(p);
  if (!(here.z === 0 && Math.abs(here.x - x) + Math.abs(here.y - y) === 1))
    return goBeside(ctx, p, x, y) || stop(p);
  p['work'] = (p['work'] as number) - 1;
  practise(ctx, p, skillName(ctx), p['took'] as number);
  if ((p['work'] as number) > 0) return true;
  const made = p['make'] as string;
  useHeld(ctx, p, p['what'] as string, def.batch);
  useHeld(ctx, p, def.fuelItem, def.fuel);
  if (made === def.salt.makes) useHeld(ctx, p, def.salt.item, def.salt.per);
  const line = ctx.emit('cure.cured', {
    causes: [p['took'] as number],
    actors: [p.id],
    data: { name: p['name'] as string, count: def.batch, what: nameOf(ctx, made) },
  });
  layAll(ctx, made, def.batch, here, line);
  stop(p);
  return true;
}
