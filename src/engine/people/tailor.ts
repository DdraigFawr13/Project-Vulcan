// Tailoring (Phase 5B Bundle 5, P5.5, V-041): the Tailor row of the Work sheet, the crafting skill.
// While the Clothes plate is short of a slot's spares (goods `shortOf`: the plate's share, plus
// anyone due to change), a free able person makes the warmest garment of the shorter slot whose
// cloth, leather or cured hides they can reach, at the nearest table (else the loom). Worth is
// their skill plus or less up to `tailor.roll` from the `craft` stream (clothes.json `worth`); the
// garment lies for haulers to take to a store, from where people change into it (change.ts).
import { streamFor, type EntityRow } from '../core/index.ts';
import { furnitureOf } from '../build/index.ts';
import { lifeOf, shortOf, wantOf, worthFor, sparesOf, layItem } from '../goods/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { fetchKind, reachableOf, useHeld } from './fetch.ts';
import { practise } from './learn.ts';
import { able, declineIfUnable, outranked, priorityLine } from './priority.ts';
import { goBeside, people, skillOf, spotOf } from './spots.ts';
import { loomOf, whereOf } from './weave.ts';

const stop = (p: EntityRow): false => {
  Object.assign(p, { job: '', plan: 0, target: -1, work: 0, make: '' });
  return false;
};

const nameOf = (ctx: SystemContext, kind: string): string =>
  ctx.content.items.find((i) => i.id === kind)?.name ?? kind;

/** The garment `p` could make now: the shorter slot first (everyday on a tie), its warmest
 * garment whose inputs they can reach. */
function choose(ctx: SystemContext, p: EntityRow) {
  const { world, content } = ctx;
  const slots = content.clothes.slots
    .map((s, k) => ({ s, k, short: shortOf(world, content, s.id) }))
    .filter((x) => x.short > 0)
    .sort((a, b) => b.short - a.short || a.k - b.k);
  for (const { s } of slots) {
    const g = content.clothes.garments
      .filter((x) => x.slot === s.id)
      .sort((a, b) => b.warmth - a.warmth || b.last - a.last)
      .find((x) => x.from.every((i) => reachableOf(ctx, p, i.kind) >= i.count));
    if (g) return g;
  }
  return undefined;
}

/** The nearest built table, else the loom: where the tailor sits. */
function benchOf(ctx: SystemContext, p: EntityRow): EntityRow | undefined {
  const here = spotOf(p);
  const far = (f: EntityRow) =>
    Math.abs((f['x'] as number) - here.x) + Math.abs((f['y'] as number) - here.y);
  const tables = furnitureOf(ctx.world)
    .filter((f) => f['kind'] === 'table' && f['state'] === 'built' && f['z'] === 0)
    .sort((a, b) => far(a) - far(b) || a.id - b.id);
  return tables[0] ?? loomOf(ctx);
}

/** Takes up tailoring when a slot is short and its cloth or leather can be reached. */
export function takeUpTailoring(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const def = content.clothes.tailor;
  if (!able(content, p, def.job)) {
    declineIfUnable(ctx, p, def.job);
    return false;
  }
  if (outranked(ctx, p, def.job, (q) => !!choose(ctx, q))) return false;
  const g = choose(ctx, p);
  const at = benchOf(ctx, p);
  if (!g || !at) return false;
  // One garment being made a slot at once.
  const making = people(world)
    .filter((q) => q['job'] === 'tailor')
    .map((q) => q['make']);
  const slotOf = (k: unknown) => content.clothes.garments.find((x) => x.item === k)?.slot;
  if (making.some((k) => slotOf(k) === g.slot)) return false;
  const stock = world.entities['stock']?.find((s) => s['good'] === content.clothes.good);
  const spares = sparesOf(world, content).length;
  p['took'] = ctx.emit('work.tookUpTailoring', {
    causes: [stock?.['line'] as number, priorityLine(world, p.id, def.job)].filter(
      (l): l is number => !!l,
    ),
    actors: [p.id],
    data: {
      name: p['name'] as string,
      what: nameOf(ctx, g.item),
      why: `clothes are short: ${spares} spare${spares === 1 ? '' : 's'} of ${wantOf(world, content, content.clothes.good)}`,
    },
  });
  const level = skillOf(world, p, content.jobs.find((j) => j.id === def.job)?.skill ?? '');
  Object.assign(p, {
    ...{ job: 'tailor', plan: at.id, target: -1, make: g.item },
    work: Math.ceil((g.minutes * 2 * def.skilled) / (def.skilled + level)),
  });
  return tailoring(ctx, p);
}

/** One minute of tailoring; false when it is done or cannot be done. */
export function tailoring(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const def = content.clothes.tailor;
  const g = content.clothes.garments.find((x) => x.item === p['make']);
  const at = furnitureOf(world).find((f) => f.id === p['plan'] && f['state'] === 'built');
  if (!g || !at) return stop(p);
  for (const input of g.from) {
    const got = fetchKind(ctx, p, input.kind, input.count);
    if (got === 'none') return stop(p);
    if (got === 'walking') return true;
  }
  const [x, y] = [at['x'] as number, at['y'] as number];
  const here = spotOf(p);
  if (!(here.z === 0 && Math.abs(here.x - x) + Math.abs(here.y - y) <= 1))
    return goBeside(ctx, p, x, y) || stop(p);
  p['work'] = (p['work'] as number) - 1;
  const skill = content.jobs.find((j) => j.id === def.job)?.skill ?? '';
  practise(ctx, p, skill, p['took'] as number);
  if ((p['work'] as number) > 0) return true;
  for (const input of g.from) useHeld(ctx, p, input.kind, input.count);
  const score = skillOf(world, p, skill) + streamFor(world, 'craft').between(-def.roll, def.roll);
  const worth = worthFor(content, score);
  const line = ctx.emit('clothes.made', {
    causes: [p['took'] as number],
    actors: [p.id],
    data: {
      name: p['name'] as string,
      worth: content.clothes.worth.find((w) => w.id === worth)?.word ?? worth,
      what: nameOf(ctx, g.item),
      where: whereOf(ctx, at),
    },
  });
  layItem(
    world,
    { kind: g.item, count: 1, ...here, made: line },
    {
      quality: worth,
      wear: lifeOf(content, g.item, worth),
    },
  );
  stop(p);
  return true;
}
