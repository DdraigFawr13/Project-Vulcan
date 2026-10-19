// Charcoal burning (Phase 4 Bundle 3, V-041): the Charcoal row of the Work sheet, woodcutting's
// skill. While the charcoal the colony holds, plus what a lit clamp will give, is under what the
// planned smelting needs (goods `charcoalNeeded`), a free able person fetches `clamp.logs` logs,
// stacks them on the clamp's spot (`clamp.build` minutes), and lights it (`metal.clampLit`). It
// burns `clamp.burn` minutes untended. Then anyone with the job opens it (`clamp.open` minutes)
// and lays `clamp.yield` charcoal for haulers (`metal.charcoalMade`, citing the lighting). Taking
// up and each step are lines; trips are not. One clamp, one burner at a time.
import type { EntityRow } from '../core/index.ts';
import { stationOf } from '../build/index.ts';
import { charcoalNeeded, haveOf, trailText, withStep, type Step } from '../goods/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { fetchKind, reachableOf, useHeld } from './fetch.ts';
import { practise } from './learn.ts';
import { able, declineIfUnable, outranked, priorityLine } from './priority.ts';
import { goBeside, layAround, people, skillOf, spotOf } from './spots.ts';

const LOGS = 'logs';

const stop = (p: EntityRow): false => {
  Object.assign(p, { job: '', plan: 0, target: -1, work: 0, make: '' });
  return false;
};

const skillName = (ctx: SystemContext): string =>
  ctx.content.jobs.find((j) => j.id === ctx.content.metal.clamp.job)?.skill ?? '';

/** What `p` would do at the clamp: open it once it has burned down, else stack and light it while
 * charcoal is short and the logs can be reached. */
function choose(ctx: SystemContext, p: EntityRow): 'open' | 'stack' | undefined {
  const { world, content } = ctx;
  const def = content.metal.clamp;
  const clamp = stationOf(world, 'clamp');
  if (!clamp || !stationOf(world, 'smelter')) return undefined;
  if (people(world).some((q) => q.id !== p.id && q['job'] === 'charcoal')) return undefined;
  if (clamp['state'] === 'lit')
    return world.tick >= (clamp['lit'] as number) + def.burn ? 'open' : undefined;
  const have = haveOf(world, content, def.item);
  if (have >= charcoalNeeded(world, content)) return undefined;
  return reachableOf(ctx, p, LOGS) >= def.logs ? 'stack' : undefined;
}

/** Takes up the clamp if it is ready to open, or charcoal is short, and nobody free who puts it
 * higher could. */
export function takeUpCharcoal(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const def = content.metal.clamp;
  if (!able(content, p, def.job)) {
    declineIfUnable(ctx, p, def.job);
    return false;
  }
  if (outranked(ctx, p, def.job, (q) => choose(ctx, q) !== undefined)) return false;
  const task = choose(ctx, p);
  if (!task) return false;
  const clamp = stationOf(world, 'clamp')!;
  const have = haveOf(world, content, def.item);
  p['took'] = ctx.emit('work.tookUpCharcoal', {
    causes: [clamp['line'] as number, priorityLine(world, p.id, def.job)].filter(
      (l): l is number => !!l,
    ),
    actors: [p.id],
    data: {
      name: p['name'] as string,
      why:
        task === 'open'
          ? 'the clamp has burned down'
          : `the smelting needs ${charcoalNeeded(world, content)} charcoal and there is ${have}`,
    },
  });
  const level = skillOf(world, p, skillName(ctx));
  const minutes = task === 'open' ? def.open : def.build;
  Object.assign(p, {
    ...{ job: 'charcoal', plan: clamp.id, target: -1, make: task },
    work: Math.ceil((minutes * 2 * def.skilled) / (def.skilled + level)),
  });
  return burning(ctx, p);
}

/** One minute at the clamp; false when it is done, or cannot be done (anything held goes back). */
export function burning(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const def = content.metal.clamp;
  const clamp = stationOf(world, 'clamp');
  const task = p['make'];
  if (!clamp || clamp.id !== p['plan']) return stop(p);
  if (task === 'open' ? clamp['state'] !== 'lit' : clamp['state'] !== 'idle') return stop(p);
  if (task === 'stack') {
    const got = fetchKind(ctx, p, LOGS, def.logs);
    if (got === 'none') return stop(p);
    if (got === 'walking') return true;
  }
  const [x, y] = [clamp['x'] as number, clamp['y'] as number];
  const here = spotOf(p);
  if (!(here.z === 0 && Math.abs(here.x - x) + Math.abs(here.y - y) === 1))
    return goBeside(ctx, p, x, y) || stop(p);
  p['work'] = (p['work'] as number) - 1;
  practise(ctx, p, skillName(ctx), p['took'] as number);
  if ((p['work'] as number) > 0) return true;
  const where = `at ${x}, ${y}`;
  if (task === 'stack') {
    useHeld(ctx, p, LOGS, def.logs);
    clamp['state'] = 'lit';
    clamp['lit'] = world.tick;
    clamp['litLine'] = ctx.emit('metal.clampLit', {
      causes: [p['took'] as number, clamp['line'] as number],
      actors: [p.id],
      data: { name: p['name'] as string, logs: def.logs, where, hours: Math.round(def.burn / 60) },
    });
  } else {
    const line = ctx.emit('metal.charcoalMade', {
      causes: [clamp['litLine'] as number, p['took'] as number].filter((l) => l > 0),
      actors: [p.id],
      data: { name: p['name'] as string, count: def.yield, where },
    });
    const step: Step = { s: 'burned', who: p['name'] as string, tick: world.tick, ...here };
    step.n = def.yield;
    layAround(ctx, def.item, def.yield, here, line, trailText(withStep([], step)));
    Object.assign(clamp, { state: 'idle', lit: 0, litLine: 0 });
  }
  stop(p);
  return true;
}
