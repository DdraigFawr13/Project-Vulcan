// Smelting (Phase 4 Bundle 3, V-041): the Smelt row of the Work sheet, smithing's skill. Once the
// smelter stands, a free able person takes up the recipe to make: an alloy first when its ingots
// are in hand and it is short, else the metal with the most ingots wanted. They carry the inputs
// from wherever they lie, work beside the smelter `minutes × 2 × skilled ÷ (skilled + level)`
// (practising smithing), and lay the output for haulers. The ingots keep a trail (goods metal.ts).
// A wanted recipe short only of charcoal is one `metal.waiting` alert, cleared when it arrives.
import type { EntityRow, RecipeDef } from '../core/index.ts';
import { stationOf } from '../build/index.ts';
import {
  haveOf,
  ingotWant,
  mergeTrails,
  oreTrail,
  trailOf,
  trailText,
  wantedBy,
  withStep,
  type Step,
} from '../goods/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { fetchKind, reachableOf, useHeld } from './fetch.ts';
import { practise } from './learn.ts';
import { able, declineIfUnable, outranked, priorityLine } from './priority.ts';
import { goBeside, layAround, people, skillOf, spotOf } from './spots.ts';

const stop = (p: EntityRow): false => {
  Object.assign(p, { job: '', plan: 0, target: -1, work: 0, make: '' });
  return false;
};

const skillName = (ctx: SystemContext): string =>
  ctx.content.jobs.find((j) => j.id === ctx.content.metal.smelter.job)?.skill ?? '';

const nameOf = (ctx: SystemContext, kind: string): string =>
  ctx.content.items.find((i) => i.id === kind)?.name ?? kind;

/** What `p` would make, or the input a wanted recipe is waiting for (only charcoal, the fuel). */
function choose(ctx: SystemContext, p: EntityRow): { recipe?: RecipeDef; missing?: string } {
  const { world, content } = ctx;
  const fuel = content.metal.clamp.item;
  const wants = content.metal.recipes
    .map((r, k) => ({ r, k, want: ingotWant(world, content, r.id) }))
    .filter((c) => c.want > 0)
    .sort((a, b) => +b.r.alloy - +a.r.alloy || b.want - a.want || a.k - b.k);
  let missing: string | undefined;
  for (const { r } of wants) {
    // Cheap first: the colony must hold the inputs at all.
    if (r.inputs.some((i) => i.kind !== fuel && haveOf(world, content, i.kind) < i.count)) continue;
    const short = r.inputs.filter((i) => reachableOf(ctx, p, i.kind) < i.count);
    if (!short.length) return { recipe: r };
    // Short of charcoal the colony has none of (some may only be on its way in a hauler's arms).
    const none = short.every((i) => i.kind === fuel && haveOf(world, content, fuel) < i.count);
    if (none) missing ??= fuel;
  }
  return missing ? { missing } : {};
}

/** The waiting alert is said once per missing input and cleared when nothing is missing; not said
 * while charcoal is on its way (a lit clamp, or someone burning it). */
function alert(ctx: SystemContext, smelter: EntityRow, missing: string | undefined): void {
  const { world } = ctx;
  if (!missing) {
    Object.assign(smelter, { alert: 0, waitFor: '' });
    return;
  }
  const coming =
    stationOf(world, 'clamp')?.['state'] === 'lit' ||
    people(world).some((q) => q['job'] === 'charcoal');
  if (coming || smelter['waitFor'] === missing) return;
  smelter['waitFor'] = missing;
  smelter['alert'] = ctx.emit('metal.waiting', {
    causes: [smelter['line'] as number],
    data: { where: `at ${smelter['x']}, ${smelter['y']}`, good: nameOf(ctx, missing) },
  });
}

/** Takes up smelting if a wanted recipe's inputs can be reached and nobody free who puts it higher
 * could. */
export function takeUpSmelting(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const def = content.metal.smelter;
  const smelter = stationOf(world, 'smelter');
  if (!smelter || smelter['state'] !== 'built') return false;
  if (!able(content, p, def.job)) {
    declineIfUnable(ctx, p, def.job);
    return false;
  }
  if (people(world).some((q) => q.id !== p.id && q['job'] === 'smelt')) return false;
  if (outranked(ctx, p, def.job, (q) => !!choose(ctx, q).recipe)) return false;
  const got = choose(ctx, p);
  alert(ctx, smelter, got.recipe ? undefined : got.missing);
  const r = got.recipe;
  if (!r) return false;
  const by = wantedBy(world, content, r.id);
  p['took'] = ctx.emit('work.tookUpSmelting', {
    causes: [by?.line ?? 0, priorityLine(world, p.id, def.job)].filter((l): l is number => !!l),
    actors: [p.id],
    data: {
      name: p['name'] as string,
      what: `${r.alloy ? 'mixing' : 'smelting'} ${nameOf(ctx, r.makes)}`,
      why: `${by?.name ?? 'ingots'} are wanted`,
    },
  });
  const level = skillOf(world, p, skillName(ctx));
  Object.assign(p, {
    ...{ job: 'smelt', plan: smelter.id, target: -1, make: r.id },
    work: Math.ceil((r.minutes * 2 * def.skilled) / (def.skilled + level)),
  });
  return smelting(ctx, p);
}

/** One minute of smelting; false when it is done, or cannot be done (what is held goes back). */
export function smelting(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const smelter = stationOf(world, 'smelter');
  const r = content.metal.recipes.find((x) => x.id === p['make']);
  if (!smelter || smelter.id !== p['plan'] || !r) return stop(p);
  for (const input of r.inputs) {
    const got = fetchKind(ctx, p, input.kind, input.count);
    if (got === 'none') return stop(p);
    if (got === 'walking') return true;
  }
  const [x, y] = [smelter['x'] as number, smelter['y'] as number];
  const here = spotOf(p);
  if (!(here.z === 0 && Math.abs(here.x - x) + Math.abs(here.y - y) === 1))
    return goBeside(ctx, p, x, y) || stop(p);
  p['work'] = (p['work'] as number) - 1;
  practise(ctx, p, skillName(ctx), p['took'] as number);
  if ((p['work'] as number) > 0) return true;
  const trails: Step[][] = [];
  for (const input of r.inputs)
    for (const used of useHeld(ctx, p, input.kind, input.count))
      trails.push(content.items.some((i) => i.ore === input.kind) ? oreTrail(used) : trailOf(used));
  const most = content.metal.trail.most;
  const step: Step = {
    ...{ s: r.alloy ? 'mixed' : 'smelted', who: p['name'] as string, tick: world.tick },
    ...{ ...here, n: r.out, k: r.makes },
  };
  const trail = trailText(withStep(mergeTrails(trails, most), step, most));
  const line = ctx.emit(r.alloy ? 'metal.mixed' : 'metal.smelted', {
    causes: [p['took'] as number],
    actors: [p.id],
    data: {
      name: p['name'] as string,
      count: r.out,
      what: nameOf(ctx, r.makes),
      where: `at ${x}, ${y}`,
    },
  });
  layAround(ctx, r.makes, r.out, here, line, trail);
  stop(p);
  return true;
}
