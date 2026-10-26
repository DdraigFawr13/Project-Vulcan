// Beekeeping (P5.13, V-135, V-015): nobody is told to keep bees. A free person by their own
// priority order (the Beekeeping row, after Candlemaking) takes up, in this order, a skep still to
// be made, the honey of a skep with bees in the harvest month, and in a swarm month the looking
// over of an empty skep (once a day each, a swarm caught by chance: no line for a visit that
// finds nothing). Work is done from beside the skep. The skeps and their lines are src/engine/bees.
import type { EntityRow } from '../core/index.ts';
import { entityOf } from '../entity/index.ts';
import {
  dayNow,
  harvestNow,
  honeyTaken,
  skepMade,
  skepNow,
  skepsOf,
  skepTended,
  swarmNow,
  yearNow,
} from '../bees/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { practise } from './learn.ts';
import { able, outranked, priorityLine } from './priority.ts';
import { busy, canStandBeside, goBeside, layAll, spotOf } from './spots.ts';
import { scaled } from './tools.ts';

type Task = 'make' | 'harvest' | 'tend';

/** Whether skep `s` is wanted for `task` today. */
function wanted(ctx: SystemContext, s: EntityRow, task: string): boolean {
  const { world, content } = ctx;
  if (task === 'make') return s['state'] === 'plan' && skepNow(world, content);
  if (task === 'harvest')
    return (
      s['state'] === 'bees' &&
      harvestNow(world, content) &&
      s['harvested'] !== yearNow(world, content)
    );
  return (
    s['state'] === 'empty' && swarmNow(world, content) && (s['visited'] as number) < dayNow(world)
  );
}

/** The skep `p` would work now and the work: making before honey before looking for a swarm,
 * the nearest first, none that someone else is on, and one they can get beside. */
function chooseSkep(ctx: SystemContext, p: EntityRow): { skep: EntityRow; task: Task } | undefined {
  const { world } = ctx;
  const taken = busy(world, p, 'beekeep');
  const here = spotOf(p);
  const near = (s: EntityRow) =>
    Math.abs((s['x'] as number) - here.x) + Math.abs((s['y'] as number) - here.y);
  for (const task of ['make', 'harvest', 'tend'] as const) {
    const skep = skepsOf(world)
      .filter((s) => wanted(ctx, s, task) && !taken.has(s.id))
      .sort((a, b) => near(a) - near(b) || a.id - b.id)
      .find((s) => canStandBeside(ctx, p, s['x'] as number, s['y'] as number));
    if (skep) return { skep, task };
  }
  return undefined;
}

const skillOf = (ctx: SystemContext): string =>
  ctx.content.jobs.find((j) => j.id === ctx.content.lamp.bees.job)?.skill ?? '';

/** Takes up the beekeeping there is, if they are able and nobody free puts it higher. */
export function takeUpBeekeeping(ctx: SystemContext, p: EntityRow): boolean {
  const { content } = ctx;
  const bees = content.lamp.bees;
  if (!able(content, p, bees.job)) return false;
  if (outranked(ctx, p, bees.job, (q) => chooseSkep(ctx, q) !== undefined)) return false;
  const pick = chooseSkep(ctx, p);
  if (!pick || !goBeside(ctx, p, pick.skep['x'] as number, pick.skep['y'] as number)) return false;
  const { skep, task } = pick;
  // Looking over a skep is not a line; making one or taking honey is taken up with one.
  p['took'] =
    task === 'tend'
      ? (skep['line'] as number)
      : ctx.emit('work.tookUpBees', {
          causes: [
            skep['line'] as number,
            ...[priorityLine(ctx.world, p.id, bees.job)].filter(
              (l): l is number => l !== undefined,
            ),
          ],
          actors: [p.id],
          data: {
            name: p['name'] as string,
            what: task === 'make' ? 'making a skep' : 'taking honey and wax',
            field: 'field',
          },
        });
  const minutes =
    task === 'make' ? bees.skep.minutes : task === 'harvest' ? bees.harvest.minutes : 1;
  Object.assign(p, {
    job: bees.job,
    target: skep.id,
    task,
    work: scaled(ctx, p, bees.job, minutes),
  });
  return true;
}

/** Ends the beekeeping job. */
function stop(p: EntityRow): false {
  Object.assign(p, { job: '', task: '', target: -1, work: 0 });
  return false;
}

/** One minute of beekeeping: walk beside the skep, work, and when the work is done change the
 * skep (bees/tend.ts) and lay the honey and wax around it. False when the skep is no longer
 * wanted for this work or cannot be reached (they look for work again). */
export function beekeeping(ctx: SystemContext, p: EntityRow): boolean {
  const skep = entityOf(ctx.world, 'skep', p['target'] as number);
  const task = p['task'] as string;
  if (!skep || !wanted(ctx, skep, task)) return stop(p);
  const [x, y] = [skep['x'] as number, skep['y'] as number];
  const here = spotOf(p);
  if (here.z !== 0 || Math.abs(here.x - x) + Math.abs(here.y - y) !== 1)
    return goBeside(ctx, p, x, y) || stop(p);
  if (task !== 'tend') {
    p['work'] = (p['work'] as number) - 1;
    practise(ctx, p, skillOf(ctx), p['took'] as number);
    if ((p['work'] as number) > 0) return true;
  }
  if (task === 'make') skepMade(ctx, skep, p);
  else if (task === 'tend') skepTended(ctx, skep, p);
  else {
    const got = honeyTaken(ctx, skep, p);
    const { honey, wax } = ctx.content.lamp.bees.harvest;
    const at = { x, y, z: 0 };
    layAll(ctx, 'honey', honey, at, got.line);
    layAll(ctx, 'wax', wax, at, got.line);
  }
  stop(p);
  return true;
}
