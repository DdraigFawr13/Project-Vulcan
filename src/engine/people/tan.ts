// Tanning (Phase 5B Bundle 5, P5.5, V-134): the Tanner row of the Work sheet, crafting's skill.
// Once the tan pits stand, a free able person takes up the tanner's work while the tailor wants an
// outer layer or fewer than two leather or cured hides lie in store. In this order they (out) take
// out a hide whose days are done, which lays leather (`tan.tanned`, citing the laying in); (cure)
// cure a hide for a hide coat when fewer than two cured hides lie in store and two hides do
// (`tan.cured`); or (in) lay a hide in a free pit with a log of bark (`tan.laidIn`), ready after
// `tan.leather.days`. At most `pits.pits` hides lie in at once, each a row of table `pit`.
// Minutes are `minutes × 2 × skilled ÷ (skilled + level)`, as smelting's; the work is practised.
import type { EntityRow } from '../core/index.ts';
import { TICKS_PER_DAY } from '../core/index.ts';
import { leatherStored, livePits, storedOf, wantsOuter } from '../build/index.ts';
import { addEntity, removeEntity } from '../entity/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { fetchKind, reachableOf, useHeld } from './fetch.ts';
import { practise } from './learn.ts';
import { able, declineIfUnable, outranked, priorityLine } from './priority.ts';
import { canStandBeside, goBeside, layAll, people, skillOf, spotOf } from './spots.ts';

type Mode = 'out' | 'cure' | 'in';

const stop = (p: EntityRow): false => {
  Object.assign(p, { job: '', plan: 0, target: -1, work: 0, make: '' });
  return false;
};

const skillName = (ctx: SystemContext): string =>
  ctx.content.jobs.find((j) => j.id === ctx.content.clothes.tan.job)?.skill ?? '';

const pitRows = (ctx: SystemContext, station: EntityRow): EntityRow[] =>
  (ctx.world.entities['pit'] ?? []).filter((r) => r['station'] === station.id);

/** The pit holding the hide that has lain longest, once its days are done. */
const doneIn = (ctx: SystemContext, station: EntityRow): EntityRow | undefined =>
  pitRows(ctx, station)
    .filter((r) => (r['ready'] as number) <= ctx.world.tick)
    .sort((a, b) => (a['ready'] as number) - (b['ready'] as number) || a.id - b.id)[0];

/** The built tan pits `p` can stand beside. */
function pitsFor(ctx: SystemContext, p: EntityRow): EntityRow | undefined {
  const s = livePits(ctx.world);
  return s && s['state'] === 'built' && canStandBeside(ctx, p, s['x'] as number, s['y'] as number)
    ? s
    : undefined;
}

/** What `p` would do now, in the order of the module note, or undefined. */
function choose(ctx: SystemContext, p: EntityRow): Mode | undefined {
  const { world, content } = ctx;
  const s = pitsFor(ctx, p);
  if (!s) return undefined;
  if (doneIn(ctx, s)) return 'out';
  const tan = content.clothes.tan;
  if (!wantsOuter(world, content) && leatherStored(world, content) >= 2) return undefined;
  if (reachableOf(ctx, p, tan.hide) < 1) return undefined;
  if (storedOf(world, [tan.fur.makes]) < 2 && storedOf(world, [tan.hide]) >= 2) return 'cure';
  const room = pitRows(ctx, s).length < content.clothes.pits.pits;
  return room && reachableOf(ctx, p, tan.leather.bark) >= 1 ? 'in' : undefined;
}

/** Takes up tanning if there is a hide to lay in, cure or take out and nobody free who puts it
 * higher could. */
export function takeUpTanning(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const tan = content.clothes.tan;
  if (!livePits(world) || livePits(world)!['state'] !== 'built') return false;
  if (!able(content, p, tan.job)) {
    declineIfUnable(ctx, p, tan.job);
    return false;
  }
  if (people(world).some((q) => q.id !== p.id && q['job'] === 'tan')) return false;
  if (outranked(ctx, p, tan.job, (q) => !!choose(ctx, q))) return false;
  const mode = choose(ctx, p);
  if (!mode) return false;
  const s = livePits(world)!;
  const words: Record<Mode, [string, string]> = {
    out: ['taking leather from the tan pits', 'a hide has lain its days'],
    cure: ['curing hides', 'cured hides are short for a hide coat'],
    in: ['laying hides in the tan pits', 'leather is short'],
  };
  const [what, why] = words[mode];
  p['took'] = ctx.emit('work.tookUpTanning', {
    causes: [s['made'] as number, priorityLine(world, p.id, tan.job)].filter(
      (l): l is number => !!l,
    ),
    actors: [p.id],
    data: { name: p['name'] as string, what, why },
  });
  const minutes = { out: tan.leather.minutes, cure: tan.fur.minutes, in: tan.leather.minutes }[
    mode
  ];
  const level = skillOf(world, p, skillName(ctx));
  Object.assign(p, {
    ...{ job: 'tan', plan: s.id, target: -1, make: mode },
    work: Math.ceil((minutes * 2 * tan.skilled) / (tan.skilled + level)),
  });
  return tanning(ctx, p);
}

/** One minute of tanning; false when it is done, or cannot be done (what is held goes back). */
export function tanning(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const tan = content.clothes.tan;
  const s = livePits(world);
  const mode = p['make'] as Mode;
  if (!s || s.id !== p['plan'] || s['state'] !== 'built') return stop(p);
  if (mode === 'out' && !doneIn(ctx, s)) return stop(p);
  if (mode === 'in' && pitRows(ctx, s).length >= content.clothes.pits.pits) return stop(p);
  const needs = mode === 'in' ? [tan.hide, tan.leather.bark] : mode === 'cure' ? [tan.hide] : [];
  for (const kind of needs) {
    const got = fetchKind(ctx, p, kind, 1);
    if (got === 'none') return stop(p);
    if (got === 'walking') return true;
  }
  const [x, y] = [s['x'] as number, s['y'] as number];
  const here = spotOf(p);
  if (!(here.z === 0 && Math.abs(here.x - x) + Math.abs(here.y - y) === 1))
    return goBeside(ctx, p, x, y) || stop(p);
  p['work'] = (p['work'] as number) - 1;
  practise(ctx, p, skillName(ctx), p['took'] as number);
  if ((p['work'] as number) > 0) return true;
  const where = `at ${x}, ${y}`;
  const base = { name: p['name'] as string, count: 1, where };
  if (mode === 'out') {
    const pit = doneIn(ctx, s)!;
    const line = ctx.emit('tan.tanned', {
      causes: [p['took'] as number, pit['line'] as number],
      actors: [p.id],
      data: base,
    });
    removeEntity(world, 'pit', pit.id);
    layAll(ctx, tan.leather.makes, 1, here, line);
  } else if (mode === 'cure') {
    useHeld(ctx, p, tan.hide, 1);
    const line = ctx.emit('tan.cured', {
      causes: [p['took'] as number],
      actors: [p.id],
      data: base,
    });
    layAll(ctx, tan.fur.makes, 1, here, line);
  } else {
    useHeld(ctx, p, tan.hide, 1);
    useHeld(ctx, p, tan.leather.bark, 1);
    const line = ctx.emit('tan.laidIn', {
      causes: [p['took'] as number],
      actors: [p.id],
      data: base,
    });
    addEntity(world, 'pit', {
      ...{ station: s.id, laid: world.tick, line },
      ready: world.tick + tan.leather.days * TICKS_PER_DAY,
    });
  }
  stop(p);
  return true;
}
